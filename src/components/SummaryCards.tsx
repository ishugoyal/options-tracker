import type { BestTradeByRate } from "@/lib/dashboard-period";

interface SummaryCardsProps {
  /** Chain-realization P/L for the period (FIFO profits already net of fees). */
  chainPlAfterFees: number;
  /** Closed earnings events: one per standalone close or closed roll chain. */
  positionsTraded: number;
  year: number;
  bestTrade: BestTradeByRate | null;
}

function fmtMoney(n: number): string {
  return (
    (n >= 0 ? "+" : "-") +
    "$" +
    Math.abs(n).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function contractLine(p: {
  ticker: string;
  optionType: string;
  strike: number;
  expiry: string;
}): string {
  return `${p.ticker} ${p.optionType.toUpperCase()} $${p.strike} · ${p.expiry}`;
}

function fmtShortDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function SummaryCards({
  chainPlAfterFees,
  positionsTraded,
  year,
  bestTrade,
}: SummaryCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-5">
        <p className="text-sm text-slate-400">P/L</p>
        <p
          className={`text-2xl font-bold ${
            chainPlAfterFees >= 0 ? "text-green-400" : "text-red-400"
          }`}
        >
          {fmtMoney(chainPlAfterFees)}
        </p>
        <p className="text-xs text-slate-500">{year}</p>
      </div>
      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-5">
        <p className="text-sm text-slate-400">Positions traded</p>
        <p className="text-2xl font-bold text-white">{positionsTraded}</p>
        <p className="text-xs text-slate-500">{year}</p>
      </div>
      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-5 sm:col-span-2 lg:col-span-1">
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
            <p className="text-xs text-slate-500">{year}</p>
          </>
        )}
      </div>
    </div>
  );
}
