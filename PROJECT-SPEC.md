# PROJECT-SPEC.md — Electron Dashboard PoC

## Overview
A desktop Electron app that connects to Google Sheets and Google Docs, displays data in a tabbed dashboard, uses Claude Haiku to analyze the data and generate recommendations, and writes changes back to the spreadsheet when the user acts on a recommendation.

## Architecture
- **Electron main process** (Node.js): Handles all Google API calls, Anthropic API calls, and credentials. No secrets in the renderer.
- **Preload script**: Exposes IPC channels via contextBridge under `window.electronAPI`
- **React renderer**: Dashboard UI with tabs, tables, analysis panel, and action buttons
- Communication between renderer and main process happens exclusively through IPC

## Project Structure
```
src/
├── main/
│   ├── index.js              # Electron main process entry
│   ├── google-auth.js        # Shared Google auth instance
│   ├── google-sheets.js      # Sheets API: get tabs, get data, update cell
│   ├── google-docs.js        # Docs API: get doc content
│   ├── llm.js                # Anthropic Haiku: analyze data
│   └── ipc-handlers.js       # Register all IPC handlers
├── preload/
│   └── index.js              # contextBridge exposing IPC channels
└── renderer/
    ├── index.html
    ├── App.jsx
    ├── components/
    │   ├── TabBar.jsx
    │   ├── DataTable.jsx
    │   ├── DocViewer.jsx
    │   ├── AnalysisPanel.jsx
    │   └── RecommendationCard.jsx
    └── styles/
```

## IPC Channels
| Channel | Direction | Args | Returns |
|---|---|---|---|
| get-sheet-tabs | renderer → main | none | string[] (tab names) |
| get-sheet-data | renderer → main | { tabName: string } | { headers: string[], rows: string[][] } |
| get-doc-content | renderer → main | none | Array<{ type, content, level? }> or null |
| update-cell | renderer → main | { tab, range, value } | { success: boolean, error?: string } |
| analyze-data | renderer → main | none | { summary: string, recommendations: Recommendation[] } |

## Recommendation Object Shape
```json
{
  "id": "rec_1",
  "title": "Short title",
  "description": "What to do and why",
  "action": {
    "tab": "SheetTabName",
    "range": "B5",
    "newValue": "Approved"
  }
}
```

## Tech Stack
- Electron (electron-forge with Vite + React template)
- React (renderer)
- googleapis npm package (Sheets v4, Docs v1)
- @anthropic-ai/sdk (Claude Haiku — model: claude-haiku-4-5-20251001)
- dotenv (load .env in main process)

## Configuration
All config lives in `.env` in the project root:
- GOOGLE_SERVICE_ACCOUNT_PATH — absolute path to the Google service account JSON key
- SPREADSHEET_ID — the Google Spreadsheet to read/write
- DOC_ID — (optional) Google Doc to read
- ANTHROPIC_API_KEY — Anthropic API key for Haiku calls

## Auth
- Google: Service account JSON key, loaded in main process only
- Anthropic: API key from .env, used in main process only
- No secrets should ever reach the renderer process

## Design Guidelines
- Clean, minimal UI — white background, light gray borders, blue accents
- Window size: 900x700
- Dashboard feel: header bar, tab bar, content area, status bar
- Loading states for all async operations
- Error messages should be user-friendly, not stack traces
