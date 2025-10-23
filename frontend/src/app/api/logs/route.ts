import { NextRequest, NextResponse } from "next/server";

// Proxy logs fetch to avoid CORS and hide direct upstream URL from the client
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  try {
    const upstream = await fetch(url, {
      // Prevent Next.js from caching logs; these are live-ish
      cache: "no-store",
      headers: {
        "accept": "application/json, text/plain, */*",
      },
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream error ${upstream.status}` },
        { status: upstream.status },
      );
    }

    const contentType = upstream.headers.get("content-type") || "text/plain";
    // Try JSON first, fallback to text
    if (contentType.includes("application/json")) {
      const data = await upstream.json();
      return NextResponse.json(data, {
        headers: {
          "cache-control": "no-store",
        },
      });
    }

    const text = await upstream.text();
    return new NextResponse(text, {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}


