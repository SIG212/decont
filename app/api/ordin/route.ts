import { NextRequest, NextResponse } from "next/server";
import { generateOrdinDeplasare } from "@/lib/ordin";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const buffer = await generateOrdinDeplasare(data);
    const name = (data.numePrenume ?? "decont").replace(/\s+/g, "_");
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="Ordin_Deplasare_${name}.docx"`,
      },
    });
  } catch (err) {
    console.error("Ordin error:", err);
    return NextResponse.json({ error: "Eroare la generare" }, { status: 500 });
  }
}
