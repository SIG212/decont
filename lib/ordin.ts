import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign,
  PageBreak, TabStopType, TabStopPosition,
} from "docx";

export interface OrdinData {
  unitatea?: string;
  numarOrdin?: string;
  dataOrdin?: string;
  numePrenume?: string;
  functia?: string;
  scopDeplasare?: string;
  destinatie?: string;
  dataPlecareZiOra?: string;
  dataSosireZiOra?: string;
  legitimatie?: string;
  avansAcordat?: string;
  rows?: { fel: string; nrData: string; suma: string }[];
  totalCheltuieli?: string;
  diferenta?: string;
}

// ── constants ──────────────────────────────────────────────────────────────
const FONT = "Segoe UI";
const W = 9500; // total content width DXA
const PT = (pt: number) => pt * 2; // half-points

const bNone = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const bThin = { style: BorderStyle.SINGLE, size: 4, color: "333333" };
const bDash = { style: BorderStyle.DASHED, size: 4, color: "999999" };
const bMed  = { style: BorderStyle.SINGLE, size: 8, color: "000000" };
const noB   = { top: bNone, bottom: bNone, left: bNone, right: bNone };
const allB  = { top: bThin, bottom: bThin, left: bThin, right: bThin };

function v(text?: string) { return text?.trim() || ""; }

// plain label text
function lbl(text: string, bold = true): TextRun {
  return new TextRun({ text, font: FONT, size: PT(10), bold });
}

// filled value — italic
function val(text?: string): TextRun {
  return new TextRun({ text: v(text) || "____________________", font: FONT, size: PT(10), italics: true });
}

function sp(pt = 6): Paragraph {
  return new Paragraph({ children: [], spacing: { before: 0, after: PT(pt) } });
}

// row with label + dashed underline value
function fieldRow(label: string, value?: string, labelW = 2800): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [lbl(label)] })],
        width: { size: labelW, type: WidthType.DXA },
        borders: noB as any,
        margins: { top: 40, bottom: 40, left: 0, right: 80 },
        verticalAlign: VerticalAlign.BOTTOM,
      }),
      new TableCell({
        children: [new Paragraph({ children: [val(value)], border: { bottom: { style: BorderStyle.DASHED, size: 4, color: "999999", space: 1 } } })],
        width: { size: W - labelW, type: WidthType.DXA },
        borders: noB as any,
        margins: { top: 40, bottom: 40, left: 80, right: 0 },
        verticalAlign: VerticalAlign.BOTTOM,
      }),
    ],
  });
}

// two fields side by side
function dualFieldRow(
  label1: string, val1: string | undefined,
  label2: string, val2: string | undefined,
  l1w = 2400, f1w = 1800, l2w = 1600, f2w = 1700
): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [lbl(label1)] })],
        width: { size: l1w, type: WidthType.DXA },
        borders: noB as any,
        margins: { top: 40, bottom: 40, left: 0, right: 60 },
        verticalAlign: VerticalAlign.BOTTOM,
      }),
      new TableCell({
        children: [new Paragraph({ children: [val(val1)], border: { bottom: { style: BorderStyle.DASHED, size: 4, color: "999999", space: 1 } } })],
        width: { size: f1w, type: WidthType.DXA },
        borders: noB as any,
        margins: { top: 40, bottom: 40, left: 60, right: 120 },
        verticalAlign: VerticalAlign.BOTTOM,
      }),
      new TableCell({
        children: [new Paragraph({ children: [lbl(label2)] })],
        width: { size: l2w, type: WidthType.DXA },
        borders: noB as any,
        margins: { top: 40, bottom: 40, left: 0, right: 60 },
        verticalAlign: VerticalAlign.BOTTOM,
      }),
      new TableCell({
        children: [new Paragraph({ children: [val(val2)], border: { bottom: { style: BorderStyle.DASHED, size: 4, color: "999999", space: 1 } } })],
        width: { size: f2w, type: WidthType.DXA },
        borders: noB as any,
        margins: { top: 40, bottom: 40, left: 60, right: 0 },
        verticalAlign: VerticalAlign.BOTTOM,
      }),
    ],
  });
}

