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
    const data: OrdinData & { 
      numePrenume?: string; 
      receipts?: { id: string; fileUrl: string; label: string }[] 
    } = await req.json();
    const rows = data.rows || [];
    const safeName = (data.numePrenume ?? "decont").replace(/\s+/g, "_");

    // Chunk receipts for 2-per-page print layout
    const receiptPages: any[][] = [];
    if (data.receipts) {
      for (let i = 0; i < data.receipts.length; i += 2) {
        receiptPages.push(data.receipts.slice(i, i + 2));
      }
    }

    const html = `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Editor Ordin de Deplasare — ${v(data.numePrenume)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root { 
      --primary: #1E3A5F; 
      --bg: #F4F7FA;
      --card-bg: #FFFFFF;
      --border: #E1E8F0;
      --text: #1A2335;
      --text-muted: #64748B;
      --print-border: #333;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Outfit', sans-serif; background: var(--bg); color: var(--text); line-height: 1.5; }

    /* Toolbars */
    .toolbar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
      background: var(--primary); color: white;
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .toolbar h1 { font-size: 16px; font-weight: 600; }
    .btn-group { display: flex; gap: 8px; }
    .btn { 
      padding: 8px 16px; border-radius: 8px; border: none; 
      font-size: 13px; font-weight: 600; cursor: pointer; 
      transition: all 0.2s; font-family: inherit;
    }
    .btn-primary { background: white; color: var(--primary); }
    .btn-primary:hover { background: #EEF3FB; }
    .btn-ghost { background: rgba(255,255,255,0.15); color: white; }
    .btn-ghost:hover { background: rgba(255,255,255,0.25); }

    /* Modern Editor Layout */
    .editor-container { 
      max-width: 900px; margin: 80px auto 40px; padding: 0 20px;
    }
    .editor-card { 
      background: var(--card-bg); border-radius: 16px; padding: 32px; 
      margin-bottom: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);
      border: 1px solid var(--border);
    }
    .editor-card h2 { font-size: 18px; margin-bottom: 24px; color: var(--primary); display: flex; align-items: center; gap: 8px; }
    
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-label { font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
    .editable-field { 
      font-size: 14px; padding: 10px 12px; border: 1px solid var(--border); 
      border-radius: 8px; background: #fafafa; min-height: 40px; outline: none;
    }
    .editable-field:focus { border-color: var(--primary); background: #fff; box-shadow: 0 0 0 3px rgba(30,58,95,0.1); }
    [contenteditable="true"] { cursor: text; }

    /* Table Styles */
    .editor-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    .editor-table th { text-align: left; font-size: 12px; color: var(--text-muted); padding: 12px; border-bottom: 2px solid var(--border); }
    .editor-table td { padding: 12px; border-bottom: 1px solid var(--border); font-size: 14px; }

    /* Receipt Gallery in Editor */
    .receipt-gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
    .receipt-thumb { border-radius: 8px; overflow: hidden; border: 1px solid var(--border); background: #fff; }
    .receipt-thumb img { width: 100%; height: 150px; object-fit: cover; display: block; }
    .receipt-thumb p { font-size: 11px; padding: 8px; color: var(--text-muted); text-align: center; }

    /* Print View - HIDDEN ON SCREEN */
    #print-view { display: none; }

    @media print {
      body { background: white; padding: 0 !important; font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 12px; }
      .toolbar, .editor-container { display: none !important; }
      #print-view { display: block !important; }

      .page {
        width: 210mm; min-height: 297mm; padding: 15mm;
        margin: 0; background: white;
        page-break-after: always;
        position: relative;
        color: black;
      }
      .val { font-style: italic; }
      .blank { display: inline-block; min-width: 120px; border-bottom: 1px dashed #999; }
      .titlu { text-align: center; margin: 16px 0 12px; }
      .titlu h1 { font-size: 16px; font-weight: bold; text-transform: uppercase; }
      .field { display: flex; border-bottom: 1px dashed #999; margin-bottom: 10px; min-height: 1.5em; }
      .field .lbl { font-weight: bold; margin-right: 8px; }
      
      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      th, td { border: 1px solid #000; padding: 6px; }
      th { background: #f0f0f0; }

      .stamp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 20px; }
      .stamp-box { border: 1px solid #000; height: 80px; padding: 5px; font-weight: bold; }

      /* Receipt Page Print Styles */
      .receipt-container { display: flex; flex-direction: column; gap: 20px; align-items: center; justify-content: center; height: 100%; }
      .receipt-item { width: 100%; text-align: center; }
      .receipt-item p { margin-bottom: 8px; font-weight: bold; font-family: 'Outfit', sans-serif; }
      .receipt-img { max-width: 100%; max-height: 120mm; border: 1px solid #eee; object-fit: contain; }
    }

    @media screen and (max-width: 600px) {
      .grid { grid-template-columns: 1fr; }
      .editor-container { padding: 0 12px; margin-top: 70px; }
      .editor-card { padding: 20px; }
    }
  </style>
</head>
<body>

<div class="toolbar">
  <h1>🧾 Editor Ordin de Deplasare</h1>
  <div class="btn-group">
    <button class="btn btn-ghost" onclick="window.print()">🖨 Printează</button>
    <button class="btn btn-primary" onclick="window.print()">📥 Descarcă PDF</button>
  </div>
</div>

<!-- MODERN EDITOR VIEW -->
<div class="editor-container">
  <div class="editor-card">
    <h2>📄 Informații Generale</h2>
    <div class="grid">
      <div class="form-group">
        <label class="form-label">Unitatea</label>
        <div class="editable-field" contenteditable="true" data-field="unitatea">${v(data.unitatea)}</div>
      </div>
      <div class="form-group">
        <label class="form-label">Număr Ordin</label>
        <div class="editable-field" contenteditable="true" data-field="numarOrdin">${v(data.numarOrdin)}</div>
      </div>
      <div class="form-group">
        <label class="form-label">Nume Prenume</label>
        <div class="editable-field" contenteditable="true" data-field="numePrenume">${v(data.numePrenume)}</div>
      </div>
      <div class="form-group">
        <label class="form-label">Funcția</label>
        <div class="editable-field" contenteditable="true" data-field="functia">${v(data.functia)}</div>
      </div>
      <div class="form-group">
        <label class="form-label">Scopul Deplasării</label>
        <div class="editable-field" contenteditable="true" data-field="scopDeplasare">${v(data.scopDeplasare)}</div>
      </div>
      <div class="form-group">
        <label class="form-label">Destinația</label>
        <div class="editable-field" contenteditable="true" data-field="destinatie">${v(data.destinatie)}</div>
      </div>
      <div class="form-group">
        <label class="form-label">Data Plecare</label>
        <div class="editable-field" contenteditable="true" data-field="dataPlecareZiOra">${v(data.dataPlecareZiOra)}</div>
      </div>
      <div class="form-group">
        <label class="form-label">Data Sosire</label>
        <div class="editable-field" contenteditable="true" data-field="dataSosireZiOra">${v(data.dataSosireZiOra)}</div>
      </div>
    </div>
  </div>

  <div class="editor-card">
    <h2>💰 Cheltuieli Efectuate</h2>
    <table class="editor-table">
      <thead>
        <tr>
          <th>Explicație</th>
          <th>Nr. Act</th>
          <th style="text-align: right;">Suma (RON)</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((r, i) => `<tr>
          <td contenteditable="true" data-field="row-fel-${i}">${r.fel}</td>
          <td contenteditable="true" data-field="row-nr-${i}">${r.nrData}</td>
          <td style="text-align: right;" contenteditable="true" data-field="row-suma-${i}">${r.suma}</td>
        </tr>`).join("")}
      </tbody>
    </table>
    <div style="margin-top: 20px; text-align: right; font-weight: 700;">
      TOTAL: <span contenteditable="true" data-field="totalCheltuieli">${v(data.totalCheltuieli)}</span>
    </div>
  </div>

  <div class="editor-card">
    <h2>🚗 Foaie de Parcurs</h2>
    <div class="grid" style="margin-bottom: 20px;">
      <div class="form-group">
        <label class="form-label">Număr Auto</label>
        <div class="editable-field" contenteditable="true" data-field="nrAuto">${v(data.nrAuto)}</div>
      </div>
      <div class="form-group">
        <label class="form-label">KM Total</label>
        <div class="editable-field" contenteditable="true" data-field="distantaKm">${v(data.distantaKm)}</div>
      </div>
    </div>
    <div class="form-label" style="margin-bottom: 10px;">Itinerariu</div>
    <div style="overflow-x: auto;">
      <table class="editor-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Loc plecare</th>
            <th>Ora</th>
            <th>Loc Sosire</th>
            <th>Ora</th>
            <th>Km</th>
          </tr>
        </thead>
        <tbody>
          ${(data.itinerariu || []).map((step, i, arr) => {
            if (i === arr.length - 1) return "";
            const next = arr[i + 1];
            return `<tr>
              <td contenteditable="true" data-field="itin-data-${i}">${step.data || ""}</td>
              <td contenteditable="true" data-field="itin-loc-${i}">${step.loc || ""}</td>
              <td contenteditable="true" data-field="itin-ora-p-${i}">${step.oraPlecare || ""}</td>
              <td contenteditable="true" data-field="itin-loc-s-${i}">${next.loc || ""}</td>
              <td contenteditable="true" data-field="itin-ora-s-${i}">${next.oraSosire || ""}</td>
              <td contenteditable="true" data-field="itin-km-${i}">${next.km || ""}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  </div>

  <div class="editor-card">
    <h2>📸 Bonuri Scante (Anexe)</h2>
    <div class="receipt-gallery">
      ${(data.receipts || []).map(r => `
        <div class="receipt-thumb">
          <img src="${r.fileUrl}" alt="Bon" />
          <p>${v(r.label)}</p>
        </div>
      `).join("")}
      ${!(data.receipts?.length) ? '<p style="color: #999; grid-column: 1/-1; text-align: center;">Niciun bon adăugat încă.</p>' : ''}
    </div>
  </div>
