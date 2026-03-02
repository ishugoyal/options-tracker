import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { toTrade } from "@/types/trade";
import { TradeForm } from "@/components/TradeForm";

export const dynamic = "force-dynamic";

interface EditTradePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditTradePage({ params }: EditTradePageProps) {
  const { id } = await params;
  const trade = await prisma.trade.findUnique({ where: { id } });
  if (!trade) notFound();

  const tradeForForm = toTrade(trade);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Edit trade</h1>
        <p className="mt-1 text-slate-400">
          {trade.ticker} {trade.expiry} {trade.optionType} ${trade.strike}
        </p>
      </div>
      <TradeForm trade={tradeForForm} />
      <Link href="/trades" className="inline-block text-sky-400 hover:underline">
        Back to Trades
      </Link>
    </div>
  );
}
