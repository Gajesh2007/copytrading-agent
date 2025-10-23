"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useVaultData } from "@/hooks/use-vault-data";

function formatUsd(value: number) {
  try {
    return value.toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    const sign = value < 0 ? "-" : "";
    const abs = Math.abs(value);
    return `${sign}$${abs.toFixed(2)}`;
  }
}

export function TotalEquityStat() {
  const { vaults, loading, error } = useVaultData(15000);
  const totalEquity = vaults.reduce((sum, v) => sum + (v.followerEquityUsd || 0), 0);

  return (
    <Card className="pixel-card rounded-sm border bg-background shadow-sm">
      <CardHeader className="py-3">
        <CardTitle className="pixel-heading text-base">Total Vault Equity</CardTitle>
      </CardHeader>
      <CardContent className="py-3">
        {error ? (
          <div className="font-mono text-xs text-rose-600">Failed to load</div>
        ) : (
          <div className="font-mono text-xl sm:text-2xl">{loading ? "…" : formatUsd(totalEquity)}</div>
        )}
      </CardContent>
    </Card>
  );
}

export default TotalEquityStat;


