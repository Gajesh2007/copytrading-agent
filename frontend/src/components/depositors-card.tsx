"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Copy, Share2, Twitter } from "lucide-react";
import { useDepositors } from "@/hooks/use-depositors";
import { useRef, useState, useEffect } from "react";

function shortAddress(address: string) {
  if (!address) return "";
  if (address === "Leader") return address;
  const head = address.slice(0, 6);
  const tail = address.slice(-3);
  return `${head}...${tail}`;
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // noop
  }
}

function generatePnlImage(params: {
  appName: string;
  vaultName: string;
  user: string;
  equity: number;
  pnl: number;
  roiPct: number;
  hidePnl: boolean;
  hideEquity: boolean;
  vaultAddress: string;
}) {
  const width = 1000;
  const height = 560;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Helpers
  const setFont = (size: number, weight = "") => {
    ctx.font = `${weight ? weight + " " : ""}${size}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
  };
  const drawFittedText = (
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    desiredSize = 26,
    minSize = 14,
    color = "#e5e7eb",
    weight = "",
    align: CanvasTextAlign = "left",
  ) => {
    ctx.fillStyle = color;
    const prevAlign = ctx.textAlign;
    ctx.textAlign = align;
    let size = desiredSize;
    setFont(size, weight);
    let width = ctx.measureText(text).width;
    while (width > maxWidth && size > minSize) {
      size -= 1;
      setFont(size, weight);
      width = ctx.measureText(text).width;
    }
    if (width > maxWidth) {
      // Ellipsize
      let t = text;
      while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) {
        t = t.slice(0, -1);
      }
      ctx.fillText(t + "…", x, y);
    } else {
      ctx.fillText(text, x, y);
    }
    ctx.textAlign = prevAlign;
  };
  const formatMoney = (n: number, includeSign = true) => {
    const sign = includeSign ? (n < 0 ? "-" : n > 0 ? "+" : "") : "";
    const v = Math.abs(n);
    const fmt = (num: number, suffix = "") => `${sign}$${num.toFixed(2)}${suffix}`;
    if (v >= 1_000_000_000) return fmt(v / 1_000_000_000, "B");
    if (v >= 1_000_000) return fmt(v / 1_000_000, "M");
    if (v >= 10_000) return fmt(v / 1_000, "k");
    return fmt(v);
  };

  // Background
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#0f172a");
  gradient.addColorStop(1, "#111827");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Card
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 2;
  const pad = 40;
  ctx.fillRect(pad, pad, width - pad * 2, height - pad * 2);
  ctx.strokeRect(pad, pad, width - pad * 2, height - pad * 2);

  // Header text (branding prominent, tighter spacing)
  ctx.fillStyle = "#e5e7eb";
  setFont(32, "bold");
  drawFittedText(params.appName.toUpperCase(), pad + 28, pad + 48, width - pad * 2 - 56, 32, 18, "#e5e7eb", "bold");
  ctx.fillStyle = "#a1a1aa";
  setFont(14);
  drawFittedText("Track and deposit at SigmaArena.com", pad + 28, pad + 68, width - pad * 2 - 56, 14, 12, "#a1a1aa");
  ctx.fillStyle = "#e5e7eb";
  setFont(26);
  drawFittedText(params.vaultName || `${shortAddress(params.vaultAddress)}`, pad + 28, pad + 98, width - pad * 2 - 56, 26, 14, "#e5e7eb");

  // User text
  ctx.fillStyle = "#a1a1aa";
  setFont(16);
  drawFittedText("Depositor", pad + 28, pad + 138, width - pad * 2 - 56, 16, 12, "#a1a1aa");
  ctx.fillStyle = "#e5e7eb";
  setFont(26);
  drawFittedText(`${shortAddress(params.user)}`, pad + 28, pad + 168, width - pad * 2 - 56, 26, 14, "#e5e7eb");

  // Metrics
  const rowY = pad + 210;
  const metricPairs: Array<{ label: string; value: string }> = [];
  if (!params.hideEquity) {
    metricPairs.push({ label: "Equity", value: `$${params.equity.toFixed(2)}` });
  }
  metricPairs.push({ label: "ROI", value: `${params.roiPct >= 0 ? "+" : ""}${params.roiPct.toFixed(2)}%` });
  metricPairs.push({ label: "PnL", value: params.hidePnl ? "Hidden" : `${params.pnl >= 0 ? "+" : ""}$${params.pnl.toFixed(2)}` });

  const metricsCount = metricPairs.length;
  // Narrow the metrics band to reduce excessive horizontal spacing
  const sideMargin = 160;
  const leftX = pad + 28 + sideMargin;
  const rightX = width - pad - 28 - sideMargin;
  const step = metricsCount > 1 ? (rightX - leftX) / (metricsCount - 1) : 0;

  for (let i = 0; i < metricPairs.length; i++) {
    const { label, value } = metricPairs[i];
    const centerX = metricsCount > 1 ? leftX + step * i : (leftX + rightX) / 2;
    const columnWidth = metricsCount > 1 ? step : (rightX - leftX);
    const maxW = Math.max(120, columnWidth - 24);
    // Label
    drawFittedText(label, centerX, rowY, maxW, 14, 12, "#a1a1aa", "", "center");
    // Value
    const display = label === "Equity" && !params.hideEquity
      ? formatMoney(params.equity, false)
      : label === "PnL" && !params.hidePnl
        ? formatMoney(params.pnl, true)
        : value;
    const val = display;
    const color = val.startsWith("+") ? "#10b981" : val.startsWith("-") ? "#ef4444" : "#e5e7eb";
    drawFittedText(display, centerX, rowY + 36, maxW, 26, 14, color, "", "center");
  }

  // Footer
  ctx.fillStyle = "#9ca3af";
  ctx.font = "14px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
  const dateStr = new Date().toLocaleString();
  ctx.fillText(`Generated ${dateStr}`, pad + 28, height - pad - 20);

  const dataUrl = canvas.toDataURL("image/png");
  return dataUrl;
}

async function shareOnTwitter({ text, imageDataUrl }: { text: string; imageDataUrl?: string }) {
  // 1) Mobile: use native share sheet if available (attaches image)
  try {
    const nav = navigator as Navigator;
    if (imageDataUrl && nav.share) {
      const res = await fetch(imageDataUrl);
      const blob = await res.blob();
      const file = new File([blob], "sigmaarena_pnl.png", { type: blob.type || "image/png" });
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ text, files: [file] });
        return;
      }
    }
  } catch {
    // continue to clipboard + compose
  }

  // 2) Desktop: copy image to clipboard (if available), then open composer with text only
  if (
    imageDataUrl &&
    typeof window !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.write === "function" &&
    typeof ClipboardItem !== "undefined"
  ) {
    try {
      const res = await fetch(imageDataUrl);
      const blob = await res.blob();
      const item = new ClipboardItem({ [blob.type || "image/png"]: blob });
      await navigator.clipboard.write([item]);
    } catch {
      // if clipboard write fails, still open composer
    }
  }

  window.open(`https://x.com/compose/tweet?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
}

export function DepositorsCard({ vaultAddress }: { vaultAddress: `0x${string}` }) {
  const { depositors, vaultName, loading, error } = useDepositors(vaultAddress);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareHidePnl, setShareHidePnl] = useState(false);
  const [shareHideEquity, setShareHideEquity] = useState(false);
  const [shareFor, setShareFor] = useState<{ user: string; equity: number; pnl: number; roiPct: number } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const previewRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!shareFor) return;
    const url = generatePnlImage({
      appName: "sigmaarena.com",
      vaultName: vaultName || shortAddress(vaultAddress),
      user: shareFor.user,
      equity: shareFor.equity,
      pnl: shareFor.pnl,
      roiPct: shareFor.roiPct,
      hidePnl: shareHidePnl,
      hideEquity: shareHideEquity,
      vaultAddress,
    });
    if (typeof url === "string") setPreviewUrl(url);
  }, [shareFor, shareHidePnl, shareHideEquity, vaultName, vaultAddress]);

  return (
    <>
    <Card className="pixel-card rounded-sm border bg-background shadow-sm">
      <CardHeader className="gap-2">
        <CardTitle className="pixel-heading text-lg">Depositors {vaultName ? `· ${vaultName}` : ""}</CardTitle>
        <CardDescription className="font-mono text-xs text-muted-foreground">
          Individual depositors’ equity, PnL, ROI and time following the vault.
        </CardDescription>
      </CardHeader>
      <CardContent>
      {error ? <div className="text-sm text-red-500">{error}</div> : null}
      <div className="w-full overflow-x-auto">
        <table className="table-grid w-full text-[11px] sm:text-xs">
          <thead className="text-xs text-muted-foreground border-b">
            <tr>
              <th className="text-left px-2 py-2 sm:px-4 sm:py-3">Address</th>
              <th className="text-right px-2 py-2 sm:px-4 sm:py-3">Equity (USD)</th>
              <th className="text-right px-2 py-2 sm:px-4 sm:py-3">PnL (USD)</th>
              <th className="text-right px-2 py-2 sm:px-4 sm:py-3">ROI</th>
              <th className="text-right px-2 py-2 sm:px-4 sm:py-3">Share</th>
            </tr>
          </thead>
          <tbody>
            {depositors?.map((d) => (
              <tr key={d.user} className="font-mono transition-colors hover:bg-accent/50 border-b last:border-none">
                <td className="px-2 py-2 sm:px-4 sm:py-3 text-xs truncate max-w-[240px]" title={d.user}>
                  <div className="flex items-center gap-2">
                    <span>{shortAddress(d.user)}</span>
                    {d.user !== "Leader" && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon-sm" variant="ghost" className="rounded-none" aria-label="Copy address" onClick={() => copyToClipboard(d.user)}>
                            <Copy className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent sideOffset={6}>Copy address</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </td>
                <td className="px-2 py-2 sm:px-4 sm:py-3 text-right">${d.equity.toFixed(2)}</td>
                <td className={"px-2 py-2 sm:px-4 sm:py-3 text-right " + (d.allTimePnl >= 0 ? "text-emerald-600" : "text-rose-600")}>{d.allTimePnl >= 0 ? "+" : ""}${d.allTimePnl.toFixed(2)}</td>
                <td className={"px-2 py-2 sm:px-4 sm:py-3 text-right " + (d.roiPct >= 0 ? "text-emerald-600" : "text-rose-600")}>{d.roiPct >= 0 ? "+" : ""}{d.roiPct.toFixed(2)}%</td>
                <td className="px-2 py-2 sm:px-4 sm:py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon-sm"
                          variant="outline"
                          className="rounded-none"
                          aria-label="Share"
                          onClick={() => {
                            setShareFor({ user: d.user, equity: d.equity, pnl: d.allTimePnl, roiPct: d.roiPct });
                            setShareOpen(true);
                          }}
                        >
                          <Share2 className="size-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>Share</TooltipContent>
                    </Tooltip>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(!depositors || depositors.length === 0) && !loading ? (
        <div className="font-mono text-xs text-muted-foreground">No depositors yet.</div>
      ) : null}
      </CardContent>
    </Card>
    <Dialog open={shareOpen} onOpenChange={setShareOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="pixel-heading text-lg">Share Your Performance</DialogTitle>
          <DialogDescription className="font-mono text-xs text-muted-foreground">
            Image preview includes {vaultName || shortAddress(vaultAddress)} and sigmaarena.com
          </DialogDescription>
        </DialogHeader>
        {shareFor && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-mono text-xs text-muted-foreground">{shortAddress(shareFor.user)}</div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                  <input type="checkbox" checked={shareHideEquity} onChange={(e) => setShareHideEquity(e.target.checked)} />
                  Hide Equity
                </label>
                <label className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                  <input type="checkbox" checked={shareHidePnl} onChange={(e) => setShareHidePnl(e.target.checked)} />
                  Hide $PnL (show % only)
                </label>
              </div>
            </div>
            <div className="overflow-hidden rounded-sm border border-[var(--outline)] bg-muted/20 p-2">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img ref={previewRef} src={previewUrl} alt="PnL preview" className="w-full" />
              ) : (
                <div className="h-[220px]" />
              )}
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                className="rounded-none"
                onClick={async () => {
                  if (!shareFor) return;
                  const text = `I just hit ${shareFor.roiPct >= 0 ? "+" : ""}${shareFor.roiPct.toFixed(2)}% ROI by copytrading ${vaultName || "this vault"} on SigmaArena`;
                  const url = generatePnlImage({
                    appName: "sigmaarena.com",
                    vaultName: vaultName || shortAddress(vaultAddress),
                    user: shareFor.user,
                    equity: shareFor.equity,
                    pnl: shareFor.pnl,
                    roiPct: shareFor.roiPct,
                    hidePnl: shareHidePnl,
                    hideEquity: shareHideEquity,
                    vaultAddress,
                  });
                  await shareOnTwitter({ text, imageDataUrl: typeof url === "string" ? url : undefined });
                }}
              >
                <Twitter className="mr-2 size-3.5" /> Tweet
              </Button>
              <Button
                variant="default"
                className="rounded-none"
                onClick={() => {
                  if (!shareFor) return;
                  const url = generatePnlImage({
                    appName: "sigmaarena.com",
                    vaultName: vaultName || shortAddress(vaultAddress),
                    user: shareFor.user,
                    equity: shareFor.equity,
                    pnl: shareFor.pnl,
                    roiPct: shareFor.roiPct,
                    hidePnl: shareHidePnl,
                    hideEquity: shareHideEquity,
                    vaultAddress,
                  });
                  if (typeof url === "string") {
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `pnl_${shareFor.user}.png`;
                    link.click();
                  }
                }}
              >
                Download Image
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}


