import Link from "next/link";
import { prisma } from "@/lib/db";
import { getClosedPositions } from "@/lib/open-positions";

export const dynamic = "force-dynamic";

export default async function ClosedPositionsPage() {
  const trades = await prisma.trade.findMany({
    orderBy: { tradeDate: "desc" },
  });

  const tradesForPositions = trades.filter((t) => t.isOrphanClose !== true);

  const positions = getClosedPositions(
    tradesForPositions.map((t) => ({
      ticker: t.ticker,
      optionType: t.optionType,
      strike: t.strike,
      expiry: t.expiry,
      action: t.action,
      quantity: t.quantity,
      pricePerContract: t.pricePerContract,
    }))
  );

  const totalProfit = positions.reduce((sum, p) => sum + p.profit, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Closed positions</h1>
        <p className="mt-1 text-slate-400">
          Options where you have fully closed the position (same number of buys and sells). Profit = premium received from sells minus premium paid for buys.
        </p>
      </div>

      {positions.length === 0 ? (
        <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-8 text-center text-slate-400">
          <p>No closed positions yet.</p>
          <p className="mt-2 text-sm">
            A position appears here when you have the same number of buy and sell contracts for the same option (ticker, type, strike, expiry).
          </p>
          <Link href="/trades" className="mt-4 inline-block text-sky-400 hover:underline">
            Back to Trades
          </Link>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
            <p className="text-slate-400 text-sm">Total profit (closed positions)</p>
            <p className={`text-2xl font-bold ${totalProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
              {totalProfit >= 0 ? "+" : ""}${totalProfit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-700 bg-slate-800/80 text-slate-400">
                <tr>
                  <th className="px-4 py-3">Ticker</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Strike</th>
                  <th className="px-4 py-3">Expiry</th>
                  <th className="px-4 py-3">Contracts</th>
                  <th className="px-4 py-3">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {positions.map((p, i) => (
                  <tr key={`${p.ticker}-${p.expiry}-${p.strike}-${p.optionType}-${i}`} className="hover:bg-slate-800/50">
                    <td className="px-4 py-2 font-medium text-white">{p.ticker}</td>
                    <td className="px-4 py-2 capitalize text-slate-300">{p.optionType}</td>
                    <td className="px-4 py-2 text-slate-300">{p.strike}</td>
                    <td className="px-4 py-2 text-slate-300">{p.expiry}</td>
                    <td className="px-4 py-2 text-slate-300">{p.quantity}</td>
                    <td className={`px-4 py-2 font-medium ${p.profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {p.profit >= 0 ? "+" : ""}${p.profit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Link href="/trades" className="inline-block text-sky-400 hover:underline">
            Back to Trades
          </Link>
        </>
      )}
    </div>
  );
}
