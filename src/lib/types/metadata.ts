export interface DocumentMetadata {
  title: string;
  documentType: string;      // e.g. "Payroll", "Contract", "Meeting Notes"
  department?: string;
  date?: string;               // inferred document date, not upload date
  author?: string;
  pages?: number;
  sheets?: string[];
  keywords: string[];
  summary: string;
}