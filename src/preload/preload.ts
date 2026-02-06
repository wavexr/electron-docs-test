import { contextBridge, ipcRenderer } from 'electron';

// Expose IPC channels to the renderer via window.electronAPI
contextBridge.exposeInMainWorld('electronAPI', {
  getSheetTabs: () => ipcRenderer.invoke('get-sheet-tabs'),
  getSheetData: (tabName: string) => ipcRenderer.invoke('get-sheet-data', tabName),
  getDocContent: () => ipcRenderer.invoke('get-doc-content'),
  updateCell: (tab: string, range: string, value: string) =>
    ipcRenderer.invoke('update-cell', tab, range, value),
  analyzeData: () => ipcRenderer.invoke('analyze-data'),
});
