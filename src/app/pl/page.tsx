import Link from "next/link";
import { prisma } from "@/lib/db";
import { getClosedPositionsWithDates } from "@/lib/open-positions";
import { plByTicker, plByWeek, plByMonth, plByYear } from "@/lib/pl-breakdown";
import { PLBreakdownTable } from "@/components/PLBreakdownTable";

export const dynamic = "force-dynamic";

export default async function PLPage() {
  const trades = await prisma.trade.findMany({
    orderBy: { tradeDate: "asc" },
  });

  const tradesForPositions = trades.filter((t) => t.isOrphanClose !== true);

  const positionsWithDates = getClosedPositionsWithDates(
    tradesForPositions.map((t) => ({
      ticker: t.ticker,
      optionType: t.optionType,
      strike: t.strike,
      expiry: t.expiry,
      action: t.action,
      quantity: t.quantity,
      pricePerContract: t.pricePerContract,
      tradeDate: t.tradeDate,
    }))
  );

  const totalProfit = positionsWithDates.reduce((sum, p) => sum + p.profit, 0);

  const byTicker = plByTicker(positionsWithDates);
  const byWeek = plByWeek(positionsWithDates);
  const byMonth = plByMonth(positionsWithDates);
  const byYear = plByYear(positionsWithDates);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-white">P/L breakdown</h1>
        <p className="mt-1 text-slate-400">
          Realized profit/loss from closed positions, grouped by ticker or time period (close date = last trade date for that option).
        </p>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-5">
        <p className="text-slate-400 text-sm">Total realized P/L</p>
        <p className={`text-2xl font-bold ${totalProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
          {totalProfit >= 0 ? "+" : ""}${totalProfit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </p>
        <p className="text-slate-500 text-xs">{positionsWithDates.length} closed position(s)</p>
      </div>

      <PLBreakdownTable
        title="By ticker"
        buckets={byTicker}
        columnLabel="Ticker"
        totalProfit={totalProfit}
      />
      <PLBreakdownTable
        title="By year"
        buckets={byYear}
        columnLabel="Year"
        totalProfit={totalProfit}
      />
      <PLBreakdownTable
        title="By month"
        buckets={byMonth}
        columnLabel="Month"
        totalProfit={totalProfit}
      />
      <PLBreakdownTable
        title="By week (week starting Monday)"
        buckets={byWeek}
        columnLabel="Week starting"
        totalProfit={totalProfit}
      />

      <div className="flex gap-4">
        <Link href="/" className="text-sky-400 hover:underline">
          ← Dashboard
        </Link>
        <Link href="/closed-positions" className="text-sky-400 hover:underline">
          Closed positions
        </Link>
      </div>
    </div>
  );
}
