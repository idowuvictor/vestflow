import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/indexer/src/db";
import { parseNetwork } from "@/indexer/src/config";
import { getOrSetCache } from "@/lib/redisCache";
import { withLogging } from "@/lib/requestLogger";

const CACHE_TTL_SECONDS = 60; // 1 minute — active stream counts change frequently

/**
 * GET /api/analytics/streams/active-count
 *
 * Returns the current open stream count per token. A stream is "active"
 * when its rate is non-zero and it has not been closed.
 *
 * Query params:
 *   - network testnet | mainnet
 *
 * Response:
 *   {
 *     tokens: Array<{ token: string, active_streams: number }>,
 *     total_active: number
 *   }
 */
export const GET = withLogging(async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  const network = parseNetwork(
    request.nextUrl.searchParams.get("network") || undefined,
  );

  try {
    const cacheKey = `analytics:streams:active-count:${network}`;
    const result = await getOrSetCache(cacheKey, CACHE_TTL_SECONDS, async () => {
      const db = getDb(network);
      const rows = db
        .prepare(
          `SELECT token, COUNT(*) as active_streams
           FROM streams
           WHERE rate > 0 AND closed_at IS NULL
           GROUP BY token
           ORDER BY active_streams DESC`,
        )
        .all() as { token: string; active_streams: number }[];

      const total = rows.reduce((sum, r) => sum + r.active_streams, 0);
      return { tokens: rows, total_active: total };
    });

    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=30" },
    });
  } catch (error) {
    console.error("Error fetching active stream counts:", error);
    return NextResponse.json(
      { error: "Failed to fetch active stream counts" },
      { status: 500 },
    );
  }
});
