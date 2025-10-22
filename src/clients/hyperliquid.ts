/**
 * Hyperliquid API client initialization module.
 *
 * Creates HTTP and WebSocket clients for interacting with Hyperliquid DEX.
 * Includes a Node.js WebSocket adapter for compatibility with the browser-oriented SDK.
 */

import * as hl from "@nktkas/hyperliquid";
import WebSocket from "ws";
import { privateKeyToAccount } from "viem/accounts";
import type { CopyTradingConfig, HyperliquidEnvironment } from "../config/index.js";
import { logger } from "../utils/logger.js";

/**
 * Helper to determine if the environment is testnet.
 */
function isTestnet(environment: HyperliquidEnvironment) {
  return environment === "testnet";
}

/**
 * Bundle of all Hyperliquid API clients and related objects.
 */
export interface HyperliquidClients {
  /** Info API client for read-only queries (positions, fills, metadata) */
  infoClient: hl.InfoClient;
  /** Exchange API client for write operations (placing orders, managing positions) */
  exchangeClient: hl.ExchangeClient;
  /** Subscription client for real-time WebSocket data streams */
  subscriptionClient: hl.SubscriptionClient;
  /** Underlying HTTP transport */
  httpTransport: hl.HttpTransport;
  /** Underlying WebSocket transport */
  wsTransport: hl.WebSocketTransport;
  /** Viem account object for the follower wallet */
  followerAccount: ReturnType<typeof privateKeyToAccount>;
  /** Address to use for follower trading (either wallet or vault) */
  followerTradingAddress: `0x${string}`;
}

/**
 * Creates and initializes all Hyperliquid API clients.
 *
 * @param config - Copy trading configuration
 * @returns Initialized client bundle
 */
export function createHyperliquidClients(config: CopyTradingConfig): HyperliquidClients {
  /**
   * Node.js WebSocket adapter for the Hyperliquid SDK.
   *
   * The Hyperliquid SDK expects a DOM-compatible WebSocket constructor,
   * but we're running in Node.js. This wrapper bridges the gap by:
   * - Converting the `ws` library's signature to match DOM WebSocket
   * - Setting `binaryType` to "arraybuffer" (DOM default) instead of "nodebuffer" (ws default)
   * - Implementing `dispatchEvent` to invoke handler properties (e.g., `onmessage`)
   *
   * TypeScript requires a cast to `typeof globalThis.WebSocket` due to incompatible
   * binaryType unions between `ws` and DOM types.
   */
  class NodeWebSocketWrapper extends WebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      const address = typeof url === "string" ? url : url.toString();
      super(address, protocols);
      // Force DOM-compatible binary type
      this.binaryType = "arraybuffer";
    }

    /**
     * Implements DOM-style dispatchEvent by invoking the corresponding handler property
     * (e.g., `onmessage`, `onopen`) and then emitting the event through the EventEmitter.
     */
    dispatchEvent(event: Event): boolean {
      const handlerKey = `on${event.type}` as const;
      const handler = (this as unknown as Record<string, ((event: Event) => void) | null>)[handlerKey];
      if (typeof handler === "function") {
        handler.call(this, event);
      }

      return super.emit(event.type, event);
    }
  }

  // Create HTTP transport for API requests (10s timeout)
  const httpTransport = new hl.HttpTransport({
    isTestnet: isTestnet(config.environment),
    timeout: 10_000,
  });

  // Create WebSocket transport with infinite retries for subscriptions
  const wsTransport = new hl.WebSocketTransport({
    isTestnet: isTestnet(config.environment),
    reconnect: {
      // Use our Node.js-compatible WebSocket wrapper
      WebSocket: NodeWebSocketWrapper as unknown as typeof globalThis.WebSocket,
      maxRetries: Number.POSITIVE_INFINITY,
    },
  });

  // Convert follower private key to viem account for signing
  const followerAccount = privateKeyToAccount(config.followerPrivateKey);

  // Determine trading address: use vault if specified, otherwise use wallet address
  const followerTradingAddress = (config.followerVaultAddress ?? followerAccount.address) as `0x${string}`;

  // Create Info API client for read-only queries
  const infoClient = new hl.InfoClient({ transport: httpTransport });

  // Create Exchange API client for placing orders
  const exchangeClient = new hl.ExchangeClient({
    transport: httpTransport,
    wallet: followerAccount,
    // If trading through a vault, set the default vault address
    ...(config.followerVaultAddress ? { defaultVaultAddress: config.followerVaultAddress } : {}),
    signatureChainId: async () => {
      // Hyperliquid uses different chain IDs for mainnet vs testnet in EIP-712 signatures
      return isTestnet(config.environment) ? ("0x66eee" as const) : ("0x1" as const);
    },
  });

  // Create subscription client for real-time WebSocket streams
  const subscriptionClient = new hl.SubscriptionClient({ transport: wsTransport });

  // Log if WebSocket fails to connect initially (non-blocking)
  wsTransport.ready().catch((error) => {
    logger.error("WebSocket transport failed to initialize", { error });
  });

  return {
    infoClient,
    exchangeClient,
    subscriptionClient,
    httpTransport,
    wsTransport,
    followerAccount,
    followerTradingAddress,
  };
}
