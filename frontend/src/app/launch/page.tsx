"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MODEL_OPTIONS = [
  { id: "gpt-5", label: "GPT-5" },
  { id: "gemini-pro", label: "Gemini Pro" },
  { id: "gpt-5-pro", label: "GPT-5 Pro" },
  { id: "claude-4-opus", label: "Claude 4 Opus" },
  { id: "grok-4", label: "Grok 4" },
  { id: "deepseek-v3-2", label: "DeepSeek V3.2" },
];

type AssetCatalogEntry = { symbol: string; name: string };
const ASSET_CATALOG: AssetCatalogEntry[] = [
  { symbol: "BTC", name: "Bitcoin" },
  { symbol: "ETH", name: "Ethereum" },
  { symbol: "SOL", name: "Solana" },
  { symbol: "EIGEN", name: "EigenCloud" },
  { symbol: "BNB", name: "Binance Coin" },
  { symbol: "XRP", name: "XRP" },
  { symbol: "ADA", name: "Cardano" },
  { symbol: "DOGE", name: "Dogecoin" },
  { symbol: "TRX", name: "TRON" },
  { symbol: "TON", name: "Toncoin" },
  { symbol: "AVAX", name: "Avalanche" },
  { symbol: "SHIB", name: "Shiba Inu" },
  { symbol: "LINK", name: "Chainlink" },
  { symbol: "DOT", name: "Polkadot" },
  { symbol: "UNI", name: "Uniswap" },
  { symbol: "LTC", name: "Litecoin" },
  { symbol: "NEAR", name: "NEAR" },
  { symbol: "APT", name: "Aptos" },
  { symbol: "INJ", name: "Injective" },
  { symbol: "OP", name: "Optimism" },
  { symbol: "ARB", name: "Arbitrum" },
];
const TOP_ASSET_COUNT = 15;
const MAX_CUSTOM_ASSETS = 10;
const TOP_VOLUME_SYMBOLS = ASSET_CATALOG.slice(0, TOP_ASSET_COUNT).map(
  (asset) => asset.symbol
);
const ASSET_LOOKUP = ASSET_CATALOG.reduce<Record<string, AssetCatalogEntry>>(
  (acc, asset) => {
    acc[asset.symbol] = asset;
    return acc;
  },
  {}
);

const STRATEGY_FORCES = [
  {
    id: "agent-intelligence",
    label: "Agent Intelligence",
    description: "Let the agent remix indicators dynamically and fire at will.",
  },
  {
    id: "trend-tracker",
    label: "Trend Tracker",
    description: "Follow EMA/ADX confirmation with disciplined trailing stops.",
  },
  {
    id: "breakout-hunter",
    label: "Breakout Hunter",
    description: "Scan Donchian + volume spikes to catch fresh breakouts.",
  },
  {
    id: "mean-reversion",
    label: "Mean Reversion",
    description: "Fade Bollinger/RSI extremes with tight re-entry checks.",
  },
  {
    id: "volatility-scalper",
    label: "Volatility Scalper",
    description: "Work ATR bands + VWAP pivots for rapid in-and-out clips.",
  },
];

const INDICATOR_BUNDLES = [
  {
    id: "core-pack",
    label: "Core Technical Pack",
    indicators: ["EMA 20", "EMA 50", "RSI", "MACD"],
    defaultIntervals: [60],
    intervalOptions: [15, 30, 60, 120],
  },
  {
    id: "momentum-pack",
    label: "Momentum Pack",
    indicators: ["RSI", "Stochastic", "Williams %R"],
    defaultIntervals: [30],
    intervalOptions: [5, 15, 30, 60],
  },
  {
    id: "volatility-pack",
    label: "Volatility Pack",
    indicators: ["ATR", "Bollinger Bands", "Keltner Channel"],
    defaultIntervals: [15],
    intervalOptions: [5, 15, 30, 45],
  },
  {
    id: "breakout-pack",
    label: "Breakout Pack",
    indicators: ["Donchian", "Volume Profile", "ADX"],
    defaultIntervals: [5],
    intervalOptions: [1, 3, 5, 10, 15],
  },
  {
    id: "mean-pack",
    label: "Mean Reversion Pack",
    indicators: ["CCI", "VWAP", "Chaikin Oscillator"],
    defaultIntervals: [120],
    intervalOptions: [60, 120, 240],
  },
];
const DEFAULT_TECH_BUNDLE_IDS = ["core-pack"];

