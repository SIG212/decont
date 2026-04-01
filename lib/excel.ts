import * as XLSX from "xlsx";
import { DecontRow } from "@/types";

const HEADERS = [
  "#",
  "Tip document / Document type",
  "Nr. document / Document no.",
  "Data document / Document date",
  "Emitent / Issuer",
  "Suma platita / Paid amount",
  "Moneda / Currency",
  "Curs valutar / FX rate",
  "Valoare / Amount (RON)",
  "Platitor / Payer",
  "Explicatii / Explanations",
];

const COL_WIDTHS = [6, 28, 26, 26, 28, 24, 20, 22, 24, 24, 36];

export function generateExcel(rows: DecontRow[]): Blob {
  const wb = XLSX.utils.book_new();

  const data = [
    HEADERS,
    ...rows.map((r) => [
      r.nr,
      r.tipDocument,
      r.nrDocument,
      r.dataDocument,
      r.emitent,
      r.sumaPlatiata,
      r.moneda,
      r.cursValutar,
      r.valoareRON,
      r.platitor,
      r.explicatii,
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);

  // Column widths
  ws["!cols"] = COL_WIDTHS.map((w) => ({ wch: w }));

  // Header style (bold, background)
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  for (let C = range.s.c; C <= range.e.c; C++) {
    const cellAddr = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!ws[cellAddr]) continue;
    ws[cellAddr].s = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "1E3A5F" } },
      alignment: { horizontal: "center", wrapText: true },
      border: {
        bottom: { style: "thin", color: { rgb: "AAAAAA" } },
      },
    };
  }

  // Data rows — alternate shading + borders
  for (let R = 1; R <= rows.length; R++) {
    const isEven = R % 2 === 0;
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[cellAddr]) {
        ws[cellAddr] = { t: "s", v: "" };
      }
      ws[cellAddr].s = {
        fill: { fgColor: { rgb: isEven ? "F0F4FA" : "FFFFFF" } },
        alignment: { horizontal: C === 0 ? "center" : "left", wrapText: false },
        border: {
          top: { style: "thin", color: { rgb: "DDDDDD" } },
          bottom: { style: "thin", color: { rgb: "DDDDDD" } },
          left: { style: "thin", color: { rgb: "DDDDDD" } },
          right: { style: "thin", color: { rgb: "DDDDDD" } },
        },
      };
    }
  }

  // Total row
  const totalRowIdx = rows.length + 1;
  const totalRow = new Array(11).fill("");
  totalRow[0] = "TOTAL";
  totalRow[8] = rows.reduce((sum, r) => {
    const v = parseFloat(String(r.valoareRON).replace(",", "."));
    return sum + (isNaN(v) ? 0 : v);
  }, 0);

  XLSX.utils.sheet_add_aoa(ws, [totalRow], { origin: totalRowIdx });

  for (let C = 0; C < 11; C++) {
    const cellAddr = XLSX.utils.encode_cell({ r: totalRowIdx, c: C });
    if (!ws[cellAddr]) ws[cellAddr] = { t: "s", v: "" };
    ws[cellAddr].s = {
      font: { bold: true },
      fill: { fgColor: { rgb: "D6E4F7" } },
      border: {
        top: { style: "medium", color: { rgb: "1E3A5F" } },
        bottom: { style: "medium", color: { rgb: "1E3A5F" } },
      },
    };
  }

  XLSX.utils.book_append_sheet(wb, ws, "Decont");

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array", cellStyles: true });
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
