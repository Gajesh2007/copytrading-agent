import { NextRequest, NextResponse } from "next/server";

// Fetch vault data from Hyperliquid Info API
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const vaultAddress = searchParams.get("vault");

  if (!vaultAddress) {
    return NextResponse.json({ error: "Missing vault address" }, { status: 400 });
  }

  try {
    // Fetch clearinghouse state
    const stateResponse = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "clearinghouseState",
        user: vaultAddress,
      }),
    });

    if (!stateResponse.ok) {
      return NextResponse.json(
        { error: `Hyperliquid API error: ${stateResponse.status}` },
        { status: stateResponse.status }
      );
    }

    const stateData = await stateResponse.json();
    
    // Extract equity value
    const equity = stateData.marginSummary?.accountValue 
      ? parseFloat(stateData.marginSummary.accountValue) 
      : 0;

    // Calculate total unrealized PNL from all positions
    let totalPnl = 0;
    if (stateData.assetPositions && Array.isArray(stateData.assetPositions)) {
      totalPnl = stateData.assetPositions.reduce((sum: number, pos: unknown) => {
        const position = pos as { position?: { unrealizedPnl?: string } };
        const unrealizedPnl = parseFloat(position.position?.unrealizedPnl || "0");
        return sum + unrealizedPnl;
      }, 0);
    }

    // Extract total account value and withdrawable
    const accountValue = parseFloat(stateData.marginSummary?.accountValue || "0");
    const withdrawable = parseFloat(stateData.withdrawable || "0");

    return NextResponse.json(
      { 
        vaultAddress,
        equity,
        accountValue,
        withdrawable,
        totalPnl,
        positions: stateData.assetPositions || [],
        marginSummary: stateData.marginSummary || {},
      },
      {
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Failed to fetch Hyperliquid data:", error);
    return NextResponse.json(
      { error: "Failed to fetch vault data" },
      { status: 500 }
    );
  }
}

