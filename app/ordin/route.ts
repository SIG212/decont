import { NextRequest, NextResponse } from "next/server";
import { generateOrdinDeplasare } from "@/lib/ordin";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const buffer = await generateOrdinDeplasare(data);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="Ordin_Deplasare_${data.numePrenume?.replace(/\s+/g, "_") ?? "decont"}.docx"`,
      },
    });
  } catch (err) {
    console.error("Ordin error:", err);
    return NextResponse.json({ error: "Eroare la generare" }, { status: 500 });
  }
}
