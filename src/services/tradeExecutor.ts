/**
 * Trade execution service for synchronizing follower positions with leader.
 *
 * Core responsibilities:
 * - Compute target positions from leader state
 * - Calculate position deltas with risk limits applied
 * - Build and submit orders to Hyperliquid exchange
 *
 * Orders are constructed as IOC (Immediate-Or-Cancel) limit orders with slippage allowance.
 */

import type * as hl from "@nktkas/hyperliquid";
import { randomUUID } from "node:crypto";
import type { RiskConfig } from "../config/index.js";
import { logger, type Logger } from "../utils/logger.js";
import { clamp } from "../utils/math.js";
import { LeaderState } from "../domain/leaderState.js";
import { FollowerState, type PositionDelta } from "../domain/followerState.js";
import { MarketMetadataService } from "./marketMetadata.js";

/** Minimum absolute position delta to trigger an order (prevents dust trades) */
const MIN_ABS_DELTA = 1e-6;

/**
 * Dependencies for TradeExecutor.
 */
interface TradeExecutorDeps {
  /** Hyperliquid exchange client for placing orders */
  exchangeClient: hl.ExchangeClient;
  /** Leader state store */
  leaderState: LeaderState;
  /** Follower state store */
  followerState: FollowerState;
  /** Market metadata service for asset details and mark prices */
  metadataService: MarketMetadataService;
  /** Risk configuration */
  risk: RiskConfig;
  /** Optional logger instance */
  log?: Logger;
}

/**
 * Manages trade execution to synchronize follower positions with leader.
 */
export class TradeExecutor {
  private syncing = false;
  private readonly log: Logger;

  constructor(private readonly deps: TradeExecutorDeps) {
    this.log = deps.log ?? logger;
  }

  /**
   * Synchronizes follower positions with leader by computing deltas and placing orders.
   *
   * Process:
   * 1. Refresh market metadata and mark prices
   * 2. Compute target positions from leader state (scaled by copyRatio)
   * 3. Compute deltas between follower current and target (with risk limits)
   * 4. Build and submit IOC limit orders for non-zero deltas
   *
   * Prevents concurrent syncs by using a `syncing` flag.
   */
  async syncWithLeader() {
    if (this.syncing) {
      this.log.debug("Trade sync already in progress");
      return;
    }
    this.syncing = true;
    try {
      // Ensure market metadata is loaded and mark prices are current
      await this.deps.metadataService.ensureLoaded();
      await this.deps.metadataService.refreshMarkPrices();

      // Compute what positions the follower should have (scaled from leader)
      const targets = this.deps.leaderState.computeTargets(this.deps.risk);

      // Compute deltas between current and target positions
      const deltas = this.deps.followerState.computeDeltas(targets, this.deps.risk);

      // Filter out dust deltas that are too small to trade
      const actionable = deltas.filter((delta) => Math.abs(delta.deltaSize) > MIN_ABS_DELTA);

      if (actionable.length === 0) {
        this.log.debug("Follower already synchronized with leader");
        return;
      }

      // Build orders for each actionable delta
      const orders = actionable.map((delta) => this.buildOrder(delta));
      this.log.info("Submitting follower sync orders", {
        orders: orders.length,
        coins: orders.map((o) => o.a),
      });

      // Submit all orders as a batch (no grouping)
      await this.deps.exchangeClient.order({
        orders,
        grouping: "na",
      });
    } catch (error) {
      this.log.error("Failed to synchronize follower with leader", { error });
      throw error;
    } finally {
      this.syncing = false;
    }
  }

  /**
   * Builds a Hyperliquid order from a position delta.
   *
   * Order characteristics:
   * - Type: IOC (Immediate-Or-Cancel) limit order
   * - Price: Mark price adjusted for slippage (higher for buys, lower for sells)
   * - Size: Absolute value of delta size, rounded to asset's size decimals
   * - Reduce-only: Set when closing or reducing a position
   *
   * @param delta - Position delta to execute
   * @returns Hyperliquid order object
   */
  private buildOrder(delta: PositionDelta) {
    const { risk, metadataService } = this.deps;
    const metadata = metadataService.requireByCoin(delta.coin);

    // Use mark price, fallback to current entry price, then 0
    const markPrice = metadataService.getMarkPrice(delta.coin) ?? delta.current?.entryPrice ?? 0;

    const sideIsBuy = delta.deltaSize > 0;

    // Convert slippage from basis points to decimal (e.g., 25 bps = 0.0025)
    const slippage = risk.maxSlippageBps / 10_000;

    // Adjust price for slippage: higher for buys (worse fill), lower for sells
    const priceMultiplier = sideIsBuy ? 1 + slippage : 1 - slippage;

    // Clamp price to reasonable bounds (10% to 1000% of mark price)
    const price = clamp(markPrice * priceMultiplier, markPrice * 0.1, markPrice * 10);

    const size = Math.abs(delta.deltaSize);

    // Determine if this order should be reduce-only
    const reduceOnly = (() => {
      if (!delta.current) {
        // Opening a new position, not reduce-only
        return false;
      }
      const currentSize = delta.current.size;
      const targetSize = delta.targetSize;

      // If target is zero (or dust), we're closing the position
      if (Math.abs(targetSize) < MIN_ABS_DELTA) {
        return true;
      }

      // If position direction stays the same but size decreases, it's a reduction
      const sameDirection = Math.sign(currentSize) === Math.sign(targetSize);
      return sameDirection && Math.abs(targetSize) < Math.abs(currentSize);
    })();

    // Build Hyperliquid order object
    return {
      a: metadata.assetId, // asset
      b: sideIsBuy, // is buy
      p: price.toString(), // price
      s: size.toFixed(metadata.sizeDecimals), // size
      r: reduceOnly, // reduce-only flag
      t: {
        limit: {
          tif: "Ioc" as const, // Immediate-Or-Cancel
        },
      },
      c: `0x${randomUUID().replace(/-/g, "").slice(0, 32)}`, // client order ID
    };
  }
}
