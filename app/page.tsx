"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { DecontRow, ScanResult } from "@/types";
import { generateExcel } from "@/lib/excel";
import { v4 as uuidv4 } from "uuid";

const MOCK_PROFILE = {
  nume: "Ionescu Alexandru",
  rol: "Account Manager",
  oras: "Cluj-Napoca",
  lat: 46.7712,
  lon: 23.6236,
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

interface OsmLocation {
  display_name: string;
  lat: string;
  lon: string;
  place_id: number;
}

interface Waypoint {
  id: string;
  location: OsmLocation | null;
  query: string;
  results: OsmLocation[];
  loading: boolean;
}

interface RouteInfo {
  distanceKm: number;
  durationMin: number;
}

interface Calatorie {
  id: string;
  plecare: OsmLocation;
  destinatii: OsmLocation[];
  ruta: RouteInfo | null;
  dataPlecare: string;
  dataIntoarcere: string;
  tipRetur: "aceeasi" | "diferita" | "dus";
}

function emptyRow(nr: number): DecontRow {
  return {
    id: uuidv4(), nr,
    tipDocument: "", nrDocument: "", dataDocument: "", emitent: "",
    sumaPlatiata: "", moneda: "RON", cursValutar: 1, valoareRON: "",
    platitor: "", explicatii: "", scanStatus: "done",
  };
}

function emptyWaypoint(): Waypoint {
  return { id: uuidv4(), location: null, query: "", results: [], loading: false };
}

function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

async function searchOsm(q: string): Promise<OsmLocation[]> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + ", Romania")}&format=json&limit=5`;
  const res = await fetch(url, { headers: { "Accept-Language": "ro" } });
  return res.json();
}

async function getRoute(points: { lat: string; lon: string }[]): Promise<RouteInfo | null> {
  const coords = points.map(p => `${p.lon},${p.lat}`).join(";");
  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=false`);
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.[0]) return null;
    return {
      distanceKm: Math.round(data.routes[0].distance / 100) / 10,
      durationMin: Math.round(data.routes[0].duration / 60),
    };
  } catch { return null; }
}

