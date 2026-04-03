import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign,
} from "docx";

const border = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

function cell(text: string, opts: {
  bold?: boolean; width?: number; colSpan?: number; align?: typeof AlignmentType[keyof typeof AlignmentType];
  shade?: string; noBorder?: boolean; size?: number;
} = {}) {
  return new TableCell({
    borders: opts.noBorder ? noBorders : borders,
    columnSpan: opts.colSpan,
    width: { size: opts.width ?? 4500, type: WidthType.DXA },
    shading: opts.shade ? { fill: opts.shade, type: ShadingType.CLEAR } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({
      alignment: opts.align ?? AlignmentType.LEFT,
      children: [new TextRun({
        text,
        bold: opts.bold,
        size: opts.size ?? 18,
        font: "Times New Roman",
      })],
    })],
  });
}

function dots(label: string, value: string, width = 4500) {
  return cell(`${label} ${value || "..................................."}`, { width });
}

interface OrdinData {
  unitatea: string;
  numarOrdin: string;
  dataOrdin: string;
  numePrenume: string;
  functia: string;
  scopDeplasare: string;
  destinatie: string;
  dataPlecareZiOra: string;
  dataSosireZiOra: string;
  distantaKm: string;
  rows: { fel: string; nrData: string; suma: string }[];
  totalCheltuieli: string;
  avansPlecareSum: string;
  totalAvans: string;
  diferenta: string;
}

