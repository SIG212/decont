import { NextRequest, NextResponse } from "next/server";
import { generateOrdinDeplasare } from "@/lib/ordin";
import mammoth from "mammoth";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const buffer = await generateOrdinDeplasare(data);

    const result = await mammoth.convertToHtml(
      { buffer: Buffer.from(buffer) },
      {
        styleMap: [
          "p[style-name='Table Contents'] => td > p:fresh",
          "b => strong",
        ],
      }
    );

    const html = `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ordin de Deplasare — ${data.numePrenume ?? ""}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #E8E8E8;
      font-family: 'Times New Roman', serif;
      padding: 32px 16px 64px;
    }
    .toolbar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      background: #1E3A5F; color: white;
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    .toolbar h1 { font-size: 15px; font-weight: 600; font-family: system-ui, sans-serif; }
    .toolbar-actions { display: flex; gap: 10px; }
    .btn {
      padding: 7px 16px; border-radius: 6px; border: none;
      font-size: 13px; font-weight: 600; cursor: pointer;
      font-family: system-ui, sans-serif; text-decoration: none;
      display: inline-flex; align-items: center; gap: 6px;
    }
    .btn-download { background: white; color: #1E3A5F; }
    .btn-close { background: rgba(255,255,255,0.15); color: white; }
    .btn-close:hover { background: rgba(255,255,255,0.25); }
    .page {
      background: white;
      width: 210mm;
      min-height: 297mm;
      margin: 56px auto 0;
      padding: 18mm 18mm;
      box-shadow: 0 4px 24px rgba(0,0,0,0.15);
    }
    /* Document styles */
    p { margin-bottom: 4px; font-size: 11pt; line-height: 1.4; }
    strong { font-weight: bold; }
    table {
      width: 100%; border-collapse: collapse;
      margin-bottom: 6px; font-size: 10.5pt;
    }
    td, th {
      border: 1px solid #000;
      padding: 4px 6px;
      vertical-align: middle;
    }
    th { background: #EEEEEE; font-weight: bold; text-align: center; }
    @media print {
      .toolbar { display: none; }
      body { background: white; padding: 0; }
      .page { box-shadow: none; margin: 0; padding: 15mm; width: 100%; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <h1>🧾 Ordin de Deplasare — ${data.numePrenume ?? ""}</h1>
    <div class="toolbar-actions">
      <button class="btn btn-download" onclick="downloadDocx()">↓ Descarcă DOCX</button>
      <button class="btn btn-close" onclick="window.print()">🖨 Printează</button>
    </div>
  </div>
  <div class="page">
    ${result.value}
  </div>
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
      a.download = 'Ordin_Deplasare_${data.numePrenume?.replace(/\s+/g, "_") ?? "decont"}.docx';
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
    return NextResponse.json({ error: "Eroare la preview" }, { status: 500 });
  }
}