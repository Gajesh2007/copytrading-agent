/**
 * Domain types for trader state and position snapshots.
 */

/** Direction of a position */
export type PositionSide = "long" | "short" | "flat";

/**
 * Immutable snapshot of a position at a point in time.
 */
export interface PositionSnapshot {
  /** Trading pair identifier (e.g., "BTC", "ETH") */
  coin: string;
  /** Position size: positive for long, negative for short, 0 for flat */
  size: number;
  /** Average entry price for the position */
  entryPrice: number;
  /** Current position value in USD (abs(size) * markPrice) */
  positionValueUsd: number;
  /** Current leverage multiplier */
  leverage: number;
  /** Margin currently allocated to this position in USD */
  marginUsedUsd: number;
  /** Estimated liquidation price, null if not available */
  liquidationPrice?: number | null;
  /** Timestamp of last update in milliseconds */
  lastUpdatedMs: number;
}

/**
 * Account-level metrics for a trader.
 */
export interface AccountMetrics {
  /** Total account value (equity) in USD */
  accountValueUsd: number;
  /** Total notional position value in USD across all positions */
  totalNotionalUsd: number;
  /** Total margin currently in use across all positions */
  totalMarginUsedUsd: number;
  /** Amount available for withdrawal in USD */
  withdrawableUsd: number;
  /** Timestamp of last update in milliseconds */
  lastUpdatedMs: number;
}

/**
 * Complete state for a trader account.
 */
export interface TraderState {
  /** Map of coin symbol to position snapshot */
  positions: Map<string, PositionSnapshot>;
  /** Account-level metrics */
  metrics: AccountMetrics;
}