function stampBox(title: string, w: number): TableCell {
  return new TableCell({
    children: [
      new Paragraph({ children: [lbl(title)], border: { bottom: bThin } }),
      sp(30),
    ],
    width: { size: w, type: WidthType.DXA },
    borders: allB as any,
    margins: { top: 80, bottom: 80, left: 80, right: 80 },
  });
}

export async function generateOrdinDeplasare(data: OrdinData): Promise<Buffer> {
  const rows = data.rows || [];
  const EMPTY = Math.max(0, 8 - rows.length);
  const colW = [Math.round(W * 0.4), Math.round(W * 0.3), W - Math.round(W * 0.4) - Math.round(W * 0.3)];

  // ── FAŢĂ ──────────────────────────────────────────────────────────────────

  // Header: unitate | depus decont
  const headerTable = new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [Math.round(W * 0.55), Math.round(W * 0.45)],
    rows: [new TableRow({
      children: [
        new TableCell({
          children: [
            new Paragraph({ children: [lbl("Unitatea:", false), lbl(" " + v(data.unitatea) || " ____________________________")] }),
          ],
          width: { size: Math.round(W * 0.55), type: WidthType.DXA },
          borders: { ...noB, bottom: bThin } as any,
          margins: { top: 40, bottom: 60, left: 0, right: 0 },
        }),
        new TableCell({
          children: [new Paragraph({
            children: [lbl("Depus decontul nr: ", false), val(), lbl("  din ", false), val()],
            alignment: AlignmentType.RIGHT,
          })],
          width: { size: Math.round(W * 0.45), type: WidthType.DXA },
          borders: noB as any,
          margins: { top: 40, bottom: 60, left: 0, right: 0 },
        }),
      ],
    })],
  });

  // Titlu
  const titlu = new Paragraph({
    children: [new TextRun({ text: "ORDIN DE DEPLASARE (DELEGAȚIE)", font: FONT, size: PT(18), bold: true })],
    alignment: AlignmentType.CENTER,
    spacing: { before: PT(20), after: PT(6) },
  });
  const nrOrdin = new Paragraph({
    children: [lbl("Nr. "), val(data.numarOrdin)],
    alignment: AlignmentType.CENTER,
    spacing: { after: PT(16) },
  });

  // Câmpuri față
  const fieldsTable = new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [2200, W - 2200],
    rows: [
      fieldRow("Domnul (a):", data.numePrenume, 2200),
      fieldRow("Având funcția de:", data.functia, 2200),
      fieldRow("Este delegat pentru:", data.scopDeplasare, 2200),
      fieldRow("La:", data.destinatie, 2200),
    ],
  });

  const durataTable = new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [2800, 2000, 1200, 1500],
    rows: [dualFieldRow("Durata deplasării de la data:", data.dataPlecareZiOra, "până la:", data.dataSosireZiOra, 2800, 2000, 1200, 1500)],
  });

  const legitimatieTable = new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [2000, W - 2000],
    rows: [fieldRow("Se legitimează cu:", data.legitimatie, 2000)],
  });

  // Data + semnătura
  const semnaturaTable = new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [W - 3000, 3000],
    rows: [new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [lbl("Data: "), val(data.dataOrdin)] })],
          width: { size: W - 3000, type: WidthType.DXA },
          borders: noB as any,
          margins: { top: 40, bottom: 40, left: 0, right: 0 },
          verticalAlign: VerticalAlign.BOTTOM,
        }),
        new TableCell({
          children: [new Paragraph({
            children: [lbl("Semnătura și ștampila unității", false)],
            alignment: AlignmentType.CENTER,
            border: { top: bMed },
          })],
          width: { size: 3000, type: WidthType.DXA },
          borders: noB as any,
          margins: { top: 120, bottom: 40, left: 0, right: 0 },
        }),
      ],
    })],
  });

  // Sosit/Plecat grid (2x2)
  const boxW = Math.round(W / 2) - 60;
  const stampTable = new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [boxW, W - boxW],
    rows: [
      new TableRow({ children: [stampBox("Sosit / Plecat 1", boxW), stampBox("Sosit / Plecat 2", W - boxW)] }),
      new TableRow({ children: [stampBox("Sosit / Plecat 3", boxW), stampBox("Sosit / Plecat 4", W - boxW)] }),
    ],
  });

  // ── VERSO ─────────────────────────────────────────────────────────────────

  const versoTitlu = new Paragraph({
    children: [new TextRun({ text: "DECONT DE CHELTUIELI", font: FONT, size: PT(14), bold: true })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: PT(14) },
  });

  // Plecare/sosire | Avans
  const infoW = Math.round(W / 2) - 60;
  const infoTable = new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [infoW, W - infoW],
    rows: [new TableRow({
      children: [
        new TableCell({
          children: [
            new Paragraph({ children: [lbl("Ziua și ora plecării: "), val(data.dataPlecareZiOra)] }),
            new Paragraph({ children: [lbl("Ziua și ora sosirii: "), val(data.dataSosireZiOra)] }),
            new Paragraph({ children: [lbl("Data depunerii decontului: "), val(data.dataOrdin)] }),
          ],
          width: { size: infoW, type: WidthType.DXA },
          borders: noB as any,
          margins: { top: 80, bottom: 80, left: 0, right: 120 },
        }),
        new TableCell({
          children: [
            new Paragraph({ children: [lbl("Avans spre decontare:")] }),
            new Paragraph({ children: [lbl("- Primit la plecare: "), val(data.avansAcordat), lbl(" lei")] }),
            new Paragraph({ children: [lbl("- Primit în timpul deplasării: "), val(), lbl(" lei")] }),
            new Paragraph({ children: [lbl("TOTAL AVANS: "), val(), lbl(" lei")], spacing: { before: PT(4) } }),
          ],
          width: { size: W - infoW, type: WidthType.DXA },
          borders: allB as any,
          margins: { top: 80, bottom: 80, left: 80, right: 80 },
          shading: { fill: "F9F9F9", type: ShadingType.CLEAR },
        }),
      ],
    })],
  });

  // Tabel cheltuieli
  const cheltuieliTitlu = new Paragraph({
    children: [lbl("Cheltuieli efectuate conform documentelor anexate")],
    spacing: { before: PT(10), after: PT(6) },
  });

  const cheltuieliTable = new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: colW,
    rows: [
      // header
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({ children: [new Paragraph({ children: [lbl("Felul actului și emitentul")], alignment: AlignmentType.CENTER })], width: { size: colW[0], type: WidthType.DXA }, borders: allB as any, shading: { fill: "F9F9F9", type: ShadingType.CLEAR }, margins: { top: 60, bottom: 60, left: 80, right: 80 } }),
          new TableCell({ children: [new Paragraph({ children: [lbl("Nr. și data actului")], alignment: AlignmentType.CENTER })], width: { size: colW[1], type: WidthType.DXA }, borders: allB as any, shading: { fill: "F9F9F9", type: ShadingType.CLEAR }, margins: { top: 60, bottom: 60, left: 80, right: 80 } }),
          new TableCell({ children: [new Paragraph({ children: [lbl("Suma (LEI)")], alignment: AlignmentType.CENTER })], width: { size: colW[2], type: WidthType.DXA }, borders: allB as any, shading: { fill: "F9F9F9", type: ShadingType.CLEAR }, margins: { top: 60, bottom: 60, left: 80, right: 80 } }),
        ],
      }),
      // data rows
      ...rows.map(r => new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [val(r.fel)] })], width: { size: colW[0], type: WidthType.DXA }, borders: allB as any, margins: { top: 60, bottom: 60, left: 80, right: 80 } }),
          new TableCell({ children: [new Paragraph({ children: [val(r.nrData)] })], width: { size: colW[1], type: WidthType.DXA }, borders: allB as any, margins: { top: 60, bottom: 60, left: 80, right: 80 } }),
          new TableCell({ children: [new Paragraph({ children: [val(r.suma)], alignment: AlignmentType.RIGHT })], width: { size: colW[2], type: WidthType.DXA }, borders: allB as any, margins: { top: 60, bottom: 60, left: 80, right: 80 } }),
        ],
      })),
      // empty rows
      ...Array.from({ length: EMPTY }, () => new TableRow({
        height: { value: 400, rule: "atLeast" as "atLeast" },
        children: [
          new TableCell({ children: [sp()], width: { size: colW[0], type: WidthType.DXA }, borders: allB as any }),
          new TableCell({ children: [sp()], width: { size: colW[1], type: WidthType.DXA }, borders: allB as any }),
          new TableCell({ children: [sp()], width: { size: colW[2], type: WidthType.DXA }, borders: allB as any }),
        ],
      })),
      // total
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [lbl("TOTAL CHELTUIELI:")], alignment: AlignmentType.RIGHT })],
            columnSpan: 2,
            width: { size: colW[0] + colW[1], type: WidthType.DXA },
            borders: allB as any,
            shading: { fill: "F9F9F9", type: ShadingType.CLEAR },
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
          }),
          new TableCell({
            children: [new Paragraph({ children: [val(data.totalCheltuieli)], alignment: AlignmentType.RIGHT })],
            width: { size: colW[2], type: WidthType.DXA },
            borders: allB as any,
            shading: { fill: "F9F9F9", type: ShadingType.CLEAR },
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
          }),
        ],
      }),
    ],
  });

  // Diferenta
  const diferentaBox = new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [W],
    rows: [new TableRow({
      children: [new TableCell({
        children: [new Paragraph({ children: [lbl("Diferența de restituit / primit: "), val(data.diferenta), lbl(" lei.")] })],
        width: { size: W, type: WidthType.DXA },
        borders: { top: bNone, bottom: bNone, left: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" }, right: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" }, ...{ top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" }, bottom: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" } } } as any,
        margins: { top: 80, bottom: 80, left: 100, right: 100 },
      })],
    })],
  });

  // Semnături verso (4 coloane)
  const sigW = Math.round(W / 4);
  const semnaturiTable = new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [sigW, sigW, sigW, W - sigW * 3],
    rows: [
      new TableRow({
        height: { value: 900, rule: "atLeast" as "atLeast" },
        children: ["Aprobat Conducător Unitate", "Control Financiar Preventiv", "Verificat Decont", "Titular Avans"].map((label, i) =>
          new TableCell({
            children: [new Paragraph({
              children: [lbl(label, false)],
              alignment: AlignmentType.CENTER,
              border: { top: bMed },
            })],
            width: { size: i < 3 ? sigW : W - sigW * 3, type: WidthType.DXA },
            borders: noB as any,
            margins: { top: 80, bottom: 80, left: 40, right: 40 },
          })
        ),
      }),
    ],
  });

  // ── Build doc ─────────────────────────────────────────────────────────────
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 850, right: 850, bottom: 850, left: 850 },
        },
      },
      children: [
        // FAŢĂ
        headerTable, sp(12),
        titlu, nrOrdin,
        fieldsTable, sp(4),
        durataTable, sp(4),
        legitimatieTable, sp(16),
        semnaturaTable, sp(16),
        stampTable,

        // VERSO
        new Paragraph({ children: [new PageBreak()] }),
        versoTitlu,
        infoTable, sp(8),
        cheltuieliTitlu,
        cheltuieliTable, sp(8),
        diferentaBox, sp(16),
        semnaturiTable,
      ],
    }],
  });

  return Packer.toBuffer(doc);
}
