"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ScheduleData,
  stroopsToXlm,
  NATIVE_TOKEN,
  setStream,
  squeezeStream,
  claimVested,
  batchGive,
  xlmToStroops,
} from "@/lib/stellar";
import { getTokenSymbol } from "@/lib/tokens";
import { balanceStatus, isExpiringSoon, isExpiringThisWeek, maxEndTime } from "@/lib/streamHealth";
import StreamBalanceBadge from "@/components/StreamBalanceBadge";
import StreamExpiryBanner from "@/components/StreamExpiryBanner";
import TokenIcon from "@/components/TokenIcon";
import StreamDetailDrawer from "@/components/StreamDetailDrawer";
import BatchTopUpModal from "@/components/BatchTopUpModal";

export type TxActionType = "set_stream" | "give" | "collect";

export interface RowTxState {
  status: "idle" | "pending" | "error";
  action?: TxActionType;
  error?: string;
}

export interface OutgoingStreamsListProps {
  schedules: ScheduleData[];
  publicKey: string;
  claimableMap: Map<number, bigint>;
  vestedMap: Map<number, bigint>;
  onEdit?: (s: ScheduleData) => void;
  onStop?: (s: ScheduleData) => void;
  onTopUp?: (s: ScheduleData) => void;
  onCollect?: (s: ScheduleData) => Promise<void> | void;
  onGive?: (s: ScheduleData, amount: string) => Promise<void> | void;
  onRefresh?: () => void;
  pendingTxMap?: Record<number, RowTxState>;
}

