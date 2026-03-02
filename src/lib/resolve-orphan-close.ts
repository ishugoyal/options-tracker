import type { PrismaClient } from "@prisma/client";

/**
 * After creating an opening trade, try to link one matching orphan close (same option, opposite action).
 * Only considers orphan closes whose tradeDate is on or after the open's tradeDate (close date >= open date).
 * Updates the orphan to closesTradeId = openTrade.id and isOrphanClose = false (FIFO by tradeDate).
 */
export async function resolveMatchingOrphanClose(
  prismaOrTx: PrismaClient | Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use">,
  openTrade: {
    id: string;
    ticker: string;
    optionType: string;
    strike: number;
    expiry: string;
    action: string;
    tradeDate: string;
  }
): Promise<void> {
  const oppositeAction = openTrade.action === "buy" ? "sell" : "buy";
  const orphan = await prismaOrTx.trade.findFirst({
    where: {
      isOrphanClose: true,
      ticker: openTrade.ticker,
      optionType: openTrade.optionType,
      strike: openTrade.strike,
      expiry: openTrade.expiry,
      action: oppositeAction,
      tradeDate: { gte: openTrade.tradeDate },
    },
    orderBy: { tradeDate: "asc" },
  });
  if (!orphan) return;
  await prismaOrTx.trade.update({
    where: { id: orphan.id },
    data: { closesTradeId: openTrade.id, isOrphanClose: false },
  });
}