export async function generateOrdinDeplasare(data: OrdinData): Promise<Buffer> {
  const tableWidth = 9000;

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
      },
      children: [
        // Header
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: "Depus decontul (numărul şi data) .......................", size: 16, font: "Times New Roman" })],
          spacing: { after: 60 },
        }),

        new Table({
          width: { size: tableWidth, type: WidthType.DXA },
          columnWidths: [tableWidth],
          rows: [
            new TableRow({ children: [cell(`(Unitatea) ${data.unitatea || "..................................................."}`, { width: tableWidth, align: AlignmentType.CENTER })] }),
            new TableRow({ children: [cell("ORDIN DE DEPLASARE (DELEGAŢIE)", { width: tableWidth, bold: true, align: AlignmentType.CENTER, shade: "EEEEEE", size: 22 })] }),
            new TableRow({ children: [cell(`Nr. ${data.numarOrdin || "............"}`, { width: tableWidth, align: AlignmentType.CENTER })] }),
            new TableRow({ children: [cell(`Domnul (a) ${data.numePrenume || "..................................................................."}`, { width: tableWidth })] }),
            new TableRow({ children: [cell(`având funcţia de ${data.functia || "..................................................................."}`, { width: tableWidth })] }),
            new TableRow({ children: [cell(`este delegat pentru ${data.scopDeplasare || "..................................................................."}`, { width: tableWidth })] }),
            new TableRow({ children: [cell(`la ${data.destinatie || "..................................................................."}`, { width: tableWidth })] }),
            new TableRow({ children: [cell(`Durata deplasării de la ${data.dataPlecareZiOra || "............"} la ${data.dataSosireZiOra || "............"}`, { width: tableWidth })] }),
            new TableRow({ children: [cell("Se legitimează cu .............................................", { width: tableWidth })] }),
            new TableRow({ children: [
              cell("Ştampila unităţii şi semnătura", { width: tableWidth / 2, align: AlignmentType.LEFT }),
              cell(`Data ${data.dataOrdin || "........................"}`, { width: tableWidth / 2, align: AlignmentType.RIGHT }),
            ] }),
          ],
        }),

        new Paragraph({ children: [new TextRun({ text: " ", size: 14 })] }),

        // Sosit/Plecat table (4 coloane)
        new Table({
          width: { size: tableWidth, type: WidthType.DXA },
          columnWidths: [2250, 2250, 2250, 2250],
          rows: [
            new TableRow({ children: [
              cell("Sosit *) .........................", { width: 2250 }),
              cell("Plecat *) ........................", { width: 2250 }),
              cell("Sosit *) .........................", { width: 2250 }),
              cell("Plecat *) ........................", { width: 2250 }),
            ] }),
            new TableRow({ children: [
              cell("Cu (fără) cazare", { width: 2250 }),
              cell("Ştampila unităţii şi semnătura", { width: 2250 }),
              cell("Cu (fără) cazare", { width: 2250 }),
              cell("Ştampila unităţii şi semnătura", { width: 2250 }),
            ] }),
          ],
        }),

        new Paragraph({ children: [new TextRun({ text: "*) Se va completa ziua, luna, anul şi ora.", size: 14, font: "Times New Roman", italics: true })], spacing: { before: 60, after: 60 } }),

        // Verso title
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "(verso)", size: 16, font: "Times New Roman", italics: true })],
          spacing: { before: 60, after: 60 },
        }),

        // Verso main table
        new Table({
          width: { size: tableWidth, type: WidthType.DXA },
          columnWidths: [4500, 4500],
          rows: [
            new TableRow({ children: [
              cell(`Ziua şi ora plecării ${data.dataPlecareZiOra || "...................."}`, { width: 4500 }),
              cell("Avans spre decontare:", { width: 4500, bold: true }),
            ] }),
            new TableRow({ children: [
              cell(`Ziua şi ora sosirii ${data.dataSosireZiOra || "....................."}`, { width: 4500 }),
              cell(`- Primit la plecare ${data.avansPlecareSum || "............"} lei`, { width: 4500 }),
            ] }),
            new TableRow({ children: [
              cell("Data depunerii decontului ..............", { width: 4500 }),
              cell("- Primit în timpul deplasării ........... lei", { width: 4500 }),
            ] }),
            new TableRow({ children: [
              cell("Penalizări calculate .....................", { width: 4500 }),
              cell(`TOTAL ${data.totalAvans || "........................."} lei`, { width: 4500, bold: true }),
            ] }),
          ],
        }),

        new Paragraph({ children: [new TextRun({ text: " ", size: 10 })] }),

        // Cheltuieli title
        new Table({
          width: { size: tableWidth, type: WidthType.DXA },
          columnWidths: [tableWidth],
          rows: [
            new TableRow({ children: [cell("CHELTUIELI EFECTUATE CONFORM DOCUMENTELOR ANEXATE", { width: tableWidth, bold: true, align: AlignmentType.CENTER, shade: "DDDDDD" })] }),
          ],
        }),

        // Cheltuieli header
        new Table({
          width: { size: tableWidth, type: WidthType.DXA },
          columnWidths: [5400, 2400, 1200],
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                cell("Felul actului şi emitentul", { width: 5400, bold: true, align: AlignmentType.CENTER, shade: "EEEEEE" }),
                cell("Nr. şi data actului", { width: 2400, bold: true, align: AlignmentType.CENTER, shade: "EEEEEE" }),
                cell("Suma", { width: 1200, bold: true, align: AlignmentType.CENTER, shade: "EEEEEE" }),
              ],
            }),
            // Data rows
            ...data.rows.map(r => new TableRow({ children: [
              cell(r.fel || "", { width: 5400 }),
              cell(r.nrData || "", { width: 2400, align: AlignmentType.CENTER }),
              cell(r.suma || "", { width: 1200, align: AlignmentType.RIGHT }),
            ] })),
            // Empty rows padding
            ...(data.rows.length < 10 ? Array(10 - data.rows.length).fill(null).map(() =>
              new TableRow({ children: [
                cell("", { width: 5400 }),
                cell("", { width: 2400 }),
                cell("", { width: 1200 }),
              ] })
            ) : []),
            // Total
            new TableRow({ children: [
              cell("TOTAL CHELTUIELI", { width: 5400, bold: true, shade: "EEEEEE" }),
              cell("", { width: 2400, shade: "EEEEEE" }),
              cell(data.totalCheltuieli || "", { width: 1200, bold: true, align: AlignmentType.RIGHT, shade: "EEEEEE" }),
            ] }),
          ],
        }),

        new Paragraph({ children: [new TextRun({ text: " ", size: 10 })] }),

        // Diferenta
        new Table({
          width: { size: tableWidth, type: WidthType.DXA },
          columnWidths: [4500, 4500],
          rows: [
            new TableRow({ children: [
              cell(`Diferenţa de restituit s-a depus cu chitanţa nr. ....... din ........`, { width: 4500 }),
              cell(`primit / Diferenţa de restituit: ${data.diferenta || "............"} lei`, { width: 4500 }),
            ] }),
          ],
        }),

        new Paragraph({ children: [new TextRun({ text: " ", size: 10 })] }),

        // Semnături
        new Table({
          width: { size: tableWidth, type: WidthType.DXA },
          columnWidths: [1200, 1800, 1500, 1500, 1800, 1200],
          rows: [
            new TableRow({ children: [
              cell("Semnătura", { width: 1200, align: AlignmentType.CENTER, size: 16 }),
              cell("Aprobat, conducătorul unităţii", { width: 1800, align: AlignmentType.CENTER, size: 16 }),
              cell("Control financiar-preventiv", { width: 1500, align: AlignmentType.CENTER, size: 16 }),
              cell("Verificat decont", { width: 1500, align: AlignmentType.CENTER, size: 16 }),
              cell("Şef compartiment", { width: 1800, align: AlignmentType.CENTER, size: 16 }),
              cell("Titular avans", { width: 1200, align: AlignmentType.CENTER, size: 16 }),
            ] }),
            new TableRow({ children: [
              cell("", { width: 1200 }),
              cell("", { width: 1800 }),
              cell("", { width: 1500 }),
              cell("", { width: 1500 }),
              cell("", { width: 1800 }),
              cell("", { width: 1200 }),
            ] }),
          ],
        }),
      ],
    }],
  });

  return Packer.toBuffer(doc);
}
