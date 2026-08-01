import Link from "next/link";
import { prisma } from "@/lib/db";
import { RollManagementView } from "@/components/RollManagementView";
import {
  buildConfirmedRolls,
  buildRollChains,
  detectHistoricalRollCandidates,
  summarizeRollPL,
  type TradeForRoll,
} from "@/lib/rolls";

export const dynamic = "force-dynamic";

export default async function RollsPage() {
  const [trades, links] = await Promise.all([
    prisma.trade.findMany({ orderBy: [{ tradeDate: "asc" }, { createdAt: "asc" }] }),
    prisma.rollLink.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  const tradeRows: TradeForRoll[] = trades.map((t) => ({
    id: t.id,
    ticker: t.ticker,
    optionType: t.optionType,
    strike: t.strike,
    expiry: t.expiry,
    action: t.action,
    quantity: t.quantity,
    pricePerContract: t.pricePerContract,
    tradeDate: t.tradeDate,
    fees: t.fees,
    closesTradeId: t.closesTradeId,
    isOrphanClose: t.isOrphanClose,
    notes: t.notes,
  }));

  const candidates = detectHistoricalRollCandidates(tradeRows, links);
  const confirmed = buildConfirmedRolls(tradeRows, links);
  const chains = buildRollChains(confirmed, tradeRows);
  const summary = summarizeRollPL(confirmed);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Roll management (pilot)</h1>
          <p className="mt-1 text-slate-400">
            Confirm historical rolls while you work. Step net = premium cash flow on both legs minus allocated fees.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {candidates.length} candidate{candidates.length !== 1 ? "s" : ""} · {confirmed.length} confirmed ·{" "}
            {trades.length} trades
          </p>
        </div>
        <Link
          href="/trades"
          className="rounded border border-slate-600 px-4 py-2 text-slate-300 hover:bg-slate-800"
        >
          ← Back to Trades
        </Link>
      </div>

      <RollManagementView
        candidates={candidates}
        confirmed={confirmed}
        chains={chains}
        summary={summary}
      />
    </div>
  );
}
