import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trades, importId } = body as { trades: Array<Record<string, unknown>>; importId?: string };
    const batchId = importId ?? `import-${Date.now()}`;

    if (!Array.isArray(trades) || trades.length === 0) {
      return NextResponse.json({ error: "No trades to import" }, { status: 400 });
    }

    const created = await prisma.$transaction(
      trades.map((t: Record<string, unknown>) =>
        prisma.trade.create({
          data: {
            ticker: String(t.ticker ?? "").toUpperCase(),
            optionType: (t.optionType === "put" ? "put" : "call") as "call" | "put",
            strike: Number(t.strike ?? 0),
            expiry: String(t.expiry ?? ""),
            action: (t.action === "sell" ? "sell" : "buy") as "buy" | "sell",
            quantity: Number(t.quantity ?? 0),
            pricePerContract: Number(t.pricePerContract ?? 0),
            tradeDate: String(t.tradeDate ?? ""),
            notes: t.notes != null ? String(t.notes) : null,
            source: "csv_import",
            importId: batchId,
          },
        })
      )
    );

    return NextResponse.json({ imported: created.length, importId: batchId, trades: created });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to import trades" }, { status: 500 });
  }
}
