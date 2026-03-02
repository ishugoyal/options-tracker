import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { resolveMatchingOrphanClose } from "@/lib/resolve-orphan-close";

export async function GET() {
  try {
    const trades = await prisma.trade.findMany({
      orderBy: { tradeDate: "desc" },
    });
    return NextResponse.json(trades);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch trades" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      ticker,
      optionType,
      strike,
      expiry,
      action,
      quantity,
      pricePerContract,
      tradeDate,
      notes = null,
      fees = null,
      source = "manual",
      importId = null,
    } = body;

    if (
      !ticker ||
      !optionType ||
      strike == null ||
      !expiry ||
      !action ||
      quantity == null ||
      pricePerContract == null ||
      !tradeDate
    ) {
      return NextResponse.json(
        { error: "Missing required fields: ticker, optionType, strike, expiry, action, quantity, pricePerContract, tradeDate" },
        { status: 400 }
      );
    }

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty < 1 || Math.floor(qty) !== qty) {
      return NextResponse.json(
        { error: "Quantity must be a positive whole number (contracts)" },
        { status: 400 }
      );
    }

    const trade = await prisma.trade.create({
      data: {
        ticker: String(ticker).toUpperCase(),
        optionType: optionType === "call" || optionType === "put" ? optionType : "call",
        strike: Number(strike),
        expiry: String(expiry),
        action: action === "buy" || action === "sell" ? action : "buy",
        quantity: Math.floor(qty),
        pricePerContract: Number(pricePerContract),
        tradeDate: String(tradeDate),
        notes: notes ?? null,
        fees: fees != null ? Number(fees) : null,
        source: String(source),
        importId: importId ?? null,
      },
    });
    await resolveMatchingOrphanClose(prisma, trade);
    revalidatePath("/");
    revalidatePath("/trades");
    revalidatePath("/open-positions");
    revalidatePath("/closed-positions");
    revalidatePath("/orphaned-closes");
    return NextResponse.json(trade);
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Failed to create trade";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
