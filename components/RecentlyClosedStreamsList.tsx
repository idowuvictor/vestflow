"use client";

import { useEffect, useState, useCallback } from "react";
import { NATIVE_TOKEN, NETWORK, stroopsToXlm } from "@/lib/stellar";

interface ClosedStream {
  receiver: string;
  token: string;
  close_time: number;
  total_streamed: string;
}

function tokenLabel(token: string): string {
  if (token === NATIVE_TOKEN) return "XLM";
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

function truncateAddress(addr: string): string {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

interface RecentlyClosedStreamsListProps {
  publicKey: string;
  refreshKey: number;
}

export default function RecentlyClosedStreamsList({ publicKey, refreshKey }: RecentlyClosedStreamsListProps) {
  const [streams, setStreams] = useState<ClosedStream[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStreams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/streams/closed/${publicKey}?limit=3&network=${NETWORK}`);
      if (!res.ok) {
        setStreams([]);
        return;
      }
      const data = await res.json();
      const items = Array.isArray(data.streams) ? data.streams : [];
      setStreams(items.slice(0, 3).map((s: any) => ({
        receiver: String(s.receiver ?? ""),
        token: String(s.token ?? NATIVE_TOKEN),
        close_time: Number(s.close_time ?? 0),
        total_streamed: String(s.total_streamed ?? "0"),
      })));
    } catch {
      setStreams([]);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    fetchStreams();
  }, [fetchStreams, refreshKey]);

  if (loading || streams.length === 0) return null;

  return (
    <div className="card p-5 mb-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold">Recently Closed Streams</h2>
          <p className="text-sm text-zinc-500">Last 3 streams that were closed</p>
        </div>
      </div>
      <div className="divide-y divide-white/10">
        {streams.map((stream, i) => {
          const closedDate = new Date(stream.close_time * 1000);
          const dateStr = closedDate.toLocaleDateString();
          return (
            <div key={`${stream.receiver}-${stream.token}-${i}`} className="flex items-start justify-between gap-4 py-3 text-sm">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="font-mono text-zinc-300 text-xs" title={stream.receiver}>
                  {truncateAddress(stream.receiver)}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-zinc-500">
                  <span>
                    Total:{" "}
                    <span className="text-zinc-300">
                      {stroopsToXlm(BigInt(stream.total_streamed))} {tokenLabel(stream.token)}
                    </span>
                  </span>
                  <span>
                    Closed:{" "}
                    <span className="text-zinc-300">{dateStr}</span>
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
