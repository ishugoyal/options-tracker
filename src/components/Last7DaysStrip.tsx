"use client";

import { useState } from "react";
import type { PeriodActivity } from "@/lib/dashboard-period";

function fmtMoney(n: number): string {
  return (
    (n >= 0 ? "+" : "-") +
    "$" +
    Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

function fmtShortDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function contractLine(p: {
  ticker: string;
  optionType: string;
  strike: number;
  expiry: string;
}): string {
  return `${p.ticker} ${p.optionType.toUpperCase()} $${p.strike} · ${p.expiry}`;
}

type PeriodKey = "30d" | "60d";

type Props = {
  periods: Record<PeriodKey, PeriodActivity>;
};

const LABELS: Record<PeriodKey, string> = {
  "30d": "Last 30 days",
  "60d": "Last 60 days",
};

export function Last7DaysStrip({ periods }: Props) {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const data = periods[period];
  const {
    start,
    end,
    realizedPl,
    closedCount,
    newPremium,
    openedCount,
    closedItems,
    openedItems,
    bestTrade,
  } = data;
  const eventCount = closedCount + openedCount;

  return (
    <div className="space-y-4 rounded-lg border border-slate-700 bg-slate-800/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="text-lg font-semibold text-white">{LABELS[period]}</h2>
          <p className="text-sm text-slate-400">
            {fmtShortDate(start)} – {fmtShortDate(end)} · {eventCount} event
            {eventCount !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex rounded-lg border border-slate-600 bg-slate-900/50 p-0.5 text-sm">
          {(["30d", "60d"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setPeriod(key)}
              className={`rounded-md px-3 py-1 font-medium transition-colors ${
                period === key
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {key.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4">
          <p className="text-sm text-slate-400">Realized</p>
          <p className={`text-2xl font-bold ${realizedPl >= 0 ? "text-green-400" : "text-red-400"}`}>
            {fmtMoney(realizedPl)}
          </p>
          <p className="text-xs text-slate-500">
            {closedCount} closed position{closedCount !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4">
          <p className="text-sm text-slate-400">New premium opened</p>
          <p className="text-2xl font-bold text-sky-400">{fmtMoney(newPremium)}</p>
          <p className="text-xs text-slate-500">
            {openedCount} sell to open{openedCount !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4 sm:col-span-2 lg:col-span-1">
          <p className="text-sm text-slate-400">Most profitable</p>
          {bestTrade ? (
            <>
              <p
                className={`text-2xl font-bold ${
                  bestTrade.profit >= 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                {fmtMoney(bestTrade.profit)}
              </p>
              <p className="mt-1 text-xs text-slate-300">{contractLine(bestTrade)}</p>
              <p className="text-xs text-slate-500">
                {fmtMoney(bestTrade.profitPerDay)}/day · {bestTrade.daysHeld} day
                {bestTrade.daysHeld !== 1 ? "s" : ""} · {fmtShortDate(bestTrade.openedAt)} →{" "}
                {fmtShortDate(bestTrade.closedAt)}
              </p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-slate-500">—</p>
              <p className="text-xs text-slate-500">No closes with open dates in this window</p>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section>
          <h3 className="mb-2 text-sm font-medium text-slate-300">Closed</h3>
          {closedItems.length === 0 ? (
            <p className="rounded border border-slate-700/80 bg-slate-900/20 px-3 py-4 text-sm text-slate-500">
              No closes in this window.
            </p>
          ) : (
            <ul className="max-h-64 space-y-2 overflow-y-auto">
              {closedItems.map((p, i) => (
                <li
                  key={`${p.ticker}-${p.expiry}-${p.strike}-${p.date}-${i}`}
                  className="rounded border border-slate-700/80 bg-slate-900/30 px-3 py-2 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-white">{contractLine(p)}</p>
                      <p className="text-xs text-slate-500">{fmtShortDate(p.date)}</p>
                    </div>
                    <p className={`shrink-0 font-medium ${p.profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {fmtMoney(p.profit)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-medium text-slate-300">Opened</h3>
          {openedItems.length === 0 ? (
            <p className="rounded border border-slate-700/80 bg-slate-900/20 px-3 py-4 text-sm text-slate-500">
              No new sells to open in this window.
            </p>
          ) : (
            <ul className="max-h-64 space-y-2 overflow-y-auto">
              {openedItems.map((p) => (
                <li
                  key={p.id}
                  className="rounded border border-slate-700/80 bg-slate-900/30 px-3 py-2 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-white">{contractLine(p)}</p>
                      <p className="text-xs text-slate-500">{fmtShortDate(p.date)}</p>
                    </div>
                    <p className="shrink-0 font-medium text-sky-400">{fmtMoney(p.premium)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
