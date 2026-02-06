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
  action: RecommendationAction;
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
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
