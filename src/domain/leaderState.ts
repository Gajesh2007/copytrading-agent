/**
 * Leader state management and target position computation.
 *
 * Extends TraderStateStore to track the leader's positions and compute
 * scaled target positions for the follower based on risk parameters.
 */

import type { RiskConfig } from "../config/index.js";
import { safeDivide } from "../utils/math.js";
import type { PositionSnapshot } from "./types.js";
import { TraderStateStore } from "./traderState.js";

/**
 * Represents a target position that the follower should replicate.
 */
export interface TargetPosition {
  /** Trading pair */
  coin: string;
  /** Target position size (already scaled by copyRatio) */
  size: number;
  /** Target notional value in USD */
  notionalUsd: number;
  /** Leader's entry price (used as reference for follower) */
  impliedEntryPrice: number;
  /** Leverage implied by this position relative to leader's account value */
  impliedLeverage: number;
}

/**
 * Manages leader account state and computes target positions for the follower.
 */
export class LeaderState extends TraderStateStore {
  constructor() {
    super("leader");
  }

  /**
   * Computes target positions for the follower by scaling leader positions.
   *
   * Each leader position is scaled by the copyRatio and annotated with
   * implied leverage relative to the leader's account value.
   *
   * @param risk - Risk configuration including copyRatio
   * @returns Array of target positions for the follower
   */
  computeTargets(risk: RiskConfig): TargetPosition[] {
    const metrics = this.getMetrics();
    return Array.from(this.getPositions().values()).map((position) => {
      const scaledSize = position.size * risk.copyRatio;
      const notionalUsd = Math.abs(scaledSize) * position.entryPrice;
      const impliedLeverage = safeDivide(notionalUsd, metrics.accountValueUsd, 0);
      return {
        coin: position.coin,
        size: scaledSize,
        notionalUsd,
        impliedEntryPrice: position.entryPrice,
        impliedLeverage,
      };
    });
  }

  /**
   * Gets a specific position by coin symbol.
   */
  getPosition(coin: string): PositionSnapshot | undefined {
    return this.getPositions().get(coin);
  }
}