export default function OutgoingStreamsList({
  schedules,
  publicKey,
  claimableMap,
  vestedMap,
  onEdit,
  onStop,
  onTopUp,
  onCollect,
  onGive,
  onRefresh,
  pendingTxMap = {},
}: OutgoingStreamsListProps) {
  const [outgoingTokenFilter, setOutgoingTokenFilter] = useState<string>("all");
  const [outgoingPage, setOutgoingPage] = useState(1);
  const [showBatchTopUp, setShowBatchTopUp] = useState(false);
  const [selectedStreamForDrawer, setSelectedStreamForDrawer] = useState<ScheduleData | null>(null);
  const [localTxStates, setLocalTxStates] = useState<Record<number, RowTxState>>({});
  const PAGE_SIZE = 20;

  // Merge external pendingTxMap with localTxStates
  const txStates = { ...localTxStates, ...pendingTxMap };

  const outgoing = schedules.filter(
    (s) => s.grantor === publicKey && !s.revoked,
  );

  const uniqueOutgoingTokens = Array.from(new Set(outgoing.map((s) => s.token))).sort();

  const filteredOutgoing = outgoing.filter(
    (s) => outgoingTokenFilter === "all" || s.token === outgoingTokenFilter
  );

  if (outgoing.length === 0) return null;

  const totalPages = Math.ceil(filteredOutgoing.length / PAGE_SIZE);
  const startIdx = (outgoingPage - 1) * PAGE_SIZE;
  const endIdx = startIdx + PAGE_SIZE;
  const paginatedOutgoing = filteredOutgoing.slice(startIdx, endIdx);
  const canGoNext = outgoingPage < totalPages;
  const canGoPrev = outgoingPage > 1;

  const handleOutgoingFilterChange = (token: string) => {
    setOutgoingTokenFilter(token);
    setOutgoingPage(1);
  };

  const now = Math.floor(Date.now() / 1000);
  const expiringThisWeek = outgoing.filter((s) => isExpiringThisWeek(s, now));

  const clearRowError = (scheduleId: number) => {
    setLocalTxStates((prev) => ({
      ...prev,
      [scheduleId]: { status: "idle" },
    }));
  };

  // Transaction execution helpers with per-row pending and error state (#1043)
  const handleExecuteSetStream = async (s: ScheduleData, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (onStop) {
      onStop(s);
      return;
    }

    setLocalTxStates((prev) => ({
      ...prev,
      [s.id]: { status: "pending", action: "set_stream" },
    }));

    try {
      await setStream(
        publicKey,
        s.token,
        [{ receiver: s.beneficiary, amt_per_sec: 0n }],
        0n
      );
      setLocalTxStates((prev) => ({
        ...prev,
        [s.id]: { status: "idle" },
      }));
      onRefresh?.();
    } catch (err: any) {
      const msg = err?.message || "Failed to update stream configuration";
      setLocalTxStates((prev) => ({
        ...prev,
        [s.id]: { status: "error", action: "set_stream", error: msg },
      }));
    }
  };

  const handleExecuteCollect = async (s: ScheduleData, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setLocalTxStates((prev) => ({
      ...prev,
      [s.id]: { status: "pending", action: "collect" },
    }));

    try {
      if (onCollect) {
        await onCollect(s);
      } else {
        try {
          await squeezeStream(publicKey, s.id);
        } catch {
          await claimVested(publicKey, s.id);
        }
      }
      setLocalTxStates((prev) => ({
        ...prev,
        [s.id]: { status: "idle" },
      }));
      onRefresh?.();
    } catch (err: any) {
      const msg = err?.message || "Failed to collect tokens";
      setLocalTxStates((prev) => ({
        ...prev,
        [s.id]: { status: "error", action: "collect", error: msg },
      }));
    }
  };

  const handleExecuteGive = async (s: ScheduleData, amount: string = "1", e?: React.MouseEvent) => {
    e?.stopPropagation();
    setLocalTxStates((prev) => ({
      ...prev,
      [s.id]: { status: "pending", action: "give" },
    }));

    try {
      if (onGive) {
        await onGive(s, amount);
      } else {
        await batchGive(
          publicKey,
          [s.beneficiary],
          [xlmToStroops(amount)],
          s.token
        );
      }
      setLocalTxStates((prev) => ({
        ...prev,
        [s.id]: { status: "idle" },
      }));
      onRefresh?.();
    } catch (err: any) {
      const msg = err?.message || "Failed to send give transaction";
      setLocalTxStates((prev) => ({
        ...prev,
        [s.id]: { status: "error", action: "give", error: msg },
      }));
    }
  };

  return (
    <>
      <div className="card p-5 mb-6" data-testid="outgoing-streams-list">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Outgoing Streams</h2>
            <p className="text-sm text-zinc-500">
              All active vesting schedules sent from your wallet
            </p>
          </div>
          <div className="flex items-center gap-2">
            {expiringThisWeek.length >= 2 && (
              <button
                type="button"
                onClick={() => setShowBatchTopUp(true)}
                className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/20"
              >
                Top Up All Expiring ({expiringThisWeek.length})
              </button>
            )}
            <label htmlFor="outgoing-token-filter" className="text-xs text-zinc-500">
              Filter by token:
            </label>
            <select
              id="outgoing-token-filter"
              value={outgoingTokenFilter}
              onChange={(e) => handleOutgoingFilterChange(e.target.value)}
              className="text-xs bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-zinc-300 outline-none focus:border-violet-500/50 transition-colors"
            >
              <option value="all">All tokens</option>
              {uniqueOutgoingTokens.map((token) => {
                const isNative = token === NATIVE_TOKEN;
                const label = isNative ? "XLM (Native)" : `${token.slice(0, 8)}...${token.slice(-4)}`;
                return (
                  <option key={token} value={token}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        <div className="divide-y divide-white/10">
          {paginatedOutgoing.map((s) => {
            const ratePerSec = s.duration > 0 ? s.total_amount / BigInt(s.duration) : 0n;
            const ratePerDay = ratePerSec * 86400n;
            const endTime = s.start_time + s.duration;
            const secsLeft = Math.max(0, endTime - now);
            const daysLeft = Math.floor(secsLeft / 86400);
            const isNative = s.token === NATIVE_TOKEN;
            const tokenSym = isNative ? "XLM" : getTokenSymbol(s.token);
            const isBeneficiary = s.beneficiary === publicKey;
            const claimable = claimableMap.get(s.id) ?? 0n;
            const status = balanceStatus(s, vestedMap.get(s.id));
            const expiringSoon = status === "healthy" && isExpiringSoon(s, now);

            // Row transaction state (#1043)
            const rowTx = txStates[s.id] || { status: "idle" };
            const isPending = rowTx.status === "pending";

            return (
              <div
                key={s.id}
                role="button"
                tabIndex={isPending ? -1 : 0}
                aria-disabled={isPending}
                aria-label={`Stream #${s.id} details`}
                data-testid={`stream-row-${s.id}`}
                onClick={() => {
                  if (isPending) return;
                  setSelectedStreamForDrawer(s);
                }}
                onKeyDown={(e) => {
                  if (isPending) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedStreamForDrawer(s);
                  }
                }}
                className={`py-4 text-sm transition-all rounded-xl -mx-2 px-2 select-none ${
                  isPending
                    ? "opacity-80 bg-violet-500/[0.03] cursor-wait"
                    : "cursor-pointer hover:bg-white/[0.03] focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/schedule/${s.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold text-zinc-200 hover:text-violet-300 transition-colors"
                      >
                        Schedule #{s.id}
                      </Link>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">
                        {s.kind === "LinearWithCliff" ? "Lin+Cliff" : s.kind}
                      </span>
                      <StreamBalanceBadge status={status} onTopUp={() => onTopUp?.(s)} />

                      {/* Row Pending Spinner (#1043) */}
                      {isPending && (
                        <span
                          className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-300 animate-pulse"
                          data-testid={`row-pending-spinner-${s.id}`}
                        >
                          <svg
                            className="animate-spin h-3 w-3 text-violet-400"
                            viewBox="0 0 24 24"
                            fill="none"
                            aria-hidden="true"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8v8H4z"
                            />
                          </svg>
                          <span>
                            {rowTx.action === "set_stream"
                              ? "Updating stream…"
                              : rowTx.action === "collect"
                              ? "Collecting…"
                              : rowTx.action === "give"
                              ? "Sending give…"
                              : "Pending…"}
                          </span>
                        </span>
                      )}
                    </div>

                    <p className="text-zinc-500 font-mono text-xs truncate">
                      → {s.beneficiary.slice(0, 10)}…{s.beneficiary.slice(-6)}
                    </p>

                    {/* Stream amounts with TokenIcon (#1040) */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 items-center">
                      <span className="inline-flex items-center gap-1">
                        Rate:{" "}
                        <span className="text-zinc-300 inline-flex items-center gap-1 font-mono">
                          <TokenIcon token={s.token} symbol={tokenSym} />
                          {stroopsToXlm(ratePerDay)} {tokenSym}/day
                        </span>
                      </span>
                      <span>
                        Remaining:{" "}
                        <span className={daysLeft < 7 ? "text-amber-400" : "text-zinc-300"}>
                          {daysLeft}d
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        Total:{" "}
                        <span className="text-zinc-300 inline-flex items-center gap-1 font-mono">
                          <TokenIcon token={s.token} symbol={tokenSym} />
                          {stroopsToXlm(s.total_amount)} {tokenSym}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Row interactive action buttons: disabled during pending state (#1043) */}
                  <div
                    className={`flex items-center gap-2 shrink-0 flex-wrap justify-end ${
                      isPending ? "pointer-events-none opacity-50" : ""
                    }`}
                  >
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit ? onEdit(s) : (window.location.href = `/schedule/${s.id}`);
                      }}
                      className="px-3 py-2 min-h-[44px] rounded-lg text-xs font-medium border border-white/10 text-zinc-300 hover:border-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={(e) => handleExecuteSetStream(s, e)}
                      aria-label="Stop stream"
                      className="px-3 py-2 min-h-[44px] rounded-lg text-xs font-medium bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Stop stream
                    </button>
                    {isBeneficiary && claimable > 0n && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={(e) => handleExecuteCollect(s, e)}
                        className="px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 transition-colors flex items-center gap-1.5 grow sm:grow-0 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <TokenIcon token={s.token} symbol={tokenSym} />
                        Collect {stroopsToXlm(claimable)} {tokenSym}
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline Error State on Row if Tx Fails (#1043) */}
                {rowTx.status === "error" && (
                  <div
                    role="alert"
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2.5 text-xs bg-red-500/10 border border-red-500/20 text-red-300 rounded-lg p-2.5 flex items-center justify-between gap-2"
                    data-testid={`row-tx-error-${s.id}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-red-400 font-bold shrink-0">⚠️</span>
                      <span className="truncate">
                        {rowTx.error || "Transaction failed. Please try again."}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearRowError(s.id);
                      }}
                      className="text-zinc-400 hover:text-white px-1 py-0.5 text-xs rounded hover:bg-white/10 shrink-0"
                      aria-label="Dismiss error"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {expiringSoon && (
                  <div onClick={(e) => e.stopPropagation()} className="mt-2">
                    <StreamExpiryBanner
                      scheduleId={s.id}
                      endTime={maxEndTime(s)}
                      onTopUp={() => onTopUp?.(s)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-white/10">
            <button
              onClick={() => setOutgoingPage(Math.max(1, outgoingPage - 1))}
              disabled={!canGoPrev}
              className="px-4 py-2 text-sm font-medium border border-white/10 rounded-lg text-zinc-300 hover:border-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              ← Previous
            </button>
            <span className="text-sm text-zinc-400">
              Page {outgoingPage} of {totalPages}
            </span>
            <button
              onClick={() => setOutgoingPage(Math.min(totalPages, outgoingPage + 1))}
              disabled={!canGoNext}
              className="px-4 py-2 text-sm font-medium border border-white/10 rounded-lg text-zinc-300 hover:border-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Stream Detail Drawer opened on row click (#1042) */}
      <StreamDetailDrawer
        stream={selectedStreamForDrawer}
        isOpen={selectedStreamForDrawer !== null}
        onClose={() => setSelectedStreamForDrawer(null)}
        onStop={(stream) => handleExecuteSetStream(stream)}
      />

      <BatchTopUpModal
        schedules={expiringThisWeek}
        open={showBatchTopUp}
        onClose={() => setShowBatchTopUp(false)}
        onSuccess={() => {
          setShowBatchTopUp(false);
          onRefresh?.();
        }}
      />
    </>
  );
}
