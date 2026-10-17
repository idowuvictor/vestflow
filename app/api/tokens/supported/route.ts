import { NextRequest, NextResponse } from "next/server";
import { getKnownTokens } from "@/indexer/src/db";
import { parseNetwork } from "@/indexer/src/config";
import { createIpBasedRateLimiter } from "@/lib/rateLimit";
import { withLogging } from "@/lib/requestLogger";

const rateLimiter = createIpBasedRateLimiter(60_000, 60);

/**
 * GET /api/tokens/supported
 *
 * Returns all tokens seen in the indexer across schedules, gives, and streams.
 * Used by clients to populate token selectors and validate token addresses.
 *
 * Query params:
 *   - network testnet | mainnet
 *
 * Response:
 *   { tokens: string[] }
 */
export const GET = withLogging(async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  const rateLimitResponse = await rateLimiter(request);
  if (rateLimitResponse) return rateLimitResponse;

  const network = parseNetwork(
    request.nextUrl.searchParams.get("network") || undefined,
  );

  try {
    const tokens = getKnownTokens(network);

    return NextResponse.json(
      { tokens },
      {
        headers: {
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (error) {
    console.error("Error in GET /api/tokens/supported:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
});
