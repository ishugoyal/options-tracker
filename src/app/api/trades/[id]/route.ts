import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const trade = await prisma.trade.findUnique({ where: { id } });
    if (!trade) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(trade);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch trade" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
      notes,
      fees,
    } = body;

    const trade = await prisma.trade.update({
      where: { id },
      data: {
        ...(ticker != null && { ticker: String(ticker).toUpperCase() }),
        ...(optionType != null && { optionType }),
        ...(strike != null && { strike: Number(strike) }),
        ...(expiry != null && { expiry: String(expiry) }),
        ...(action != null && { action }),
        ...(quantity != null && { quantity: Math.floor(Number(quantity)) }),
        ...(pricePerContract != null && { pricePerContract: Number(pricePerContract) }),
        ...(tradeDate != null && { tradeDate: String(tradeDate) }),
        ...(notes !== undefined && { notes: notes ?? null }),
        ...(fees !== undefined && { fees: fees != null ? Number(fees) : null }),
      },
    });
    revalidatePath("/");
    revalidatePath("/trades");
    revalidatePath("/open-positions");
    revalidatePath("/closed-positions");
    return NextResponse.json(trade);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update trade" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await prisma.trade.delete({ where: { id } });
    revalidatePath("/");
    revalidatePath("/trades");
    revalidatePath("/open-positions");
    revalidatePath("/closed-positions");
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete trade" }, { status: 500 });
  }
}