export default function LaunchPage() {
  const [modelId, setModelId] = useState(MODEL_OPTIONS[0]?.id ?? "");
  const [assetMode, setAssetMode] = useState<"top" | "custom">("top");
  const [selectedAssets, setSelectedAssets] = useState<string[]>(TOP_VOLUME_SYMBOLS);
  const [indicatorMode, setIndicatorMode] = useState<"default" | "custom">("default");
  const [selectedBundles, setSelectedBundles] = useState<string[]>(DEFAULT_TECH_BUNDLE_IDS);
  const [customIntervals, setCustomIntervals] = useState<Record<string, number[]>>(
    Object.fromEntries(
      INDICATOR_BUNDLES.map((bundle) => [bundle.id, [...bundle.defaultIntervals]])
    )
  );
  const [strategyForce, setStrategyForce] = useState("agent-intelligence");
  const [seedAmount, setSeedAmount] = useState("5000");
  const [riskBudget, setRiskBudget] = useState("medium");
  const [assetQuery, setAssetQuery] = useState("");
  const [agentName, setAgentName] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(
    "You are an autonomous trading agent tuned for disciplined execution. Respect guardrails, communicate key decisions, and prefer high-liquidity venues."
  );
  const [userPrompt, setUserPrompt] = useState(
    "Focus on Momentum Surge opportunities while capping drawdown at the configured risk budget. Surface commentary when you rotate assets or adjust guardrails."
  );

  const modelLabel = MODEL_OPTIONS.find((m) => m.id === modelId)?.label ?? "Select model";
  const forceDetail = STRATEGY_FORCES.find((f) => f.id === strategyForce);
  const estimatedDailyCost = useMemo(() => {
    const base = 2; // base cost per day in USD
    const assetMultiplier = selectedAssets.length * 1.2;
    const bundleMultiplier = selectedBundles.length * 0.8;
    return Math.round((base + assetMultiplier + bundleMultiplier) * 100) / 100;
  }, [selectedAssets.length, selectedBundles.length]);

  const estimatedDrawdown = useMemo(() => {
    if (riskBudget === "low") return "3-5%";
    if (riskBudget === "medium") return "6-10%";
    return "10-18%";
  }, [riskBudget]);

  const filteredAssets = useMemo(() => {
    const query = assetQuery.trim().toLowerCase();
    if (!query) return ASSET_CATALOG;
    return ASSET_CATALOG.filter((asset) =>
      asset.symbol.toLowerCase().includes(query) ||
      asset.name.toLowerCase().includes(query)
    );
  }, [assetQuery]);

  function handleAssetModeChange(mode: "top" | "custom") {
    if (mode === assetMode) return;
    setAssetMode(mode);
    if (mode === "top") {
      setAssetQuery("");
      setSelectedAssets(TOP_VOLUME_SYMBOLS);
    } else {
      setSelectedAssets((prev) => {
        if (prev.length && prev.length <= MAX_CUSTOM_ASSETS) {
          return prev.slice(0, MAX_CUSTOM_ASSETS);
        }
        return TOP_VOLUME_SYMBOLS.slice(0, Math.min(5, MAX_CUSTOM_ASSETS));
      });
    }
  }

  function toggleAsset(asset: string) {
    if (assetMode !== "custom") return;
    setSelectedAssets((prev) => {
      if (prev.includes(asset)) {
        return prev.filter((item) => item !== asset);
      }
      if (prev.length >= MAX_CUSTOM_ASSETS) {
        return prev;
      }
      return [...prev, asset];
    });
  }

  function handleAssetSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (assetMode !== "custom") return;
    const match = filteredAssets[0];
    if (!match) return;
    toggleAsset(match.symbol);
  }

  function handleIndicatorModeChange(mode: "default" | "custom") {
    if (mode === indicatorMode) return;
    setIndicatorMode(mode);
    setCustomIntervals(
      Object.fromEntries(
        INDICATOR_BUNDLES.map((bundle) => [bundle.id, [...bundle.defaultIntervals]])
      )
    );
    if (mode === "default") {
      setSelectedBundles(DEFAULT_TECH_BUNDLE_IDS);
    } else {
      setSelectedBundles(DEFAULT_TECH_BUNDLE_IDS);
    }
  }

  function toggleBundle(bundleId: string) {
    if (indicatorMode !== "custom") return;
    setSelectedBundles((prev) =>
      prev.includes(bundleId)
        ? prev.filter((item) => item !== bundleId)
        : [...prev, bundleId]
    );
  }

  function toggleInterval(bundleId: string, interval: number) {
    const bundle = INDICATOR_BUNDLES.find((item) => item.id === bundleId);
    if (!bundle) return;
    setCustomIntervals((prev) => {
      const current = prev[bundleId] ?? [...bundle.defaultIntervals];
      const exists = current.includes(interval);
      let next = exists ? current.filter((value) => value !== interval) : [...current, interval];
      if (next.length === 0) {
        const fallback = bundle.intervalOptions[0] ?? bundle.defaultIntervals[0];
        next = [fallback];
      }
      next = Array.from(new Set(next)).sort((a, b) => a - b);
      return { ...prev, [bundleId]: next };
    });
  }

  function handleLaunch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    toast.success(`Launching ${agentName ? `"${agentName}"` : "agent"}`, {
      description: `${modelLabel} on ${selectedAssets.join(", ")} with ${forceDetail?.label ?? "strategy"} strategy` + (showAdvanced ? " • Custom prompts applied" : ""),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="pixel-heading text-3xl sm:text-4xl">Launch Agent</h1>
          <p className="pixel-label text-sm text-muted-foreground mt-1">
            Select your model, market scope, and optional context to go live in seconds.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="rounded-none px-3 py-1">
            Estimated daily cost: ${estimatedDailyCost.toFixed(2)}
          </Badge>
        </div>
      </div>

      <form
        className="grid grid-cols-1 xl:grid-cols-[2fr_minmax(260px,1fr)] gap-6 items-start"
        onSubmit={handleLaunch}
      >
        <div className="space-y-5">
          <Card className="pixel-card rounded-sm">
            <CardHeader className="pb-4">
              <CardTitle className="pixel-label">1. Model Selection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="grid gap-2">
                <span className="pixel-label text-xs text-muted-foreground uppercase tracking-wide">
                  Agent name
                </span>
                <Input
                  value={agentName}
                  onChange={(event) => setAgentName(event.target.value)}
                  placeholder="e.g. AlphaRunner"
                  className="rounded-none font-mono"
                  maxLength={60}
                />
              </label>
              <Select value={modelId} onValueChange={setModelId}>
                <SelectTrigger className="rounded-none">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_OPTIONS.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="pixel-label text-xs text-muted-foreground">
                Each model executes differently. Choose the one that fits your risk appetite and execution window.
              </div>
            </CardContent>
          </Card>

          <Card className="pixel-card rounded-sm">
            <CardHeader className="pb-4">
              <CardTitle className="pixel-label">2. Asset Basket</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="rounded-none"
                  variant={assetMode === "top" ? "default" : "outline"}
                  onClick={() => handleAssetModeChange("top")}
                >
                  Top {TOP_ASSET_COUNT} Volume
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="rounded-none"
                  variant={assetMode === "custom" ? "default" : "outline"}
                  onClick={() => handleAssetModeChange("custom")}
                >
                  Custom Basket
                </Button>
              </div>

              {assetMode === "top" ? (
                <div className="space-y-3">
                  <p className="pixel-label text-xs text-muted-foreground">
                    We&apos;ll auto-allocate across the top {TOP_ASSET_COUNT} assets by 24h volume.
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {TOP_VOLUME_SYMBOLS.map((symbol) => {
                      const asset = ASSET_LOOKUP[symbol];
                      return (
                        <Badge
                          key={symbol}
                          variant="secondary"
                          className="rounded-none"
                          title={asset?.name ?? symbol}
                        >
                          {symbol}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="pixel-label text-xs text-muted-foreground">
                    Choose up to {MAX_CUSTOM_ASSETS} supported assets for your basket.
                  </p>
                  <Input
                    value={assetQuery}
                    onChange={(event) => setAssetQuery(event.target.value)}
                    onKeyDown={handleAssetSearchKeyDown}
                    placeholder="Search by symbol or name..."
                    className="rounded-none font-mono"
                  />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {filteredAssets.map((asset) => {
                      const selected = selectedAssets.includes(asset.symbol);
                      return (
                        <Button
                          key={asset.symbol}
                          type="button"
                          variant="outline"
                          className={cn(
                            "rounded-none justify-start text-left h-auto py-3 px-3",
                            selected
                              ? "bg-foreground text-background border-foreground hover:bg-foreground hover:text-background focus-visible:ring-foreground/40"
                              : "hover:bg-foreground/10"
                          )}
                          onClick={() => toggleAsset(asset.symbol)}
                        >
                          <div className="flex flex-col items-start">
                            <span className="font-mono text-sm">{asset.symbol}</span>
                            <span className="pixel-label text-xs text-muted-foreground">
                              {asset.name}
                            </span>
                          </div>
                        </Button>
                      );
                    })}
                    {filteredAssets.length === 0 && (
                      <div className="col-span-full pixel-label text-xs text-muted-foreground">
                        No assets match your search.
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="pixel-label text-xs text-muted-foreground">
                Selected:
                <div className="mt-1 flex flex-wrap gap-1">
                  {selectedAssets.length > 0 ? (
                    selectedAssets.map((symbol) => {
                      const asset = ASSET_LOOKUP[symbol];
                      return (
                        <Badge key={symbol} variant="secondary" className="rounded-none">
                          {symbol}
                          {asset ? ` · ${asset.name}` : null}
                        </Badge>
                      );
                    })
                  ) : (
                    <span className="text-muted-foreground">None</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="pixel-card rounded-sm">
            <CardHeader className="pb-4">
              <CardTitle className="pixel-label">3. Strategy Force</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                {STRATEGY_FORCES.map((force) => {
                  const selected = strategyForce === force.id;
                  return (
                    <button
                      key={force.id}
                      type="button"
                      onClick={() => setStrategyForce(force.id)}
                      className={cn(
                        "text-left rounded-sm border border-[var(--outline)] px-4 py-3 transition-colors",
                        selected
                          ? "bg-foreground text-background"
                          : "hover:bg-foreground/10"
                      )}
                    >
                      <div className="font-mono text-sm">{force.label}</div>
                      <div className="pixel-label text-xs text-muted-foreground mt-1">
                        {force.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="pixel-card rounded-sm">
            <CardHeader className="pb-4">
              <CardTitle className="pixel-label">4. Indicator Context (Optional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="pixel-label text-xs text-muted-foreground">
                Supply optional technical signal packs to guide the agent&apos;s decision engine.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="rounded-none"
                  variant={indicatorMode === "default" ? "default" : "outline"}
                  onClick={() => handleIndicatorModeChange("default")}
                >
                  Standard Technical Set
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="rounded-none"
                  variant={indicatorMode === "custom" ? "default" : "outline"}
                  onClick={() => handleIndicatorModeChange("custom")}
                >
                  Custom Signals
                </Button>
              </div>

              {indicatorMode === "default" ? (
                <div className="space-y-3">
                  <p className="pixel-label text-xs text-muted-foreground">
                    We&apos;ll provide a balanced technical baseline combining momentum, trend, and confirmation layers.
                  </p>
                  {DEFAULT_TECH_BUNDLE_IDS.map((bundleId) => {
                    const bundle = INDICATOR_BUNDLES.find((item) => item.id === bundleId);
                    if (!bundle) return null;
                    return (
                      <div key={bundle.id} className="rounded-sm border border-[var(--outline)] px-3 py-2">
                        <div className="font-mono text-sm">{bundle.label}</div>
                        <div className="pixel-label text-xs text-muted-foreground mt-1">
                          {bundle.indicators.join(" · ")}
                        </div>
                        <div className="pixel-label text-[9px] text-muted-foreground mt-1 uppercase tracking-[0.24em]">
                          Interval: {bundle.defaultIntervals.join(", ")} min
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-2">
                  {INDICATOR_BUNDLES.map((bundle) => {
                    const selected = selectedBundles.includes(bundle.id);
                    const activeIntervals = customIntervals[bundle.id] ?? bundle.defaultIntervals;
                    return (
                      <div
                        key={bundle.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleBundle(bundle.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            toggleBundle(bundle.id);
                          }
                        }}
                        className={cn(
                          "border border-[var(--outline)] bg-background/80 px-3 py-3 cursor-pointer transition",
                          selected ? "outline outline-2 outline-offset-[-2px]" : "opacity-80 hover:opacity-100"
                        )}
                      >
                        <div
                          className={cn(
                            "font-mono text-sm",
                            selected ? "text-foreground" : "text-muted-foreground"
                          )}
                        >
                          {bundle.label}
                        </div>
                        <div className="pixel-label text-[10px] text-muted-foreground mt-1">
                          {bundle.indicators.join(" · ")}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {bundle.intervalOptions.map((option) => {
                            const active = activeIntervals.includes(option);
                            return (
                              <Button
                                key={`${bundle.id}-${option}`}
                                type="button"
                                size="sm"
                                variant={active ? "default" : "outline"}
                                className="rounded-none px-2 py-1 font-mono text-xs"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleInterval(bundle.id, option);
                                }}
                              >
                                {option}m
                              </Button>
                            );
                          })}
                        </div>
                        <p className="pixel-label mt-2 text-[9px] text-muted-foreground uppercase tracking-[0.24em]">
                          Active: {[...activeIntervals].sort((a, b) => a - b).join(", ")} min
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="space-y-2">
                <h4 className="pixel-label text-xs text-muted-foreground uppercase tracking-wide">
                  Selected packs
                </h4>
                {selectedBundles.length ? (
                  <div className="grid gap-2">
                    {selectedBundles.map((bundleId) => {
                      const bundle = INDICATOR_BUNDLES.find((item) => item.id === bundleId);
                      if (!bundle) return null;
                      return (
                        <div key={bundle.id} className="rounded-sm border border-dashed border-[var(--outline)] px-3 py-2">
                          <div className="font-mono text-xs">{bundle.label}</div>
                          <div className="pixel-label text-[10px] text-muted-foreground mt-1">
                            {bundle.indicators.join(" · ")}
                          </div>
                          <div className="pixel-label text-[9px] text-muted-foreground mt-1 uppercase tracking-[0.24em]">
                            Interval: {(customIntervals[bundle.id] ?? bundle.defaultIntervals).join(", ")} min
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <span className="text-muted-foreground text-xs">None</span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="pixel-card rounded-sm">
            <CardHeader className="pb-4">
              <CardTitle className="pixel-label">5. Funding & Guardrails</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="grid gap-2">
                <span className="pixel-label text-xs text-muted-foreground uppercase tracking-wide">
                  Seed amount (USD)
                </span>
                <Input
                  value={seedAmount}
                  onChange={(event) => setSeedAmount(event.target.value)}
                  type="number"
                  min={100}
                  step={100}
                  className="rounded-none font-mono"
                  required
                />
              </label>
              <label className="grid gap-2">
                <span className="pixel-label text-xs text-muted-foreground uppercase tracking-wide">
                  Risk budget
                </span>
                <Select value={riskBudget} onValueChange={setRiskBudget}>
                  <SelectTrigger className="rounded-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low - conservative</SelectItem>
                    <SelectItem value="medium">Medium - balanced</SelectItem>
                    <SelectItem value="high">High - aggressive</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            </CardContent>
          </Card>

          <Card className="pixel-card rounded-sm">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="pixel-label">6. Advanced Agent Voice</CardTitle>
                  <p className="pixel-label text-[10px] text-muted-foreground">
                    Customize the system and user prompts that guide this agent&apos;s commentary and behavior.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-none"
                  onClick={() => setShowAdvanced((prev) => !prev)}
                >
                  {showAdvanced ? "Hide" : "Show"}
                </Button>
              </div>
            </CardHeader>
            {showAdvanced && (
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <label className="pixel-label text-[10px] text-muted-foreground uppercase tracking-[0.24em]" htmlFor="system-prompt">
                    System prompt
                  </label>
                  <textarea
                    id="system-prompt"
                    value={systemPrompt}
                    onChange={(event) => setSystemPrompt(event.target.value)}
                    rows={4}
                    className="font-mono text-sm rounded-none border border-[var(--outline)] bg-background/80 px-3 py-2 outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="pixel-label text-[10px] text-muted-foreground uppercase tracking-[0.24em]" htmlFor="user-prompt">
                    User prompt
                  </label>
                  <textarea
                    id="user-prompt"
                    value={userPrompt}
                    onChange={(event) => setUserPrompt(event.target.value)}
                    rows={4}
                    className="font-mono text-sm rounded-none border border-[var(--outline)] bg-background/80 px-3 py-2 outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                  />
                </div>
                <p className="pixel-label text-[10px] text-muted-foreground">
                  Prompts will sync with the agent&apos;s commentary channel once deployed.
                </p>
              </CardContent>
            )}
          </Card>

          <div className="flex justify-end">
            <Button type="submit" size="lg" className="rounded-none px-8">
              Launch Agent
            </Button>
          </div>
        </div>

        <aside className="space-y-5">
          <Card className="pixel-card rounded-sm">
            <CardHeader className="pb-4">
              <CardTitle className="pixel-label">Deployment Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="pixel-label text-xs text-muted-foreground uppercase tracking-wide">
                  Name
                </div>
                <div className="font-mono mt-1">{agentName || "—"}</div>
              </div>
              <div>
                <div className="pixel-label text-xs text-muted-foreground uppercase tracking-wide">
                  Model
                </div>
                <div className="font-mono mt-1">{modelLabel}</div>
              </div>
              <div>
                <div className="pixel-label text-xs text-muted-foreground uppercase tracking-wide">
                  Assets
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {selectedAssets.length ? (
                    selectedAssets.map((symbol) => {
                      const asset = ASSET_LOOKUP[symbol];
                      return (
                        <Badge key={symbol} variant="secondary" className="rounded-none">
                          {symbol}
                          {asset ? ` · ${asset.name}` : null}
                        </Badge>
                      );
                    })
                  ) : (
                    <span className="pixel-label text-xs text-muted-foreground">None selected</span>
                  )}
                </div>
              </div>
              <div>
                <div className="pixel-label text-xs text-muted-foreground uppercase tracking-wide">
                  Strategy force
                </div>
                <div className="font-mono mt-1">{forceDetail?.label ?? "—"}</div>
              </div>
              <div>
                <div className="pixel-label text-xs text-muted-foreground uppercase tracking-wide">
                  Indicator context
                </div>
                <div className="mt-1 flex flex-col gap-1">
                  {selectedBundles.length ? (
                    selectedBundles.map((bundleId) => {
                      const bundle = INDICATOR_BUNDLES.find((item) => item.id === bundleId);
                      if (!bundle) return null;
                      return (
                        <div key={bundle.id} className="rounded-sm border border-[var(--outline)] px-3 py-2">
                          <div className="font-mono text-sm">{bundle.label}</div>
                          <div className="pixel-label text-xs text-muted-foreground mt-1">
                            {bundle.indicators.join(" · ")}
                          </div>
                          <div className="pixel-label text-[9px] text-muted-foreground mt-1 uppercase tracking-[0.24em]">
                            Interval: {(customIntervals[bundle.id] ?? bundle.defaultIntervals).join(", ")} min
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <span className="pixel-label text-xs text-muted-foreground">No context provided</span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="pixel-card border border-[var(--outline)] rounded-sm p-3">
                  <div className="pixel-label text-xs text-muted-foreground uppercase tracking-wide">
                    Seed
                  </div>
                  <div className="font-mono text-lg">${Number(seedAmount || 0).toLocaleString()}</div>
                </div>
                <div className="pixel-card border border-[var(--outline)] rounded-sm p-3">
                  <div className="pixel-label text-xs text-muted-foreground uppercase tracking-wide">
                    Risk window
                  </div>
                  <div className="font-mono text-lg">{estimatedDrawdown}</div>
                </div>
              </div>
              <div className="pixel-label text-xs text-muted-foreground border-t border-dashed border-[var(--outline)] pt-3">
                Deployment typically takes under 30 seconds. You can pause, top-up, or clone once the agent is live.
              </div>
            </CardContent>
          </Card>
        </aside>
      </form>
    </div>
  );
}
