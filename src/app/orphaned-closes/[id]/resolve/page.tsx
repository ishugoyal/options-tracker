import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getOrphanOpenCandidates } from "@/lib/orphan-open-candidates";
import { ResolveOrphanForm } from "@/components/ResolveOrphanForm";

export const dynamic = "force-dynamic";

export default async function ResolveOrphanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orphan = await prisma.trade.findFirst({
    where: { id, isOrphanClose: true },
  });
  if (!orphan) notFound();

  const allTrades = await prisma.trade.findMany();
  const candidates = getOrphanOpenCandidates(orphan, allTrades);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Resolve orphaned close</h1>
        <p className="mt-1 text-slate-400">
          Link this close to an existing opening trade in the app, or create a new opening trade. The close will no
          longer appear as orphaned.
        </p>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4">
        <p className="text-slate-400 text-sm mb-2">Orphan close:</p>
        <p className="text-white font-medium">
          {orphan.ticker} {orphan.expiry} {orphan.optionType} ${orphan.strike} — {orphan.action === "buy" ? "Buy" : "Sell"} to close, {orphan.quantity} @ ${orphan.pricePerContract.toFixed(2)} ({orphan.tradeDate})
        </p>
      </div>

      <ResolveOrphanForm
        orphan={{
          id: orphan.id,
          ticker: orphan.ticker,
          optionType: orphan.optionType,
          strike: orphan.strike,
          expiry: orphan.expiry,
          action: orphan.action,
          quantity: orphan.quantity,
          pricePerContract: orphan.pricePerContract,
          tradeDate: orphan.tradeDate,
        }}
        candidates={candidates}
      />

      <Link href="/orphaned-closes" className="inline-block text-sky-400 hover:underline">
        ← Back to Orphaned closes
      </Link>
    </div>
  );
}
