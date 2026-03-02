import Link from "next/link";
import { prisma } from "@/lib/db";
import { OrphanedCloseRowActions } from "@/components/OrphanedCloseRowActions";

export const dynamic = "force-dynamic";

export default async function OrphanedClosesPage() {
  const trades = await prisma.trade.findMany({
    where: { isOrphanClose: true },
    orderBy: { tradeDate: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Orphaned closing trades</h1>
        <p className="mt-1 text-slate-400">
          Closing trades that had no matching opening trade in the app (or in the same import). They are excluded from
          open and closed position calculations. Add the missing opening trade or delete these if they were imported by
          mistake.
        </p>
      </div>

      {trades.length === 0 ? (
        <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-8 text-center text-slate-400">
          <p>No orphaned closing trades.</p>
          <p className="mt-2 text-sm">
            Orphaned closes appear when you import a &quot;Closing&quot; row and no matching &quot;Opening&quot; trade was
            found in the file or in the app.
          </p>
          <Link href="/trades" className="mt-4 inline-block text-sky-400 hover:underline">
            Back to Trades
          </Link>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-700 bg-slate-800/80 text-slate-400">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Ticker</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Strike</th>
                  <th className="px-4 py-3">Expiry</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {trades.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/50">
                    <td className="px-4 py-2 text-slate-300">{t.tradeDate}</td>
                    <td className="px-4 py-2 font-medium text-white">{t.ticker}</td>
                    <td className="px-4 py-2 capitalize text-slate-300">{t.optionType}</td>
                    <td className="px-4 py-2 text-slate-300">{t.strike}</td>
                    <td className="px-4 py-2 text-slate-300">{t.expiry}</td>
                    <td className="px-4 py-2">
                      <span className={t.action === "buy" ? "text-green-400" : "text-amber-400"}>{t.action}</span>
                    </td>
                    <td className="px-4 py-2 text-slate-300">{t.quantity}</td>
                    <td className="px-4 py-2 text-slate-300">${t.pricePerContract.toFixed(2)}</td>
                    <OrphanedCloseRowActions id={t.id} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-4">
            <Link href="/trades" className="text-sky-400 hover:underline">
              Back to Trades
            </Link>
            <Link href="/open-positions" className="text-sky-400 hover:underline">
              Open positions
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
