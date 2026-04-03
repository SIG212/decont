"use client";

import { useState, useCallback, useRef } from "react";
import { DecontRow, ScanResult } from "@/types";
import { generateExcel } from "@/lib/excel";
import { v4 as uuidv4 } from "uuid";

const MOCK_PROFILE = {
  nume: "Ionescu Alexandru",
  rol: "Account Manager",
  oras: "Cluj-Napoca",
  diurna: 75,
  transport: ["Mașină personală", "Avion", "Transport în comun"],
};

const MOCK_KPI = {
  calatoriiAnAcesta: 12,
  calatoriiTotal: 47,
  cheltuieliLuna: 3240,
  cheltuieliAn: 18750,
};

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
        {/* Profile + KPIs */}
        <div className="dashboard">
          <div className="profile-card">
            <div className="profile-avatar">{MOCK_PROFILE.nume.split(" ").map(n => n[0]).join("")}</div>
            <div className="profile-info">
              <h2>{MOCK_PROFILE.nume}</h2>
              <p className="profile-rol">{MOCK_PROFILE.rol}</p>
              <p className="profile-oras">📍 {MOCK_PROFILE.oras}</p>
            </div>
            <div className="profile-meta">
              <div className="meta-item">
                <span className="meta-label">Diurnă / zi</span>
                <span className="meta-value">{MOCK_PROFILE.diurna} RON</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Transport</span>
                <div className="transport-tags">
                  {MOCK_PROFILE.transport.map(t => (
                    <span key={t} className="tag">{t}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="kpis">
            <div className="kpi-card">
              <span className="kpi-icon">✈️</span>
              <span className="kpi-value">{MOCK_KPI.calatoriiAnAcesta}</span>
              <span className="kpi-label">Călătorii în {new Date().getFullYear()}</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-icon">🗺️</span>
              <span className="kpi-value">{MOCK_KPI.calatoriiTotal}</span>
              <span className="kpi-label">Total călătorii</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-icon">💳</span>
              <span className="kpi-value">{MOCK_KPI.cheltuieliLuna.toLocaleString("ro-RO")} RON</span>
              <span className="kpi-label">Cheltuieli luna aceasta</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-icon">📊</span>
              <span className="kpi-value">{MOCK_KPI.cheltuieliAn.toLocaleString("ro-RO")} RON</span>
              <span className="kpi-label">Cheltuieli în {new Date().getFullYear()}</span>
            </div>
          </div>
        </div>

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


    </div>
  );
}
