/**
 * Follower state management and position delta computation.
 *
 * Extends TraderStateStore to track the follower's positions and compute
 * the required order sizes to match target positions with risk limits applied.
 */

import type { RiskConfig } from "../config/index.js";
import { safeDivide } from "../utils/math.js";
import type { PositionSnapshot } from "./types.js";
import type { TargetPosition } from "./leaderState.js";
import { TraderStateStore } from "./traderState.js";
import { logger } from "../utils/logger.js";

/**
 * Represents the difference between current and target position for a coin.
 */
export interface PositionDelta {
  /** Trading pair */
  coin: string;
  /** Current follower position (undefined if no position exists) */
  current: PositionSnapshot | undefined;
  /** Target position size after applying risk limits */
  targetSize: number;
  /** Required change in position size (positive = buy, negative = sell) */
  deltaSize: number;
  /** Maximum allowed notional USD for this position */
  maxNotionalUsd: number;
}

/**
 * Manages follower account state and computes position deltas.
 */
export class FollowerState extends TraderStateStore {
  constructor() {
    super("follower");
  }

  /**
   * Gets a specific position by coin symbol.
   */
  getPosition(coin: string): PositionSnapshot | undefined {
    return this.getPositions().get(coin);
  }

  /**
   * Computes position deltas by mirroring leader's leverage scaled by copyRatio.
   *
   * Core logic:
   * 1. Calculate target leverage = leader's leverage × copyRatio
   * 2. Calculate target notional = target leverage × follower's equity
   * 3. Apply risk caps (maxLeverage, maxNotionalUsd)
   * 4. Convert notional to position size using mark price
   *
   * This ensures follower positions scale proportionally to follower's account size.
   *
   * @param targets - Target positions with leader's leverage
   * @param risk - Risk configuration including copyRatio
   * @returns Array of position deltas to execute
   */
  computeDeltas(targets: TargetPosition[], risk: RiskConfig): PositionDelta[] {
    const deltas: PositionDelta[] = [];
    const followerMetrics = this.getMetrics();
    const followerEquity = followerMetrics.accountValueUsd;

    const targetCoins = new Set<string>();

    // Compute deltas for each target position
    for (const target of targets) {
      const current = this.getPositions().get(target.coin);
      targetCoins.add(target.coin);

      // Scale leader's leverage by copyRatio
      const targetLeverage = target.leaderLeverage * risk.copyRatio;
      
      // Cap leverage to risk limits
      const cappedLeverage = Math.min(targetLeverage, risk.maxLeverage);
      
      // Calculate target notional based on follower's equity
      const targetNotional = cappedLeverage * followerEquity;
      
      // Apply hard notional cap
      const allowedNotional = Math.min(targetNotional, risk.maxNotionalUsd);
      
      // Convert notional to size using current mark price
      const price = target.markPrice;
      // Determine direction: mirror leader, or invert if configured
      const direction = Math.sign(target.leaderSize) * (risk.inverse ? -1 : 1);
      const allowedSize = direction * safeDivide(allowedNotional, price, 0);
      const deltaSize = allowedSize - (current?.size ?? 0);
      
      // Log detailed sizing calculation (debug for cleanliness)
      if (Math.abs(deltaSize) > 1e-6) {
        logger.debug(`Position sizing for ${target.coin}`, {
          leaderLeverage: target.leaderLeverage.toFixed(2) + "x",
          copyRatio: risk.copyRatio,
          inverse: !!risk.inverse,
          targetLeverage: targetLeverage.toFixed(2) + "x",
          cappedLeverage: cappedLeverage.toFixed(2) + "x",
          followerEquity: "$" + followerEquity.toFixed(2),
          allowedNotional: "$" + allowedNotional.toFixed(2),
          markPrice: price,
          targetSize: allowedSize.toFixed(4),
          currentSize: (current?.size ?? 0).toFixed(4),
          deltaSize: deltaSize.toFixed(4),
        });
      }

      deltas.push({
        coin: target.coin,
        current,
        targetSize: allowedSize,
        deltaSize,
        maxNotionalUsd: allowedNotional,
      });
    }

    // Generate close deltas for positions not in targets (follower has but leader doesn't)
    for (const [coin, position] of this.getPositions()) {
      if (targetCoins.has(coin)) {
        continue;
      }
      // Skip dust positions
      if (Math.abs(position.size) < 1e-9) {
        continue;
      }
      deltas.push({
        coin,
        current: position,
        targetSize: 0,
        deltaSize: -position.size,
        maxNotionalUsd: 0,
      });
    }

    return deltas;
  }
}
