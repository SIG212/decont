import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign,
  PageBreak, HeadingLevel,
} from "docx";

export interface OrdinData {
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

// ── helpers ────────────────────────────────────────────────────────────────

const W = 9360; // content width in DXA (A4 with 1.8cm margins each side)
const FONT = "Calibri";
const SIZE_NORMAL = 20; // 10pt
const SIZE_LABEL = 18;  // 9pt

const borderNone = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const borderThin = { style: BorderStyle.SINGLE, size: 4, color: "AAAAAA" };
const borderMed  = { style: BorderStyle.SINGLE, size: 8, color: "1E3A5F" };
const borderAll  = { top: borderThin, bottom: borderThin, left: borderThin, right: borderThin };
const borderNoneAll = { top: borderNone, bottom: borderNone, left: borderNone, right: borderNone };

function val(text?: string) {
  return text?.trim() || "—";
}

function labelRun(text: string): TextRun {
  return new TextRun({ text, font: FONT, size: SIZE_LABEL, color: "6B7A90" });
}

function valueRun(text?: string): TextRun {
  return new TextRun({ text: val(text), font: FONT, size: SIZE_NORMAL, italics: true, color: "1A2335" });
}

function boldRun(text: string, size = SIZE_NORMAL): TextRun {
  return new TextRun({ text, font: FONT, size, bold: true, color: "1E3A5F" });
}

function cell(
  children: Paragraph[],
  opts: { width?: number; shade?: string; borders?: object; valign?: typeof VerticalAlign.CENTER; colSpan?: number } = {}
): TableCell {
  return new TableCell({
    children,
    columnSpan: opts.colSpan,
    width: { size: opts.width ?? W, type: WidthType.DXA },
    borders: (opts.borders ?? borderNoneAll) as any,
    shading: opts.shade ? { fill: opts.shade, type: ShadingType.CLEAR } : undefined,
    verticalAlign: opts.valign ?? VerticalAlign.CENTER,
    margins: { top: 80, bottom: 80, left: 140, right: 140 },
  });
}

function fieldRow(label: string, value?: string, w1 = 2800, w2 = W - 2800): TableRow {
  return new TableRow({
    children: [
      cell([new Paragraph({ children: [labelRun(label)] })], { width: w1, borders: borderNoneAll }),
      cell([new Paragraph({ children: [valueRun(value)], border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: "C5D3E8", space: 1 } } })], { width: w2 }),
    ],
  });
}

function sectionHeader(title: string): Paragraph {
  return new Paragraph({
    children: [boldRun(title, 22)],
    spacing: { before: 280, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: "1E3A5F", space: 4 } },
  });
}

function divider(): Paragraph {
  return new Paragraph({
    children: [],
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "EEEEEE", space: 4 } },
    spacing: { before: 120, after: 120 },
  });
}

function spacer(lines = 1): Paragraph {
  return new Paragraph({ children: [new TextRun({ text: "", size: SIZE_NORMAL * lines })], spacing: { after: 0 } });
}

// ── main ───────────────────────────────────────────────────────────────────

