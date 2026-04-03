import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const SYSTEM_PROMPT = `You are an expense receipt OCR engine. Extract structured data from the receipt image or document provided.

Return ONLY a valid JSON object (no markdown, no explanation) with these exact keys:
{
  "tipDocument": "bon fiscal | factura | chitanta | bilet | altele",
  "nrDocument": "document/receipt number or empty string",
  "dataDocument": "DD.MM.YYYY format or empty string",
  "emitent": "company/store name that issued the document",
  "sumaPlatiata": numeric value only (no currency symbol),
  "moneda": "RON | EUR | USD | GBP or other 3-letter currency code",
  "cursValutar": 1 if RON, otherwise the exchange rate if visible or empty string,
  "valoareRON": numeric value in RON (sumaPlatiata * cursValutar if foreign currency),
  "platitor": "",
  "explicatii": "brief description: type of expense, fuel type if applicable, meal, accommodation, etc."
}

Rules:
- If a field is not visible or cannot be determined, use empty string ""
- For numeric fields use numbers not strings
- tipDocument must be one of: bon fiscal, factura, chitanta, bilet, altele
- Always try to infer the expense category in explicatii (e.g. "Combustibil diesel", "Masa de pranz", "Cazare", "Taxi", etc.)
- If the document is in a foreign currency and no exchange rate is visible, set cursValutar to ""`;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    // Determine mime type
    let mimeType = file.type;
    if (!mimeType || mimeType === "application/octet-stream") {
      const ext = file.name.split(".").pop()?.toLowerCase();
      const mimeMap: Record<string, string> = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        webp: "image/webp",
        pdf: "application/pdf",
        heic: "image/heic",
      };
      mimeType = mimeMap[ext || ""] || "image/jpeg";
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent([
      SYSTEM_PROMPT,
      {
        inlineData: {
          mimeType,
          data: base64,
        },
      },
    ]);

    const text = result.response.text().trim();

    // Strip markdown fences if present
    const clean = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

    const parsed = JSON.parse(clean);

    return NextResponse.json(parsed);
  } catch (err: unknown) {
    console.error("Scan error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
