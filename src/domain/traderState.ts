/**
 * Base class for managing trader state (positions and account metrics).
 *
 * Maintains an in-memory representation of positions that can be updated via:
 * - Full snapshots from Hyperliquid clearinghouse state
 * - Incremental updates from WebSocket fill events
 *
 * Position size is tracked with signed values (positive = long, negative = short).
 */

import type { ClearinghouseStateResponse } from "@nktkas/hyperliquid/api/info";
import type { UserFillsEvent } from "@nktkas/hyperliquid/api/subscription";
import { logger, type Logger } from "../utils/logger.js";
import { clamp, round, safeDivide, toFloat } from "../utils/math.js";
import type { AccountMetrics, PositionSnapshot } from "./types.js";

/**
 * Fill data structure from Hyperliquid WebSocket events.
 */
interface Fill {
  /** Trading pair */
  coin: string;
  /** Fill price */
  px: string;
  /** Fill size (always positive) */
  sz: string;
  /** Side: "B" for buy, "A" for ask/sell */
  side: "B" | "A";
  /** Position size before this fill */
  startPosition: string;
  /** Timestamp in milliseconds */
  time: number;
}

/** Minimum position size to consider non-zero (prevents floating point dust) */
const EPSILON = 1e-9;

/**
 * Manages trader state with support for both full snapshots and incremental updates.
 */
export class TraderStateStore {
  private readonly positions = new Map<string, PositionSnapshot>();
  private metrics: AccountMetrics = {
    accountValueUsd: 0,
    totalNotionalUsd: 0,
    totalMarginUsedUsd: 0,
    withdrawableUsd: 0,
    lastUpdatedMs: 0,
  };

  /**
   * @param name - Human-readable name for logging (e.g., "leader", "follower")
   * @param log - Logger instance
   */
  constructor(private readonly name: string, private readonly log: Logger = logger) {}

  /**
   * Returns a read-only view of current positions.
   */
  getPositions(): ReadonlyMap<string, PositionSnapshot> {
    return this.positions;
  }

  /**
   * Returns current account-level metrics.
   */
  getMetrics(): AccountMetrics {
    return this.metrics;
  }

  /**
   * Processes a batch of fills from a WebSocket event, updating positions incrementally.
   * @param event - User fills event from Hyperliquid WebSocket
   */
  handleFillEvent(event: UserFillsEvent) {
    for (const fill of event.fills) {
      this.applyFill(fill as Fill);
    }
  }

  /**
   * Applies a full clearinghouse state snapshot, replacing all positions and metrics.
   * This is the authoritative source of truth for position state.
   * @param state - Complete clearinghouse state from Hyperliquid Info API
   */
  applyClearinghouseState(state: ClearinghouseStateResponse) {
    const now = Date.now();

    // Update account-level metrics
    this.metrics = {
      accountValueUsd: toFloat(state.marginSummary.accountValue),
      totalNotionalUsd: toFloat(state.marginSummary.totalNtlPos),
      totalMarginUsedUsd: toFloat(state.marginSummary.totalMarginUsed),
      withdrawableUsd: toFloat(state.withdrawable),
      lastUpdatedMs: now,
    };

    // Rebuild position map from snapshot
    this.positions.clear();
    for (const entry of state.assetPositions) {
      // Only handle one-way positions (not hedged mode)
      if (entry.type !== "oneWay") {
        continue;
      }
      const position = entry.position;
      const size = toFloat(position.szi);

      // Skip closed positions (size is effectively zero)
      if (Math.abs(size) < EPSILON) {
        continue;
      }

      const snapshot: PositionSnapshot = {
        coin: position.coin,
        size,
        entryPrice: toFloat(position.entryPx),
        positionValueUsd: toFloat(position.positionValue),
        leverage: Number(position.leverage.value ?? 0),
        marginUsedUsd: toFloat(position.marginUsed),
        liquidationPrice: position.liquidationPx ? toFloat(position.liquidationPx) : null,
        lastUpdatedMs: now,
      };

      this.positions.set(position.coin, snapshot);
    }
  }

  /**
   * Manually updates or removes a position.
   * @param coin - Trading pair identifier
   * @param snapshot - New position snapshot, or null to remove
   */
  upsertPosition(coin: string, snapshot: PositionSnapshot | null) {
    if (!snapshot || Math.abs(snapshot.size) < EPSILON) {
      this.positions.delete(coin);
      return;
    }
    this.positions.set(coin, snapshot);
  }

  /**
   * Applies a single fill to the position state, updating size and entry price.
   * Handles:
   * - Opening new positions
   * - Adding to existing positions
   * - Reducing positions
   * - Closing positions
   * - Flipping position direction (e.g., long to short)
   *
   * @param fill - Fill data from WebSocket event
   */
  private applyFill(fill: Fill) {
    const existing = this.positions.get(fill.coin);
    const oldSize = existing?.size ?? toFloat(fill.startPosition);
    const fillSize = toFloat(fill.sz);

    // Convert fill to signed size: positive for buy, negative for sell
    const signedFillSize = fill.side === "B" ? fillSize : -fillSize;
    const newSize = round(oldSize + signedFillSize, 9);

    // Position fully closed, remove it
    if (Math.abs(newSize) < EPSILON) {
      this.positions.delete(fill.coin);
      return;
    }

    const fillPrice = toFloat(fill.px);
    const now = fill.time ?? Date.now();

    let newEntryPrice = fillPrice;
    let marginUsedUsd = existing?.marginUsedUsd ?? 0;
    let leverage = existing?.leverage ?? 0;

    if (!existing) {
      // Opening a new position
      newEntryPrice = fillPrice;
      marginUsedUsd = Math.abs(newSize) * fillPrice;
      leverage = 0;
    } else {
      // Updating existing position
      const sameDirection = Math.sign(oldSize) === Math.sign(newSize);
      const oldNotional = Math.abs(oldSize) * existing.entryPrice;
      const fillNotional = Math.abs(signedFillSize) * fillPrice;

      if (sameDirection || Math.sign(oldSize) === 0) {
        // Adding to position: compute weighted average entry price
        newEntryPrice = safeDivide(oldNotional + fillNotional, Math.abs(newSize), fillPrice);
      } else {
        // Reducing or flipping position
        const closingSize = clamp(Math.abs(oldSize), 0, Math.abs(fillSize));
        const remainingFill = Math.abs(fillSize) - closingSize;
        if (remainingFill > EPSILON) {
          // Position flipped direction; new entry is the fill price
          newEntryPrice = fillPrice;
        } else {
          // Pure reduction: keep existing entry price
          newEntryPrice = existing.entryPrice;
        }
      }
      marginUsedUsd = Math.abs(newSize) * fillPrice;
    }

    const snapshot: PositionSnapshot = {
      coin: fill.coin,
      size: newSize,
      entryPrice: newEntryPrice,
      positionValueUsd: Math.abs(newSize) * fillPrice,
      leverage,
      marginUsedUsd,
      liquidationPrice: existing?.liquidationPrice ?? null,
      lastUpdatedMs: now,
    };

    this.positions.set(fill.coin, snapshot);
    this.log.debug(`${this.name} position updated via fill`, {
      coin: snapshot.coin,
      size: snapshot.size,
      entry: snapshot.entryPrice,
    });
  }
}
