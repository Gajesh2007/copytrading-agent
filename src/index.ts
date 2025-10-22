#!/usr/bin/env node
/**
 * Hyperliquid Copy Trading Agent
 *
 * This agent automatically replicates trades from a leader account to a follower account
 * on Hyperliquid DEX, with configurable risk management and position scaling.
 *
 * Key features:
 * - Real-time WebSocket subscriptions to leader fills
 * - Periodic reconciliation to ensure state consistency
 * - Risk controls: copy ratio, max leverage, max notional, slippage limits
 * - Support for both direct wallet trading and vault delegation
 */

import { setTimeout as delay } from "node:timers/promises";
import { loadConfig } from "./config/index.js";
import { createHyperliquidClients } from "./clients/hyperliquid.js";
import { LeaderState } from "./domain/leaderState.js";
import { FollowerState } from "./domain/followerState.js";
import { MarketMetadataService } from "./services/marketMetadata.js";
import { TradeExecutor } from "./services/tradeExecutor.js";
import { Reconciler } from "./services/reconciler.js";
import { SubscriptionService } from "./services/subscriptions.js";
import { logger } from "./utils/logger.js";

/**
 * Main entry point for the copy trading agent.
 * Initializes all services, starts WebSocket subscriptions, and runs the sync loop.
 */
async function main() {
  try {
    // Load configuration from environment variables
    const config = loadConfig();

    // Initialize Hyperliquid API clients (HTTP + WebSocket)
    const clients = createHyperliquidClients(config);

    // State stores for leader and follower positions
    const leaderState = new LeaderState();
    const followerState = new FollowerState();

    // Service to fetch and cache market metadata (decimals, max leverage, etc.)
    const metadataService = new MarketMetadataService(clients.infoClient, logger);

    // Core service that computes deltas and executes follower orders
    const tradeExecutor = new TradeExecutor({
      exchangeClient: clients.exchangeClient,
      leaderState,
      followerState,
      metadataService,
      risk: config.risk,
      log: logger,
    });

    // Periodic reconciliation service to sync full account state from Hyperliquid API
    const reconciler = new Reconciler(
      clients.infoClient,
      config,
      leaderState,
      followerState,
      clients.followerTradingAddress,
      logger,
    );

    // WebSocket subscription service for real-time leader fill updates
    const subscriptions = new SubscriptionService(
      clients.subscriptionClient,
      config,
      leaderState,
      () => tradeExecutor.syncWithLeader(),
      logger,
    );

    // Start WebSocket subscriptions to leader fills
    await subscriptions.start();

    // Perform initial reconciliation to sync state
    await reconciler.reconcileOnce();

    // Start periodic reconciliation loop
    reconciler.start();

    /**
     * Background polling loop to periodically sync follower with leader.
     * This provides a fallback in case WebSocket events are missed.
     */
    const pollLoop = async () => {
      while (true) {
        await tradeExecutor.syncWithLeader().catch((error) => {
          logger.error("Periodic sync failed", { error });
        });
        await delay(config.refreshAccountIntervalMs);
      }
    };

    void pollLoop();

    /**
     * Graceful shutdown handler for SIGINT/SIGTERM signals.
     * Unsubscribes from WebSocket channels and closes connections cleanly.
     */
    const shutdown = async (signal: string) => {
      logger.warn(`Received ${signal}, shutting down`);
      await subscriptions.stop().catch((error) => logger.error("Failed to stop subscriptions cleanly", { error }));
      reconciler.stop();
      await clients.wsTransport.close().catch(() => undefined);
      process.exit(0);
    };

    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
  } catch (error) {
    logger.error("Fatal error in copy trading agent", { error });
    process.exit(1);
  }
}

void main();
