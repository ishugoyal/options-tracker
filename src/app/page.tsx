import Link from "next/link";
import { prisma } from "@/lib/db";
import { getOpenPositions, getClosedPositions } from "@/lib/open-positions";
import { getActionLabels } from "@/lib/action-labels";
import { SummaryCards } from "@/components/SummaryCards";
import { TradeTable } from "@/components/TradeTable";
import { OpenPositionsPreview } from "@/components/OpenPositionsPreview";
import { ClosedPositionsPreview } from "@/components/ClosedPositionsPreview";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const allTrades = await prisma.trade.findMany({
    orderBy: { tradeDate: "desc" },
  });

  const tradesForSummary = allTrades.slice(0, 50).map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
  }));

  const openPositions = getOpenPositions(
    allTrades.map((t) => ({
      ticker: t.ticker,
      optionType: t.optionType,
      strike: t.strike,
      expiry: t.expiry,
      action: t.action,
      quantity: t.quantity,
    }))
  );

  const closedPositions = getClosedPositions(
    allTrades.map((t) => ({
      ticker: t.ticker,
      optionType: t.optionType,
      strike: t.strike,
      expiry: t.expiry,
      action: t.action,
      quantity: t.quantity,
      pricePerContract: t.pricePerContract,
    }))
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
        <p className="mt-1 text-slate-400">Options trading activity at a glance.</p>
      </div>
      <SummaryCards
        trades={tradesForSummary}
        totalRealizedPL={totalClosedProfit}
        allTradesForFees={allTrades.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() }))}
      />

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
