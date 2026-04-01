"use client";

import { useState, useCallback, useRef } from "react";
import { DecontRow, ScanResult } from "@/types";
import { generateExcel } from "@/lib/excel";
import { v4 as uuidv4 } from "uuid";

const MONEDE = ["RON", "EUR", "USD", "GBP", "CHF", "HUF"];
const TIP_DOCUMENTE = ["bon fiscal", "factura", "chitanta", "bilet", "altele"];

function emptyRow(nr: number): DecontRow {
  return {
    id: uuidv4(),
    nr,
    tipDocument: "",
    nrDocument: "",
    dataDocument: "",
    emitent: "",
    sumaPlatiata: "",
    moneda: "RON",
    cursValutar: 1,
    valoareRON: "",
    platitor: "",
    explicatii: "",
    scanStatus: "done",
  };
}

export default function Home() {
  const [rows, setRows] = useState<DecontRow[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [scanning, setScanning] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(async (files: File[]) => {
    const validFiles = files.filter((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase();
      return ["jpg", "jpeg", "png", "webp", "pdf", "heic"].includes(ext || "");
    });

    if (!validFiles.length) return;

    // Create placeholder rows immediately
    const newRows: DecontRow[] = validFiles.map((f, i) => ({
      ...emptyRow(rows.length + i + 1),
      fileName: f.name,
      scanStatus: "pending" as const,
    }));

    setRows((prev) => [...prev, ...newRows]);

    // Scan each file
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      const row = newRows[i];

      setScanning((prev) => new Set(prev).add(row.id));

      try {
        const fd = new FormData();
        fd.append("file", file);

        const res = await fetch("/api/scan", { method: "POST", body: fd });
        const data: ScanResult = await res.json();

        setRows((prev) =>
          prev.map((r) =>
            r.id === row.id
              ? {
                  ...r,
                  ...data,
                  scanStatus: data.error ? "error" : "done",
                  sumaPlatiata: data.sumaPlatiata ?? "",
                  cursValutar: data.cursValutar ?? 1,
                  valoareRON: data.valoareRON ?? "",
                  moneda: data.moneda || "RON",
                }
              : r
          )
        );
      } catch {
        setRows((prev) =>
          prev.map((r) => (r.id === row.id ? { ...r, scanStatus: "error" } : r))
        );
      } finally {
        setScanning((prev) => {
          const next = new Set(prev);
          next.delete(row.id);
          return next;
        });
      }
    }
  }, [rows.length]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      processFiles(Array.from(e.dataTransfer.files));
    },
    [processFiles]
  );

  const updateRow = (id: string, field: keyof DecontRow, value: string | number) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };
        // Auto-calc valoareRON if suma or curs changes
        if (field === "sumaPlatiata" || field === "cursValutar") {
          const suma = parseFloat(String(field === "sumaPlatiata" ? value : updated.sumaPlatiata).replace(",", "."));
          const curs = parseFloat(String(field === "cursValutar" ? value : updated.cursValutar).replace(",", "."));
          if (!isNaN(suma) && !isNaN(curs)) {
            updated.valoareRON = Math.round(suma * curs * 100) / 100;
          }
        }
        return updated;
      })
    );
  };

  const deleteRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id).map((r, i) => ({ ...r, nr: i + 1 })));
  };

  const addEmptyRow = () => {
    setRows((prev) => [...prev, emptyRow(prev.length + 1)]);
  };

  const handleExport = () => {
    const blob = generateExcel(rows);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Decont_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalRON = rows.reduce((sum, r) => {
    const v = parseFloat(String(r.valoareRON).replace(",", "."));
    return sum + (isNaN(v) ? 0 : v);
  }, 0);

  const isScanning = scanning.size > 0;

  return (
    <div className="app">
      <header>
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">🧾</span>
            <div>
              <h1>Decont</h1>
              <p>Scanner bonuri &amp; export Excel</p>
            </div>
          </div>
          <div className="header-actions">
            {rows.length > 0 && (
              <>
                <span className="total-badge">
                  Total: <strong>{totalRON.toFixed(2)} RON</strong>
                </span>
                <button className="btn btn-export" onClick={handleExport} disabled={isScanning}>
                  ↓ Export Excel
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* Drop zone */}
        <div
          className={`dropzone ${isDragging ? "dragging" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.pdf,.heic"
            style={{ display: "none" }}
            onChange={(e) => processFiles(Array.from(e.target.files || []))}
          />
          <div className="dz-content">
            {isScanning ? (
              <>
                <div className="spinner" />
                <p>Se procesează {scanning.size} bon{scanning.size > 1 ? "uri" : ""}...</p>
              </>
            ) : (
              <>
                <div className="dz-icon">📎</div>
                <p><strong>Trage bonurile aici</strong> sau click pentru upload</p>
                <span className="dz-hint">JPG, PNG, PDF, HEIC — multiple fișiere simultan</span>
              </>
            )}
          </div>
        </div>

        {/* Table */}
        {rows.length > 0 && (
          <div className="table-wrap">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th className="col-nr">#</th>
                    <th className="col-tip">Tip document</th>
                    <th className="col-nr-doc">Nr. document</th>
                    <th className="col-data">Data</th>
                    <th className="col-emitent">Emitent</th>
                    <th className="col-suma">Suma plătită</th>
                    <th className="col-moneda">Monedă</th>
                    <th className="col-curs">Curs</th>
                    <th className="col-ron">Valoare RON</th>
                    <th className="col-platitor">Plătitor</th>
                    <th className="col-expl">Explicații</th>
                    <th className="col-del" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isPending = row.scanStatus === "pending" || scanning.has(row.id);
                    const isError = row.scanStatus === "error";
                    return (
                      <tr key={row.id} className={isPending ? "row-pending" : isError ? "row-error" : ""}>
                        <td className="col-nr">{row.nr}</td>
                        <td className="col-tip">
                          {isPending ? <span className="skeleton" /> : (
                            <select
                              value={row.tipDocument}
                              onChange={(e) => updateRow(row.id, "tipDocument", e.target.value)}
                            >
                              <option value="">—</option>
                              {TIP_DOCUMENTE.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                          )}
                        </td>
                        <td className="col-nr-doc">
                          {isPending ? <span className="skeleton" /> : (
                            <input value={row.nrDocument} onChange={(e) => updateRow(row.id, "nrDocument", e.target.value)} />
                          )}
                        </td>
                        <td className="col-data">
                          {isPending ? <span className="skeleton" /> : (
                            <input value={row.dataDocument} onChange={(e) => updateRow(row.id, "dataDocument", e.target.value)} placeholder="DD.MM.YYYY" />
                          )}
                        </td>
                        <td className="col-emitent">
                          {isPending ? <span className="skeleton" /> : (
                            <input value={row.emitent} onChange={(e) => updateRow(row.id, "emitent", e.target.value)} />
                          )}
                        </td>
                        <td className="col-suma">
                          {isPending ? <span className="skeleton" /> : (
                            <input type="number" step="0.01" value={row.sumaPlatiata} onChange={(e) => updateRow(row.id, "sumaPlatiata", e.target.value)} />
                          )}
                        </td>
                        <td className="col-moneda">
                          {isPending ? <span className="skeleton" /> : (
                            <select value={row.moneda} onChange={(e) => updateRow(row.id, "moneda", e.target.value)}>
                              {MONEDE.map((m) => <option key={m} value={m}>{m}</option>)}
                            </select>
                          )}
                        </td>
                        <td className="col-curs">
                          {isPending ? <span className="skeleton" /> : (
                            <input type="number" step="0.0001" value={row.cursValutar} onChange={(e) => updateRow(row.id, "cursValutar", e.target.value)} />
                          )}
                        </td>
                        <td className="col-ron">
                          {isPending ? <span className="skeleton" /> : (
                            <input type="number" step="0.01" value={row.valoareRON} onChange={(e) => updateRow(row.id, "valoareRON", e.target.value)} className="input-ron" />
                          )}
                        </td>
                        <td className="col-platitor">
                          {isPending ? <span className="skeleton" /> : (
                            <input value={row.platitor} onChange={(e) => updateRow(row.id, "platitor", e.target.value)} />
                          )}
                        </td>
                        <td className="col-expl">
                          {isPending ? <span className="skeleton" /> : (
                            <input value={row.explicatii} onChange={(e) => updateRow(row.id, "explicatii", e.target.value)} />
                          )}
                        </td>
                        <td className="col-del">
                          <button className="btn-del" onClick={() => deleteRow(row.id)} title="Șterge">×</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={8} className="total-label">TOTAL</td>
                    <td className="total-value">{totalRON.toFixed(2)}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="table-actions">
              <button className="btn btn-ghost" onClick={addEmptyRow}>+ Adaugă rând manual</button>
              <button className="btn btn-export" onClick={handleExport} disabled={isScanning}>↓ Export Excel</button>
            </div>
          </div>
        )}
      </main>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: 'DM Sans', system-ui, sans-serif;
          background: #F4F6FA;
          color: #1A2335;
          min-height: 100vh;
        }

        .app { min-height: 100vh; display: flex; flex-direction: column; }

        header {
          background: #1E3A5F;
          color: white;
          padding: 0 24px;
          position: sticky;
          top: 0;
          z-index: 100;
          box-shadow: 0 2px 12px rgba(0,0,0,0.15);
        }

        .header-inner {
          max-width: 1600px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 64px;
        }

        .logo { display: flex; align-items: center; gap: 12px; }
        .logo-icon { font-size: 28px; }
        .logo h1 { font-size: 20px; font-weight: 700; letter-spacing: -0.3px; }
        .logo p { font-size: 12px; opacity: 0.6; margin-top: 1px; }

        .header-actions { display: flex; align-items: center; gap: 16px; }

        .total-badge {
          font-size: 14px;
          opacity: 0.85;
        }
        .total-badge strong { font-size: 16px; color: #7ECBFF; }

        main {
          max-width: 1600px;
          margin: 0 auto;
          width: 100%;
          padding: 32px 24px;
          flex: 1;
        }

        /* Drop zone */
        .dropzone {
          border: 2px dashed #C5D3E8;
          border-radius: 16px;
          background: white;
          padding: 48px 32px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
          margin-bottom: 32px;
        }
        .dropzone:hover, .dropzone.dragging {
          border-color: #1E3A5F;
          background: #EEF3FB;
        }
        .dz-content { display: flex; flex-direction: column; align-items: center; gap: 8px; }
        .dz-icon { font-size: 40px; margin-bottom: 4px; }
        .dz-content p { font-size: 16px; color: #1A2335; }
        .dz-hint { font-size: 13px; color: #8899AA; }

        .spinner {
          width: 36px; height: 36px;
          border: 3px solid #C5D3E8;
          border-top-color: #1E3A5F;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-bottom: 8px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Table */
        .table-wrap { background: white; border-radius: 16px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); overflow: hidden; }
        .table-scroll { overflow-x: auto; }

        table { width: 100%; border-collapse: collapse; font-size: 13px; }

        thead th {
          background: #1E3A5F;
          color: white;
          padding: 11px 10px;
          text-align: left;
          font-weight: 600;
          font-size: 11.5px;
          letter-spacing: 0.2px;
          white-space: nowrap;
        }

        tbody tr { border-bottom: 1px solid #EEF1F6; }
        tbody tr:hover { background: #F7F9FC; }
        tbody tr.row-pending { opacity: 0.6; }
        tbody tr.row-error { background: #FFF5F5; }

        tbody td { padding: 6px 6px; vertical-align: middle; }

        input, select {
          width: 100%;
          border: 1px solid transparent;
          border-radius: 6px;
          padding: 5px 7px;
          font-size: 13px;
          background: transparent;
          color: #1A2335;
          transition: all 0.15s;
          font-family: inherit;
        }
        input:hover, select:hover { border-color: #C5D3E8; background: white; }
        input:focus, select:focus {
          outline: none;
          border-color: #1E3A5F;
          background: white;
          box-shadow: 0 0 0 3px rgba(30,58,95,0.08);
        }

        .input-ron { font-weight: 600; color: #1E3A5F; }

        .skeleton {
          display: block;
          height: 20px;
          background: linear-gradient(90deg, #EEF1F6 25%, #E4E9F0 50%, #EEF1F6 75%);
          background-size: 200% 100%;
          animation: shimmer 1.2s infinite;
          border-radius: 4px;
          width: 80%;
        }
        @keyframes shimmer { to { background-position: -200% 0; } }

        /* Column widths */
        .col-nr { width: 40px; text-align: center; }
        .col-tip { width: 130px; }
        .col-nr-doc { width: 110px; }
        .col-data { width: 110px; }
        .col-emitent { width: 160px; }
        .col-suma { width: 100px; }
        .col-moneda { width: 80px; }
        .col-curs { width: 80px; }
        .col-ron { width: 100px; }
        .col-platitor { width: 130px; }
        .col-expl { min-width: 180px; }
        .col-del { width: 36px; }

        tfoot td {
          padding: 10px 10px;
          border-top: 2px solid #1E3A5F;
          background: #EEF3FB;
        }
        .total-label {
          text-align: right;
          font-weight: 700;
          font-size: 12px;
          letter-spacing: 0.5px;
          color: #1E3A5F;
        }
        .total-value {
          font-weight: 700;
          font-size: 15px;
          color: #1E3A5F;
        }

        .table-actions {
          display: flex;
          justify-content: space-between;
          padding: 14px 16px;
          border-top: 1px solid #EEF1F6;
          background: #FAFBFD;
        }

        /* Buttons */
        .btn {
          padding: 9px 20px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: all 0.15s;
          font-family: inherit;
        }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .btn-export {
          background: #1E3A5F;
          color: white;
        }
        .btn-export:hover:not(:disabled) { background: #162D4A; }

        .btn-ghost {
          background: transparent;
          color: #1E3A5F;
          border: 1.5px solid #C5D3E8;
        }
        .btn-ghost:hover { background: #EEF3FB; border-color: #1E3A5F; }

        .btn-del {
          background: none;
          border: none;
          color: #CC3333;
          font-size: 18px;
          cursor: pointer;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s;
        }
        .btn-del:hover { background: #FFE8E8; }
      `}</style>
    </div>
  );
}
