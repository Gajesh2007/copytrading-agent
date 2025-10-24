import { useEffect, useState, useCallback } from "react";
import { VAULT_AGENTS, type RiskSnapshot } from "@/data/dashboard";

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
  leaderAllTimeRoiPercent: number;
  logsUrl: string;
  dashboardUrl: string;
  risk_snapshot: RiskSnapshot;
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

          // Fetch depositors to derive leader all-time PnL %
          const depositorRes = await fetch(`/api/vault/depositors?vault=${vault.vaultAddress}`, { cache: "no-store" });
          const depositorJson = depositorRes.ok ? await depositorRes.json() as { followers?: Array<{ user: string; equity: number; pnl: number; allTimePnl: number }> } : { followers: [] };
          const leaderRow = Array.isArray(depositorJson.followers) ? depositorJson.followers.find((f) => f.user === "Leader") : undefined;

          const leaderEquity = leaderData?.equity || 0;
          const followerEquity = followerData.equity || 0;

          // Calculate ROI from follower vault PNL
          // ROI = (total PNL / (equity - PNL)) * 100
          const totalPnl = followerData.totalPnl || 0;
          const initialCapital = followerEquity - totalPnl;
          const roiPercent = initialCapital > 0 ? (totalPnl / initialCapital) * 100 : 0;

          // Leader all-time ROI % from vault depositors (creator)
          const leaderAllTimePnl = leaderRow?.allTimePnl ?? 0;
          const leaderCurrentPnl = leaderRow?.pnl ?? 0;
          const leaderEquityForCalc = leaderRow?.equity ?? leaderEquity;
          const leaderInitialCapital = leaderEquityForCalc - leaderCurrentPnl;
          const leaderAllTimeRoiPercent = leaderInitialCapital > 0 ? (leaderAllTimePnl / leaderInitialCapital) * 100 : 0;

          return {
            modelId: vault.modelId,
            name: vault.name,
            model: vault.model,
            vaultAddress: vault.vaultAddress,
            followerEquityUsd: followerEquity,
            leaderEquityUsd: leaderEquity,
            roiPercent,
            leaderAllTimeRoiPercent,
            logsUrl: vault.logsUrl,
            dashboardUrl: vault.dashboardUrl,
            risk_snapshot: vault.risk_snapshot,
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

