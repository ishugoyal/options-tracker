import Link from "next/link";
import { prisma } from "@/lib/db";
import { getClosedPositionsWithDates } from "@/lib/open-positions";
import { buildConfirmedRolls, buildRollChains, type TradeForRoll } from "@/lib/rolls";
import { EarningsView } from "@/components/EarningsView";

export const dynamic = "force-dynamic";

export default async function EarningsPage() {
  const [trades, rollLinks] = await Promise.all([
    prisma.trade.findMany({
      orderBy: { tradeDate: "asc" },
    }),
    prisma.rollLink.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

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
      fees: t.fees,
    }))
  );

  const rollTrades: TradeForRoll[] = trades.map((t) => ({
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
  const confirmedRolls = buildConfirmedRolls(rollTrades, rollLinks);
  const rollChains = buildRollChains(confirmedRolls, rollTrades);

  const allTickers = Array.from(
    new Set([
      ...positionsWithDates.map((p) => p.ticker),
      ...rollChains.map((chain) => chain.ticker),
    ].filter(Boolean))
  ).sort();

  return (
    <div className="space-y-8">
      <EarningsView
        positions={positionsWithDates}
        rollChains={rollChains}
        allTickers={allTickers}
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
