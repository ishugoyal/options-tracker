import Link from "next/link";
import { prisma } from "@/lib/db";
import { getActionLabels } from "@/lib/action-labels";
import { TradeTable } from "@/components/TradeTable";

export const dynamic = "force-dynamic";

export default async function TradesPage() {
  const trades = await prisma.trade.findMany({
    orderBy: { tradeDate: "desc" },
  });

  const tradesForDisplay = trades.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
  }));

  const actionLabels = getActionLabels(
    trades.map((t) => ({
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Trades</h1>
          <p className="mt-1 text-slate-400">
            {tradesForDisplay.length} trade{tradesForDisplay.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/trades/import"
            className="rounded border border-slate-600 px-4 py-2 text-slate-300 hover:bg-slate-800"
          >
            Import CSV
          </Link>
          <Link
            href="/trades/new"
            className="rounded bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-500"
          >
            Add trade
          </Link>
          <Link
            href="/open-positions"
            className="rounded border border-slate-600 px-4 py-2 text-slate-300 hover:bg-slate-800"
          >
            Open positions
          </Link>
          <Link
            href="/closed-positions"
            className="rounded border border-slate-600 px-4 py-2 text-slate-300 hover:bg-slate-800"
          >
            Closed positions
          </Link>
        </div>
      </div>
      <TradeTable trades={tradesForDisplay} actionLabels={actionLabels} />
    </div>
  );
}