function WaypointInput({ waypoint, label, onChange }: {
  waypoint: Waypoint; label: string;
  onChange: (w: Waypoint) => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleInput = (val: string) => {
    const base = { ...waypoint, query: val, location: null, results: [] };
    onChange(base);
    clearTimeout(timerRef.current);
    if (val.length < 2) return;
    timerRef.current = setTimeout(async () => {
      onChange({ ...base, loading: true });
      const results = await searchOsm(val);
      onChange({ ...base, results, loading: false });
    }, 400);
  };

  const select = (loc: OsmLocation) => {
    const short = loc.display_name.split(",").slice(0, 2).join(", ");
    onChange({ ...waypoint, query: short, location: loc, results: [] });
  };

  return (
    <div className="wp-wrap">
      <label className="wp-label">{label}</label>
      <div className="wp-input-wrap">
        <input
          className="wp-input"
          value={waypoint.query}
          onChange={e => handleInput(e.target.value)}
          placeholder="Caută oraș sau adresă..."
          autoComplete="off"
        />
        {waypoint.location && <span className="wp-check">✓</span>}
        {waypoint.loading && <span className="wp-spin" />}
      </div>
      {waypoint.results.length > 0 && (
        <ul className="wp-dropdown">
          {waypoint.results.map(r => (
            <li key={r.place_id} onClick={() => select(r)}>
              {r.display_name.split(",").slice(0, 3).join(", ")}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Home() {
  const [calatorii, setCalatorii] = useState<Calatorie[]>([]);
  const [activaId, setActivaId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState(1);

  const [plecare, setPlecare] = useState<Waypoint>({
    ...emptyWaypoint(),
    query: MOCK_PROFILE.oras,
    location: { display_name: MOCK_PROFILE.oras, lat: String(MOCK_PROFILE.lat), lon: String(MOCK_PROFILE.lon), place_id: 0 },
  });
  const [destinatii, setDestinatii] = useState<Waypoint[]>([emptyWaypoint()]);
  const [ruta, setRuta] = useState<RouteInfo | null>(null);
  const [rutaLoading, setRutaLoading] = useState(false);
  const [dataPlecare, setDataPlecare] = useState("");
  const [dataIntoarcere, setDataIntoarcere] = useState("");
  const [tipRetur, setTipRetur] = useState<"aceeasi" | "diferita" | "dus">("aceeasi");
  const [destinatiiIntoarcere, setDestinatiiIntoarcere] = useState<Waypoint[]>([emptyWaypoint()]);

  const [rows, setRows] = useState<DecontRow[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [scanning, setScanning] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const calatoreaActiva = calatorii.find(c => c.id === activaId) ?? null;

  useEffect(() => {
    const allSet = [plecare, ...destinatii].every(w => w.location);
    if (!allSet || destinatii.length === 0) return;
    const pts = [plecare, ...destinatii].map(w => w.location!);
    setRutaLoading(true);
    getRoute(pts).then(r => { setRuta(r); setRutaLoading(false); });
  }, [plecare, destinatii]);

  const openModal = () => {
    setStep(1); setRuta(null); setDataPlecare(""); setDataIntoarcere(""); setTipRetur("aceeasi");
    setPlecare({ ...emptyWaypoint(), query: MOCK_PROFILE.oras, location: { display_name: MOCK_PROFILE.oras, lat: String(MOCK_PROFILE.lat), lon: String(MOCK_PROFILE.lon), place_id: 0 } });
    setDestinatii([emptyWaypoint()]);
    setDestinatiiIntoarcere([emptyWaypoint()]);
    setShowModal(true);
  };

  const creareCaHatorie = () => {
    const locs = destinatii.map(d => d.location).filter(Boolean) as OsmLocation[];
    if (!plecare.location || locs.length === 0) return;
    const c: Calatorie = { id: uuidv4(), plecare: plecare.location, destinatii: locs, ruta, dataPlecare, dataIntoarcere, tipRetur };
    setCalatorii(prev => [...prev, c]);
    setActivaId(c.id);
    setRows([]);
    setShowModal(false);
  };

  const processFiles = useCallback(async (files: File[]) => {
    const validFiles = files.filter(f => ["jpg", "jpeg", "png", "webp", "pdf", "heic"].includes(f.name.split(".").pop()?.toLowerCase() || ""));
    if (!validFiles.length) return;
    const newRows: DecontRow[] = validFiles.map((f, i) => ({ ...emptyRow(rows.length + i + 1), fileName: f.name, scanStatus: "pending" as const }));
    setRows(prev => [...prev, ...newRows]);
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i]; const row = newRows[i];
      setScanning(prev => new Set(prev).add(row.id));
      try {
        const fd = new FormData(); fd.append("file", file);
        const res = await fetch("/api/scan", { method: "POST", body: fd });
        const data: ScanResult = await res.json();
        setRows(prev => prev.map(r => r.id === row.id ? { ...r, ...data, scanStatus: data.error ? "error" : "done", sumaPlatiata: data.sumaPlatiata ?? "", cursValutar: data.cursValutar ?? 1, valoareRON: data.valoareRON ?? "", moneda: data.moneda || "RON" } : r));
      } catch {
        setRows(prev => prev.map(r => r.id === row.id ? { ...r, scanStatus: "error" } : r));
      } finally {
        setScanning(prev => { const n = new Set(prev); n.delete(row.id); return n; });
      }
    }
  }, [rows.length]);

  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); processFiles(Array.from(e.dataTransfer.files)); }, [processFiles]);

  const updateRow = (id: string, field: keyof DecontRow, value: string | number) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const u = { ...r, [field]: value };
      if (field === "sumaPlatiata" || field === "cursValutar") {
        const s = parseFloat(String(field === "sumaPlatiata" ? value : u.sumaPlatiata).replace(",", "."));
        const c = parseFloat(String(field === "cursValutar" ? value : u.cursValutar).replace(",", "."));
        if (!isNaN(s) && !isNaN(c)) u.valoareRON = Math.round(s * c * 100) / 100;
      }
      return u;
    }));
  };

  const totalRON = rows.reduce((sum, r) => { const v = parseFloat(String(r.valoareRON).replace(",", ".")); return sum + (isNaN(v) ? 0 : v); }, 0);
  const isScanning = scanning.size > 0;
  const canStep2 = plecare.location && destinatii.some(d => d.location);
  const canFinish = dataPlecare && dataIntoarcere;

  return (
    <div className="app">
      <header>
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">🧾</span>
            <div><h1>Decont</h1><p>Scanner bonuri &amp; export Excel</p></div>
          </div>
          <div className="header-actions">
            {calatoreaActiva && rows.length > 0 && (
              <>
                <span className="total-badge">Total: <strong>{totalRON.toFixed(2)} RON</strong></span>
                <button className="btn btn-export" onClick={() => { const blob = generateExcel(rows); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `Decont_${new Date().toISOString().slice(0,10)}.xlsx`; a.click(); URL.revokeObjectURL(url); }} disabled={isScanning}>↓ Export Excel</button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* Dashboard */}
        <div className="dashboard">
          <div className="profile-card">
            <div className="profile-avatar">{MOCK_PROFILE.nume.split(" ").map(n => n[0]).join("")}</div>
            <div className="profile-info">
              <h2>{MOCK_PROFILE.nume}</h2>
              <p className="profile-rol">{MOCK_PROFILE.rol}</p>
              <p className="profile-oras">📍 {MOCK_PROFILE.oras}</p>
            </div>
            <div className="profile-meta">
              <div className="meta-item"><span className="meta-label">Diurnă / zi</span><span className="meta-value">{MOCK_PROFILE.diurna} RON</span></div>
              <div className="meta-item"><span className="meta-label">Transport</span><div className="transport-tags">{MOCK_PROFILE.transport.map(t => <span key={t} className="tag">{t}</span>)}</div></div>
            </div>
          </div>
          <div className="kpis">
            {[
              { icon: "✈️", val: MOCK_KPI.calatoriiAnAcesta, label: `Călătorii în ${new Date().getFullYear()}` },
              { icon: "🗺️", val: MOCK_KPI.calatoriiTotal, label: "Total călătorii" },
              { icon: "💳", val: `${MOCK_KPI.cheltuieliLuna.toLocaleString("ro-RO")} RON`, label: "Cheltuieli luna aceasta" },
              { icon: "📊", val: `${MOCK_KPI.cheltuieliAn.toLocaleString("ro-RO")} RON`, label: `Cheltuieli în ${new Date().getFullYear()}` },
            ].map(k => (
              <div key={k.label} className="kpi-card">
                <span className="kpi-icon">{k.icon}</span>
                <span className="kpi-value">{k.val}</span>
                <span className="kpi-label">{k.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions bar */}
        <div className="actions-bar">
          <button className="btn btn-primary btn-lg" onClick={openModal}>+ Crează călătorie în România</button>
          {calatorii.length > 0 && (
            <div className="calatorii-list">
              {calatorii.map(c => (
                <button key={c.id} className={`btn-calatorie ${activaId === c.id ? "active" : ""}`} onClick={() => { setActivaId(c.id); setRows([]); }}>
                  <span>{c.plecare.display_name.split(",")[0]} → {c.destinatii[c.destinatii.length - 1].display_name.split(",")[0]}</span>
                  <span className="calatorie-data">{c.dataPlecare}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Active trip */}
        {calatoreaActiva && (
          <>
            <div className="calatorie-header">
              <div className="ch-info">
                <span className="ch-ruta">{calatoreaActiva.plecare.display_name.split(",")[0]}{calatoreaActiva.destinatii.map(d => ` → ${d.display_name.split(",")[0]}`)}</span>
                <span className="ch-meta">{calatoreaActiva.dataPlecare} – {calatoreaActiva.dataIntoarcere}{calatoreaActiva.ruta && ` · ${calatoreaActiva.ruta.distanceKm} km · ${formatDuration(calatoreaActiva.ruta.durationMin)}`}</span>
              </div>
              <span className="ch-badge">Călătorie activă</span>
            </div>

            <div className={`dropzone ${isDragging ? "dragging" : ""}`} onDragOver={e => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}>
              <input ref={fileInputRef} type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf,.heic" style={{ display: "none" }} onChange={e => processFiles(Array.from(e.target.files || []))} />
              <div className="dz-content">
                {isScanning ? (<><div className="spinner" /><p>Se procesează {scanning.size} bon{scanning.size > 1 ? "uri" : ""}...</p></>) : (<><div className="dz-icon">📎</div><p><strong>Adaugă bonuri pentru această călătorie</strong></p><span className="dz-hint">JPG, PNG, PDF, HEIC — multiple fișiere simultan</span></>)}
              </div>
            </div>

            {rows.length > 0 && (
              <div className="table-wrap">
                <div className="table-scroll">
                  <table>
                    <thead><tr>
                      <th className="col-nr">#</th><th className="col-tip">Tip document</th><th className="col-nr-doc">Nr. document</th>
                      <th className="col-data">Data</th><th className="col-emitent">Emitent</th><th className="col-suma">Suma plătită</th>
                      <th className="col-moneda">Monedă</th><th className="col-curs">Curs</th><th className="col-ron">Valoare RON</th>
                      <th className="col-platitor">Plătitor</th><th className="col-expl">Explicații</th><th className="col-del" />
                    </tr></thead>
                    <tbody>
                      {rows.map(row => {
                        const isPending = row.scanStatus === "pending" || scanning.has(row.id);
                        const isError = row.scanStatus === "error";
                        return (
                          <tr key={row.id} className={isPending ? "row-pending" : isError ? "row-error" : ""}>
                            <td className="col-nr">{row.nr}</td>
                            <td className="col-tip">{isPending ? <span className="skeleton" /> : <select value={row.tipDocument} onChange={e => updateRow(row.id, "tipDocument", e.target.value)}><option value="">—</option>{TIP_DOCUMENTE.map(t => <option key={t} value={t}>{t}</option>)}</select>}</td>
                            <td className="col-nr-doc">{isPending ? <span className="skeleton" /> : <input value={row.nrDocument} onChange={e => updateRow(row.id, "nrDocument", e.target.value)} />}</td>
                            <td className="col-data">{isPending ? <span className="skeleton" /> : <input value={row.dataDocument} onChange={e => updateRow(row.id, "dataDocument", e.target.value)} placeholder="DD.MM.YYYY" />}</td>
                            <td className="col-emitent">{isPending ? <span className="skeleton" /> : <input value={row.emitent} onChange={e => updateRow(row.id, "emitent", e.target.value)} />}</td>
                            <td className="col-suma">{isPending ? <span className="skeleton" /> : <input type="number" step="0.01" value={row.sumaPlatiata} onChange={e => updateRow(row.id, "sumaPlatiata", e.target.value)} />}</td>
                            <td className="col-moneda">{isPending ? <span className="skeleton" /> : <select value={row.moneda} onChange={e => updateRow(row.id, "moneda", e.target.value)}>{MONEDE.map(m => <option key={m} value={m}>{m}</option>)}</select>}</td>
                            <td className="col-curs">{isPending ? <span className="skeleton" /> : <input type="number" step="0.0001" value={row.cursValutar} onChange={e => updateRow(row.id, "cursValutar", e.target.value)} />}</td>
                            <td className="col-ron">{isPending ? <span className="skeleton" /> : <input type="number" step="0.01" value={row.valoareRON} onChange={e => updateRow(row.id, "valoareRON", e.target.value)} className="input-ron" />}</td>
                            <td className="col-platitor">{isPending ? <span className="skeleton" /> : <input value={row.platitor} onChange={e => updateRow(row.id, "platitor", e.target.value)} />}</td>
                            <td className="col-expl">{isPending ? <span className="skeleton" /> : <input value={row.explicatii} onChange={e => updateRow(row.id, "explicatii", e.target.value)} />}</td>
                            <td className="col-del"><button className="btn-del" onClick={() => setRows(prev => prev.filter(r => r.id !== row.id).map((r, i) => ({ ...r, nr: i + 1 })))}>×</button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot><tr><td colSpan={8} className="total-label">TOTAL</td><td className="total-value">{totalRON.toFixed(2)}</td><td colSpan={3} /></tr></tfoot>
                  </table>
                </div>
                <div className="table-actions">
                  <button className="btn btn-ghost" onClick={() => setRows(prev => [...prev, emptyRow(prev.length + 1)])}>+ Adaugă rând manual</button>
                  <button className="btn btn-export" onClick={() => { const blob = generateExcel(rows); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `Decont_${new Date().toISOString().slice(0,10)}.xlsx`; a.click(); URL.revokeObjectURL(url); }} disabled={isScanning}>↓ Export Excel</button>
                </div>
              </div>
            )}
          </>
        )}

        {!calatoreaActiva && (
          <div className="empty-state">
            <div className="empty-icon">🗺️</div>
            <p>Crează o călătorie pentru a putea adăuga cheltuieli</p>
          </div>
        )}
      </main>

      {/* Wizard modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="steps">
              {["Rută", "Date", "Sumar"].map((s, i) => (
                <div key={s} className={`step-item ${step === i + 1 ? "active" : step > i + 1 ? "done" : ""}`}>
                  <div className="step-dot">{step > i + 1 ? "✓" : i + 1}</div>
                  <span>{s}</span>
                </div>
              ))}
            </div>

            {step === 1 && (
              <div className="modal-body">
                <h2>Definește ruta</h2>
                <WaypointInput waypoint={plecare} label="Oraș de plecare" onChange={setPlecare} />
                {destinatii.map((d, i) => (
                  <div key={d.id} className="dest-row">
                    <WaypointInput waypoint={d} label={i === 0 ? "Destinație" : `Oprire ${i + 1}`} onChange={w => setDestinatii(prev => prev.map((x, j) => j === i ? w : x))} />
                    {destinatii.length > 1 && <button className="btn-rm" onClick={() => setDestinatii(prev => prev.filter((_, j) => j !== i))}>×</button>}
                  </div>
                ))}
                <button className="btn btn-ghost btn-sm" onClick={() => setDestinatii(prev => [...prev, emptyWaypoint()])}>+ Adaugă oprire</button>
                {rutaLoading && <p className="ruta-loading">Se calculează ruta...</p>}
                {ruta && !rutaLoading && (
                  <div className="ruta-info">
                    <span>🛣️ <strong>{ruta.distanceKm} km</strong></span>
                    <span>⏱ <strong>{formatDuration(ruta.durationMin)}</strong></span>
                    <span className="ruta-note">via mașină · OSRM</span>
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="modal-body">
                <h2>Date deplasare</h2>
                <div className="form-row">
                  <div className="form-group"><label>Data plecare</label><input type="date" value={dataPlecare} onChange={e => setDataPlecare(e.target.value)} /></div>
                  <div className="form-group"><label>Data întoarcere</label><input type="date" value={dataIntoarcere} min={dataPlecare} onChange={e => setDataIntoarcere(e.target.value)} /></div>
                </div>
                <div className="form-group">
                  <label>Tip retur</label>
                  <div className="retur-options">
                    {([["aceeasi", "Aceeași rută", "Revin pe același traseu"], ["diferita", "Rută diferită", "Definesc ruta de întoarcere"], ["dus", "Doar dus", "Fără întoarcere"]] as const).map(([val, title, desc]) => (
                      <div key={val} className={`retur-opt ${tipRetur === val ? "selected" : ""}`} onClick={() => setTipRetur(val)}>
                        <strong>{title}</strong><span>{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {tipRetur === "diferita" && (
                  <div className="retur-ruta">
                    <p className="retur-label">Ruta de întoarcere</p>
                    {destinatiiIntoarcere.map((d, i) => (
                      <div key={d.id} className="dest-row">
                        <WaypointInput waypoint={d} label={`Punct ${i + 1}`} onChange={w => setDestinatiiIntoarcere(prev => prev.map((x, j) => j === i ? w : x))} />
                      </div>
                    ))}
                    <button className="btn btn-ghost btn-sm" onClick={() => setDestinatiiIntoarcere(prev => [...prev, emptyWaypoint()])}>+ Adaugă punct</button>
                  </div>
                )}
                {dataPlecare && dataIntoarcere && (
                  <div className="diurna-calc">
                    <span>Diurnă estimată:</span>
                    <strong>{(() => { const z = Math.ceil((new Date(dataIntoarcere).getTime() - new Date(dataPlecare).getTime()) / 86400000) + 1; return `${z} zile × ${MOCK_PROFILE.diurna} RON = ${z * MOCK_PROFILE.diurna} RON`; })()}</strong>
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="modal-body">
                <h2>Sumar călătorie</h2>
                <div className="sumar">
                  <div className="sumar-row"><span>Plecare</span><strong>{plecare.location?.display_name.split(",").slice(0, 2).join(", ")}</strong></div>
                  <div className="sumar-row"><span>Destinație</span><strong>{destinatii.filter(d => d.location).map(d => d.location!.display_name.split(",")[0]).join(" → ")}</strong></div>
                  {ruta && <div className="sumar-row"><span>Distanță</span><strong>{ruta.distanceKm} km · {formatDuration(ruta.durationMin)}</strong></div>}
                  <div className="sumar-row"><span>Perioadă</span><strong>{dataPlecare} → {dataIntoarcere}</strong></div>
                  <div className="sumar-row"><span>Retur</span><strong>{{ aceeasi: "Aceeași rută", diferita: "Rută diferită", dus: "Doar dus" }[tipRetur]}</strong></div>
                  {dataPlecare && dataIntoarcere && (
                    <div className="sumar-row sumar-total"><span>Diurnă totală</span><strong>{(() => { const z = Math.ceil((new Date(dataIntoarcere).getTime() - new Date(dataPlecare).getTime()) / 86400000) + 1; return `${z * MOCK_PROFILE.diurna} RON`; })()}</strong></div>
                  )}
                </div>
              </div>
            )}

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => step === 1 ? setShowModal(false) : setStep(s => s - 1)}>{step === 1 ? "Anulează" : "← Înapoi"}</button>
              {step < 3
                ? <button className="btn btn-primary" disabled={step === 1 ? !canStep2 : !canFinish} onClick={() => setStep(s => s + 1)}>Continuă →</button>
                : <button className="btn btn-primary" onClick={creareCaHatorie}>Crează călătoria ✓</button>
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
