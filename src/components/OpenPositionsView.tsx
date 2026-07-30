"use client";

import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import type { OpenPosition } from "@/lib/open-positions";
import type { RollChain } from "@/lib/rolls";
import { ClosePositionForm } from "@/components/ClosePositionForm";

interface OpenPositionsViewProps {
  positions: OpenPosition[];
  openRollChains?: RollChain[];
}

function positionKey(pos: OpenPosition): string {
  return `${pos.ticker}-${pos.expiry}-${pos.strike}-${pos.optionType}`;
}

export function OpenPositionsView({ positions, openRollChains = [] }: OpenPositionsViewProps) {
  const [selectedPosition, setSelectedPosition] = useState<OpenPosition | null>(null);
  const [prices, setPrices] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const isLoadingAny = Object.values(loading).some(Boolean);

  useEffect(() => {
    let cancelled = false;
    const fetchPrices = async () => {
      if (positions.length === 0) return;
      const keys = positions.map(positionKey);
      setLoading((prev) => keys.reduce((acc, k) => ({ ...acc, [k]: true }), { ...prev }));
      setErrors((prev) => keys.reduce((acc, k) => ({ ...acc, [k]: "" }), { ...prev }));
      const results = await Promise.allSettled(
        positions.map(async (pos) => {
          try {
            const url = `/api/option-quote?ticker=${encodeURIComponent(pos.ticker)}&expiry=${encodeURIComponent(pos.expiry)}&strike=${pos.strike}&type=${pos.optionType}`;
            const res = await fetch(url);
            const data = await res.json();
            if (!res.ok) {
              const errMsg = data?.detail ?? data?.error ?? `HTTP ${res.status}`;
              return { ok: false as const, error: errMsg };
            }
            const value = data?.last ?? data?.bid ?? data?.ask ?? null;
            return { ok: true as const, value };
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : "Network error";
            return { ok: false as const, error: errMsg };
          }
        })
      );
      if (cancelled) return;
      const nextPrices: Record<string, number | null> = {};
      const nextErrors: Record<string, string> = {};
      keys.forEach((k) => {
        nextErrors[k] = "";
      });
      results.forEach((r, i) => {
        const k = positionKey(positions[i]);
        if (r.status === "fulfilled") {
          if (r.value.ok) {
            nextPrices[k] = r.value.value;
          } else {
            nextErrors[k] = r.value.error;
          }
        } else {
          nextErrors[k] = r.reason?.message ?? "Request failed";
        }
      });
      setPrices((prev) => ({ ...prev, ...nextPrices }));
      setErrors((prev) => {
        const next = { ...prev };
        keys.forEach((k) => {
          next[k] = nextErrors[k] ?? "";
        });
        return next;
      });
      setLoading((prev) => keys.reduce((acc, k) => ({ ...acc, [k]: false }), { ...prev }));
    };
    fetchPrices();
    return () => {
      cancelled = true;
    };
  }, [positions, refreshTrigger]);

  return (
    <div className="space-y-8">
      {openRollChains.length > 0 && (
        <section>
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-white">Open roll chains</h2>
            <p className="text-sm text-slate-400">
              Confirmed rolls that still have an open leg. Realized P/L is deferred in Earnings until the chain is
              fully closed.
            </p>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-700 bg-slate-800/80 text-slate-400">
                <tr>
                  <th className="px-4 py-3">Started</th>
                  <th className="px-4 py-3">Last activity</th>
                  <th className="px-4 py-3">Ticker</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Chain</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Steps</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {openRollChains.map((chain) => (
                  <tr key={chain.id} className="hover:bg-slate-800/50">
                    <td className="px-4 py-2 text-slate-300">
                      {format(parseISO(chain.startedAt), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-2 text-slate-300">
                      {format(parseISO(chain.lastActivityAt), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-2 font-medium text-white">{chain.ticker}</td>
                    <td className="px-4 py-2 capitalize text-slate-300">{chain.optionType}</td>
                    <td className="px-4 py-2 text-slate-300">
                      ${chain.startStrike} {chain.startExpiry} → ${chain.endStrike} {chain.endExpiry}
                    </td>
                    <td className="px-4 py-2 text-slate-300">{chain.quantity}</td>
                    <td className="px-4 py-2 text-slate-300">{chain.steps.length}</td>
                    <td className="px-4 py-2">
                      <span className="rounded bg-amber-900/40 px-1.5 py-0.5 text-xs text-amber-300">
                        Open
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {positions.length > 0 ? (
        <section className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-white">Open contracts</h2>
            <div className="flex items-center gap-4">
              <span className="text-slate-400 text-sm">Hover over — in Current price to see errors.</span>
              <button
                type="button"
                onClick={() => setRefreshTrigger((t) => t + 1)}
                disabled={isLoadingAny}
                className="rounded bg-slate-700 px-3 py-1.5 text-sm text-white hover:bg-slate-600 disabled:opacity-50"
              >
                {isLoadingAny ? "Loading…" : "Refresh prices"}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-700 bg-slate-800/80 text-slate-400">
                <tr>
                  <th className="px-4 py-3">Ticker</th>
                  <th className="px-4 py-3">Side</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Strike</th>
                  <th className="px-4 py-3">Expiry</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Current price</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {positions.map((pos, i) => {
                  const k = positionKey(pos);
                  const price = prices[k];
                  const isLoading = loading[k];
                  return (
                    <tr
                      key={`${pos.ticker}-${pos.expiry}-${pos.strike}-${pos.optionType}-${pos.side}-${i}`}
                      className="hover:bg-slate-800/50"
                    >
                      <td className="px-4 py-2 font-medium text-white">{pos.ticker}</td>
                      <td className="px-4 py-2 capitalize text-slate-300">{pos.side}</td>
                      <td className="px-4 py-2 capitalize text-slate-300">{pos.optionType}</td>
                      <td className="px-4 py-2 text-slate-300">{pos.strike}</td>
                      <td className="px-4 py-2 text-slate-300">{pos.expiry}</td>
                      <td className="px-4 py-2 text-slate-300">{pos.quantityToClose}</td>
                      <td className="px-4 py-2 text-slate-300" title={errors[k] || undefined}>
                        {isLoading ? (
                          <span className="text-slate-500">…</span>
                        ) : price != null ? (
                          <span className="text-white">${Number(price).toFixed(2)}</span>
                        ) : errors[k] ? (
                          <span className="text-amber-400">—</span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => setSelectedPosition(pos)}
                          className="rounded bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500"
                        >
                          Close
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selectedPosition && (
            <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-6">
              <h2 className="mb-4 text-lg font-semibold text-white">Close this position</h2>
              <ClosePositionForm
                position={selectedPosition}
                onCancel={() => setSelectedPosition(null)}
                onSuccess={() => setSelectedPosition(null)}
              />
            </div>
          )}
        </section>
      ) : (
        openRollChains.length > 0 && (
          <p className="text-sm text-slate-400">No standalone open contracts beyond the roll chains above.</p>
        )
      )}
    </div>
  );
}
