"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ScheduleData,
  stroopsToXlm,
  truncate,
  formatDate,
  NATIVE_TOKEN,
  NETWORK,
} from "@/lib/stellar";
import { getTokenSymbol } from "@/lib/tokens";
import TokenIcon from "@/components/TokenIcon";
import AddressLabel from "@/components/AddressLabel";
import CopyButton from "@/components/CopyButton";

export interface StreamDetailDrawerProps {
  stream: ScheduleData | null;
  isOpen: boolean;
  onClose: () => void;
  onStop?: (stream: ScheduleData) => void;
  onCollect?: (stream: ScheduleData) => void;
  onTopUp?: (stream: ScheduleData) => void;
}

interface StreamHistoryEvent {
  id: string;
  type: string;
  date: string;
  amount?: string;
  description: string;
}

export default function StreamDetailDrawer({
  stream,
  isOpen,
  onClose,
  onStop,
  onCollect,
  onTopUp,
}: StreamDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<"details" | "history">("details");
  const [historyEvents, setHistoryEvents] = useState<StreamHistoryEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  // Accessible Focus Management & Escape Key Handling
  useEffect(() => {
    if (!isOpen || !stream) return;

    // Save previous focus
    previouslyFocusedElementRef.current = document.activeElement as HTMLElement | null;

    // Focus close button on open
    setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      // Focus trap
      if (e.key === "Tab" && drawerRef.current) {
        const focusableElements = drawerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      // Restore previous focus on close
      previouslyFocusedElementRef.current?.focus();
    };
  }, [isOpen, stream, onClose]);

  // Load stream history when history tab is activated
  useEffect(() => {
    if (!isOpen || !stream || activeTab !== "history") return;

    let isMounted = true;
    setHistoryLoading(true);

    fetch(`/api/events?schedule_id=${stream.id}&network=${NETWORK}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (!isMounted) return;
        const events = Array.isArray(data.events) ? data.events : [];
        if (events.length > 0) {
          setHistoryEvents(
            events.map((e: any) => ({
              id: String(e.id || Math.random()),
              type: String(e.event_type || "stream_event"),
              date: e.ledger_closed_at
                ? new Date(e.ledger_closed_at).toLocaleDateString()
                : "Recent",
              amount: e.amount ? `${stroopsToXlm(BigInt(e.amount))} ${getTokenSymbol(stream.token)}` : undefined,
              description: e.event_type === "claimed" ? "Claimed tokens" : e.event_type || "Stream event",
            }))
          );
        } else {
          // Fallback to baseline stream lifecycle events
          setHistoryEvents([
            {
              id: "init",
              type: "created",
              date: formatDate(stream.start_time),
              description: "Stream configured and started",
            },
            ...(stream.claimed > 0n
              ? [
                  {
                    id: "claimed",
                    type: "claimed",
                    date: "Recent",
                    amount: `${stroopsToXlm(stream.claimed)} ${getTokenSymbol(stream.token)}`,
                    description: "Tokens claimed by beneficiary",
                  },
                ]
              : []),
          ]);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setHistoryEvents([
          {
            id: "init",
            type: "created",
            date: formatDate(stream.start_time),
            description: "Stream configured and started",
          },
          ...(stream.claimed > 0n
            ? [
                {
                  id: "claimed",
                  type: "claimed",
                  date: "Recent",
                  amount: `${stroopsToXlm(stream.claimed)} ${getTokenSymbol(stream.token)}`,
                  description: "Tokens claimed by beneficiary",
                },
              ]
            : []),
        ]);
      })
      .finally(() => {
        if (isMounted) setHistoryLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, stream, activeTab]);

  if (!isOpen || !stream) return null;

  const now = Math.floor(Date.now() / 1000);
  const isNative = stream.token === NATIVE_TOKEN;
  const tokenSymbol = isNative ? "XLM" : getTokenSymbol(stream.token);
  const ratePerSec = stream.duration > 0 ? stream.total_amount / BigInt(stream.duration) : 0n;
  const ratePerDay = ratePerSec * 86400n;
  const projectedEndTimestamp = stream.start_time + stream.duration;
  const remainingBalance = stream.total_amount > stream.claimed ? stream.total_amount - stream.claimed : 0n;
  const isCompleted = projectedEndTimestamp <= now;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      aria-labelledby="stream-drawer-title"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop for click outside */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
        data-testid="stream-drawer-backdrop"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div
          ref={drawerRef}
          className="w-screen max-w-md bg-zinc-900 border-l border-white/10 shadow-2xl flex flex-col justify-between"
          data-testid="stream-detail-drawer"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs uppercase font-semibold tracking-wider text-violet-400">
                  Stream Config & Details
                </span>
                <h2 id="stream-drawer-title" className="text-xl font-bold text-white mt-1">
                  Schedule #{stream.id}
                </h2>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                aria-label="Close drawer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-4 mt-6 border-b border-white/5" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "details"}
                onClick={() => setActiveTab("details")}
                className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "details"
                    ? "border-violet-500 text-white"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Details
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "history"}
                onClick={() => setActiveTab("history")}
                className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "history"
                    ? "border-violet-500 text-white"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                History Tab
              </button>
            </div>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {activeTab === "details" ? (
              <div className="space-y-5">
                {/* Receiver Field */}
                <div className="bg-white/3 rounded-xl p-4 border border-white/5 space-y-1">
                  <span className="text-xs text-zinc-400 font-medium">Receiver</span>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <div className="min-w-0">
                      <Link
                        href={`/profile/${encodeURIComponent(stream.beneficiary)}`}
                        className="text-sm font-mono text-zinc-200 hover:text-violet-300 transition-colors truncate block"
                        title={stream.beneficiary}
                      >
                        {stream.beneficiary}
                      </Link>
                      <AddressLabel address={stream.beneficiary} compact />
                    </div>
                    <CopyButton value={stream.beneficiary} label="Copy receiver address" />
                  </div>
                </div>

                {/* Token Field */}
                <div className="bg-white/3 rounded-xl p-4 border border-white/5 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-zinc-400 font-medium">Token</span>
                    <div className="flex items-center gap-2 mt-1">
                      <TokenIcon token={stream.token} symbol={tokenSymbol} size={18} />
                      <span className="font-semibold text-white">{tokenSymbol}</span>
                      <span className="text-xs text-zinc-500 font-mono">
                        ({truncate(stream.token, 4, 4)})
                      </span>
                    </div>
                  </div>
                  <CopyButton value={stream.token} label="Copy token address" />
                </div>

                {/* Rate Field */}
                <div className="bg-white/3 rounded-xl p-4 border border-white/5 space-y-2">
                  <span className="text-xs text-zinc-400 font-medium">Streaming Rate</span>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">Rate per second</span>
                    <span className="font-mono text-sm text-zinc-200 flex items-center gap-1.5">
                      <TokenIcon token={stream.token} symbol={tokenSymbol} />
                      {stroopsToXlm(ratePerSec)} {tokenSymbol}/s
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">Rate per day</span>
                    <span className="font-mono text-sm font-semibold text-emerald-400 flex items-center gap-1.5">
                      <TokenIcon token={stream.token} symbol={tokenSymbol} />
                      {stroopsToXlm(ratePerDay)} {tokenSymbol}/day
                    </span>
                  </div>
                </div>

                {/* Balance Field */}
                <div className="bg-white/3 rounded-xl p-4 border border-white/5 space-y-2">
                  <span className="text-xs text-zinc-400 font-medium">Balance</span>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">Total Allocated</span>
                    <span className="font-mono text-sm text-zinc-200 flex items-center gap-1.5">
                      <TokenIcon token={stream.token} symbol={tokenSymbol} />
                      {stroopsToXlm(stream.total_amount)} {tokenSymbol}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">Remaining Balance</span>
                    <span className="font-mono text-sm text-amber-300 flex items-center gap-1.5">
                      <TokenIcon token={stream.token} symbol={tokenSymbol} />
                      {stroopsToXlm(remainingBalance)} {tokenSymbol}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">Claimed</span>
                    <span className="font-mono text-xs text-zinc-400">
                      {stroopsToXlm(stream.claimed)} {tokenSymbol}
                    </span>
                  </div>
                </div>

                {/* Dates: Start Date & Projected End */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/3 rounded-xl p-4 border border-white/5 space-y-1">
                    <span className="text-xs text-zinc-400 font-medium">Start Date</span>
                    <p className="text-xs font-semibold text-zinc-200">
                      {formatDate(stream.start_time)}
                    </p>
                  </div>
                  <div className="bg-white/3 rounded-xl p-4 border border-white/5 space-y-1">
                    <span className="text-xs text-zinc-400 font-medium">Projected End</span>
                    <p className={`text-xs font-semibold ${isCompleted ? "text-zinc-400" : "text-violet-300"}`}>
                      {formatDate(projectedEndTimestamp)}
                    </p>
                  </div>
                </div>

                {/* Stream Configuration metadata */}
                <div className="bg-white/3 rounded-xl p-4 border border-white/5 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Kind</span>
                    <span className="text-zinc-300">{stream.kind}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Status</span>
                    <span className={stream.revoked ? "text-red-400" : isCompleted ? "text-zinc-400" : "text-emerald-400"}>
                      {stream.revoked ? "Revoked" : isCompleted ? "Completed" : "Active"}
                    </span>
                  </div>
                  {stream.cliff_duration > 0 && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Cliff Duration</span>
                      <span className="text-zinc-300">{Math.round(stream.cliff_duration / 86400)} days</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* History Tab */
              <div className="space-y-4" data-testid="stream-history-tab">
                <p className="text-xs text-zinc-400">
                  Event log and transactions recorded for this stream.
                </p>

                {historyLoading ? (
                  <div className="space-y-3">
                    <div className="h-12 bg-white/5 rounded-lg animate-pulse" />
                    <div className="h-12 bg-white/5 rounded-lg animate-pulse" />
                  </div>
                ) : historyEvents.length === 0 ? (
                  <div className="p-8 text-center text-sm text-zinc-500 bg-white/2 rounded-xl border border-white/5">
                    No history events found for this stream.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {historyEvents.map((evt) => (
                      <div
                        key={evt.id}
                        className="p-3 bg-white/3 rounded-lg border border-white/5 flex items-start justify-between text-xs"
                      >
                        <div className="space-y-1">
                          <p className="font-semibold text-zinc-200">{evt.description}</p>
                          <span className="text-zinc-500">{evt.date}</span>
                        </div>
                        {evt.amount && (
                          <span className="font-mono text-emerald-400 font-semibold">{evt.amount}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-6 border-t border-white/10 flex items-center gap-3">
            <Link
              href={`/schedule/${stream.id}`}
              className="flex-1 py-2.5 px-4 text-center rounded-xl text-xs font-semibold text-zinc-200 border border-white/10 hover:border-white/20 transition-colors"
            >
              View Full Schedule
            </Link>
            {onStop && !stream.revoked && !isCompleted && (
              <button
                type="button"
                onClick={() => {
                  onStop(stream);
                  onClose();
                }}
                className="py-2.5 px-4 rounded-xl text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors"
              >
                Stop Stream
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
