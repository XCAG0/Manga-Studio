/**
 * Manga Studio - Electron Preload Script
 * =======================================
 * Exposes safe APIs to the renderer process via contextBridge
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected APIs to renderer
contextBridge.exposeInMainWorld('electronAPI', {
    // File operations
    openFile: () => ipcRenderer.invoke('open-file'),
    saveFile: (data, defaultPath) => ipcRenderer.invoke('save-file', { data, defaultPath }),
    saveFileToPath: (data, filePath) => ipcRenderer.invoke('save-file-to-path', { data, filePath }),
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    getDefaultExportPath: () => ipcRenderer.invoke('get-default-export-path'),

    // Window controls
    minimize: () => ipcRenderer.invoke('minimize-window'),
    maximize: () => ipcRenderer.invoke('maximize-window'),
    close: () => ipcRenderer.invoke('close-window'),

    // Project management
    saveProject: ({ projectName, folderName, canvasJSON, thumbnail, textManagerLines }) =>
        ipcRenderer.invoke('save-project', { projectName, folderName, canvasJSON, thumbnail, textManagerLines }),
    getFolders: () => ipcRenderer.invoke('get-projects'),
    getProjects: () => ipcRenderer.invoke('get-projects'),
    createFolder: (folderName) => ipcRenderer.invoke('create-folder', folderName),
    loadProject: (projectPath) => ipcRenderer.invoke('load-project', projectPath),
    deleteProject: (projectPath) => ipcRenderer.invoke('delete-project', projectPath),

    // External links
    openExternal: (url) => ipcRenderer.send('open-external', url),

    // Auto-updater
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    installUpdate: () => ipcRenderer.invoke('install-update'),
    onUpdateStatus: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on('update-status', handler);
        return () => ipcRenderer.removeListener('update-status', handler);
    },

    // Close confirmation (for Alt+F4)
    onCloseRequested: (callback) => {
        const handler = () => callback();
        ipcRenderer.on('close-requested', handler);
        return () => ipcRenderer.removeListener('close-requested', handler);
    },
    confirmClose: (shouldClose) => ipcRenderer.send('confirm-close', shouldClose)
});