export async function generateOrdinDeplasare(data: OrdinData): Promise<Buffer> {

  // ── FAŢĂ ─────────────────────────────────────────────────────────────────

  const headerTable = new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [W - 2800, 2800],
    rows: [
      new TableRow({
        children: [
          cell([
            new Paragraph({ children: [boldRun("ORDIN DE DEPLASARE", 32)], alignment: AlignmentType.LEFT }),
            new Paragraph({ children: [new TextRun({ text: "( DELEGAŢIE )", font: FONT, size: 22, color: "6B7A90" })], alignment: AlignmentType.LEFT }),
          ], { width: W - 2800, shade: "F0F4FA" }),
          cell([
            new Paragraph({ children: [labelRun("Nr. ordin")], alignment: AlignmentType.RIGHT }),
            new Paragraph({ children: [boldRun(val(data.numarOrdin), 28)], alignment: AlignmentType.RIGHT }),
            new Paragraph({ children: [labelRun("Data")], alignment: AlignmentType.RIGHT }),
            new Paragraph({ children: [valueRun(data.dataOrdin)], alignment: AlignmentType.RIGHT }),
          ], { width: 2800, shade: "F0F4FA" }),
        ],
      }),
    ],
  });

  const dateAngajatTable = new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [W / 2, W / 2],
    rows: [
      new TableRow({
        children: [
          cell([
            new Paragraph({ children: [labelRun("Nume și prenume")] }),
            new Paragraph({ children: [valueRun(data.numePrenume)], border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: "C5D3E8", space: 1 } } }),
          ], { width: W / 2 }),
          cell([
            new Paragraph({ children: [labelRun("Funcția")] }),
            new Paragraph({ children: [valueRun(data.functia)], border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: "C5D3E8", space: 1 } } }),
          ], { width: W / 2 }),
        ],
      }),
    ],
  });

  const dateDeplasareTable = new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [W / 2, W / 2],
    rows: [
      new TableRow({
        children: [
          cell([
            new Paragraph({ children: [labelRun("Destinație")] }),
            new Paragraph({ children: [valueRun(data.destinatie)], border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: "C5D3E8", space: 1 } } }),
          ], { width: W / 2 }),
          cell([
            new Paragraph({ children: [labelRun("Se legitimează cu")] }),
            new Paragraph({ children: [valueRun(data.legitimatie)], border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: "C5D3E8", space: 1 } } }),
          ], { width: W / 2 }),
        ],
      }),
      new TableRow({
        children: [
          cell([
            new Paragraph({ children: [labelRun("Scopul deplasării")] }),
            new Paragraph({ children: [valueRun(data.scopDeplasare)], border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: "C5D3E8", space: 1 } } }),
          ], { width: W, colSpan: 2 } as Parameters<typeof cell>[1]),
        ],
      }),
      new TableRow({
        children: [
          cell([
            new Paragraph({ children: [labelRun("Plecare (ziua, luna, anul și ora)")] }),
            new Paragraph({ children: [valueRun(data.dataPlecareZiOra)], border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: "C5D3E8", space: 1 } } }),
          ], { width: W / 2 }),
          cell([
            new Paragraph({ children: [labelRun("Sosire (ziua, luna, anul și ora)")] }),
            new Paragraph({ children: [valueRun(data.dataSosireZiOra)], border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: "C5D3E8", space: 1 } } }),
          ], { width: W / 2 }),
        ],
      }),
    ],
  });

  const semnaturaTable = new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [W / 3, W / 3, W / 3],
    rows: [
      new TableRow({
        children: [
          cell([new Paragraph({ children: [labelRun("Ștampila unității și semnătura")] })], { width: W / 3 }),
          cell([new Paragraph({ children: [labelRun("Aprobat, conducătorul unității")] })], { width: W / 3 }),
          cell([new Paragraph({ children: [labelRun("Data")] }), new Paragraph({ children: [valueRun(data.dataOrdin)] }) ], { width: W / 3 }),
        ],
      }),
      new TableRow({
        height: { value: 800, rule: "exact" as "exact" },
        children: [
          cell([spacer()], { width: W / 3 }),
          cell([spacer()], { width: W / 3 }),
          cell([spacer()], { width: W / 3 }),
        ],
      }),
    ],
  });

  // ── VERSO ────────────────────────────────────────────────────────────────

  const rows = data.rows || [];
  const EMPTY_ROWS = Math.max(0, 12 - rows.length);

  const cheltuieliHeaderRow = new TableRow({
    children: [
      cell([new Paragraph({ children: [boldRun("Felul actului și emitentul", SIZE_LABEL)], alignment: AlignmentType.CENTER })],
        { width: 5600, shade: "EEF3FB", borders: borderAll }),
      cell([new Paragraph({ children: [boldRun("Nr. și data actului", SIZE_LABEL)], alignment: AlignmentType.CENTER })],
        { width: 2200, shade: "EEF3FB", borders: borderAll }),
      cell([new Paragraph({ children: [boldRun("Suma (RON)", SIZE_LABEL)], alignment: AlignmentType.CENTER })],
        { width: 1560, shade: "EEF3FB", borders: borderAll }),
    ],
  });

  const cheltuieliRows = rows.map((r, i) =>
    new TableRow({
      children: [
        cell([new Paragraph({ children: [valueRun(r.fel)] })], { width: 5600, shade: i % 2 === 0 ? "FFFFFF" : "F7F9FC", borders: borderAll }),
        cell([new Paragraph({ children: [valueRun(r.nrData)], alignment: AlignmentType.CENTER })], { width: 2200, shade: i % 2 === 0 ? "FFFFFF" : "F7F9FC", borders: borderAll }),
        cell([new Paragraph({ children: [valueRun(r.suma)], alignment: AlignmentType.RIGHT })], { width: 1560, shade: i % 2 === 0 ? "FFFFFF" : "F7F9FC", borders: borderAll }),
      ],
    })
  );

  const emptyRows = Array.from({ length: EMPTY_ROWS }, () =>
    new TableRow({
      height: { value: 360, rule: "atLeast" as "atLeast" },
      children: [
        cell([spacer()], { width: 5600, borders: borderAll }),
        cell([spacer()], { width: 2200, borders: borderAll }),
        cell([spacer()], { width: 1560, borders: borderAll }),
      ],
    })
  );

  const totalRow = new TableRow({
    children: [
      cell([new Paragraph({ children: [boldRun("TOTAL CHELTUIELI", SIZE_LABEL)], alignment: AlignmentType.RIGHT })],
        { width: 5600 + 2200, colSpan: 2, shade: "EEF3FB", borders: borderAll } as Parameters<typeof cell>[1]),
      cell([new Paragraph({ children: [boldRun(val(data.totalCheltuieli))], alignment: AlignmentType.RIGHT })],
        { width: 1560, shade: "EEF3FB", borders: borderAll }),
    ],
  });

  const cheltuieliTable = new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [5600, 2200, 1560],
    rows: [cheltuieliHeaderRow, ...cheltuieliRows, ...emptyRows, totalRow],
  });

  const avansTable = new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [W / 2, W / 2],
    rows: [
      new TableRow({
        children: [
          cell([
            new Paragraph({ children: [labelRun("Avans acordat la plecare")] }),
            new Paragraph({ children: [valueRun(data.avansAcordat || "—")], border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: "C5D3E8", space: 1 } } }),
          ], { width: W / 2 }),
          cell([
            new Paragraph({ children: [labelRun("Diferența de depus / restituit")] }),
            new Paragraph({ children: [valueRun(data.diferenta || "—")], border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: "C5D3E8", space: 1 } } }),
          ], { width: W / 2 }),
        ],
      }),
    ],
  });

  const semnaturiVersoTable = new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [W / 6, W / 6, W / 6, W / 6, W / 6, W / 6],
    rows: [
      new TableRow({
        children: ["Semnătura", "Aprobat conducătorul unității", "Control financiar preventiv", "Verificat decont", "Șef compartiment", "Titular avans"].map((label, i) =>
          cell([new Paragraph({ children: [labelRun(label)], alignment: AlignmentType.CENTER })],
            { width: W / 6, borders: borderAll, shade: i === 0 ? undefined : "FAFBFD" })
        ),
      }),
      new TableRow({
        height: { value: 900, rule: "atLeast" as "atLeast" },
        children: Array.from({ length: 6 }, () =>
          cell([spacer()], { width: W / 6, borders: borderAll })
        ),
      }),
    ],
  });

  // ── Document ─────────────────────────────────────────────────────────────

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 900, right: 900, bottom: 900, left: 900 },
        },
      },
      children: [
        // FAŢĂ
        headerTable,
        spacer(),
        sectionHeader("Date angajat"),
        spacer(),
        dateAngajatTable,
        spacer(),
        sectionHeader("Date deplasare"),
        spacer(),
        dateDeplasareTable,
        spacer(),
        sectionHeader("Aprobare"),
        spacer(),
        semnaturaTable,

        // page break → VERSO
        new Paragraph({ children: [new PageBreak()] }),

        new Paragraph({
          children: [boldRun("VERSO — CHELTUIELI EFECTIVE", 26)],
          spacing: { after: 60 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: "1E3A5F", space: 4 } },
        }),
        spacer(),
        sectionHeader("Cheltuieli efectuate conform documentelor anexate"),
        spacer(),
        cheltuieliTable,
        spacer(),
        sectionHeader("Decontare"),
        spacer(),
        avansTable,
        spacer(),
        sectionHeader("Semnături"),
        spacer(),
        semnaturiVersoTable,
      ],
    }],
  });

  return Packer.toBuffer(doc);
}
