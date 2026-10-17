import { NextRequest, NextResponse } from "next/server";
import { queryGives } from "@/indexer/src/db";
import { parseNetwork } from "@/indexer/src/config";
import { createIpBasedRateLimiter } from "@/lib/rateLimit";
import { withLogging } from "@/lib/requestLogger";

const rateLimiter = createIpBasedRateLimiter(60_000, 60);

const STELLAR_ADDRESS_RE = /^G[A-Z2-7]{55}$/;

/**
 * GET /api/gives/received/:address
 *
 * Returns paginated gives received by a Stellar address.
 *
 * Query params:
 *   - limit   integer 1–100, default 20
 *   - cursor  opaque pagination cursor from previous response
 *   - network testnet | mainnet
 *
 * Response sorted by timestamp descending:
 *   {
 *     address:     string,
 *     gives:       Array<{ id, sender, token, amount, ledger, timestamp }>,
 *     next_cursor: string | null
 *   }
 */
export const GET = withLogging(async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
): Promise<NextResponse> {
  const rateLimitResponse = await rateLimiter(request);
  if (rateLimitResponse) return rateLimitResponse;

  const { address } = await params;

  if (!address || !STELLAR_ADDRESS_RE.test(address)) {
    return NextResponse.json(
      { error: "Invalid or missing Stellar address" },
      { status: 400 },
    );
  }

  const rawLimit = request.nextUrl.searchParams.get("limit");
  let limit = 20;
  if (rawLimit != null) {
    const parsed = Number(rawLimit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
      return NextResponse.json(
        { error: "limit must be an integer between 1 and 100" },
        { status: 400 },
      );
    }
    limit = parsed;
  }

  const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
  const network = parseNetwork(
    request.nextUrl.searchParams.get("network") || undefined,
  );

  try {
    const result = queryGives({
      receiver: address,
      limit,
      cursor,
      network,
    });

    if (result === null) {
      return NextResponse.json(
        { error: "cursor is invalid" },
        { status: 400 },
      );
    }

    const gives = result.items.map((g) => ({
      id: g.id,
      sender: g.sender,
      token: g.token,
      amount: g.amount,
      ledger: g.ledger,
      timestamp: g.timestamp,
    }));

    return NextResponse.json(
      { address, gives, next_cursor: result.nextCursor },
      {
        headers: {
          "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
        },
      },
    );
  } catch (error) {
    console.error(`Error in GET /api/gives/received/${address}:`, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
});
