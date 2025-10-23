import { NextRequest, NextResponse } from "next/server";

// Fetch positions for all vaults from Hyperliquid
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const vaults = searchParams.get("vaults");

  if (!vaults) {
    return NextResponse.json({ error: "Missing vault addresses" }, { status: 400 });
  }

  const vaultAddresses = vaults.split(",");

  try {
    // First, fetch current market prices
    const metaResponse = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "meta" }),
    });

    const metaData = await metaResponse.json();
    const priceMap: Record<string, number> = {};
    
    // Build a map of coin -> current mark price
    if (metaData.universe && Array.isArray(metaData.universe)) {
      metaData.universe.forEach((asset: unknown) => {
        const assetData = asset as { name?: string };
        if (assetData.name) {
          priceMap[assetData.name] = 0; // Will be filled from allMids
        }
      });
    }

    // Fetch all current mark prices
    const allMidsResponse = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "allMids" }),
    });

    const allMids = await allMidsResponse.json();
    if (metaData.universe && Array.isArray(metaData.universe)) {
      metaData.universe.forEach((asset: unknown, idx: number) => {
        const assetData = asset as { name?: string };
        if (assetData.name && allMids[idx]) {
          priceMap[assetData.name] = parseFloat(allMids[idx]);
        }
      });
    }

    // Fetch positions for all vaults in parallel
    const promises = vaultAddresses.map(async (vaultAddress) => {
      try {
        const response = await fetch("https://api.hyperliquid.xyz/info", {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "clearinghouseState",
            user: vaultAddress.trim(),
          }),
        });

        if (!response.ok) {
          console.error(`Failed to fetch positions for ${vaultAddress}`);
          return { vaultAddress, positions: [] };
        }

        const data = await response.json();
        const positions = (data.assetPositions || []).map((pos: unknown) => {
          const position = pos as { 
            position: { 
              coin: string; 
              entryPx?: string; 
              szi: string; 
              unrealizedPnl?: string;
              leverage?: { value?: string };
              marginUsed?: string;
            } 
          };
          const coin = position.position.coin;
          const entryPx = parseFloat(position.position.entryPx || "0");
          const size = parseFloat(position.position.szi);
          const unrealizedPnl = parseFloat(position.position.unrealizedPnl || "0");
          
          // Calculate mark price from unrealized PNL if available
          // unrealizedPnl = (markPrice - entryPrice) * size
          // So: markPrice = (unrealizedPnl / size) + entryPrice
          let markPrice = priceMap[coin];
          if (!markPrice && size !== 0 && entryPx > 0) {
            markPrice = (unrealizedPnl / size) + entryPx;
          }
          if (!markPrice) {
            markPrice = entryPx;
          }
          
          return {
            coin,
            size,
            entryPrice: entryPx,
            markPrice,
            leverage: parseFloat(position.position.leverage?.value || "0"),
            unrealizedPnl,
            marginUsed: parseFloat(position.position.marginUsed || "0"),
          };
        });

        return { vaultAddress, positions };
      } catch (err) {
        console.error(`Error fetching positions for ${vaultAddress}:`, err);
        return { vaultAddress, positions: [] };
      }
    });

    const results = await Promise.all(promises);
    const positionsMap: Record<string, unknown[]> = {};
    
    results.forEach((result) => {
      positionsMap[result.vaultAddress] = result.positions;
    });

    return NextResponse.json(positionsMap, {
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to fetch positions:", error);
    return NextResponse.json(
      { error: "Failed to fetch positions" },
      { status: 500 }
    );
  }
}

