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
import type { MarketMetadataService } from "../services/marketMetadata.js";

/**
 * Represents a target position that the follower should replicate.
 */
export interface TargetPosition {
  /** Trading pair */
  coin: string;
  /** Leader's position size (raw, not scaled) */
  leaderSize: number;
  /** Leader's leverage for this position (notional / leader's account value) */
  leaderLeverage: number;
  /** Current mark price for the asset */
  markPrice: number;
}

/**
 * Manages leader account state and computes target positions for the follower.
 */
export class LeaderState extends TraderStateStore {
  constructor() {
    super("leader");
  }

  /**
   * Computes target positions for the follower by analyzing leader's leverage.
   *
   * Instead of copying absolute position sizes, we copy the LEVERAGE RATIO.
   * This allows the follower to scale positions proportionally to their account size.
   *
   * Uses CURRENT MARK PRICE for leverage calculations, not entry price.
   * This ensures leverage is based on current market value.
   *
   * @param metadataService - Service providing current mark prices
   * @returns Array of target positions with leader's leverage info
   */
  computeTargets(metadataService: MarketMetadataService): TargetPosition[] {
    const metrics = this.getMetrics();
    const leaderEquity = metrics.accountValueUsd;
    
    return Array.from(this.getPositions().values()).map((position) => {
      // Use CURRENT mark price for leverage calculation
      const markPrice = metadataService.getMarkPrice(position.coin) ?? position.entryPrice;
      
      // Calculate leader's current leverage for this position
      const notionalUsd = Math.abs(position.size) * markPrice;
      const leaderLeverage = safeDivide(notionalUsd, leaderEquity, 0);
      
      return {
        coin: position.coin,
        leaderSize: position.size,
        leaderLeverage,
        markPrice,
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
