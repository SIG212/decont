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
  unitatea: "SC Exemplu SRL · CUI 12345678 · Str. Exemplu nr. 1, Cluj-Napoca",
  legitimatie: "CI seria XY nr. 123456",
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
  opriri: OsmLocation[];
  destinatie: OsmLocation;
  ruta: RouteInfo | null;
  dataPlecare: string;
  oraPlecare: string;
  dataIntoarcere: string;
  oraSosire: string;
  tipRetur: "aceeasi" | "diferita" | "dus";
  rutaIntoarcere: RouteInfo | null;
  opririIntoarcere: OsmLocation[];
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
  const [profileExpanded, setProfileExpanded] = useState(false);
  const [step, setStep] = useState(1);

  const [plecare, setPlecare] = useState<Waypoint>({
    ...emptyWaypoint(),
    query: MOCK_PROFILE.oras,
    location: { display_name: MOCK_PROFILE.oras, lat: String(MOCK_PROFILE.lat), lon: String(MOCK_PROFILE.lon), place_id: 0 },
  });
  const [opriri, setOpriri] = useState<Waypoint[]>([]);
  const [destinatie, setDestinatie] = useState<Waypoint>(emptyWaypoint());
  const [ruta, setRuta] = useState<RouteInfo | null>(null);
  const [rutaLoading, setRutaLoading] = useState(false);
  const [dataPlecare, setDataPlecare] = useState("");
  const [oraPlecare, setOraPlecare] = useState("");
  const [dataIntoarcere, setDataIntoarcere] = useState("");
  const [oraSosire, setOraSosire] = useState("");
  const [tipRetur, setTipRetur] = useState<"aceeasi" | "diferita" | "dus">("aceeasi");
  const [opririIntoarcere, setOpririIntoarcere] = useState<Waypoint[]>([]);
  const [rutaIntoarcere, setRutaIntoarcere] = useState<RouteInfo | null>(null);
  const [rutaIntoarcereLoading, setRutaIntoarcereLoading] = useState(false);

  const [rows, setRows] = useState<DecontRow[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [scanning, setScanning] = useState<Set<string>>(new Set());
  const [pendingRow, setPendingRow] = useState<DecontRow | null>(null);
  const [showBonModal, setShowBonModal] = useState(false);
  const [bonScanning, setBonScanning] = useState(false);
  const [isEditingConfirm, setIsEditingConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const calatoreaActiva = calatorii.find(c => c.id === activaId) ?? null;
  const todayStr = new Date().toISOString().slice(0, 10);

  // Calculate outbound route
  useEffect(() => {
    const allPts = [plecare, ...opriri, destinatie];
    const allSet = allPts.every(w => w.location);
    if (!allSet || !destinatie.location) return;
    const pts = allPts.map(w => w.location!);
    setRutaLoading(true);
    getRoute(pts).then(r => { setRuta(r); setRutaLoading(false); });
  }, [plecare, opriri, destinatie]);

  // Calculate return route
  useEffect(() => {
    if (tipRetur !== "diferita") { setRutaIntoarcere(null); return; }
    // Return: from last destination, through return stops, back to plecare
    const allPts = [destinatie, ...opririIntoarcere, plecare];
    const allSet = allPts.every(w => w.location);
    if (!allSet || !destinatie.location || !plecare.location) return;
    const pts = allPts.map(w => w.location!);
    setRutaIntoarcereLoading(true);
    getRoute(pts).then(r => { setRutaIntoarcere(r); setRutaIntoarcereLoading(false); });
  }, [tipRetur, destinatie, opririIntoarcere, plecare]);

  const openModal = () => {
    setStep(1); setRuta(null); setRutaIntoarcere(null); setDataPlecare(""); setOraPlecare(""); setDataIntoarcere(""); setOraSosire(""); setTipRetur("aceeasi");
    setPlecare({ ...emptyWaypoint(), query: MOCK_PROFILE.oras, location: { display_name: MOCK_PROFILE.oras, lat: String(MOCK_PROFILE.lat), lon: String(MOCK_PROFILE.lon), place_id: 0 } });
    setOpriri([]);
    setDestinatie(emptyWaypoint());
    setOpririIntoarcere([]);
    setShowModal(true);
  };

  const creareCaHatorie = () => {
    if (!plecare.location || !destinatie.location) return;
    const c: Calatorie = {
      id: uuidv4(),
      plecare: plecare.location,
      opriri: opriri.map(o => o.location).filter(Boolean) as OsmLocation[],
      destinatie: destinatie.location,
      ruta,
      dataPlecare, oraPlecare, dataIntoarcere, oraSosire, tipRetur,
      rutaIntoarcere: tipRetur === "diferita" ? rutaIntoarcere : tipRetur === "aceeasi" ? ruta : null,
      opririIntoarcere: tipRetur === "diferita" ? opririIntoarcere.map(o => o.location).filter(Boolean) as OsmLocation[] : [],
    };
    setCalatorii(prev => [...prev, c]);
    setActivaId(c.id);
    setRows([]);
    setShowModal(false);
  };

  const processSingleFile = useCallback(async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!["jpg", "jpeg", "png", "webp", "pdf", "heic"].includes(ext)) return;
    
    // Create local preview URL
    const fileUrl = URL.createObjectURL(file);
    const row = { ...emptyRow(rows.length + 1), fileName: file.name, fileUrl, scanStatus: "pending" as const };
    
    setPendingRow(row);
    setIsEditingConfirm(false);
    setShowBonModal(true);
    setBonScanning(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/scan", { method: "POST", body: fd });
      const data: ScanResult = await res.json();
      setPendingRow(prev => prev ? { ...prev, ...data, scanStatus: data.error ? "error" : "done", sumaPlatiata: data.sumaPlatiata ?? "", cursValutar: data.cursValutar ?? 1, valoareRON: data.valoareRON ?? "", moneda: data.moneda || "RON" } : null);
    } catch {
      setPendingRow(prev => prev ? { ...prev, scanStatus: "error" } : null);
    } finally {
      setBonScanning(false);
    }
  }, [rows.length]);

  const confirmBon = () => {
    if (!pendingRow) return;
    if (isEditingConfirm) {
      setRows(prev => prev.map(r => r.id === pendingRow.id ? pendingRow : r));
    } else {
      setRows(prev => [...prev, { ...pendingRow, nr: prev.length + 1, scanStatus: "done" }]);
    }
    setPendingRow(null);
    setShowBonModal(false);
    setIsEditingConfirm(false);
  };

  const openEditBon = (row: DecontRow) => {
    setPendingRow(row);
    setIsEditingConfirm(true);
    setBonScanning(false);
    setShowBonModal(true);
  };

  const updatePendingRow = (field: keyof DecontRow, value: string | number) => {
    setPendingRow(prev => {
      if (!prev) return null;
      const u = { ...prev, [field]: value } as any;
      if (field === "sumaPlatiata" || field === "cursValutar") {
        const s = parseFloat(String(field === "sumaPlatiata" ? value : u.sumaPlatiata).replace(",", "."));
        const c = parseFloat(String(field === "cursValutar" ? value : u.cursValutar).replace(",", "."));
        if (!isNaN(s) && !isNaN(c)) u.valoareRON = Math.round(s * c * 100) / 100;
      }
      return u;
    });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) processSingleFile(files[0]);
  }, [processSingleFile]);

  const updateRow = (id: string, field: keyof DecontRow, value: string | number) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const u = { ...r, [field]: value } as any;
      if (field === "sumaPlatiata" || field === "cursValutar") {
        const s = parseFloat(String(field === "sumaPlatiata" ? value : u.sumaPlatiata).replace(",", "."));
        const c = parseFloat(String(field === "cursValutar" ? value : u.cursValutar).replace(",", "."));
        if (!isNaN(s) && !isNaN(c)) u.valoareRON = Math.round(s * c * 100) / 100;
      }
      return u;
    }));
  };

  const totalRON = rows.reduce((sum, r) => { const v = parseFloat(String(r.valoareRON).replace(",", ".")); return sum + (isNaN(v) ? 0 : v); }, 0);
  const canStep2 = plecare.location && destinatie.location;
  const canFinish = dataPlecare && (tipRetur === "dus" || dataIntoarcere);

  const previewOrdin = async () => {
    if (!calatoreaActiva) return;
    
    const fetchDistances = async (points: any[]) => {
      if (points.length < 2) return [];
      const coords = points.map(p => `${p.lon},${p.lat}`).join(";");
      try {
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=false`);
        const json = await res.json();
        if (json.routes && json.routes[0]) {
          return json.routes[0].legs.map((l: any) => (l.distance / 1000).toFixed(1));
        }
      } catch (e) {
        console.error("OSRM error breakdown:", e);
      }
      return points.slice(1).map(() => "");
    };

    // 1. Build Outbound Nodes
    const outboundPoints = [calatoreaActiva.plecare, ...calatoreaActiva.opriri, calatoreaActiva.destinatie];
    const outboundDistances = await fetchDistances(outboundPoints);
    
    const itin: any[] = [];
    outboundPoints.forEach((p, i) => {
      itin.push({
        data: calatoreaActiva.dataPlecare,
        loc: p.display_name.split(",")[0],
        oraPlecare: i === 0 ? calatoreaActiva.oraPlecare : "",
        oraSosire: i > 0 ? (i === outboundPoints.length - 1 ? "..." : "") : "",
        km: i > 0 ? outboundDistances[i-1] : "0"
      });
    });

    // 2. Build Return Nodes
    if (calatoreaActiva.tipRetur !== "dus") {
      const returnPoints = [calatoreaActiva.destinatie, ...calatoreaActiva.opririIntoarcere, calatoreaActiva.plecare];
      const returnDistances = await fetchDistances(returnPoints);
      
      returnPoints.forEach((p, i) => {
        itin.push({
          data: calatoreaActiva.dataIntoarcere,
          loc: p.display_name.split(",")[0],
          oraPlecare: i === 0 ? "..." : "",
          oraSosire: i > 0 ? (i === returnPoints.length - 1 ? calatoreaActiva.oraSosire : "") : "",
          km: i > 0 ? returnDistances[i-1] : ""
        });
      });
    }

    const sumKm = (calatoreaActiva.ruta?.distanceKm || 0) + (calatoreaActiva.rutaIntoarcere?.distanceKm || 0);

    const payload = {
      unitatea: MOCK_PROFILE.unitatea,
      numarOrdin: "",
      dataOrdin: calatoreaActiva.dataPlecare,
      numePrenume: MOCK_PROFILE.nume,
      functia: MOCK_PROFILE.rol,
      legitimatie: MOCK_PROFILE.legitimatie,
      scopDeplasare: "deplasare în interes de serviciu",
      destinatie: [calatoreaActiva.destinatie.display_name.split(",")[0], ...calatoreaActiva.opriri.map(d => d.display_name.split(",")[0])].join(", "),
      dataPlecareZiOra: `${calatoreaActiva.dataPlecare} ora ${calatoreaActiva.oraPlecare || "..."}`,
      dataSosireZiOra: `${calatoreaActiva.dataIntoarcere} ora ${calatoreaActiva.oraSosire || "..."}`,
      distantaKm: String(sumKm.toFixed(1)),
      rows: rows.map(r => ({
        fel: `${r.tipDocument} - ${r.emitent}`,
        nrData: `${r.nrDocument} / ${r.dataDocument}`,
        suma: r.valoareRON ? `${r.valoareRON} RON` : "",
      })),
      receipts: rows.map(r => ({
        id: r.id,
        fileUrl: r.fileUrl,
        label: `${r.tipDocument} - ${r.emitent} (${r.valoareRON} RON)`
      })),
      totalCheltuieli: `${totalRON.toFixed(2)} RON`,
      diferenta: "",
      nrAuto: "AG 010183",
      numeSofer: MOCK_PROFILE.nume,
      tipAutovehicul: "Persoane",
      tipCombustibil: "Benzină",
      itinerariu: itin
    };
    const res = await fetch("/api/ordin/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const html = await res.text();
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

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
                <button className="btn btn-export" onClick={() => { const blob = generateExcel(rows); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `Decont_${new Date().toISOString().slice(0,10)}.xlsx`; a.click(); URL.revokeObjectURL(url); }}>↓ Export Excel</button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* Dashboard: Profile & KPIs */}
        <div className="dashboard">
          <div className={`profile-card ${profileExpanded ? "expanded" : ""}`}>
            <div className="profile-header" onClick={() => setProfileExpanded(prev => !prev)}>
              <div className="profile-avatar">{MOCK_PROFILE.nume.split(" ").map(n => n[0]).join("")}</div>
              <div className="profile-info">
                <h2>{MOCK_PROFILE.nume}</h2>
                <p className="profile-rol">{MOCK_PROFILE.rol}</p>
                <p className="profile-oras">📍 {MOCK_PROFILE.oras}</p>
              </div>
              <span className="profile-chevron">{profileExpanded ? "▲" : "▼"}</span>
            </div>
            <div className="profile-meta">
              <div className="meta-item"><span className="meta-label">Diurnă / zi</span><span className="meta-value">{MOCK_PROFILE.diurna} RON</span></div>
              <div className="meta-item"><span className="meta-label">Transport</span><div className="transport-tags">{MOCK_PROFILE.transport.map(t => <span key={t} className="tag">{t}</span>)}</div></div>
              <div className="meta-item"><span className="meta-label">Unitatea</span><span className="meta-value" style={{fontSize:"12px"}}>{MOCK_PROFILE.unitatea}</span></div>
              <div className="meta-item"><span className="meta-label">Legitimație</span><span className="meta-value">{MOCK_PROFILE.legitimatie}</span></div>
            </div>
          </div>
          <div className="kpis-scroll-wrapper">
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
        </div>

        {/* 1. Active trip card (if exists) */}
        {calatoreaActiva && (
          <div className="trip-card">
            <div className="trip-card-header">
              <div className="ch-info">
                <span className="ch-ruta">{calatoreaActiva.plecare.display_name.split(",")[0]}{calatoreaActiva.opriri.map(d => ` → ${d.display_name.split(",")[0]}`)} → {calatoreaActiva.destinatie.display_name.split(",")[0]}</span>
                <span className="ch-meta">{calatoreaActiva.dataPlecare} – {calatoreaActiva.dataIntoarcere}{calatoreaActiva.ruta && ` · ${calatoreaActiva.ruta.distanceKm} km · ${formatDuration(calatoreaActiva.ruta.durationMin)}`}</span>
              </div>
              <div className="trip-card-actions">
                <span className="ch-badge">Călătorie activă</span>
                {rows.length > 0 && <span className="total-badge">Total: <strong>{totalRON.toFixed(2)} RON</strong></span>}
              </div>
            </div>

            <div className="bonuri-section">
              <div
                className={`bon-add-zone ${isDragging ? "dragging" : ""}`}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{ marginBottom: rows.length > 0 ? "16px" : "0" }}
              >
                <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,.heic" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) processSingleFile(f); e.target.value = ""; }} />
                <span className="bon-add-icon">📷</span>
                <span className="bon-add-text">Adaugă bon</span>
                <span className="bon-add-hint">JPG, PNG, PDF, HEIC</span>
              </div>

              {rows.length > 0 && (
                <div className="bonuri-list">
                  {rows.map((row, i) => (
                    <div key={row.id} className="bon-card" onClick={() => openEditBon(row)} style={{cursor: "pointer"}}>
                      <div className="bon-card-nr">{i + 1}</div>
                      <div className="bon-card-body">
                        <div className="bon-card-top">
                          <span className="bon-card-tip">{row.tipDocument || "—"}</span>
                          <span className="bon-card-emitent">{row.emitent || "Emitent necunoscut"}</span>
                        </div>
                        <div className="bon-card-bottom">
                          <span className="bon-card-data">{row.dataDocument || "—"}</span>
                          <span className="bon-card-doc">Nr. {row.nrDocument || "—"}</span>
                        </div>
                      </div>
                      <div className="bon-card-amount">
                        <strong>{row.valoareRON ? `${Number(row.valoareRON).toFixed(2)} RON` : "—"}</strong>
                        {row.moneda !== "RON" && row.sumaPlatiata && (
                          <span className="bon-card-original">{row.sumaPlatiata} {row.moneda}</span>
                        )}
                      </div>
                      <button className="btn-del" onClick={(e) => { e.stopPropagation(); setRows(prev => prev.filter(r => r.id !== row.id).map((r, idx) => ({ ...r, nr: idx + 1 }))); }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {rows.length > 0 && (
              <div className="trip-card-footer">
                <div className="trip-total">
                  <span>Total cheltuieli</span>
                  <strong>{totalRON.toFixed(2)} RON</strong>
                </div>
                <div className="trip-footer-actions">
                  <button className="btn btn-ghost" onClick={previewOrdin}>👁 Ordin deplasare</button>
                  <button className="btn btn-export" onClick={() => { const blob = generateExcel(rows); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `Decont_${new Date().toISOString().slice(0,10)}.xlsx`; a.click(); URL.revokeObjectURL(url); }}>↓ Export Excel</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. Primary action button */}
        <div style={{ marginBottom: "24px" }}>
          <button className="btn btn-primary btn-lg" onClick={openModal} style={{ width: "100%" }}>+ Creează călătorie în România</button>
        </div>

        {/* 3. Trip History Section */}
        <div className="history-section" style={{ paddingBottom: "40px" }}>
          <div className="istoric-header">
            <h3 className="istoric-title">Istoric delegații</h3>
            <button className="btn-add-istoric" onClick={openModal} title="Creează călătorie nouă">+</button>
          </div>
          
          <div className="actions-bar">
            {calatorii.length > (calatoreaActiva ? 1 : 0) ? (
              <div className="calatorii-list">
                {calatorii
                  .filter(c => activaId !== c.id)
                  .map(c => (
                    <button key={c.id} className="btn-calatorie" onClick={() => { setActivaId(c.id); setRows([]); }}>
                      <span>{c.plecare.display_name.split(",")[0]} → {c.destinatie.display_name.split(",")[0]}</span>
                      <span className="calatorie-data">{c.dataPlecare}</span>
                    </button>
                  ))
                }
              </div>
            ) : (
              <div className="empty-state" style={{ padding: "20px 0", textAlign: "left" }}>
                <p style={{ fontSize: "13px", color: "#8899AA" }}>Nicio altă delegație în istoric.</p>
              </div>
            )}
          </div>
        </div>
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
                {opriri.map((d, i) => (
                  <div key={d.id} className="dest-row">
                    <WaypointInput waypoint={d} label={`Oprire ${i + 1}`} onChange={w => setOpriri(prev => prev.map((x, j) => j === i ? w : x))} />
                    <button className="btn-rm" onClick={() => setOpriri(prev => prev.filter((_, j) => j !== i))}>×</button>
                  </div>
                ))}
                <WaypointInput waypoint={destinatie} label="Destinație" onChange={setDestinatie} />
                <button className="btn btn-ghost btn-sm" onClick={() => setOpriri(prev => [...prev, emptyWaypoint()])}>+ Adaugă oprire intermediară</button>
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
                  <div className="form-group"><label>Data plecare</label><input type="date" value={dataPlecare} min={todayStr} onChange={e => { setDataPlecare(e.target.value); if (dataIntoarcere && e.target.value > dataIntoarcere) setDataIntoarcere(""); }} /></div>
                  <div className="form-group"><label>Ora plecare</label><input type="time" value={oraPlecare} onChange={e => setOraPlecare(e.target.value)} /></div>
                </div>
                {tipRetur !== "dus" && (
                  <div className="form-row">
                    <div className="form-group"><label>Data întoarcere</label><input type="date" value={dataIntoarcere} min={dataPlecare || todayStr} onChange={e => setDataIntoarcere(e.target.value)} /></div>
                    <div className="form-group"><label>Ora sosire</label><input type="time" value={oraSosire} onChange={e => setOraSosire(e.target.value)} /></div>
                  </div>
                )}
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
                    <div className="retur-fixed-point">📍 {destinatie.location?.display_name.split(",").slice(0, 2).join(", ") || "Destinație"}</div>
                    {opririIntoarcere.map((d, i) => (
                      <div key={d.id} className="dest-row">
                        <WaypointInput waypoint={d} label={`Oprire retur ${i + 1}`} onChange={w => setOpririIntoarcere(prev => prev.map((x, j) => j === i ? w : x))} />
                        <button className="btn-rm" onClick={() => setOpririIntoarcere(prev => prev.filter((_, j) => j !== i))}>×</button>
                      </div>
                    ))}
                    <div className="retur-fixed-point">🏠 {plecare.location?.display_name.split(",").slice(0, 2).join(", ") || "Plecare"}</div>
                    <button className="btn btn-ghost btn-sm" onClick={() => setOpririIntoarcere(prev => [...prev, emptyWaypoint()])}>+ Adaugă oprire retur</button>
                    {rutaIntoarcereLoading && <p className="ruta-loading">Se calculează ruta de întoarcere...</p>}
                    {rutaIntoarcere && !rutaIntoarcereLoading && (
                      <div className="ruta-info">
                        <span>🛣️ <strong>{rutaIntoarcere.distanceKm} km</strong></span>
                        <span>⏱ <strong>{formatDuration(rutaIntoarcere.durationMin)}</strong></span>
                        <span className="ruta-note">retur · via mașină</span>
                      </div>
                    )}
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
                <div className="itinerariu">
                  <h3 className="itinerariu-title">🗺️ Itinerariu dus</h3>
                  <div className="itinerariu-timeline">
                    <div className="it-point it-start">
                      <div className="it-dot"></div>
                      <div className="it-content">
                        <span className="it-type">Plecare</span>
                        <strong>{plecare.location?.display_name.split(",").slice(0, 2).join(", ")}</strong>
                        {dataPlecare && <span className="it-date">{dataPlecare} {oraPlecare && `ora ${oraPlecare}`}</span>}
                      </div>
                    </div>
                    {opriri.filter(o => o.location).map((o, i) => (
                      <div key={o.id} className="it-point it-stop">
                        <div className="it-dot"></div>
                        <div className="it-content">
                          <span className="it-type">Oprire {i + 1}</span>
                          <strong>{o.location!.display_name.split(",").slice(0, 2).join(", ")}</strong>
                        </div>
                      </div>
                    ))}
                    <div className="it-point it-end">
                      <div className="it-dot"></div>
                      <div className="it-content">
                        <span className="it-type">Destinație</span>
                        <strong>{destinatie.location?.display_name.split(",").slice(0, 2).join(", ")}</strong>
                      </div>
                    </div>
                  </div>
                  {ruta && (
                    <div className="ruta-info" style={{marginTop: "8px"}}>
                      <span>🛣️ <strong>{ruta.distanceKm} km</strong></span>
                      <span>⏱ <strong>{formatDuration(ruta.durationMin)}</strong></span>
                    </div>
                  )}
                </div>

                {tipRetur !== "dus" && (
                  <div className="itinerariu" style={{marginTop: "16px"}}>
                    <h3 className="itinerariu-title">🔄 Itinerariu retur {tipRetur === "aceeasi" ? "(aceeași rută)" : "(rută diferită)"}</h3>
                    <div className="itinerariu-timeline">
                      <div className="it-point it-start">
                        <div className="it-dot"></div>
                        <div className="it-content">
                          <span className="it-type">Plecare retur</span>
                          <strong>{destinatie.location?.display_name.split(",").slice(0, 2).join(", ")}</strong>
                        </div>
                      </div>
                      {tipRetur === "aceeasi" && opriri.filter(o => o.location).reverse().map((o, i) => (
                        <div key={`ret-${o.id}`} className="it-point it-stop">
                          <div className="it-dot"></div>
                          <div className="it-content">
                            <span className="it-type">Oprire {i + 1}</span>
                            <strong>{o.location!.display_name.split(",").slice(0, 2).join(", ")}</strong>
                          </div>
                        </div>
                      ))}
                      {tipRetur === "diferita" && opririIntoarcere.filter(o => o.location).map((o, i) => (
                        <div key={`reti-${o.id}`} className="it-point it-stop">
                          <div className="it-dot"></div>
                          <div className="it-content">
                            <span className="it-type">Oprire retur {i + 1}</span>
                            <strong>{o.location!.display_name.split(",").slice(0, 2).join(", ")}</strong>
                          </div>
                        </div>
                      ))}
                      <div className="it-point it-end">
                        <div className="it-dot"></div>
                        <div className="it-content">
                          <span className="it-type">Sosire</span>
                          <strong>{plecare.location?.display_name.split(",").slice(0, 2).join(", ")}</strong>
                          {dataIntoarcere && <span className="it-date">{dataIntoarcere} {oraSosire && `ora ${oraSosire}`}</span>}
                        </div>
                      </div>
                    </div>
                    {tipRetur === "aceeasi" && ruta && (
                      <div className="ruta-info" style={{marginTop: "8px"}}>
                        <span>🛣️ <strong>{ruta.distanceKm} km</strong></span>
                        <span>⏱ <strong>{formatDuration(ruta.durationMin)}</strong></span>
                      </div>
                    )}
                    {tipRetur === "diferita" && rutaIntoarcere && (
                      <div className="ruta-info" style={{marginTop: "8px"}}>
                        <span>🛣️ <strong>{rutaIntoarcere.distanceKm} km</strong></span>
                        <span>⏱ <strong>{formatDuration(rutaIntoarcere.durationMin)}</strong></span>
                      </div>
                    )}
                  </div>
                )}

                <div className="sumar" style={{marginTop: "16px"}}>
                  <div className="sumar-row"><span>Perioadă</span><strong>{dataPlecare} {oraPlecare && `ora ${oraPlecare}`} → {tipRetur === "dus" ? "(doar dus)" : `${dataIntoarcere} ${oraSosire ? `ora ${oraSosire}` : ""}`}</strong></div>
                  {ruta && <div className="sumar-row"><span>Distanță dus</span><strong>{ruta.distanceKm} km · {formatDuration(ruta.durationMin)}</strong></div>}
                  {tipRetur === "aceeasi" && ruta && <div className="sumar-row"><span>Distanță retur</span><strong>{ruta.distanceKm} km · {formatDuration(ruta.durationMin)}</strong></div>}
                  {tipRetur === "diferita" && rutaIntoarcere && <div className="sumar-row"><span>Distanță retur</span><strong>{rutaIntoarcere.distanceKm} km · {formatDuration(rutaIntoarcere.durationMin)}</strong></div>}
                  {ruta && (
                    <div className="sumar-row"><span>Distanță totală</span><strong>
                      {(() => {
                        let total = ruta.distanceKm;
                        if (tipRetur === "aceeasi") total += ruta.distanceKm;
                        if (tipRetur === "diferita" && rutaIntoarcere) total += rutaIntoarcere.distanceKm;
                        return `${total} km`;
                      })()}
                    </strong></div>
                  )}
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
                : <button className="btn btn-primary" onClick={creareCaHatorie}>Creează călătoria ✓</button>
              }
            </div>
          </div>
        </div>
      )}
      {/* Bon review modal */}
      {showBonModal && pendingRow && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !bonScanning && (setShowBonModal(false), setPendingRow(null))}>
          <div className="modal bon-modal">
            <div className="bon-modal-header">
              <h2>{bonScanning ? "Se scanează bonul..." : isEditingConfirm ? "Editează datele bonului" : "Verifică datele bonului"}</h2>
              {pendingRow.fileName && <span className="bon-filename">📄 {pendingRow.fileName}</span>}
            </div>

            <div className="modal-body">
              {bonScanning ? (
                <div className="bon-scanning">
                  <div className="spinner" />
                  <p>Se extrag datele din document...</p>
                  <span className="bon-scanning-hint">AI analizează bonul</span>
                </div>
              ) : (
                <div className="bon-fields">
                  <div className="bon-field-row">
                    <div className="bon-field">
                      <label>Tip document</label>
                      <select value={pendingRow.tipDocument} onChange={e => updatePendingRow("tipDocument", e.target.value)}>
                        <option value="">—</option>
                        {TIP_DOCUMENTE.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="bon-field">
                      <label>Nr. document</label>
                      <input value={pendingRow.nrDocument} onChange={e => updatePendingRow("nrDocument", e.target.value)} />
                    </div>
                  </div>
                  <div className="bon-field-row">
                    <div className="bon-field">
                      <label>Data document</label>
                      <input value={pendingRow.dataDocument} onChange={e => updatePendingRow("dataDocument", e.target.value)} placeholder="DD.MM.YYYY" />
                    </div>
                    <div className="bon-field">
                      <label>Emitent</label>
                      <input value={pendingRow.emitent} onChange={e => updatePendingRow("emitent", e.target.value)} />
                    </div>
                  </div>
                  <div className="bon-field-row">
                    <div className="bon-field">
                      <label>Suma plătită</label>
                      <input type="number" step="0.01" value={pendingRow.sumaPlatiata} onChange={e => updatePendingRow("sumaPlatiata", e.target.value)} />
                    </div>
                    <div className="bon-field">
                      <label>Monedă</label>
                      <select value={pendingRow.moneda} onChange={e => updatePendingRow("moneda", e.target.value)}>
                        {MONEDE.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="bon-field-row">
                    <div className="bon-field">
                      <label>Curs valutar</label>
                      <input type="number" step="0.0001" value={pendingRow.cursValutar} onChange={e => updatePendingRow("cursValutar", e.target.value)} />
                    </div>
                    <div className="bon-field bon-field-highlight">
                      <label>Valoare RON</label>
                      <input type="number" step="0.01" value={pendingRow.valoareRON} onChange={e => updatePendingRow("valoareRON", e.target.value)} className="input-ron" />
                    </div>
                  </div>
                  <div className="bon-field-row">
                    <div className="bon-field">
                      <label>Plătitor</label>
                      <input value={pendingRow.platitor} onChange={e => updatePendingRow("platitor", e.target.value)} />
                    </div>
                    <div className="bon-field">
                      <label>Explicații</label>
                      <input value={pendingRow.explicatii} onChange={e => updatePendingRow("explicatii", e.target.value)} />
                    </div>
                  </div>
                  {pendingRow.scanStatus === "error" && (
                    <div className="bon-error">⚠️ Nu am putut extrage datele automat. Completează manual.</div>
                  )}
                </div>
              )}
            </div>

            {!bonScanning && (
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => { setShowBonModal(false); setPendingRow(null); }}>Anulează</button>
                <button className="btn btn-confirm" onClick={confirmBon}>✓ {isEditingConfirm ? "Salvează modificările" : "E în regulă, adaugă la decont"}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
