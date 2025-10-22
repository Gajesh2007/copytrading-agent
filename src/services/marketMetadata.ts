/**
 * Service for fetching and caching Hyperliquid market metadata.
 *
 * Maintains:
 * - Asset metadata (asset IDs, size decimals, max leverage)
 * - Current mark prices for all assets
 *
 * Metadata is loaded once on initialization and mark prices can be refreshed periodically.
 */

import type * as hl from "@nktkas/hyperliquid";
import { logger, type Logger } from "../utils/logger.js";

/**
 * Metadata for a single trading pair.
 */
export interface AssetMetadata {
  /** Numeric asset ID used in Hyperliquid API calls */
  assetId: number;
  /** Human-readable coin symbol (e.g., "BTC", "ETH") */
  coin: string;
  /** Maximum allowed leverage for this asset */
  maxLeverage: number;
  /** Number of decimal places for position size */
  sizeDecimals: number;
  /** ID of the margin tier table for this asset */
  marginTableId: number;
}

/**
 * Caches market metadata and mark prices for efficient order construction.
 */
export class MarketMetadataService {
  private loaded = false;
  private readonly coinToMeta = new Map<string, AssetMetadata>();
  private readonly coinToMarkPx = new Map<string, number>();

  constructor(private readonly infoClient: hl.InfoClient, private readonly log: Logger = logger) {}

  /**
   * Ensures market metadata is loaded, fetching from API if needed.
   * Safe to call multiple times (no-op if already loaded).
   *
   * @param signal - Optional abort signal to cancel the request
   */
  async ensureLoaded(signal?: AbortSignal) {
    if (this.loaded) {
      return;
    }
    const [meta, contexts] = await this.infoClient.metaAndAssetCtxs(undefined, signal);
    meta.universe.forEach((entry, index) => {
      const metadata: AssetMetadata = {
        assetId: index,
        coin: entry.name,
        maxLeverage: entry.maxLeverage,
        sizeDecimals: entry.szDecimals,
        marginTableId: entry.marginTableId,
      };
      this.coinToMeta.set(entry.name, metadata);
      const ctx = contexts[index];
      if (ctx) {
        this.coinToMarkPx.set(entry.name, Number(ctx.markPx));
      }
    });
    this.loaded = true;
    this.log.info("Loaded Hyperliquid market metadata", { assets: this.coinToMeta.size });
  }

  /**
   * Gets metadata for a coin, returning undefined if not found.
   */
  getByCoin(coin: string): AssetMetadata | undefined {
    return this.coinToMeta.get(coin);
  }

  /**
   * Gets metadata for a coin, throwing if not found.
   * @throws {Error} If the coin is not in the metadata cache
   */
  requireByCoin(coin: string): AssetMetadata {
    const metadata = this.getByCoin(coin);
    if (!metadata) {
      throw new Error(`Unknown coin ${coin} in market metadata`);
    }
    return metadata;
  }

  /**
   * Gets the current mark price for a coin.
   */
  getMarkPrice(coin: string): number | undefined {
    return this.coinToMarkPx.get(coin);
  }

  /**
   * Refreshes mark prices from the API without reloading metadata.
   * If metadata is not yet loaded, performs a full load instead.
   *
   * @param signal - Optional abort signal to cancel the request
   */
  async refreshMarkPrices(signal?: AbortSignal) {
    if (!this.loaded) {
      await this.ensureLoaded(signal);
      return;
    }
    const [meta, contexts] = await this.infoClient.metaAndAssetCtxs(undefined, signal);
    meta.universe.forEach((entry, index) => {
      const ctx = contexts[index];
      if (ctx) {
        this.coinToMarkPx.set(entry.name, Number(ctx.markPx));
      }
    });
    this.log.debug("Refreshed mark prices");
  }
}
