import React, { useState, useEffect, useCallback, useMemo } from 'react';
import '../preload/types.d';

interface SheetData {
  headers: string[];
  rows: string[][];
}

interface DocElement {
  type: 'heading' | 'paragraph' | 'list' | 'table';
  content: string;
  level?: number;
}

interface DocContent {
  title: string;
  elements: DocElement[];
}

interface Recommendation {
  id: string;
  title: string;
  description: string;
  category: string;
  sourceReferences?: string[];
  action: {
    tab: string;
    range: string;
    newValue: string;
  };
}

interface AnalysisResult {
  summary: string;
  recommendations: Recommendation[];
  error?: string;
}

interface Toast {
  id: number;
  message: string;
}

interface RecCardState {
  loading?: boolean;
  applied?: boolean;
  error?: string;
  modificationNotes?: string;
  modifying?: boolean;
  modifiedAction?: { tab: string; range: string; newValue: string };
}

function App() {
  const [tabs, setTabs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>('');
  const [sheetData, setSheetData] = useState<SheetData | null>(null);
  const [docContent, setDocContent] = useState<DocContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [recStates, setRecStates] = useState<Record<string, RecCardState>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [highlightedCells, setHighlightedCells] = useState<Set<string>>(new Set());
  let toastCounter = React.useRef(0);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (activeTab && activeTab !== '__doc__') {
      loadSheetData(activeTab);
    }
  }, [activeTab]);

  const loadInitialData = async () => {
    setLoading(true);
    setError(null);

    const [tabResult, docResult] = await Promise.all([
      window.electronAPI.getSheetTabs(),
      window.electronAPI.getDocContent(),
    ]);

    if ('error' in tabResult) {
      setError(tabResult.error);
      setTabs([]);
    } else {
      setTabs(tabResult);
      if (tabResult.length > 0) {
        setActiveTab(tabResult[0]);
      }
    }

    setDocContent(docResult);
    setLastRefreshed(new Date());
    setLoading(false);
  };

  const loadSheetData = async (tabName: string) => {
    setLoading(true);
    setError(null);
    const result = await window.electronAPI.getSheetData(tabName);

    if ('error' in result) {
      setError(result.error);
      setSheetData(null);
    } else {
      setSheetData(result);
    }
    setLastRefreshed(new Date());
    setLoading(false);
  };

  const handleRefresh = useCallback(() => {
    if (activeTab === '__doc__') {
      window.electronAPI.getDocContent().then((result) => {
        setDocContent(result);
        setLastRefreshed(new Date());
      });
    } else if (activeTab) {
      loadSheetData(activeTab);
    }
  }, [activeTab]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    setShowAnalysis(true);
    setAnalysis(null);
    setRecStates({});
    const result = await window.electronAPI.analyzeData();
    setAnalysis(result);
    setAnalyzing(false);
  };

  const handleTabClick = (tab: string) => {
    setActiveTab(tab);
    setError(null);
  };

  // Convert range like "B5" to { row, col } (0-indexed, row relative to data rows not header)
  const parseRange = (range: string): { row: number; col: number } | null => {
    const match = range.match(/^([A-Z]+)(\d+)$/i);
    if (!match) return null;
    const colStr = match[1].toUpperCase();
    const rowNum = parseInt(match[2], 10);
    let col = 0;
    for (let i = 0; i < colStr.length; i++) {
      col = col * 26 + (colStr.charCodeAt(i) - 64);
    }
    // row 1 is the header, so data row 0 = spreadsheet row 2
    return { row: rowNum - 2, col: col - 1 };
  };

  const isCellHighlighted = (rowIndex: number, colIndex: number): boolean => {
    const cellKey = `${activeTab}:`;
    for (const key of highlightedCells) {
      if (!key.startsWith(cellKey)) continue;
      const range = key.slice(cellKey.length);
      const parsed = parseRange(range);
      if (parsed && parsed.row === rowIndex && parsed.col === colIndex) return true;
    }
    return false;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const addToast = (message: string) => {
    const id = ++toastCounter.current;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const setModificationNotes = (recId: string, notes: string) => {
    setRecStates((prev) => ({
      ...prev,
      [recId]: { ...prev[recId], modificationNotes: notes },
    }));
  };

  const groupedRecommendations = useMemo(() => {
    if (!analysis?.recommendations) return {};
    const groups: Record<string, Recommendation[]> = {};
    for (const rec of analysis.recommendations) {
      const cat = rec.category || 'Other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(rec);
    }
    return groups;
  }, [analysis?.recommendations]);

  const handleModify = async (rec: Recommendation) => {
    const state = recStates[rec.id] || {};
    const notes = (state.modificationNotes || '').trim();
    if (!notes) return;

    setRecStates((prev) => ({ ...prev, [rec.id]: { ...prev[rec.id], modifying: true, error: undefined } }));

    try {
      const modResult = await window.electronAPI.modifyRecommendation(rec, notes);
      if ('error' in modResult) {
        setRecStates((prev) => ({
          ...prev,
          [rec.id]: { ...prev[rec.id], modifying: false, error: modResult.error },
        }));
        return;
      }
      setRecStates((prev) => ({
        ...prev,
        [rec.id]: { ...prev[rec.id], modifying: false, modifiedAction: modResult },
      }));
      addToast(`Action for "${rec.title}" modified by Haiku`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setRecStates((prev) => ({
        ...prev,
        [rec.id]: { ...prev[rec.id], modifying: false, error: message },
      }));
    }
  };

  const handleApply = async (rec: Recommendation) => {
    const state = recStates[rec.id] || {};
    const notes = state.modificationNotes || '';
    const finalAction = state.modifiedAction || rec.action;
    const wasModified = !!state.modifiedAction;
    setRecStates((prev) => ({ ...prev, [rec.id]: { ...prev[rec.id], loading: true } }));

    try {
      // 1. Read current cell value for receipt's Original Value
      const cellResult = await window.electronAPI.getCellValue(finalAction.tab, finalAction.range);
      const originalValue = cellResult.value || '';

      // 2. Call updateCell with current action (original or already-modified)
      const result = await window.electronAPI.updateCell(
        finalAction.tab,
        finalAction.range,
        finalAction.newValue
      );

      if (result.success) {
        // 3. Generate receipt
        const receiptIdResult = await window.electronAPI.getNextReceiptId();
        const receipt = {
          receiptId: receiptIdResult.receiptId,
          timestamp: new Date().toISOString(),
          recommendationId: rec.id,
          recommendationTitle: rec.title,
          category: rec.category || 'Other',
          tab: finalAction.tab,
          cell: finalAction.range,
          originalValue,
          newValue: finalAction.newValue,
          modificationNotes: notes,
          wasModified: wasModified ? 'Yes' : 'No',
          sourceReferences: (rec.sourceReferences || []).join('; '),
          appliedBy: 'User',
          status: 'Applied',
        };
        const receiptResult = await window.electronAPI.appendReceipt(receipt);
        if (receiptResult.error) {
          console.warn('Receipt write failed:', receiptResult.error);
        }

        // 4. Update UI
        setRecStates((prev) => ({ ...prev, [rec.id]: { applied: true } }));
        addToast(`Updated ${finalAction.tab} ${finalAction.range} successfully`);
        const cellKey = `${finalAction.tab}:${finalAction.range}`;
        setHighlightedCells((prev) => new Set(prev).add(cellKey));
        if (activeTab === finalAction.tab) {
          loadSheetData(finalAction.tab);
        }
      } else {
        setRecStates((prev) => ({
          ...prev,
          [rec.id]: { ...prev[rec.id], loading: false, error: result.error || 'Update failed' },
        }));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setRecStates((prev) => ({
        ...prev,
        [rec.id]: { ...prev[rec.id], loading: false, error: message },
      }));
    }
  };

  const renderDocContent = () => {
    if (!docContent) return <p className="no-data">No document available</p>;

    return (
      <div className="doc-content">
        <h2 className="doc-title">{docContent.title}</h2>
        {docContent.elements.map((el, i) => {
          switch (el.type) {
            case 'heading': {
              const HeadingTag = `h${Math.min(el.level || 1, 6)}` as keyof JSX.IntrinsicElements;
              return <HeadingTag key={i} className={`doc-heading doc-h${el.level}`}>{el.content}</HeadingTag>;
            }
            case 'paragraph':
              return <p key={i} className="doc-paragraph">{el.content}</p>;
            case 'list':
              return <li key={i} className="doc-list-item">{el.content}</li>;
            case 'table':
              return (
                <pre key={i} className="doc-table">
                  {el.content}
                </pre>
              );
            default:
              return <p key={i}>{el.content}</p>;
          }
        })}
      </div>
    );
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Dashboard</h1>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={handleRefresh} disabled={loading}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
            </svg>
            Refresh
          </button>
          <button className="btn btn-primary" onClick={runAnalysis} disabled={analyzing}>
            {analyzing ? (
              <>
                <div className="spinner-small" />
                Analyzing...
              </>
            ) : 'Analyze'}
          </button>
        </div>
      </header>

      <nav className="tabs">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => handleTabClick(tab)}
          >
            {tab}
          </button>
        ))}
        {docContent && (
          <button
            className={`tab tab-doc ${activeTab === '__doc__' ? 'active' : ''}`}
            onClick={() => handleTabClick('__doc__')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            Document
          </button>
        )}
      </nav>

      <main className="content">
        {error && (
          <div className="error-message">
            <strong>Error:</strong> {error}
          </div>
        )}

        {loading ? (
          <div className="loading-container">
            <div className="spinner" />
            <p className="loading-text">Loading...</p>
          </div>
        ) : activeTab === '__doc__' ? (
          renderDocContent()
        ) : sheetData ? (
          sheetData.headers.length === 0 && sheetData.rows.length === 0 ? (
            <p className="no-data">No data in this tab</p>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  {sheetData.headers.length > 0 && (
                    <tr>
                      {sheetData.headers.map((header, i) => (
                        <th key={i}>{header}</th>
                      ))}
                    </tr>
                  )}
                </thead>
                <tbody>
                  {sheetData.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className={isCellHighlighted(rowIndex, cellIndex) ? 'cell-updated' : ''}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : !error ? (
          <p className="no-data">No data to display</p>
        ) : null}
      </main>

      {/* Analysis Panel Overlay */}
      {showAnalysis && (
        <div className="analysis-overlay">
          <div className="analysis-panel">
            <div className="analysis-header">
              <h2>Analysis</h2>
              <button className="btn-close" onClick={() => setShowAnalysis(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {analyzing ? (
              <div className="analysis-loading">
                <div className="spinner" />
                <p className="loading-text">Analyzing your data with Claude...</p>
              </div>
            ) : analysis?.error ? (
              <div className="error-message">{analysis.error}</div>
            ) : analysis ? (
              <div className="analysis-body">
                <div className="analysis-summary">
                  <h3>Summary</h3>
                  <p>{analysis.summary}</p>
                </div>

                <h3>Recommendations</h3>
                {Object.entries(groupedRecommendations).map(([category, recs]) => (
                  <div key={category} className="rec-group">
                    <div className="rec-group-header">
                      <span className="rec-group-title">{category}</span>
                      <span className="rec-group-count">{recs.length}</span>
                    </div>
                    <div className="rec-cards">
                      {recs.map((rec) => {
                        const state = recStates[rec.id] || {};
                        return (
                          <div key={rec.id} className={`rec-card ${state.applied ? 'rec-card-applied' : ''}`}>
                            <div className="rec-card-body">
                              <h4>{rec.title}</h4>
                              <p>{rec.description}</p>
                              {rec.sourceReferences && rec.sourceReferences.length > 0 && (
                                <div className="rec-sources">
                                  {rec.sourceReferences.map((src, i) => (
                                    <span key={i} className="rec-source-tag">{src}</span>
                                  ))}
                                </div>
                              )}
                              <span className="rec-action-label">
                                Action: Set {(state.modifiedAction || rec.action).tab} {(state.modifiedAction || rec.action).range} to &quot;{(state.modifiedAction || rec.action).newValue}&quot;
                              </span>
                              {state.modifiedAction && !state.applied && (
                                <span className="rec-modified-badge">Modified</span>
                              )}
                              {!state.applied && (
                                <div className="rec-modification">
                                  <label className="rec-modification-label">Modification notes</label>
                                  <div className="rec-modification-row">
                                    <input
                                      className="rec-modification-input"
                                      type="text"
                                      placeholder="e.g. Change assignee to Jane instead"
                                      value={state.modificationNotes || ''}
                                      onChange={(e) => setModificationNotes(rec.id, e.target.value)}
                                      disabled={state.loading || state.modifying}
                                    />
                                    <button
                                      className="btn btn-secondary btn-sm"
                                      disabled={state.loading || state.modifying || !(state.modificationNotes || '').trim()}
                                      onClick={() => handleModify(rec)}
                                    >
                                      {state.modifying ? (
                                        <div className="spinner-small spinner-dark" />
                                      ) : 'Modify'}
                                    </button>
                                  </div>
                                </div>
                              )}
                              {state.error && (
                                <div className="rec-error">{state.error}</div>
                              )}
                            </div>
                            {state.applied ? (
                              <span className="rec-applied">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12"/>
                                </svg>
                                Applied!
                              </span>
                            ) : (
                              <button
                                className="btn btn-primary btn-sm"
                                disabled={state.loading}
                                onClick={() => handleApply(rec)}
                              >
                                {state.loading ? (
                                  <div className="spinner-small" />
                                ) : 'Apply'}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}

      <footer className="status-bar">
        {lastRefreshed
          ? `Last refreshed: ${formatTime(lastRefreshed)}`
          : 'Not yet refreshed'}
      </footer>

      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
