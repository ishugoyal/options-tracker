"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ConfirmedRoll, RollCandidate, RollChain, RollPLSummary } from "@/lib/rolls";

type Props = {
  candidates: RollCandidate[];
  confirmed: ConfirmedRoll[];
  chains: RollChain[];
  summary: RollPLSummary;
};

function money(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function contractLabel(t: {
  ticker: string;
  optionType: string;
  strike: number;
  expiry: string;
  label: string;
  quantity: number;
  pricePerContract: number;
}): string {
  return `${t.ticker} ${t.expiry} ${t.optionType} $${t.strike} · ${t.label} ${t.quantity} @ $${t.pricePerContract.toFixed(2)}`;
}

export function RollManagementView({ candidates, confirmed, chains, summary }: Props) {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tickerFilter, setTickerFilter] = useState("");

  const tickers = useMemo(
    () => Array.from(new Set([...candidates, ...confirmed].map((r) => r.ticker))).sort(),
    [candidates, confirmed]
  );

  const filteredCandidates = useMemo(
    () => (tickerFilter ? candidates.filter((c) => c.ticker === tickerFilter) : candidates),
    [candidates, tickerFilter]
  );
  const filteredConfirmed = useMemo(
    () => (tickerFilter ? confirmed.filter((c) => c.ticker === tickerFilter) : confirmed),
    [confirmed, tickerFilter]
  );
  const filteredChains = useMemo(
    () => (tickerFilter ? chains.filter((c) => c.ticker === tickerFilter) : chains),
    [chains, tickerFilter]
  );

  const filteredSummary = useMemo(() => {
    if (!tickerFilter) return summary;
    let premium = 0;
    let fees = 0;
    let credits = 0;
    let debits = 0;
    for (const r of filteredConfirmed) {
      premium += r.pl.premium;
      fees += r.pl.fees;
      if (r.pl.premium >= 0) credits += r.pl.premium;
      else debits += r.pl.premium;
    }
    return {
      count: filteredConfirmed.length,
      premium,
      fees,
      pl: premium - fees,
      credits,
      debits,
    };
  }, [tickerFilter, summary, filteredConfirmed]);

  const confirmRoll = async (candidate: RollCandidate) => {
    setError(null);
    setBusyKey(candidate.key);
    try {
      const res = await fetch("/api/rolls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          closeTradeId: candidate.closeTrade.id,
          openTradeId: candidate.openTrade.id,
          quantity: candidate.quantity,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to confirm roll");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm roll");
    } finally {
      setBusyKey(null);
    }
  };

  const unlinkRoll = async (id: string) => {
    if (!confirm("Remove this roll link? Trades stay unchanged.")) return;
    setError(null);
    setBusyKey(id);
    try {
      const res = await fetch(`/api/rolls/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to unlink roll");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlink roll");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded bg-red-900/30 px-4 py-2 text-sm text-red-300">{error}</div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
          <p className="text-sm text-slate-400">Roll cash flow (after fees)</p>
          <p className={`text-2xl font-bold ${filteredSummary.pl >= 0 ? "text-green-400" : "text-red-400"}`}>
            {money(filteredSummary.pl)}
          </p>
          <p className="text-xs text-slate-500">{filteredSummary.count} confirmed roll{filteredSummary.count !== 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
          <p className="text-sm text-slate-400">Net premium</p>
          <p className={`text-2xl font-bold ${filteredSummary.premium >= 0 ? "text-green-400" : "text-red-400"}`}>
            {money(filteredSummary.premium)}
          </p>
          <p className="text-xs text-slate-500">
            Credits {money(filteredSummary.credits)} · Debits {money(filteredSummary.debits)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
          <p className="text-sm text-slate-400">Roll fees</p>
          <p className="text-2xl font-bold text-white">
            ${filteredSummary.fees.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-slate-500">Allocated from both legs</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
          <p className="text-sm text-slate-400">Chains (2+ steps)</p>
          <p className="text-2xl font-bold text-white">
            {filteredChains.filter((c) => c.steps.length > 1).length}
          </p>
          <p className="text-xs text-slate-500">A→B→C style linked rolls</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-400">
          Ticker filter
          <select
            value={tickerFilter}
            onChange={(e) => setTickerFilter(e.target.value)}
            className="ml-2 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-white"
          >
            <option value="">All</option>
            {tickers.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <span className="text-sm text-slate-500">
          {filteredCandidates.length} candidate{filteredCandidates.length !== 1 ? "s" : ""} ·{" "}
          {filteredConfirmed.length} linked
        </span>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Suggested historical rolls</h2>
          <p className="text-sm text-slate-400">
            Same-day close + open on a different contract. Net = premium cash flow − fees. Confirm to save the link.
          </p>
        </div>

        {filteredCandidates.length === 0 ? (
          <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-6 text-slate-400">
            No unlinked historical roll candidates found.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-700 bg-slate-800/80 text-slate-400">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Ticker</th>
                  <th className="px-3 py-2">Close leg</th>
                  <th className="px-3 py-2">Open leg</th>
                  <th className="px-3 py-2">Qty</th>
                  <th className="px-3 py-2">Premium</th>
                  <th className="px-3 py-2">Fees</th>
                  <th className="px-3 py-2">Net</th>
                  <th className="px-3 py-2">Confidence</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredCandidates.map((c) => (
                  <tr key={c.key} className="align-top hover:bg-slate-800/40">
                    <td className="px-3 py-2 text-slate-300">{c.tradeDate}</td>
                    <td className="px-3 py-2 font-medium text-white">{c.ticker}</td>
                    <td className="px-3 py-2 text-slate-300">{contractLabel(c.closeTrade)}</td>
                    <td className="px-3 py-2 text-slate-300">{contractLabel(c.openTrade)}</td>
                    <td className="px-3 py-2 text-slate-300">{c.quantity}</td>
                    <td className={`px-3 py-2 ${c.pl.premium >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {money(c.pl.premium)}
                    </td>
                    <td className="px-3 py-2 text-slate-400">
                      ${c.pl.fees.toFixed(2)}
                    </td>
                    <td className={`px-3 py-2 font-medium ${c.pl.pl >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {money(c.pl.pl)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs ${
                          c.confidence === "high"
                            ? "bg-green-900/40 text-green-300"
                            : "bg-amber-900/40 text-amber-300"
                        }`}
                      >
                        {c.confidence}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-400">{c.reason}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        disabled={busyKey === c.key}
                        onClick={() => confirmRoll(c)}
                        className="rounded bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
                      >
                        {busyKey === c.key ? "Linking…" : "Confirm link"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Confirmed roll links</h2>
          <p className="text-sm text-slate-400">
            Per-step cash flow updates as you confirm. Whole-chain P/L is reported in Earnings.
          </p>
        </div>

        {filteredConfirmed.length === 0 ? (
          <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-6 text-slate-400">
            No confirmed roll links yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-700 bg-slate-800/80 text-slate-400">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Ticker</th>
                  <th className="px-3 py-2">Close leg</th>
                  <th className="px-3 py-2">Open leg</th>
                  <th className="px-3 py-2">Qty</th>
                  <th className="px-3 py-2">Premium</th>
                  <th className="px-3 py-2">Fees</th>
                  <th className="px-3 py-2">Net</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredConfirmed.map((r) => (
                  <tr key={r.id} className="align-top hover:bg-slate-800/40">
                    <td className="px-3 py-2 text-slate-300">{r.tradeDate}</td>
                    <td className="px-3 py-2 font-medium text-white">{r.ticker}</td>
                    <td className="px-3 py-2 text-slate-300">{contractLabel(r.closeTrade)}</td>
                    <td className="px-3 py-2 text-slate-300">{contractLabel(r.openTrade)}</td>
                    <td className="px-3 py-2 text-slate-300">{r.quantity}</td>
                    <td className={`px-3 py-2 ${r.pl.premium >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {money(r.pl.premium)}
                    </td>
                    <td className="px-3 py-2 text-slate-400">${r.pl.fees.toFixed(2)}</td>
                    <td className={`px-3 py-2 font-medium ${r.pl.pl >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {money(r.pl.pl)}
                    </td>
                    <td className="px-3 py-2 text-slate-400">{r.reason}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        disabled={busyKey === r.id}
                        onClick={() => unlinkRoll(r.id)}
                        className="text-red-400 hover:underline disabled:opacity-50"
                      >
                        {busyKey === r.id ? "Removing…" : "Unlink"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </div>
  );
}
