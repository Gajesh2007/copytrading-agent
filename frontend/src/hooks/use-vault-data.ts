import { useEffect, useState, useCallback } from "react";
import { VAULT_AGENTS } from "@/data/dashboard";

interface HyperliquidVaultData {
  vaultAddress: string;
  equity: number;
  accountValue: number;
  withdrawable: number;
  totalPnl: number;
  positions: unknown[];
  marginSummary: unknown;
}

interface VaultData {
  modelId: string;
  name: string;
  model: string;
  vaultAddress: `0x${string}`;
  followerEquityUsd: number;
  leaderEquityUsd: number;
  roiPercent: number;
  logsUrl: string;
  dashboardUrl: string;
}

export function useVaultData(refreshInterval = 10000) {
  const [vaults, setVaults] = useState<VaultData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      // Fetch Hyperliquid data for each vault AND leader
      const vaultPromises = VAULT_AGENTS.filter((v) => !('comingSoon' in v && v.comingSoon)).map(async (vault) => {
        try {
          // Fetch both follower vault and leader wallet data in parallel
          const [followerResponse, leaderResponse] = await Promise.all([
            fetch(`/api/hyperliquid?vault=${vault.vaultAddress}`, { cache: "no-store" }),
            fetch(`/api/hyperliquid?vault=${vault.leaderAddress}`, { cache: "no-store" }),
          ]);

          if (!followerResponse.ok) {
            console.error(`Failed to fetch Hyperliquid data for vault ${vault.vaultAddress}`);
            return null;
          }

          const followerData: HyperliquidVaultData = await followerResponse.json();
          const leaderData: HyperliquidVaultData | null = leaderResponse.ok 
            ? await leaderResponse.json() 
            : null;

          const leaderEquity = leaderData?.equity || 0;
          const followerEquity = followerData.equity || 0;

          // Calculate ROI from follower vault PNL
          // ROI = (total PNL / (equity - PNL)) * 100
          const totalPnl = followerData.totalPnl || 0;
          const initialCapital = followerEquity - totalPnl;
          const roiPercent = initialCapital > 0 ? (totalPnl / initialCapital) * 100 : 0;

          return {
            modelId: vault.modelId,
            name: vault.name,
            model: vault.model,
            vaultAddress: vault.vaultAddress,
            followerEquityUsd: followerEquity,
            leaderEquityUsd: leaderEquity,
            roiPercent,
            logsUrl: vault.logsUrl,
            dashboardUrl: vault.dashboardUrl,
          };
        } catch (err) {
          console.error(`Error fetching vault ${vault.vaultAddress}:`, err);
          return null;
        }
      });

      const vaultResults = await Promise.all(vaultPromises);
      const validVaults = vaultResults.filter((v) => v !== null) as VaultData[];
      
      setVaults(validVaults);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch vault data:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();

    const interval = setInterval(() => {
      void fetchData();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [fetchData, refreshInterval]);

  return { vaults, loading, error, refresh: fetchData };
}

