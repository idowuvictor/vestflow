"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { NATIVE_TOKEN, stroopsToXlm } from "@/lib/stellar";

interface Give {
  id: string;
  sender: string;
  receiver: string;
  token: string;
  amount: string;
  timestamp: number;
  ledger: number;
  tx_hash: string | null;
}

function tokenLabel(token: string): string {
  if (token === NATIVE_TOKEN) return "XLM";
  return `${token.slice(0, 8)}...${token.slice(-4)}`;
}

function truncateAddress(addr: string): string {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function GiveReceiptPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [give, setGive] = useState<Give | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchGive = async () => {
      try {
        const res = await fetch(`/api/gives/${id}`);
        if (!res.ok) {
          setError("Give not found");
          return;
        }
        const data = await res.json();
        setGive(data);
      } catch (err) {
        setError("Failed to load give details");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchGive();
  }, [id]);

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center text-zinc-400">Loading...</div>
        </main>
      </>
    );
  }

  if (error || !give) {
    return (
      <>
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">
            <p className="text-zinc-400 mb-4">{error || "Give not found"}</p>
            <Link href="/app" className="text-violet-400 hover:text-violet-300">
              ← Back to dashboard
            </Link>
          </div>
        </main>
      </>
    );
  }

  const giveDate = new Date(give.timestamp * 1000);
  const amount = BigInt(give.amount);
  const isNative = give.token === NATIVE_TOKEN;
  const displayAmount = stroopsToXlm(amount);

  return (
    <>
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Link href="/app" className="text-sm text-zinc-400 hover:text-zinc-300 mb-6 inline-block">
          ← Back to dashboard
        </Link>

        <div className="card p-8 rounded-2xl border border-white/10">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Give Receipt</h1>
            <p className="text-zinc-400">Sharing your contribution</p>
          </div>

          <div className="space-y-6">
            {/* Amount */}
            <div className="text-center py-6 border border-white/10 rounded-lg bg-white/[0.02]">
              <div className="text-sm text-zinc-500 mb-2">Amount</div>
              <div className="text-4xl font-bold text-emerald-400">
                {displayAmount} {tokenLabel(give.token)}
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Sender */}
              <div className="p-4 border border-white/10 rounded-lg bg-white/[0.02]">
                <div className="text-xs text-zinc-500 mb-2 uppercase tracking-wider">From</div>
                <div className="font-mono text-sm text-zinc-300" title={give.sender}>
                  {truncateAddress(give.sender)}
                </div>
              </div>

              {/* Receiver */}
              <div className="p-4 border border-white/10 rounded-lg bg-white/[0.02]">
                <div className="text-xs text-zinc-500 mb-2 uppercase tracking-wider">To</div>
                <div className="font-mono text-sm text-zinc-300" title={give.receiver}>
                  {truncateAddress(give.receiver)}
                </div>
              </div>

              {/* Token */}
              <div className="p-4 border border-white/10 rounded-lg bg-white/[0.02]">
                <div className="text-xs text-zinc-500 mb-2 uppercase tracking-wider">Token</div>
                <div className="font-mono text-sm text-zinc-300" title={give.token}>
                  {tokenLabel(give.token)}
                </div>
              </div>

              {/* Date */}
              <div className="p-4 border border-white/10 rounded-lg bg-white/[0.02]">
                <div className="text-xs text-zinc-500 mb-2 uppercase tracking-wider">Date</div>
                <div className="text-sm text-zinc-300">
                  {giveDate.toLocaleDateString()} {giveDate.toLocaleTimeString()}
                </div>
              </div>

              {/* Event ID */}
              <div className="p-4 border border-white/10 rounded-lg bg-white/[0.02] md:col-span-2">
                <div className="text-xs text-zinc-500 mb-2 uppercase tracking-wider">Event ID</div>
                <div className="font-mono text-xs text-zinc-400 break-all" title={give.id}>
                  {give.id}
                </div>
              </div>
            </div>

            {/* Share info */}
            <div className="p-4 border border-white/10 rounded-lg bg-white/[0.02] text-center">
              <p className="text-xs text-zinc-500">
                Share this page URL to acknowledge your contribution
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
