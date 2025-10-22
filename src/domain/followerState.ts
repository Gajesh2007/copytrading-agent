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
   * Computes position deltas by comparing current follower positions to target positions.
   *
   * Applies risk limits:
   * - maxLeverage: limits notional based on follower's account value
   * - maxNotionalUsd: hard cap on position size
   *
   * Also generates close deltas for positions the follower holds but the leader does not.
   *
   * @param targets - Target positions from leader state
   * @param risk - Risk configuration
   * @returns Array of position deltas to execute
   */
  computeDeltas(targets: TargetPosition[], risk: RiskConfig): PositionDelta[] {
    const deltas: PositionDelta[] = [];
    const followerMetrics = this.getMetrics();
    const equity = followerMetrics.accountValueUsd;

    // Apply leverage cap: max notional = max leverage * account value
    const leverageCapNotional = risk.maxLeverage * equity;
    const globalNotionalCap = Math.min(risk.maxNotionalUsd, leverageCapNotional);

    const targetCoins = new Set<string>();

    // Compute deltas for each target position
    for (const target of targets) {
      const current = this.getPositions().get(target.coin);
      targetCoins.add(target.coin);

      const price = target.impliedEntryPrice;
      // Limit notional to the minimum of target notional and global cap
      const allowedNotional = Math.min(target.notionalUsd, globalNotionalCap);
      const allowedSize = Math.sign(target.size) * safeDivide(allowedNotional, price, 0);
      const deltaSize = allowedSize - (current?.size ?? 0);

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
