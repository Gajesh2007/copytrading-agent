/**
 * WebSocket subscription service for real-time leader fill events.
 *
 * Subscribes to the leader's fill stream on Hyperliquid and:
 * - Updates leader state incrementally with each fill
 * - Triggers follower sync callback when fills occur
 *
 * This provides low-latency replication compared to polling.
 */

import type * as hl from "@nktkas/hyperliquid";
import type { CopyTradingConfig } from "../config/index.js";
import { logger, type Logger } from "../utils/logger.js";
import { LeaderState } from "../domain/leaderState.js";

/**
 * Handle for managing an active subscription.
 */
type SubscriptionHandle = {
  unsubscribe: () => Promise<void>;
};

/**
 * Manages WebSocket subscriptions to leader account events.
 */
export class SubscriptionService {
  private fillsSub: SubscriptionHandle | null = null;

  /**
   * @param subscriptionClient - Hyperliquid WebSocket subscription client
   * @param config - Copy trading configuration
   * @param leaderState - Leader state store to update
   * @param onLeaderFill - Optional callback to trigger on each fill event
   * @param log - Logger instance
   */
  constructor(
    private readonly subscriptionClient: hl.SubscriptionClient,
    private readonly config: CopyTradingConfig,
    private readonly leaderState: LeaderState,
    private readonly onLeaderFill?: () => void | Promise<void>,
    private readonly log: Logger = logger,
  ) {}

  /**
   * Starts WebSocket subscription to leader fills.
   * No-op if already subscribed.
   */
  async start() {
    if (this.fillsSub) {
      return;
    }

    this.log.info("Starting leader subscriptions", { leader: this.config.leaderAddress });

    // Subscribe to leader's fill events
    const subscription = await this.subscriptionClient.userFills(
      {
        user: this.config.leaderAddress as `0x${string}`,
        aggregateByTime: this.config.websocketAggregateFills,
      },
      (event) => {
        this.log.debug("Received leader fills event", { count: event.fills.length });

        // Update leader state incrementally
        this.leaderState.handleFillEvent(event);

        // Trigger sync callback (e.g., to execute follower orders)
        void this.onLeaderFill?.();
      },
    );

    this.fillsSub = {
      unsubscribe: () => subscription.unsubscribe(),
    };
  }

  /**
   * Stops WebSocket subscription to leader fills.
   * No-op if not subscribed.
   */
  async stop() {
    if (!this.fillsSub) {
      return;
    }
    this.log.info("Stopping leader subscriptions");
    await this.fillsSub.unsubscribe().catch((error) => {
      this.log.error("Failed to unsubscribe from fills", { error });
    });
    this.fillsSub = null;
  }
}
