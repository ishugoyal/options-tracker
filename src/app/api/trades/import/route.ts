import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { resolveMatchingOrphanClose } from "@/lib/resolve-orphan-close";
import { validateRollPair, type TradeForRoll } from "@/lib/rolls";

function optionKey(t: { ticker: string; optionType: string; strike: number; expiry: string }): string {
  return `${String(t.ticker ?? "").toUpperCase()}|${t.optionType}|${t.strike}|${t.expiry}`;
}

function toTradeForRoll(t: {
  id: string;
  ticker: string;
  optionType: string;
  strike: number;
  expiry: string;
  action: string;
  quantity: number;
  pricePerContract: number;
  tradeDate: string;
  fees: number | null;
  closesTradeId: string | null;
  isOrphanClose: boolean;
  notes: string | null;
}): TradeForRoll {
  return {
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
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trades, importId, rolls } = body as {
      trades: Array<Record<string, unknown> & { openClose?: "open" | "close"; importKey?: string }>;
      importId?: string;
      rolls?: Array<{ closeImportKey: string; openImportKey: string; quantity: number }>;
    };
    const batchId = importId ?? `import-${Date.now()}`;

    if (!Array.isArray(trades) || trades.length === 0) {
      return NextResponse.json({ error: "No trades to import" }, { status: 400 });
    }

    const keyToTradeId = new Map<string, string>();

    const created = await prisma.$transaction(async (tx) => {
      const createdList: Awaited<ReturnType<typeof tx.trade.create>>[] = [];
      // Opens created in this batch by option key: list of { id, action, tradeDate } for matching closes (FIFO)
      const batchOpensByKey = new Map<string, Array<{ id: string; action: string; tradeDate: string }>>();

      for (let i = 0; i < trades.length; i++) {
        const t = trades[i];
        const ticker = String(t.ticker ?? "").toUpperCase();
        const optionType = (t.optionType === "put" ? "put" : "call") as "call" | "put";
        const action = (t.action === "sell" ? "sell" : "buy") as "buy" | "sell";
        const openClose = t.openClose as "open" | "close" | undefined;
        const strike = Number(t.strike ?? 0);
        const expiry = String(t.expiry ?? "");
        const tradeDate = String(t.tradeDate ?? "");
        const key = optionKey({ ticker, optionType, strike, expiry });
        const importKey = typeof t.importKey === "string" && t.importKey ? t.importKey : `imp-${i}`;

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
        keyToTradeId.set(importKey, newTrade.id);

        if (openClose !== "close") {
          const list = batchOpensByKey.get(key) ?? [];
          list.push({ id: newTrade.id, action, tradeDate: newTrade.tradeDate });
          batchOpensByKey.set(key, list);
          await resolveMatchingOrphanClose(tx, newTrade);
        }
      }

      let rollsLinked = 0;
      const rollSelections = Array.isArray(rolls) ? rolls : [];
      const usedClose = new Set<string>();
      const usedOpen = new Set<string>();

      for (const roll of rollSelections) {
        const closeImportKey = String(roll.closeImportKey ?? "").trim();
        const openImportKey = String(roll.openImportKey ?? "").trim();
        const quantity = Math.floor(Number(roll.quantity ?? 0));
        const closeTradeId = keyToTradeId.get(closeImportKey);
        const openTradeId = keyToTradeId.get(openImportKey);
        if (!closeTradeId || !openTradeId) continue;
        if (usedClose.has(closeTradeId) || usedOpen.has(openTradeId)) continue;

        const close = createdList.find((t) => t.id === closeTradeId);
        const open = createdList.find((t) => t.id === openTradeId);
        if (!close || !open) continue;

        const validationError = validateRollPair(toTradeForRoll(close), toTradeForRoll(open), quantity);
        if (validationError) continue;

        await tx.rollLink.create({
          data: { closeTradeId, openTradeId, quantity },
        });
        usedClose.add(closeTradeId);
        usedOpen.add(openTradeId);
        rollsLinked += 1;
      }

      return { createdList, rollsLinked };
    });

    revalidatePath("/trades");
    revalidatePath("/rolls");
    revalidatePath("/reports");
    revalidatePath("/open-positions");

    return NextResponse.json({
      imported: created.createdList.length,
      importId: batchId,
      trades: created.createdList,
      rollsLinked: created.rollsLinked,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to import trades";
    console.error("Import error:", e);
    return NextResponse.json(
      { error: "Failed to import trades", detail: message },
      { status: 500 }
    );
  }
}