</div>

<!-- TRADITIONAL PRINT VIEW -->
<div id="print-view">
  <!-- PAGE 1: ORDIN DE DEPLASARE -->
  <div class="page">
    <div style="display:flex; justify-content:space-between; border-bottom:1px solid #000; padding-bottom:10px;">
      <div>Unitatea: <strong data-field="unitatea">${v(data.unitatea)}</strong></div>
      <div>Nr. Ordin: <strong data-field="numarOrdin">${v(data.numarOrdin)}</strong></div>
    </div>
    <div class="titlu"><h1>Ordin de Deplasare</h1></div>
    <div class="field"><span class="lbl" style="font-weight:bold;">Domnul (a):</span> <span class="val" data-field="numePrenume">${v(data.numePrenume)}</span></div>
    <div class="field"><span class="lbl" style="font-weight:bold;">Având funcția de:</span> <span class="val" data-field="functia">${v(data.functia)}</span></div>
    <div class="field"><span class="lbl" style="font-weight:bold;">Este delegat pentru:</span> <span class="val" data-field="scopDeplasare">${v(data.scopDeplasare)}</span></div>
    <div class="field"><span class="lbl" style="font-weight:bold;">La:</span> <span class="val" data-field="destinatie">${v(data.destinatie)}</span></div>
    <div class="field" style="display:flex; gap:10px;">
      <span class="lbl" style="font-weight:bold;">De la:</span> <span class="val" data-field="dataPlecareZiOra">${v(data.dataPlecareZiOra)}</span>
      <span class="lbl" style="font-weight:bold;">Până la:</span> <span class="val" data-field="dataSosireZiOra">${v(data.dataSosireZiOra)}</span>
    </div>
    <div class="field"><span class="lbl" style="font-weight:bold;">Se legitimează cu:</span> <span class="val">${v(data.legitimatie)}</span></div>
    <div style="margin-top:40px; display:flex; justify-content:space-between;">
      <span>Data: ________________</span>
      <div style="text-align:center; border-top:1px solid #000; width:200px; padding-top:5px;">Semnătura unității</div>
    </div>
    <div class="stamp-grid">
      <div class="stamp-box">Sosit / Plecat 1</div>
      <div class="stamp-box">Sosit / Plecat 2</div>
      <div class="stamp-box">Sosit / Plecat 3</div>
      <div class="stamp-box">Sosit / Plecat 4</div>
    </div>
  </div>

  <!-- PAGE 2: DECONT -->
  <div class="page">
    <div class="titlu"><h1>Decont de Cheltuieli</h1></div>
    <table style="border: 1px solid #000; border-collapse: collapse; width: 100%;">
      <thead>
        <tr><th style="border: 1px solid #000; padding: 6px;">Explicație</th><th style="border: 1px solid #000; padding: 6px;">Nr. Act</th><th style="border: 1px solid #000; padding: 6px;">Suma</th></tr>
      </thead>
      <tbody>
        ${rows.map((r, i) => `<tr>
          <td style="border: 1px solid #000; padding: 6px;" data-field="row-fel-${i}">${r.fel}</td>
          <td style="border: 1px solid #000; padding: 6px;" data-field="row-nr-${i}">${r.nrData}</td>
          <td style="border: 1px solid #000; padding: 6px; text-align:right;" data-field="row-suma-${i}">${r.suma}</td>
        </tr>`).join("")}
        <tr style="font-weight:bold;">
          <td colspan="2" style="border: 1px solid #000; padding: 6px; text-align:right;">TOTAL:</td>
          <td style="border: 1px solid #000; padding: 6px; text-align:right;" data-field="totalCheltuieli">${v(data.totalCheltuieli)}</td>
        </tr>
      </tbody>
    </table>
    <div style="margin-top:40px; display:grid; grid-template-columns: repeat(4, 1fr); gap:10px; text-align:center;">
      <div style="border-top:1px solid #000; padding-top:5px;">Aprobat</div>
      <div style="border-top:1px solid #000; padding-top:5px;">Control VP</div>
      <div style="border-top:1px solid #000; padding-top:5px;">Verificat</div>
      <div style="border-top:1px solid #000; padding-top:5px;">Titular</div>
    </div>
  </div>

  <!-- PAGE 3: FOAIE PARCURS -->
  <div class="page">
    <div class="titlu"><h1>Foaie de Parcurs</h1></div>
    <div style="display:flex; justify-content:space-between; margin-bottom:20px;">
      <div>Auto: <strong data-field="nrAuto">${v(data.nrAuto)}</strong></div>
      <div>Șofer: <strong>${v(data.numeSofer)}</strong></div>
      <div>Total KM: <strong data-field="distantaKm">${v(data.distantaKm)}</strong></div>
    </div>
    <table style="border: 1px solid #000; border-collapse: collapse; width: 100%;">
      <thead>
        <tr>
          <th style="border: 1px solid #000; padding: 4px;">Data</th>
          <th style="border: 1px solid #000; padding: 4px;">Loc plecare</th>
          <th style="border: 1px solid #000; padding: 4px;">Ora</th>
          <th style="border: 1px solid #000; padding: 4px;">Loc Sosire</th>
          <th style="border: 1px solid #000; padding: 4px;">Ora</th>
          <th style="border: 1px solid #000; padding: 4px;">Km</th>
        </tr>
      </thead>
      <tbody>
        ${(data.itinerariu || []).map((step, i, arr) => {
          if (i === arr.length - 1) return "";
          const next = arr[i + 1];
          return `<tr>
            <td style="border: 1px solid #000; padding: 4px; text-align:center;" data-field="itin-data-${i}">${step.data || ""}</td>
            <td style="border: 1px solid #000; padding: 4px;" data-field="itin-loc-${i}">${step.loc || ""}</td>
            <td style="border: 1px solid #000; padding: 4px; text-align:center;" data-field="itin-ora-p-${i}">${step.oraPlecare || ""}</td>
            <td style="border: 1px solid #000; padding: 4px;" data-field="itin-loc-s-${i}">${next.loc || ""}</td>
            <td style="border: 1px solid #000; padding: 4px; text-align:center;" data-field="itin-ora-s-${i}">${next.oraSosire || ""}</td>
            <td style="border: 1px solid #000; padding: 4px; text-align:center;" data-field="itin-km-${i}">${next.km || ""}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  </div>

  <!-- RECEIPT PAGES -->
  ${receiptPages.map((page, pIdx) => `
    <div class="page">
      <div class="titlu"><h1>Anexe Bonuri (Pagina ${pIdx + 1})</h1></div>
      <div class="receipt-container">
        ${page.map(r => `
          <div class="receipt-item">
            <p>${v(r.label)}</p>
            <img src="${r.fileUrl}" class="receipt-img" onerror="this.src='https://placehold.co/400x600?text=Imagine+Indisponibila'"/>
          </div>
        `).join("")}
      </div>
    </div>
  `).join("")}
</div>

<script>
  // Sync changes from editor to print view
  document.querySelectorAll('.editable-field, [contenteditable="true"]').forEach(el => {
    el.addEventListener('input', () => {
      const field = el.dataset.field;
      if (!field) return;
      const value = el.innerText || el.textContent;
      document.querySelectorAll(\`[data-field="\${field}"]\`).forEach(target => {
        if (target !== el) {
          if (target.tagName === 'STRONG' || target.tagName === 'SPAN' || target.tagName === 'TD' || target.tagName === 'DIV') {
            target.innerText = value;
          }
        }
      });
    });
  });
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
