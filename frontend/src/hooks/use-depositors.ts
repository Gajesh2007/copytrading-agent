import { useCallback, useEffect, useState } from "react";

export type Depositor = {
  user: string;
  equity: number;
  pnl: number;
  allTimePnl: number;
  daysFollowing: number;
  roiPct: number;
};

export function useDepositors(vaultAddress: `0x${string}`, refreshMs = 15000) {
  const [depositors, setDepositors] = useState<Depositor[]>([]);
  const [vaultName, setVaultName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/vault/depositors?vault=${vaultAddress}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setDepositors(json.followers ?? []);
      setVaultName(json.name ?? "");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load depositors");
    } finally {
      setLoading(false);
    }
  }, [vaultAddress]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), refreshMs);
    return () => clearInterval(id);
  }, [load, refreshMs]);

  return { depositors, vaultName, loading, error, refresh: load };
}


