"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useVaultData } from "@/hooks/use-vault-data";
import { RollingCurrency } from "@/components/RollingNumber";

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
          <div className="font-mono text-xl sm:text-2xl">
            {loading ? "…" : <RollingCurrency value={totalEquity} className="font-mono" decimals={2} />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default TotalEquityStat;


