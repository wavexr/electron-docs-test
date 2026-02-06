import React, { useState, useEffect, useCallback } from 'react';
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

  const handleApply = async (rec: Recommendation) => {
    setRecStates((prev) => ({ ...prev, [rec.id]: { loading: true } }));

    const result = await window.electronAPI.updateCell(
      rec.action.tab,
      rec.action.range,
      rec.action.newValue
    );

    if (result.success) {
      setRecStates((prev) => ({ ...prev, [rec.id]: { applied: true } }));
      addToast(`Updated ${rec.action.tab} ${rec.action.range} successfully`);
      // Auto-refresh the affected tab data
      if (activeTab === rec.action.tab) {
        loadSheetData(rec.action.tab);
      }
    } else {
      setRecStates((prev) => ({
        ...prev,
        [rec.id]: { error: result.error || 'Update failed' },
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
                        <td key={cellIndex}>{cell}</td>
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
                <div className="rec-cards">
                  {analysis.recommendations.map((rec) => {
                    const state = recStates[rec.id] || {};
                    return (
                      <div key={rec.id} className={`rec-card ${state.applied ? 'rec-card-applied' : ''}`}>
                        <div className="rec-card-body">
                          <h4>{rec.title}</h4>
                          <p>{rec.description}</p>
                          <span className="rec-action-label">
                            Action: Set {rec.action.tab} {rec.action.range} to &quot;{rec.action.newValue}&quot;
                          </span>
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
