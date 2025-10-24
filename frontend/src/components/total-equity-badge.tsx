"use client";

import { useVaultData } from "@/hooks/use-vault-data";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RollingCurrency } from "@/components/RollingNumber";

export default function TotalEquityBadge() {
  const { vaults, loading, error } = useVaultData(15000);
  const totalEquity = vaults.reduce((sum, v) => sum + (v.followerEquityUsd || 0), 0);

  return (
    <span
      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-none select-text cursor-text")}
      title="Total equity across all follower vaults"
      aria-label="Total Vault Equity"
      role="status"
    >
      Total Vault Equity: <span className="ml-1 font-mono select-text">
        {loading ? (
          "…"
        ) : error ? (
          "—"
        ) : (
          <RollingCurrency value={totalEquity} className="font-mono" />
        )}
      </span>
    </span>
  );
}


