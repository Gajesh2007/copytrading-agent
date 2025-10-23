import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch("https://nof1.ai/api/leaderboard", {
      cache: "no-store",
      headers: {
        "accept": "application/json",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Nof1 API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, {
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to fetch Nof1 leaderboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard data" },
      { status: 500 }
    );
  }
}

