/**
 * Configuration module for the copy trading agent.
 * Loads and validates environment variables with sensible defaults.
 */

import { toFloat } from "../utils/math.js";

/** Hyperliquid network environment */
export type HyperliquidEnvironment = "mainnet" | "testnet";

/**
 * Risk management parameters for copy trading.
 */
export interface RiskConfig {
  /** 
   * Leverage multiplier when copying positions.
   * - 1.0 = mirror leader's exact leverage ratio
   * - 0.5 = use half the leader's leverage
   * - 2.0 = use 2x the leader's leverage
   * 
   * Example: If leader uses 5x leverage and copyRatio=0.5, follower uses 2.5x leverage.
   * This scales positions proportionally to follower's account size.
   */
  copyRatio: number;
  /** Maximum leverage allowed for follower positions (hard cap) */
  maxLeverage: number;
  /** Maximum notional USD value for any single follower position (hard cap) */
  maxNotionalUsd: number;
  /** Maximum slippage in basis points (e.g., 25 = 0.25%) */
  maxSlippageBps: number;
  /** When true, invert leader direction (long->short, short->long) */
  inverse: boolean;
}

/**
 * Complete configuration for the copy trading agent.
 */
export interface CopyTradingConfig {
  /** Hyperliquid network to connect to */
  environment: HyperliquidEnvironment;
  /** Ethereum address of the leader account to copy */
  leaderAddress: string;
  /** Private key of the follower account (hex format with 0x prefix) */
  followerPrivateKey: `0x${string}`;
  /** Optional vault address if trading through a Hyperliquid vault */
  followerVaultAddress?: `0x${string}`;
  /** Risk management parameters */
  risk: RiskConfig;
  /** Interval in milliseconds for periodic full state reconciliation */
  reconciliationIntervalMs: number;
  /** Interval in milliseconds for refreshing follower account state */
  refreshAccountIntervalMs: number;
  /** Whether to aggregate fills by time in WebSocket subscriptions */
  websocketAggregateFills: boolean;
}

/**
 * Requires an environment variable to be set, throws if missing.
 * @param key - Environment variable name
 * @returns The environment variable value
 * @throws {Error} If the environment variable is not set
 */
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Parses an optional numeric environment variable with a fallback.
 * @param key - Environment variable name
 * @param fallback - Default value if not set
 * @returns The parsed number or fallback
 * @throws {Error} If the value is set but not a valid number
 */
function optionalNumberEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) {
    return fallback;
  }
  const parsed = toFloat(raw);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid numeric value for ${key}: ${raw}`);
  }
  return parsed;
}

/**
 * Parses an optional boolean environment variable with a fallback.
 * Accepts: "1", "true", "yes", "on" (case-insensitive) for true.
 * @param key - Environment variable name
 * @param fallback - Default value if not set
 * @returns The parsed boolean or fallback
 */
function optionalBooleanEnv(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (!raw) {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

/**
 * Loads and validates configuration from environment variables.
 * @returns Complete validated configuration
 * @throws {Error} If required variables are missing or invalid
 */
export function loadConfig(): CopyTradingConfig {
  const environment =
    (process.env.HYPERLIQUID_ENVIRONMENT as HyperliquidEnvironment | undefined) ?? "mainnet";
  if (environment !== "mainnet" && environment !== "testnet") {
    throw new Error(`Unsupported Hyperliquid environment: ${environment}`);
  }

  const followerPrivateKey = requireEnv("FOLLOWER_PRIVATE_KEY") as `0x${string}`;
  const followerVaultAddress = process.env.FOLLOWER_VAULT_ADDRESS as `0x${string}` | undefined;
  if (followerVaultAddress && followerVaultAddress.length !== 42) {
    throw new Error("FOLLOWER_VAULT_ADDRESS must be a 42-character hex string");
  }

  return {
    environment,
    leaderAddress: requireEnv("LEADER_ADDRESS"),
    followerPrivateKey,
    ...(followerVaultAddress ? { followerVaultAddress } : {}),
    risk: {
      copyRatio: optionalNumberEnv("COPY_RATIO", 1),
      maxLeverage: optionalNumberEnv("MAX_LEVERAGE", 10),
      maxNotionalUsd: optionalNumberEnv("MAX_NOTIONAL_USD", 250_000),
      maxSlippageBps: optionalNumberEnv("MAX_SLIPPAGE_BPS", 25),
      inverse: optionalBooleanEnv("INVERSE", false),
    },
    reconciliationIntervalMs: optionalNumberEnv("RECONCILIATION_INTERVAL_MS", 60_000),
    refreshAccountIntervalMs: optionalNumberEnv("REFRESH_ACCOUNT_INTERVAL_MS", 5_000),
    websocketAggregateFills: optionalBooleanEnv("AGGREGATE_FILLS", true),
  };
}
