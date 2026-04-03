import { NextRequest, NextResponse } from "next/server";
import { OrdinData } from "@/lib/ordin";

function v(text?: string) { return text?.trim() || ""; }
function fill(text?: string) {
  return v(text)
    ? `<span class="val">${v(text)}</span>`
    : `<span class="blank"></span>`;
}

export async function POST(req: NextRequest) {
  try {
    const data: OrdinData & { numePrenume?: string } = await req.json();
    const rows = data.rows || [];
    const EMPTY = Math.max(0, 8 - rows.length);
    const safeName = (data.numePrenume ?? "decont").replace(/\s+/g, "_");

    const html = `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8">
  <title>Ordin de Deplasare — ${v(data.numePrenume)}</title>
  <style>
    :root { --border: #333; --dash: #999; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #f0f0f0; padding: 60px 16px 40px; font-size: 12px; color: #000; }

    .toolbar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      background: #1E3A5F; color: white;
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 24px; font-family: system-ui, sans-serif;
    }
    .toolbar h1 { font-size: 14px; font-weight: 600; }
    .btn { padding: 6px 14px; border-radius: 6px; border: none; font-size: 12px; font-weight: 600; cursor: pointer; margin-left: 8px; font-family: system-ui, sans-serif; }
    .btn-dl { background: white; color: #1E3A5F; }
    .btn-print { background: rgba(255,255,255,0.15); color: white; }

    .page {
      width: 210mm; min-height: 297mm; padding: 15mm;
      margin: 0 auto 30px; background: white;
      box-shadow: 0 0 10px rgba(0,0,0,0.15);
      page-break-after: always;
    }

    /* val = valoare completata italic */
    .val { font-style: italic; }
    .blank { display: inline-block; min-width: 120px; border-bottom: 1px dashed var(--dash); }
    .blank-long { display: inline-block; width: 100%; border-bottom: 1px dashed var(--dash); }

    /* Header */
    .header { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 11px; }
    .unitate { border-bottom: 1px solid var(--border); padding-bottom: 4px; }
    .unitate small { color: #555; display: block; margin-bottom: 2px; }

    /* Titlu */
    .titlu { text-align: center; margin: 16px 0 12px; }
    .titlu h1 { font-size: 16px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; }
    .titlu .nr { margin-top: 4px; font-size: 12px; }

    /* Câmpuri */
    .field { display: flex; align-items: baseline; margin-bottom: 10px; }
    .field .lbl { font-weight: bold; white-space: nowrap; margin-right: 6px; }
    .field .line { flex: 1; border-bottom: 1px dashed var(--dash); min-height: 1.3em; padding-bottom: 1px; }
    .field .val { flex: 1; border-bottom: 1px dashed var(--dash); font-style: italic; }

    .field-dual { display: flex; align-items: baseline; margin-bottom: 10px; gap: 8px; }
    .field-dual .lbl { font-weight: bold; white-space: nowrap; }
    .field-dual .line { flex: 1; border-bottom: 1px dashed var(--dash); min-height: 1.3em; }
    .field-dual .sep { font-weight: bold; white-space: nowrap; margin: 0 8px; }

    /* Semnatura */
    .sign-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 28px; margin-bottom: 24px; }
    .sign-box { text-align: center; border-top: 1px solid var(--border); width: 200px; padding-top: 4px; font-size: 11px; }

    /* Sosit/Plecat */
    .stamp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .stamp-box { border: 1px solid var(--border); padding: 8px; height: 100px; }
    .stamp-box-title { font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 4px; display: block; }

    /* Verso */
    .verso-title { text-align: center; text-transform: uppercase; font-size: 14px; font-weight: bold; margin-bottom: 16px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 16px; }
    .avans-box { border: 1px solid var(--border); padding: 10px; }
    .avans-box p { margin-bottom: 5px; }
    .info-col p { margin-bottom: 6px; }

    /* Tabel cheltuieli */
    .ch-title { font-weight: bold; margin: 14px 0 6px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11px; }
    th, td { border: 1px solid var(--border); padding: 6px 8px; }
    th { background: #f9f9f9; font-weight: bold; }
    td.right { text-align: right; }
    td.center { text-align: center; }
    .total-row td { background: #f9f9f9; font-weight: bold; }

    /* Diferenta */
    .dif-box { border: 1px solid #ccc; padding: 8px 10px; margin: 10px 0 18px; }

    /* Semnături verso */
    .sigs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; text-align: center; margin-top: 24px; }
    .sig-box { border-top: 2px solid var(--border); padding-top: 5px; font-size: 10px; min-height: 50px; }

    @media print {
      .toolbar { display: none; }
      body { background: none; padding: 0; }
      .page { margin: 0; box-shadow: none; }
    }
  </style>
</head>
<body>

<div class="toolbar">
  <h1>🧾 Ordin de Deplasare — ${v(data.numePrenume)}</h1>
  <div>
    <button class="btn btn-dl" onclick="downloadDocx()">↓ Descarcă DOCX</button>
    <button class="btn btn-print" onclick="window.print()">🖨 Printează</button>
  </div>
</div>

<!-- FAŢĂ -->
<div class="page">
  <div class="header">
    <div class="unitate">
      <small>Unitatea (Nume, CUI, Adresă):</small>
      <strong>${v(data.unitatea) || "____________________________"}</strong>
    </div>
    <div>Depus decontul nr: <span class="blank"></span> din <span class="blank"></span></div>
  </div>

  <div class="titlu">
    <h1>Ordin de Deplasare (Delegație)</h1>
    <div class="nr">Nr. ${fill(data.numarOrdin)}</div>
  </div>

  <div class="field">
    <span class="lbl">Domnul (a):</span>
    <span class="${v(data.numePrenume) ? 'val' : 'line'}">${v(data.numePrenume) || ""}</span>
  </div>
  <div class="field">
    <span class="lbl">Având funcția de:</span>
    <span class="${v(data.functia) ? 'val' : 'line'}">${v(data.functia) || ""}</span>
  </div>
  <div class="field">
    <span class="lbl">Este delegat pentru:</span>
    <span class="${v(data.scopDeplasare) ? 'val' : 'line'}">${v(data.scopDeplasare) || ""}</span>
  </div>
  <div class="field">
    <span class="lbl">La:</span>
    <span class="${v(data.destinatie) ? 'val' : 'line'}">${v(data.destinatie) || ""}</span>
  </div>

  <div class="field-dual">
    <span class="lbl">Durata deplasării de la data:</span>
    <span class="${v(data.dataPlecareZiOra) ? 'val line' : 'line'}">${v(data.dataPlecareZiOra) || ""}</span>
    <span class="sep">până la:</span>
    <span class="${v(data.dataSosireZiOra) ? 'val line' : 'line'}">${v(data.dataSosireZiOra) || ""}</span>
  </div>

  <div class="field">
    <span class="lbl">Se legitimează cu:</span>
    <span class="${v(data.legitimatie) ? 'val' : 'line'}">${v(data.legitimatie) || "BI / CI Seria ____ Nr. _________"}</span>
  </div>

  <div class="sign-row">
    <div>Data: <span class="val">${v(data.dataOrdin) || "____________"}</span></div>
    <div class="sign-box">Semnătura și ștampila unității</div>
  </div>

  <div class="stamp-grid">
    <div class="stamp-box"><span class="stamp-box-title">Sosit / Plecat 1</span></div>
    <div class="stamp-box"><span class="stamp-box-title">Sosit / Plecat 2</span></div>
    <div class="stamp-box"><span class="stamp-box-title">Sosit / Plecat 3</span></div>
    <div class="stamp-box"><span class="stamp-box-title">Sosit / Plecat 4</span></div>
  </div>
</div>

<!-- VERSO -->
<div class="page">
  <div class="verso-title">Decont de Cheltuieli</div>

  <div class="info-grid">
    <div class="info-col">
      <p><strong>Ziua și ora plecării:</strong> <span class="val">${v(data.dataPlecareZiOra) || "___________________"}</span></p>
      <p><strong>Ziua și ora sosirii:</strong> <span class="val">${v(data.dataSosireZiOra) || "___________________"}</span></p>
      <p><strong>Data depunerii decontului:</strong> <span class="val">${v(data.dataOrdin) || "____________"}</span></p>
    </div>
    <div class="avans-box">
      <p><strong>Avans spre decontare:</strong></p>
      <p>- Primit la plecare: <span class="val">${v(data.avansAcordat) || "__________"}</span> lei</p>
      <p>- Primit în timpul deplasării: <span class="blank"></span> lei</p>
      <p><strong>TOTAL AVANS: <span class="blank"></span> lei</strong></p>
    </div>
  </div>

  <div class="ch-title">Cheltuieli efectuate conform documentelor anexate</div>
  <table>
    <thead>
      <tr>
        <th style="width:45%">Felul actului și emitentul</th>
        <th style="width:30%">Nr. și data actului</th>
        <th style="width:25%">Suma (LEI)</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map(r => `<tr>
        <td><span class="val">${r.fel || ""}</span></td>
        <td class="center"><span class="val">${r.nrData || ""}</span></td>
        <td class="right"><span class="val">${r.suma || ""}</span></td>
      </tr>`).join("")}
      ${Array.from({ length: EMPTY }, () => `<tr><td>&nbsp;</td><td></td><td></td></tr>`).join("")}
      <tr class="total-row">
        <td colspan="2" style="text-align:right">TOTAL CHELTUIELI:</td>
        <td class="right val">${v(data.totalCheltuieli) || ""}</td>
      </tr>
    </tbody>
  </table>

  <div class="dif-box">
    Diferența de restituit / primit: <span class="val">${v(data.diferenta) || "____________________________"}</span> lei.
  </div>

  <div class="sigs">
    <div class="sig-box">Aprobat Conducător Unitate</div>
    <div class="sig-box">Control Financiar Preventiv</div>
    <div class="sig-box">Verificat Decont</div>
    <div class="sig-box">Titular Avans</div>
  </div>
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
