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
/** Exchange minimum order notional (USD). Override with env MIN_ORDER_NOTIONAL_USD if needed. */
const MIN_ORDER_NOTIONAL_USD = Number(process.env.MIN_ORDER_NOTIONAL_USD ?? 10);

/**
 * Determines the number of decimal places in a number's string representation.
 * Used to match the price precision of the mark price.
 */
function getDecimalPlaces(value: number): number {
  const str = value.toString();
  const decimalIndex = str.indexOf(".");
  if (decimalIndex === -1) {
    return 0;
  }
  return str.length - decimalIndex - 1;
}

/**
 * Rounds a price to match the precision of a reference price (mark price).
 * This ensures orders comply with Hyperliquid's tick size requirements.
 */
function roundToMarkPricePrecision(price: number, markPrice: number): string {
  const decimals = getDecimalPlaces(markPrice);
  const rounded = Number(price.toFixed(decimals));
  
  // Format with fixed decimals and strip trailing zeros if any
  let result = rounded.toFixed(decimals);
  
  // Only strip trailing zeros after the decimal point, keep the number valid
  if (decimals > 0) {
    result = result.replace(/\.?0+$/, "");
  }
  
  // Ensure we have at least one digit
  return result || "0";
}

/**
 * Dependencies for TradeExecutor.
 */
interface TradeExecutorDeps {
  /** Hyperliquid exchange client for placing orders */
  exchangeClient: hl.ExchangeClient;
  /** Hyperliquid info client for fetching account state */
  infoClient: hl.InfoClient;
  /** Follower trading address */
  followerAddress: `0x${string}`;
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

      // CRITICAL: Fetch fresh follower state from exchange before calculating deltas
      // This prevents stale state causing "reduce only would increase position" errors
      const followerState = await this.deps.infoClient.clearinghouseState({
        user: this.deps.followerAddress,
      });
      this.deps.followerState.applyClearinghouseState(followerState);
      this.log.debug("Refreshed follower state before sync");

      // Compute leader's current leverage for each position
      const targets = this.deps.leaderState.computeTargets(this.deps.metadataService);
      
      if (targets.length > 0) {
        this.log.debug("Leader positions and leverage", {
          positions: targets.map((t) => ({
            coin: t.coin,
            leverage: t.leaderLeverage.toFixed(2) + "x",
            markPrice: t.markPrice,
          })),
        });
      }

      // Compute deltas between current and target positions (scales leverage by copyRatio)
      const deltas = this.deps.followerState.computeDeltas(targets, this.deps.risk);

      // Filter out dust deltas that are too small to trade
      const actionable = deltas.filter((delta) => Math.abs(delta.deltaSize) > MIN_ABS_DELTA);

      if (actionable.length === 0) {
        this.log.debug("Follower already synchronized with leader");
        return;
      }

      // Pre-filter tiny notionals to avoid minimum $10 exchange rejection
      const aboveMinNotional = actionable.filter((delta) => {
        const markPx = this.deps.metadataService.getMarkPrice(delta.coin) ?? delta.current?.entryPrice;
        if (!markPx || markPx <= 0) {
          this.log.debug(`Skipping ${delta.coin} due to missing/invalid mark price`);
          return false;
        }
        const notional = Math.abs(delta.deltaSize) * markPx;
        if (notional < MIN_ORDER_NOTIONAL_USD) {
          this.log.debug(`Skipping ${delta.coin} due to small notional`, { notional: notional.toFixed(4) });
          return false;
        }
        return true;
      });

      if (aboveMinNotional.length === 0) {
        this.log.debug("No deltas above minimum notional threshold");
        return;
      }

      // Build orders for each actionable delta
      const orders = aboveMinNotional
        .map((delta) => this.buildOrder(delta))
        // Filter out orders that round to zero size (too small to trade)
        .filter((order) => {
          const size = parseFloat(order.s);
          if (size === 0 || !isFinite(size)) {
            this.log.debug(`Skipping zero-size order for asset ${order.a}`);
            return false;
          }
          return true;
        });
      
      if (orders.length === 0) {
        this.log.debug("No valid orders to submit after filtering");
        return;
      }
      
      this.log.info("Submitting follower sync orders", {
        orders: orders.length,
        coins: orders.map((o) => o.a),
      });

      // Submit all orders as a batch (no grouping)
      try {
        const response = await this.deps.exchangeClient.order({
          orders,
          grouping: "na",
        });
        
        // Log successful fills and any errors
        const statuses = response.response.data.statuses;
        const filled = statuses.filter((s) => "filled" in s || "resting" in s);
        const errors = statuses.filter((s) => "error" in s);
        
        if (filled.length > 0) {
          this.log.info("Orders executed successfully", { count: filled.length });
        }
        if (errors.length > 0) {
          this.log.warn("Some orders failed", {
            errorCount: errors.length,
            errors: errors.map((e) => "error" in e ? e.error : "unknown"),
          });
        }
      } catch (error: unknown) {
        // Log the error but don't crash - margin errors are expected
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes("Insufficient margin")) {
          this.log.warn("Order sync partially failed due to insufficient margin", { error: errorMessage });
        } else {
          this.log.error("Failed to synchronize follower with leader", { error });
        }
      }
    } catch (error) {
      this.log.error("Trade sync error", { error });
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

    // Use mark price, fallback to current entry price
    const markPrice = metadataService.getMarkPrice(delta.coin) ?? delta.current?.entryPrice;

    if (!markPrice || markPrice <= 0) {
      throw new Error(`Cannot build order for ${delta.coin}: no valid mark price available`);
    }

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

    // Round price to match mark price precision (Hyperliquid's tick size)
    const priceStr = roundToMarkPricePrecision(price, markPrice);

    // Build Hyperliquid order object
    return {
      a: metadata.assetId, // asset
      b: sideIsBuy, // is buy
      p: priceStr, // price
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
