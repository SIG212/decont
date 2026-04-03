import { NextRequest, NextResponse } from "next/server";
import { generateOrdinDeplasare } from "@/lib/ordin";
import mammoth from "mammoth";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const buffer = await generateOrdinDeplasare(data);
    const result = await mammoth.convertToHtml({ buffer: Buffer.from(buffer) });
    const name = data.numePrenume ?? "";
    const safeName = name.replace(/\s+/g, "_");

    const html = `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8">
  <title>Ordin de Deplasare — ${name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #E8E8E8; font-family: Calibri, sans-serif; padding: 32px 16px 64px; }
    .toolbar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      background: #1E3A5F; color: white;
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      font-family: system-ui, sans-serif;
    }
    .toolbar h1 { font-size: 15px; font-weight: 600; }
    .btn {
      padding: 7px 16px; border-radius: 6px; border: none;
      font-size: 13px; font-weight: 600; cursor: pointer;
      font-family: system-ui, sans-serif; margin-left: 8px;
    }
    .btn-dl { background: white; color: #1E3A5F; }
    .btn-print { background: rgba(255,255,255,0.15); color: white; }
    .page {
      background: white; width: 210mm; min-height: 297mm;
      margin: 56px auto 0; padding: 13mm 13mm;
      box-shadow: 0 4px 24px rgba(0,0,0,0.15);
    }
    p { margin-bottom: 3px; font-size: 10pt; line-height: 1.4; }
    em { font-style: italic; color: #1A2335; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 10pt; }
    td, th { padding: 4px 7px; vertical-align: middle; }
    th { background: #EEF3FB; font-weight: bold; }
    @media print {
      .toolbar { display: none; }
      body { background: white; padding: 0; }
      .page { box-shadow: none; margin: 0; padding: 13mm; width: 100%; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <h1>🧾 Ordin de Deplasare — ${name}</h1>
    <div>
      <button class="btn btn-dl" onclick="downloadDocx()">↓ Descarcă DOCX</button>
      <button class="btn btn-print" onclick="window.print()">🖨 Printează</button>
    </div>
  </div>
  <div class="page">${result.value}</div>
  <script>
    const payload = ${JSON.stringify(data)};
    async function downloadDocx() {
      const res = await fetch('/api/ordin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Ordin_Deplasare_${safeName}.docx';
      a.click();
      URL.revokeObjectURL(url);
    }
  </script>
</body>
</html>`;

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    console.error("Preview error:", err);
    return NextResponse.json({ error: "Eroare preview" }, { status: 500 });
  }
}
