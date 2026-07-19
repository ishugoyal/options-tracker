import Link from "next/link";
import { format, parseISO } from "date-fns";
import { prisma } from "@/lib/db";
import { getClosedPositionsWithDates } from "@/lib/open-positions";
import { formatDateRange, isDateInRange, type DateRange } from "@/lib/earnings-filters";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    start?: string;
    end?: string;
    tickers?: string;
  }>;
}

export default async function ClosedPositionsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const dateRange: DateRange | null =
    params.start && params.end ? { start: params.start, end: params.end } : null;
  const selectedTickers = params.tickers
    ? params.tickers
        .split(",")
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean)
    : [];

  const trades = await prisma.trade.findMany({
    orderBy: { tradeDate: "desc" },
  });

  const tradesForPositions = trades.filter((t) => t.isOrphanClose !== true);

  let positions = getClosedPositionsWithDates(
    tradesForPositions.map((t) => ({
      ticker: t.ticker,
      optionType: t.optionType,
      strike: t.strike,
      expiry: t.expiry,
      action: t.action,
      quantity: t.quantity,
      pricePerContract: t.pricePerContract,
      fees: t.fees,
      tradeDate: t.tradeDate,
    }))
  );

  if (dateRange) {
    positions = positions.filter((p) => p.closedAt && isDateInRange(p.closedAt, dateRange));
  }
  if (selectedTickers.length > 0) {
    const set = new Set(selectedTickers);
    positions = positions.filter((p) => set.has(p.ticker.toUpperCase()));
  }

  positions = [...positions].sort((a, b) => (b.closedAt || "").localeCompare(a.closedAt || ""));

  const totalProfit = positions.reduce((sum, p) => sum + p.profit, 0);
  const filterParts: string[] = [];
  if (dateRange) filterParts.push(formatDateRange(dateRange));
  if (selectedTickers.length > 0) filterParts.push(selectedTickers.join(", "));
  const filterLabel = filterParts.length > 0 ? filterParts.join(" · ") : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Closed positions</h1>
        <p className="mt-1 text-slate-400">
          One entry per round trip (open then close). Same option traded multiple times shows as separate rows. P/L =
          earnings (premium) minus fees.
        </p>
        {filterLabel && (
          <p className="mt-2 text-sm text-sky-400">
            Filtered: {filterLabel}{" "}
            <Link href="/closed-positions" className="ml-2 text-slate-400 hover:underline">
              Clear filters
            </Link>
          </p>
        )}
      </div>

      {positions.length === 0 ? (
        <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-8 text-center text-slate-400">
          <p>{filterLabel ? "No closed positions match these filters." : "No closed positions yet."}</p>
          {!filterLabel && (
            <p className="mt-2 text-sm">
              A position appears here when you have the same number of buy and sell contracts for the same option
              (ticker, type, strike, expiry).
            </p>
          )}
          <Link href="/reports" className="mt-4 inline-block text-sky-400 hover:underline">
            Back to Earnings
          </Link>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
            <p className="text-slate-400 text-sm">
              Total profit{filterLabel ? " (filtered)" : ""} · {positions.length} positions
            </p>
            <p className={`text-2xl font-bold ${totalProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
              {totalProfit >= 0 ? "+" : ""}$
              {totalProfit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-700 bg-slate-800/80 text-slate-400">
                <tr>
                  <th className="px-4 py-3">Closed date</th>
                  <th className="px-4 py-3">Ticker</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Strike</th>
                  <th className="px-4 py-3">Expiry</th>
                  <th className="px-4 py-3">Contracts</th>
                  <th className="px-4 py-3 text-right">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {positions.map((p, i) => (
                  <tr
                    key={`${p.ticker}-${p.expiry}-${p.strike}-${p.optionType}-${i}`}
                    className="hover:bg-slate-800/50"
                  >
                    <td className="px-4 py-2 text-slate-300">
                      {p.closedAt ? format(parseISO(p.closedAt), "MMM d, yyyy") : "—"}
                    </td>
                    <td className="px-4 py-2 font-medium text-white">{p.ticker}</td>
                    <td className="px-4 py-2 capitalize text-slate-300">{p.optionType}</td>
                    <td className="px-4 py-2 text-slate-300">{p.strike}</td>
                    <td className="px-4 py-2 text-slate-300">{p.expiry}</td>
                    <td className="px-4 py-2 text-slate-300">{p.quantity}</td>
                    <td
                      className={`px-4 py-2 text-right font-medium ${
                        p.profit >= 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {p.profit >= 0 ? "+" : ""}$
                      {p.profit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Link href="/reports" className="inline-block text-sky-400 hover:underline">
            ← Back to Earnings
          </Link>
        </>
      )}
    </div>
  );
}
