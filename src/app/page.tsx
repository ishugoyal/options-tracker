import Link from "next/link";
import { prisma } from "@/lib/db";
import { getOpenPositions, getClosedPositions, getClosedPositionsWithDates } from "@/lib/open-positions";
import { getActionLabels } from "@/lib/action-labels";
import { toTrade } from "@/types/trade";
import { SummaryCards } from "@/components/SummaryCards";
import { TradeTable } from "@/components/TradeTable";
import { OpenPositionsPreview } from "@/components/OpenPositionsPreview";
import { ClosedPositionsPreview } from "@/components/ClosedPositionsPreview";

export const dynamic = "force-dynamic";

const thisYear = new Date().getFullYear();
const yearStart = `${thisYear}-01-01`;
const yearEnd = `${thisYear}-12-31`;

export default async function HomePage() {
  const allTrades = await prisma.trade.findMany({
    orderBy: { tradeDate: "desc" },
  });

  const tradesThisYear = allTrades.filter(
    (t) => t.tradeDate >= yearStart && t.tradeDate <= yearEnd
  );
  const tradesForSummary = tradesThisYear.slice(0, 50).map(toTrade);
  const tradesForSummaryCount = tradesThisYear.map(toTrade);

  const tradesForPositions = allTrades.filter((t) => t.isOrphanClose !== true);

  const openPositions = getOpenPositions(
    tradesForPositions.map((t) => ({
      ticker: t.ticker,
      optionType: t.optionType,
      strike: t.strike,
      expiry: t.expiry,
      action: t.action,
      quantity: t.quantity,
    }))
  );

  const closedPositionsAll = getClosedPositionsWithDates(
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
  const closedPositions = closedPositionsAll.filter(
    (p) => p.closedAt >= yearStart && p.closedAt <= yearEnd
  );
  const totalClosedProfit = closedPositions.reduce((sum, p) => sum + p.profit, 0);

  const actionLabels = getActionLabels(
    allTrades.map((t) => ({
      id: t.id,
      ticker: t.ticker,
      optionType: t.optionType,
      strike: t.strike,
      expiry: t.expiry,
      action: t.action,
      quantity: t.quantity,
      tradeDate: t.tradeDate,
    }))
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-slate-400">Options trading activity this year ({thisYear}).</p>
      </div>
      <SummaryCards
        trades={tradesForSummaryCount}
        totalRealizedPL={totalClosedProfit}
        allTradesForFees={tradesForSummaryCount}
      />

      <div className="flex gap-4">
        <Link href="/reports" className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2 text-sm text-sky-400 hover:bg-slate-800">
          Earnings →
        </Link>
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Open positions</h2>
          <Link href="/open-positions" className="text-sky-400 hover:underline">
            View all →
          </Link>
        </div>
        <OpenPositionsPreview positions={openPositions} />
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Closed positions</h2>
          <Link href="/closed-positions" className="text-sky-400 hover:underline">
            View all →
          </Link>
        </div>
        <ClosedPositionsPreview positions={closedPositions} totalProfit={totalClosedProfit} />
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Recent trades</h2>
          <Link href="/trades" className="text-sky-400 hover:underline">
            View all →
          </Link>
        </div>
        <TradeTable trades={tradesForSummary} actionLabels={actionLabels} />
      </div>
    </div>
  );
}
