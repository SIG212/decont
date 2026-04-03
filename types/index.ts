export interface DecontRow {
  id: string;
  nr: number;
  tipDocument: string;
  nrDocument: string;
  dataDocument: string;
  emitent: string;
  sumaPlatiata: number | string;
  moneda: string;
  cursValutar: number | string;
  valoareRON: number | string;
  platitor: string;
  explicatii: string;
  // internal
  scanStatus: "pending" | "done" | "error";
  fileName?: string;
  fileUrl?: string;
}

export type DecontField = keyof Omit<DecontRow, "id" | "nr" | "scanStatus" | "fileName">;

export interface ScanResult {
  tipDocument?: string;
  nrDocument?: string;
  dataDocument?: string;
  emitent?: string;
  sumaPlatiata?: number | string;
  moneda?: string;
  cursValutar?: number | string;
  valoareRON?: number | string;
  platitor?: string;
  explicatii?: string;
  error?: string;
}
