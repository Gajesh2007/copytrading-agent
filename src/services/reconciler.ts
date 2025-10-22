/**
 * Reconciliation service for periodically syncing state from Hyperliquid API.
 *
 * Fetches full account snapshots for both leader and follower to ensure
 * in-memory state matches the exchange. This provides a fallback in case
 * WebSocket events are missed or state drifts.
 *
 * Runs on a configurable interval (default: 60 seconds).
 */

import type * as hl from "@nktkas/hyperliquid";
import type { CopyTradingConfig } from "../config/index.js";
import { logger, type Logger } from "../utils/logger.js";
import { LeaderState } from "../domain/leaderState.js";
import { FollowerState } from "../domain/followerState.js";

/**
 * Manages periodic reconciliation of leader and follower states.
 */
export class Reconciler {
  private intervalHandle: NodeJS.Timeout | null = null;

  constructor(
    private readonly infoClient: hl.InfoClient,
    private readonly config: CopyTradingConfig,
    private readonly leaderState: LeaderState,
    private readonly followerState: FollowerState,
    private readonly followerAddress: `0x${string}`,
    private readonly log: Logger = logger,
  ) {}

  /**
   * Performs a single reconciliation by fetching full clearinghouse state
   * for both leader and follower from the API.
   *
   * Fetches happen in parallel for efficiency.
   */
  async reconcileOnce() {
    const [leader, follower] = await Promise.all([
      this.infoClient.clearinghouseState({ user: this.config.leaderAddress as `0x${string}` }),
      this.infoClient.clearinghouseState({ user: this.followerAddress }),
    ]);

    this.leaderState.applyClearinghouseState(leader);
    this.followerState.applyClearinghouseState(follower);
    this.log.debug("Reconciled leader/follower states");
  }

  /**
   * Starts the periodic reconciliation loop.
   * No-op if already running.
   */
  start() {
    if (this.intervalHandle) {
      return;
    }

    this.log.info("Starting reconciler loop", {
      intervalMs: this.config.reconciliationIntervalMs,
    });

    const tick = async () => {
      try {
        await this.reconcileOnce();
      } catch (error) {
        this.log.error("Reconciliation loop error", { error });
      }
    };

    // Run immediately on start
    void tick();
    // Schedule periodic ticks
    this.intervalHandle = setInterval(tick, this.config.reconciliationIntervalMs);
  }

  /**
   * Stops the periodic reconciliation loop.
   * No-op if not running.
   */
  stop() {
    if (!this.intervalHandle) {
      return;
    }
    clearInterval(this.intervalHandle);
    this.intervalHandle = null;
  }
}
