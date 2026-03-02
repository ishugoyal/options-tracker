import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveMatchingOrphanClose } from "@/lib/resolve-orphan-close";

function optionKey(t: { ticker: string; optionType: string; strike: number; expiry: string }): string {
  return `${String(t.ticker ?? "").toUpperCase()}|${t.optionType}|${t.strike}|${t.expiry}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trades, importId } = body as {
      trades: Array<Record<string, unknown> & { openClose?: "open" | "close" }>;
      importId?: string;
    };
    const batchId = importId ?? `import-${Date.now()}`;

    if (!Array.isArray(trades) || trades.length === 0) {
      return NextResponse.json({ error: "No trades to import" }, { status: 400 });
    }

    const created = await prisma.$transaction(async (tx) => {
      const createdList: Awaited<ReturnType<typeof tx.trade.create>>[] = [];
      // Opens created in this batch by option key: list of { id, action, tradeDate } for matching closes (FIFO)
      const batchOpensByKey = new Map<string, Array<{ id: string; action: string; tradeDate: string }>>();

      for (const t of trades) {
        const ticker = String(t.ticker ?? "").toUpperCase();
        const optionType = (t.optionType === "put" ? "put" : "call") as "call" | "put";
        const action = (t.action === "sell" ? "sell" : "buy") as "buy" | "sell";
        const openClose = t.openClose as "open" | "close" | undefined;
        const strike = Number(t.strike ?? 0);
        const expiry = String(t.expiry ?? "");
        const tradeDate = String(t.tradeDate ?? "");
        const key = optionKey({ ticker, optionType, strike, expiry });

        let closesTradeId: string | null = null;

        if (openClose === "close") {
          const oppositeAction = action === "buy" ? "sell" : "buy";
          const batchOpens = batchOpensByKey.get(key);
          // Match an open whose tradeDate is on or before this close's tradeDate (close date >= open date)
          const matchFromBatch = batchOpens?.findIndex(
            (o) => o.action === oppositeAction && o.tradeDate <= tradeDate
          );
          if (matchFromBatch !== undefined && matchFromBatch >= 0 && batchOpens) {
            const matched = batchOpens[matchFromBatch];
            closesTradeId = matched.id;
            batchOpens.splice(matchFromBatch, 1);
          } else {
            const alreadyClosed = await tx.trade.findMany({
              where: { closesTradeId: { not: null } },
              select: { closesTradeId: true },
            });
            const closedIds = alreadyClosed
              .map((r) => r.closesTradeId)
              .filter((id): id is string => id != null);
            const existingOpen = await tx.trade.findFirst({
              where: {
                ticker,
                optionType,
                strike,
                expiry,
                action: oppositeAction,
                tradeDate: { lte: tradeDate },
                ...(closedIds.length > 0 && { id: { notIn: closedIds } }),
              },
              orderBy: { tradeDate: "asc" },
            });
            if (existingOpen) closesTradeId = existingOpen.id;
          }
        }

        const isOrphanClose = openClose === "close" && closesTradeId == null;

        const newTrade = await tx.trade.create({
          data: {
            ticker,
            optionType,
            strike,
            expiry,
            action,
            quantity: Number(t.quantity ?? 0),
            pricePerContract: Number(t.pricePerContract ?? 0),
            tradeDate: String(t.tradeDate ?? ""),
            notes: t.notes != null ? String(t.notes) : null,
            fees: t.fees != null ? Number(t.fees) : null,
            source: "csv_import",
            importId: batchId,
            closesTradeId,
            isOrphanClose,
          },
        });

        createdList.push(newTrade);

        if (openClose !== "close") {
          const list = batchOpensByKey.get(key) ?? [];
          list.push({ id: newTrade.id, action, tradeDate: newTrade.tradeDate });
          batchOpensByKey.set(key, list);
          await resolveMatchingOrphanClose(tx, newTrade);
        }
      }

      return createdList;
    });

    return NextResponse.json({ imported: created.length, importId: batchId, trades: created });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to import trades";
    console.error("Import error:", e);
    return NextResponse.json(
      { error: "Failed to import trades", detail: message },
      { status: 500 }
    );
  }
}
