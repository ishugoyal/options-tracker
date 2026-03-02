import Link from "next/link";
import { prisma } from "@/lib/db";
import { getClosedPositionsWithDates } from "@/lib/open-positions";
import { EarningsView } from "@/components/EarningsView";

export const dynamic = "force-dynamic";

export default async function EarningsPage() {
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
      fees: t.fees,
    }))
  );

  const allTickers = Array.from(
    new Set(positionsWithDates.map((p) => p.ticker).filter(Boolean))
  ).sort();

  return (
    <div className="space-y-8">
      <EarningsView positions={positionsWithDates} allTickers={allTickers} />

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
