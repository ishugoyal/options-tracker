import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await prisma.rollLink.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Roll link not found" }, { status: 404 });
    }

    await prisma.rollLink.delete({ where: { id } });

    revalidatePath("/trades");
    revalidatePath("/rolls");
    revalidatePath("/reports");
    revalidatePath("/open-positions");

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to delete roll link" },
      { status: 500 }
    );
  }
}
