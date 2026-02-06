export interface SheetData {
  headers: string[];
  rows: string[][];
}

export interface SheetDataError {
  error: string;
}

export interface DocElement {
  type: 'heading' | 'paragraph' | 'list' | 'table';
  content: string;
  level?: number;
}

export interface DocContent {
  title: string;
  elements: DocElement[];
}

export interface RecommendationAction {
  tab: string;
  range: string;
  newValue: string;
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  category: string;
  sourceReferences?: string[];
  action: RecommendationAction;
}

export interface ReceiptRow {
  receiptId: string;
  timestamp: string;
  recommendationId: string;
  recommendationTitle: string;
  category: string;
  tab: string;
  cell: string;
  originalValue: string;
  newValue: string;
  modificationNotes: string;
  wasModified: string;
  sourceReferences: string;
  appliedBy: string;
  status: string;
}

export interface AnalysisResult {
  summary: string;
  recommendations: Recommendation[];
  error?: string;
}

export interface ElectronAPI {
  getSheetTabs: () => Promise<string[] | { error: string }>;
  getSheetData: (tabName: string) => Promise<SheetData | SheetDataError>;
  getDocContent: () => Promise<DocContent | null>;
  updateCell: (tab: string, range: string, value: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  analyzeData: () => Promise<AnalysisResult>;
  modifyRecommendation: (rec: Recommendation, userNotes: string) => Promise<{ tab: string; range: string; newValue: string } | { error: string }>;
  appendReceipt: (receipt: ReceiptRow) => Promise<{ success: boolean; error?: string }>;
  getCellValue: (tab: string, range: string) => Promise<{ value: string; error?: string }>;
  getNextReceiptId: () => Promise<{ receiptId: string; error?: string }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
