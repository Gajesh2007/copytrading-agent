"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  VAULT_AGENTS,
} from "@/data/dashboard";
import { useVaultData } from "@/hooks/use-vault-data";
import { usePositions } from "@/hooks/use-positions";
import { DepositorsCard } from "@/components/depositors-card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";


function formatCurrency(value: number, fractionDigits = 0) {
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

function formatPercent(value: number, fractionDigits = 1) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${Math.abs(value).toFixed(fractionDigits)}%`;
}

function formatAddress(value: string) {
  if (value.length <= 10) {
    return value;
  }
  const head = value.slice(0, 5);
  const tail = value.slice(-5);
  return `${head}...${tail}`;
}

export default function HomePage() {
  const { vaults, loading, error } = useVaultData(10000); // Refresh every 10 seconds
  const [openLogsVault, setOpenLogsVault] = useState<{ name: string; logsUrl: string } | null>(null);

  const modelOptions = useMemo(() => {
    const entries = new Map<string, { name: string; comingSoon?: boolean }>();
    for (const vault of VAULT_AGENTS) {
      if (!entries.has(vault.modelId)) {
        entries.set(vault.modelId, { name: vault.model, comingSoon: vault.comingSoon });
      } else {
        const existing = entries.get(vault.modelId)!;
        entries.set(vault.modelId, { name: existing.name, comingSoon: existing.comingSoon || vault.comingSoon });
      }
    }
    return Array.from(entries, ([id, v]) => ({ id, name: v.name, comingSoon: v.comingSoon }));
  }, []);

  const [selectedModel, setSelectedModel] = useState("");

  const { positionDiffs, loading: positionsLoading } = usePositions(selectedModel, 10000);
  
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [showDepositDisclaimer, setShowDepositDisclaimer] = useState(false);
  const [pendingDepositUrl, setPendingDepositUrl] = useState<string>("");

  const selectedVault = useMemo(() => {
    return vaults.find((vault) => vault.modelId === selectedModel);
  }, [vaults, selectedModel]);

  // Default to highest Leader PnL % vault on first load
  useEffect(() => {
    if (!selectedModel && vaults.length > 0) {
      const best = [...vaults].sort((a, b) => b.leaderAllTimeRoiPercent - a.leaderAllTimeRoiPercent)[0];
      if (best) setSelectedModel(best.modelId);
    }
  }, [vaults, selectedModel]);

  const sortedPositions = useMemo(() => {
    if (!sortColumn) return positionDiffs;
    
    return [...positionDiffs].sort((a, b) => {
      let aVal: number;
      let bVal: number;
      
      switch (sortColumn) {
        case "market":
          return sortDirection === "asc" 
            ? a.coin.localeCompare(b.coin)
            : b.coin.localeCompare(a.coin);
        case "leaderSize":
          aVal = a.leaderNotionalUsd;
          bVal = b.leaderNotionalUsd;
          break;
        case "followerSize":
          aVal = a.followerNotionalUsd;
          bVal = b.followerNotionalUsd;
          break;
        case "entry":
          aVal = a.entryPrice;
          bVal = b.entryPrice;
          break;
        case "mark":
          aVal = a.markPrice;
          bVal = b.markPrice;
          break;
        case "pnl":
          aVal = a.pnl;
          bVal = b.pnl;
          break;
        default:
          return 0;
      }
      
      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [positionDiffs, sortColumn, sortDirection]);

  const handleSort = useCallback((column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  }, [sortColumn, sortDirection]);

  const navigableOptions = useMemo(() => modelOptions.filter((o: { id: string; name: string; comingSoon?: boolean }) => !o.comingSoon), [modelOptions]);

  const currentModelIndex = useMemo(() => {
    return navigableOptions.findIndex((opt) => opt.id === selectedModel);
  }, [navigableOptions, selectedModel]);

  const goToPreviousModel = useCallback(() => {
    if (currentModelIndex > 0) {
      setSelectedModel(navigableOptions[currentModelIndex - 1].id);
    }
  }, [currentModelIndex, navigableOptions]);

  const goToNextModel = useCallback(() => {
    if (currentModelIndex > -1 && currentModelIndex < navigableOptions.length - 1) {
      setSelectedModel(navigableOptions[currentModelIndex + 1].id);
    }
  }, [currentModelIndex, navigableOptions]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        goToPreviousModel();
      } else if (e.key === "ArrowRight") {
        goToNextModel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToPreviousModel, goToNextModel]);

  // Show error state
  if (error && !loading && vaults.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-center">
            <h2 className="pixel-heading mb-2 text-xl">Failed to load vault data</h2>
            <p className="font-mono text-sm text-muted-foreground">{error}</p>
            <p className="mt-4 font-mono text-xs text-muted-foreground">
              Make sure the APIs are accessible and try refreshing the page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-10 pb-16 pt-10">
      
      {modelOptions.length > 0 && (
        <section className="space-y-6">
          <div className="pixel-card space-y-4 rounded-sm border bg-background px-5 py-5 shadow-sm sm:px-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h1 className="pixel-heading text-xl sm:text-2xl">
                Models
              </h1>
              <span className="pixel-label text-[10px] text-muted-foreground uppercase tracking-[0.24em]">
                Select a model to view vault details
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="icon-sm"
                variant="outline"
                className="rounded-none"
                onClick={goToPreviousModel}
                disabled={currentModelIndex === 0}
                aria-label="Previous model"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                {modelOptions.map((option) => (
                  option.comingSoon ? (
                    <Button
                      key={option.id}
                      size="sm"
                      variant="outline"
                      className="rounded-none"
                      disabled
                    >
                      {option.name}
                      <span className="ml-2 pixel-label text-[9px]">Coming Soon</span>
                    </Button>
                  ) : (
                    <Button
                      key={option.id}
                      size="sm"
                      variant={option.id === selectedModel ? "default" : "outline"}
                      className="rounded-none"
                      onClick={() => setSelectedModel(option.id)}
                    >
                      {option.name}
                    </Button>
                  )
                ))}
              </div>
              <Button
                size="icon-sm"
                variant="outline"
                className="rounded-none"
                onClick={goToNextModel}
                disabled={currentModelIndex === navigableOptions.length - 1 || currentModelIndex === -1}
                aria-label="Next model"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          {loading && !selectedVault ? (
            <div className="pixel-card rounded-sm border bg-background p-6 shadow-sm">
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
                  <p className="font-mono text-sm text-muted-foreground">Loading vault data...</p>
                </div>
              </div>
            </div>
          ) : selectedVault ? (
            <div className="pixel-card rounded-sm border bg-background p-6 shadow-sm">
              <div className="space-y-6">
                <div>
                  <span className="pixel-label text-[10px] text-muted-foreground uppercase tracking-[0.24em]">
                    {selectedVault.model}
                  </span>
                  <h2 className="pixel-heading mt-1 text-2xl">{selectedVault.name}</h2>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <VaultMetric
                    label="Vault Equity"
                    value={formatCurrency(selectedVault.followerEquityUsd)}
                    tooltip={
                      <span>
                        Current total value of all assets in the vault (in USD). This changes with deposits,
                        withdrawals, and unrealized PnL.
                      </span>
                    }
                  />
                  <VaultMetric
                    label="Leader Equity"
                    value={formatCurrency(selectedVault.leaderEquityUsd)}
                    tooltip={
                      <span>
                        Current wallet equity of the leader being mirrored (in USD). Follower sizing mirrors leader leverage,
                        not absolute size.
                      </span>
                    }
                  />
                  <VaultMetric
                    label="Leader PnL %"
                    value={formatPercent(selectedVault.leaderAllTimeRoiPercent)}
                    tone={selectedVault.leaderAllTimeRoiPercent >= 0 ? "gain" : "loss"}
                    tooltip={
                      <span>
                        All-time ROI of the creator wallet mirrored by this vault, from Hyperliquid followers data.
                      </span>
                    }
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-[var(--outline)] pt-4">
                  <Button 
                    size="sm" 
                    variant="default" 
                    className="rounded-none"
                    onClick={() => {
                      setPendingDepositUrl(`https://app.hyperliquid.xyz/vaults/${selectedVault.vaultAddress}`);
                      setShowDepositDisclaimer(true);
                    }}
                  >
                    <ExternalLink className="mr-2 size-3.5" />
                    Deposit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-none"
                    onClick={() => setOpenLogsVault(selectedVault)}
                  >
                    <Activity className="mr-2 size-3.5" />
                    Logs
                  </Button>
                  <Button size="sm" variant="ghost" className="rounded-none" asChild>
                    <Link href={selectedVault.dashboardUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 size-3.5" />
                      Leader Dashboard
                    </Link>
                  </Button>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="pixel-label text-[10px] text-muted-foreground uppercase tracking-[0.24em]">
                      Vault Address
                    </span>
                    <code className="rounded-sm bg-muted px-2 py-1 font-mono text-xs">
                      {formatAddress(selectedVault.vaultAddress)}
                    </code>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="rounded-none"
                      onClick={() => {
                        if (typeof navigator !== "undefined" && navigator.clipboard) {
                          void navigator.clipboard.writeText(selectedVault.vaultAddress);
                        }
                      }}
                      aria-label="Copy vault address"
                    >
                      <Copy className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="w-full space-y-6">
          <Card className="pixel-card rounded-sm border bg-background shadow-sm">
            <CardHeader className="gap-3">
              <CardTitle className="pixel-heading text-lg">
                Position Alignment
              </CardTitle>
              <CardDescription className="font-mono text-xs text-muted-foreground">
                Leader vs follower leverage and notional footprints per market.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto px-0">
              <table className="table-grid w-full text-[11px] sm:text-xs">
                <thead>
                  <tr className="text-left font-mono">
                    <th className="px-2 py-2 sm:px-4 sm:py-3">
                      <button
                        onClick={() => handleSort("market")}
                        className="flex items-center gap-0.5 hover:text-foreground transition-colors text-[10px] sm:text-xs"
                      >
                        Market
                        <ArrowUpDown className="size-2.5 sm:size-3" />
                      </button>
                    </th>
                    <th className="px-2 py-2 sm:px-4 sm:py-3">Side</th>
                    <th className="hidden md:table-cell px-2 py-2 sm:px-4 sm:py-3">
                      <button
                        onClick={() => handleSort("leaderSize")}
                        className="flex items-center gap-0.5 hover:text-foreground transition-colors text-[10px] sm:text-xs"
                      >
                        Leader ($)
                        <ArrowUpDown className="size-2.5 sm:size-3" />
                      </button>
                    </th>
                    <th className="px-2 py-2 sm:px-4 sm:py-3">
                      <button
                        onClick={() => handleSort("followerSize")}
                        className="flex items-center gap-0.5 hover:text-foreground transition-colors text-[10px] sm:text-xs"
                      >
                        Size ($)
                        <ArrowUpDown className="size-2.5 sm:size-3" />
                      </button>
                    </th>
                    <th className="px-2 py-2 sm:px-4 sm:py-3">
                      <button
                        onClick={() => handleSort("entry")}
                        className="flex items-center gap-0.5 hover:text-foreground transition-colors text-[10px] sm:text-xs"
                      >
                        Entry
                        <ArrowUpDown className="size-2.5 sm:size-3" />
                      </button>
                    </th>
                    <th className="px-2 py-2 sm:px-4 sm:py-3">
                      <button
                        onClick={() => handleSort("mark")}
                        className="flex items-center gap-0.5 hover:text-foreground transition-colors text-[10px] sm:text-xs"
                      >
                        Mark
                        <ArrowUpDown className="size-2.5 sm:size-3" />
                      </button>
                    </th>
                    <th className="px-2 py-2 sm:px-4 sm:py-3">
                      <button
                        onClick={() => handleSort("pnl")}
                        className="flex items-center gap-0.5 hover:text-foreground transition-colors text-[10px] sm:text-xs"
                      >
                        PNL
                        <ArrowUpDown className="size-2.5 sm:size-3" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {positionsLoading && sortedPositions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-2 py-6 sm:px-4 sm:py-8 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="h-3 w-3 sm:h-4 sm:w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>
                          <span className="font-mono text-[11px] sm:text-sm text-muted-foreground">Loading...</span>
                        </div>
                      </td>
                    </tr>
                  ) : sortedPositions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-2 py-6 sm:px-4 sm:py-8 text-center font-mono text-[11px] sm:text-sm text-muted-foreground">
                        No positions found
                      </td>
                    </tr>
                  ) : (
                    sortedPositions.map((row) => (
                      <tr key={row.coin} className="font-mono transition-colors hover:bg-accent/50">
                      <td className="px-2 py-2 sm:px-4 sm:py-3">{row.coin}</td>
                      <td className="px-2 py-2 sm:px-4 sm:py-3">
                        <span className={cn(
                          "text-[9px] sm:text-[10px] font-bold uppercase tracking-wider",
                          row.side === "LONG" ? "text-emerald-600" : "text-rose-600"
                        )}>
                          {row.side}
                        </span>
                      </td>
                      <td className="hidden md:table-cell px-2 py-2 sm:px-4 sm:py-3">
                        <span className={cn(
                          row.side === "LONG" ? "text-emerald-600" : "text-rose-600"
                        )}>
                          {formatCurrency(row.leaderNotionalUsd, 0)}
                        </span>
                      </td>
                      <td className="px-2 py-2 sm:px-4 sm:py-3">
                        <span className={cn(
                          row.side === "LONG" ? "text-emerald-600" : "text-rose-600"
                        )}>
                          {formatCurrency(row.followerNotionalUsd, 0)}
                        </span>
                      </td>
                      <td className="px-2 py-2 sm:px-4 sm:py-3 text-[10px] sm:text-xs">{formatCurrency(row.entryPrice, row.entryPrice < 10 ? 4 : 2)}</td>
                      <td className="px-2 py-2 sm:px-4 sm:py-3 text-[10px] sm:text-xs">{formatCurrency(row.markPrice, row.markPrice < 10 ? 4 : 2)}</td>
                      <td className="px-2 py-2 sm:px-4 sm:py-3">
                        <div className="flex flex-col gap-0.5">
                          <span
                            className={cn(
                              "text-[10px] sm:text-xs",
                              row.pnl === 0
                                ? "text-muted-foreground"
                                : row.pnl > 0
                                  ? "text-emerald-600"
                                  : "text-rose-600",
                            )}
                          >
                            {row.pnl !== 0 && (row.pnl > 0 ? "+" : "")}
                            {formatCurrency(row.pnl, 0)}
                          </span>
                          <span className="text-[9px] sm:text-[11px] text-muted-foreground">
                            ({row.pnlPercent > 0 ? "+" : ""}{row.pnlPercent.toFixed(2)}%)
                          </span>
                        </div>
                      </td>
                    </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
          {selectedVault && (
            <DepositorsCard vaultAddress={selectedVault.vaultAddress} />
          )}
        </div>

        <div className="w-full space-y-6">
          <Card className="pixel-card rounded-sm border bg-background shadow-sm">
            <CardHeader className="gap-2">
              <CardTitle className="pixel-heading text-lg">
                Risk Snapshot
              </CardTitle>
              <CardDescription className="font-mono text-xs text-muted-foreground">
                Applied guardrails from current .env config.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 text-sm">
                <RiskRow label="Copy Ratio" value={`${Math.round(((selectedVault?.risk_snapshot.copyRatio ?? 0) * 100))}%`} />
                <RiskRow label="Max Leverage" value={`${(selectedVault?.risk_snapshot.maxLeverage ?? 0).toFixed(1)}x`} />
                <RiskRow label="Max Notional" value={formatCurrency(selectedVault?.risk_snapshot.maxNotionalUsd ?? 0)} />
                <RiskRow label="Slippage Guard" value={`${selectedVault?.risk_snapshot.slippageBps ?? 0} bps`} />
                <RiskRow
                  label="Refresh Interval"
                  value={`${Math.round(((selectedVault?.risk_snapshot.refreshAccountIntervalMs ?? 0) / 1000))}s`}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
      {/* Logs Modal */}
      <Dialog open={!!openLogsVault} onOpenChange={(o) => {
        if (!o) setOpenLogsVault(null);
      }}>
          <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="pixel-heading text-lg">Vault Logs</DialogTitle>
            <DialogDescription className="font-mono text-xs text-muted-foreground">
              {openLogsVault?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-hidden">
            {openLogsVault && <LogsViewer url={openLogsVault.logsUrl} />}
          </div>
        </DialogContent>
      </Dialog>

      {/* Deposit Disclaimer Modal */}
      <Dialog open={showDepositDisclaimer} onOpenChange={setShowDepositDisclaimer}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="pixel-heading text-lg">Risk Disclaimer</DialogTitle>
            <DialogDescription className="font-mono text-xs text-muted-foreground">
              Please read carefully before depositing
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3 rounded-sm border border-amber-500/50 bg-amber-500/10 p-4">
              <p className="font-mono text-sm leading-relaxed">
                <strong className="text-amber-600">⚠ EXPERIMENTAL SOFTWARE</strong>
              </p>
              <ul className="space-y-2 font-mono text-xs text-muted-foreground">
                <li>• This is experimental copytrading software</li>
                <li>• We only mirror other traders - no guarantees on performance</li>
                <li>• Trading carries significant risk of loss</li>
                <li>• Code is not audited - use at your own risk</li>
                <li>• Max leverage capped at 10x to reduce liquidation risk</li>
                <li>• You may lose some or all of your deposit</li>
                <li>• Your ROI depends on when you deposit, as your entry timing determines performance</li>
              </ul>
            </div>
            <p className="font-mono text-xs text-muted-foreground">
              By proceeding, you acknowledge that you understand these risks and are depositing at your own discretion.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 rounded-none"
                onClick={() => setShowDepositDisclaimer(false)}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                className="flex-1 rounded-none"
                asChild
                onClick={() => setShowDepositDisclaimer(false)}
              >
                <Link
                  href={pendingDepositUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  I Understand, Proceed
                </Link>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type VaultMetricProps = {
  label: string;
  value: string;
  tone?: "gain" | "loss";
  tooltip?: React.ReactNode;
};

function VaultMetric({ label, value, tone, tooltip }: VaultMetricProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className="pixel-label text-[9px] text-muted-foreground uppercase tracking-[0.24em]">
          {label}
        </span>
        {tooltip ? (
          <Tooltip open={open} onOpenChange={setOpen} delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                className="text-muted-foreground hover:text-foreground"
                aria-label={`${label} info`}
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
                onBlur={() => setOpen(false)}
              >
                <Info className="size-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>{tooltip}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      <span
        className={cn(
          "font-mono text-sm",
          tone === "gain" && "text-emerald-600",
          tone === "loss" && "text-rose-600",
        )}
      >
        {value}
      </span>
    </div>
  );
}

type RiskRowProps = {
  label: string;
  value: string;
};

function RiskRow({ label, value }: RiskRowProps) {
  return (
    <div className="flex items-center justify-between border border-[var(--outline)] bg-background/70 px-3 py-2">
      <span className="pixel-label text-[10px] text-muted-foreground uppercase tracking-[0.24em]">
        {label}
      </span>
      <span className="font-mono text-sm">{value}</span>
    </div>
  );
}

type LogsViewerProps = { url: string };

function LogsViewer({ url }: LogsViewerProps) {
  const [logs, setLogs] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLogs("");
    try {
      const res = await fetch(`/api/logs?url=${encodeURIComponent(url)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const contentType = res.headers.get("content-type") || "";
      let text = "";
      if (contentType.includes("application/json")) {
        const json: unknown = await res.json();
        if (Array.isArray(json)) {
          text = (json as unknown[])
            .map((row: unknown) => (typeof row === "string" ? row : JSON.stringify(row)))
            .join("\n");
        } else if (json && typeof json === "object" && "logs" in json) {
          const logsObj = json as { logs: unknown };
          const arr = Array.isArray(logsObj.logs) ? logsObj.logs : [logsObj.logs];
          text = (arr as unknown[])
            .map((row: unknown) => (typeof row === "string" ? row : JSON.stringify(row)))
            .join("\n");
        } else {
          text = JSON.stringify(json, null, 2);
        }
      } else {
        text = await res.text();
      }
      setLogs(text || "(no logs)");
    } catch {
      setError("Failed to load logs");
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="pixel-label text-[10px] text-muted-foreground uppercase tracking-[0.24em]">
          Live Logs
        </span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="rounded-none" onClick={() => fetchLogs()} disabled={loading}>
            Refresh
          </Button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs underline text-muted-foreground hover:text-foreground"
          >
            Open raw
          </a>
        </div>
      </div>
      <div
        ref={containerRef}
        className="h-[60vh] max-h-[520px] overflow-auto rounded-sm border border-[var(--outline)] bg-black p-3"
      >
        <pre className="m-0 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-green-400">
{loading ? "loading…" : error ? error : logs}
        </pre>
      </div>
    </div>
  );
}
