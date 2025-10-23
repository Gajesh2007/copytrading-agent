import { useEffect, useState, useCallback } from "react";
import { VAULT_AGENTS } from "@/data/dashboard";

export interface Position {
  coin: string;
  size: number;
  entryPrice: number;
  markPrice: number;
  leverage: number;
  unrealizedPnl: number;
  marginUsed: number;
}

export interface PositionDiff {
  coin: string;
  side: "LONG" | "SHORT";
  markPrice: number;
  leaderSize: number;
  followerSize: number;
  leaderNotionalUsd: number;
  followerNotionalUsd: number;
  leaderLeverage: number;
  followerLeverage: number;
  deltaSize: number;
  deltaNotionalUsd: number;
  pnl: number;
  pnlPercent: number;
  entryPrice: number;
}

export function usePositions(selectedModelId: string | null, refreshInterval = 10000) {
  const [positionDiffs, setPositionDiffs] = useState<PositionDiff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPositions = useCallback(async () => {
    if (!selectedModelId) {
      setPositionDiffs([]);
      setLoading(false);
      return;
    }

    try {
      // Get the selected vault
      const selectedVault = VAULT_AGENTS.find((v) => v.modelId === selectedModelId);
      if (!selectedVault) {
        setPositionDiffs([]);
        setLoading(false);
        return;
      }

      // Fetch positions for just this vault's leader and follower
      const addresses = [selectedVault.vaultAddress, selectedVault.leaderAddress].join(",");

      const response = await fetch(`/api/positions?vaults=${addresses}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch positions");
      }

      const positionsMap: Record<string, Position[]> = await response.json();

      const leaderPositions = positionsMap[selectedVault.leaderAddress] || [];
      const followerPositions = positionsMap[selectedVault.vaultAddress] || [];

      // Combine positions by coin
      const allCoinsMap = new Map<string, { leader?: Position; follower?: Position }>();

      // Add leader positions
      leaderPositions.forEach((pos) => {
        const existing = allCoinsMap.get(pos.coin) || {};
        allCoinsMap.set(pos.coin, { ...existing, leader: pos });
      });

      // Add follower positions
      followerPositions.forEach((pos) => {
        const existing = allCoinsMap.get(pos.coin) || {};
        allCoinsMap.set(pos.coin, { ...existing, follower: pos });
      });

      // Create position diffs with real calculations
      const diffs: PositionDiff[] = Array.from(allCoinsMap.entries()).map(([coin, data]) => {
        const leaderSize = data.leader?.size || 0;
        const followerSize = data.follower?.size || 0;
        // Use the markPrice from the position data (now includes actual current price)
        const markPrice = data.follower?.markPrice || data.leader?.markPrice || 0;

        // Determine side based on follower position (or leader if follower has none)
        const activeSize = followerSize !== 0 ? followerSize : leaderSize;
        const side: "LONG" | "SHORT" = activeSize >= 0 ? "LONG" : "SHORT";

        const leaderNotionalUsd = Math.abs(leaderSize * markPrice);
        const followerNotionalUsd = Math.abs(followerSize * markPrice);
        const deltaSize = leaderSize - followerSize;
        const deltaNotionalUsd = deltaSize * markPrice;
        
        // Get follower's unrealized PNL for this position (already in USD)
        const pnl = data.follower?.unrealizedPnl || 0;
        const entryPrice = data.follower?.entryPrice || markPrice;
        
        // Calculate PNL percentage based on actual PNL and position cost basis
        // Cost basis = abs(size) * entryPrice
        const costBasis = Math.abs(followerSize) * entryPrice;
        const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

        return {
          coin,
          side,
          markPrice,
          leaderSize,
          followerSize,
          leaderNotionalUsd,
          followerNotionalUsd,
          leaderLeverage: data.leader?.leverage || 0,
          followerLeverage: data.follower?.leverage || 0,
          deltaSize,
          deltaNotionalUsd,
          pnl,
          pnlPercent,
          entryPrice,
        };
      }).sort((a, b) => Math.abs(b.followerNotionalUsd) - Math.abs(a.followerNotionalUsd)); // Sort by largest follower position first

      setPositionDiffs(diffs);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch positions:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch positions");
    } finally {
      setLoading(false);
    }
  }, [selectedModelId]);

  useEffect(() => {
    void fetchPositions();

    const interval = setInterval(() => {
      void fetchPositions();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [fetchPositions, refreshInterval, selectedModelId]);

  return { positionDiffs, loading, error, refresh: fetchPositions };
}

