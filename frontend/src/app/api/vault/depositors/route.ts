import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const vaultAddress = searchParams.get("vault");

  if (!vaultAddress) {
    return NextResponse.json({ error: "Missing vault address" }, { status: 400 });
  }

  try {
    const res = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ type: "vaultDetails", vaultAddress }),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Hyperliquid API error: ${res.status}` },
        { status: res.status },
      );
    }

    const data: Record<string, unknown> | null = await res.json();
    if (!data) {
      return NextResponse.json({ followers: [] }, { headers: { "cache-control": "no-store" } });
    }

    const toNumber = (v: unknown): number => {
      const n = Number(v ?? 0);
      return Number.isFinite(n) ? n : 0;
    };

    const followersRaw: ReadonlyArray<Record<string, unknown>> = Array.isArray((data as Record<string, unknown>).followers)
      ? ((data as Record<string, unknown>).followers as ReadonlyArray<Record<string, unknown>>)
      : [];

    const followers = followersRaw.map((f) => {
      const user = typeof f.user === "string" ? (f.user as string) : "Leader";
      const equity = toNumber(f.vaultEquity);
      const pnl = toNumber(f.pnl);
      const allTimePnl = toNumber(f.allTimePnl);
      const daysFollowing = Math.max(0, Math.floor(toNumber(f.daysFollowing)));
      const initial = equity - pnl;
      const roiPct = initial > 0 ? (pnl / initial) * 100 : 0;
      return {
        user,
        equity,
        pnl,
        allTimePnl,
        daysFollowing,
        roiPct,
      };
    });

    return NextResponse.json(
      {
        vault: data.vaultAddress,
        name: data.name,
        leader: data.leader,
        followers,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("Failed to fetch vault depositors:", error);
    return NextResponse.json({ error: "Failed to fetch vault depositors" }, { status: 500 });
  }
}


