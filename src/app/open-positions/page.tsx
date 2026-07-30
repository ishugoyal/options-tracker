import Link from "next/link";
import { prisma } from "@/lib/db";
import { getOpenPositions } from "@/lib/open-positions";
import { buildConfirmedRolls, buildRollChains, type TradeForRoll } from "@/lib/rolls";
import { OpenPositionsView } from "@/components/OpenPositionsView";

export const dynamic = "force-dynamic";

export default async function OpenPositionsPage() {
  const [trades, rollLinks] = await Promise.all([
    prisma.trade.findMany({
      orderBy: { tradeDate: "desc" },
    }),
    prisma.rollLink.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  const tradesForPositions = trades.filter((t) => t.isOrphanClose !== true);

  const positions = getOpenPositions(
    tradesForPositions.map((t) => ({
      ticker: t.ticker,
      optionType: t.optionType,
      strike: t.strike,
      expiry: t.expiry,
      action: t.action,
      quantity: t.quantity,
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
  const openRollChains = buildRollChains(
    buildConfirmedRolls(rollTrades, rollLinks),
    rollTrades
  ).filter((chain) => !chain.isClosed);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Open positions</h1>
        <p className="mt-1 text-slate-400">
          Short and long positions you can close. Click <strong>Close</strong> to record a closing trade (buy to close
          shorts, sell to close longs). Confirmed roll chains that are still open are listed separately — no realized
          P/L until the chain is fully closed.
        </p>
      </div>

      {positions.length === 0 && openRollChains.length === 0 ? (
        <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-8 text-center text-slate-400">
          <p>No open positions.</p>
          <p className="mt-2 text-sm">
            Open positions appear when you have an imbalance for an option: more <strong>sold</strong> than bought
            (short), or more <strong>bought</strong> than sold (long). Add a Sell or Buy trade to see positions here.
          </p>
          <Link href="/trades" className="mt-4 inline-block text-sky-400 hover:underline">
            Back to Trades
          </Link>
        </div>
      ) : (
        <>
          <OpenPositionsView positions={positions} openRollChains={openRollChains} />
          <Link href="/trades" className="inline-block text-sky-400 hover:underline">
            Back to Trades
          </Link>
        </>
      )}
    </div>
  );
}
