import Link from "next/link";
import { prisma } from "@/lib/db";
import { getOpenPositions } from "@/lib/open-positions";
import { OpenPositionsView } from "@/components/OpenPositionsView";

export const dynamic = "force-dynamic";

export default async function OpenPositionsPage() {
  const trades = await prisma.trade.findMany({
    orderBy: { tradeDate: "desc" },
  });

  const positions = getOpenPositions(
    trades.map((t) => ({
      ticker: t.ticker,
      optionType: t.optionType,
      strike: t.strike,
      expiry: t.expiry,
      action: t.action,
      quantity: t.quantity,
    }))
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Open positions</h1>
        <p className="mt-1 text-slate-400">
          Short and long positions you can close. Click <strong>Close</strong> to record a closing trade (buy to close
          shorts, sell to close longs).
        </p>
      </div>

      {positions.length === 0 ? (
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
          <OpenPositionsView positions={positions} />
          <Link href="/trades" className="inline-block text-sky-400 hover:underline">
            Back to Trades
          </Link>
        </>
      )}
    </div>
  );
}
