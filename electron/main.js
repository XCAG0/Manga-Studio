/**
 * Manga Studio - Electron Main Process
 * =====================================
 * Handles window management, Python server, IPC, auto-updates, and project management.
 */

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, spawnSync } = require('child_process');
let autoUpdater = null;

// Discord Rich Presence
let discordRPC = null;
let rpcClient = null;
const DISCORD_CLIENT_ID = '1456610268548173856';

// Check if running in development mode
const isDev = !app.isPackaged;

// Global references
let mainWindow = null;
let pythonProcess = null;
let updateDownloaded = false;
let startTimestamp = null;

// Logging
const logFile = path.join(app.getPath('userData'), 'manga-studio.log');

function logToFile(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    try {
        fs.appendFileSync(logFile, logEntry);
    } catch (e) { }
    console.log(message);
}

function getAutoUpdater() {
    if (isDev) return null;
    if (autoUpdater) return autoUpdater;

    try {
        ({ autoUpdater } = require('electron-updater'));
        return autoUpdater;
    } catch (error) {
        logToFile(`[AutoUpdater] Failed to load updater module: ${error.message}`);
        return null;
    }
}

function createRuntimePaths(pythonPath, serverPath) {
    const runtimeDir = path.join(app.getPath('userData'), 'runtime');
    const configPath = path.join(runtimeDir, 'ocr-runtime.json');
    const benchmarkImagePath = path.join(path.dirname(serverPath), 'test.png');

    fs.mkdirSync(runtimeDir, { recursive: true });

    return {
        runtimeDir,
        configPath,
        benchmarkImagePath,
        env: {
            ...process.env,
            PYTHONIOENCODING: 'utf-8',
            PYTHONNOUSERSITE: '1',
            MANGA_STUDIO_USER_DATA: runtimeDir,
            MANGA_OCR_RUNTIME_CONFIG: configPath,
            MANGA_PYTHON_HOME: path.dirname(pythonPath),
            MANGA_OCR_BENCHMARK_IMAGE: benchmarkImagePath,
        },
    };
}

function getInstallerPathCandidates() {
    return [
        path.join(__dirname, '..', 'manga-backend', 'installer.bat'),
        path.join(process.resourcesPath, 'manga-backend', 'installer.bat'),
    ];
}

function getInstallerHintPath() {
    return getInstallerPathCandidates().find((candidate) => fs.existsSync(candidate))
        || getInstallerPathCandidates()[0];
}

function getRuntimeManagerPaths() {
    return [
        path.join(__dirname, '..', 'manga-backend', 'ocr_runtime_manager.pyc'),
        path.join(__dirname, '..', 'manga-backend', 'ocr_runtime_manager.py'),
        path.join(process.resourcesPath, 'manga-backend', 'ocr_runtime_manager.pyc'),
        path.join(process.resourcesPath, 'manga-backend', 'ocr_runtime_manager.py'),
    ];
}

function isUsablePythonPath(candidate) {
    if (!candidate || candidate === 'python') return false;

    const normalized = String(candidate).trim().replace(/^"(.*)"$/, '$1');
    if (!normalized) return false;
    if (!fs.existsSync(normalized)) return false;

    try {
        const stats = fs.statSync(normalized);
        if (!stats.isFile() || stats.size === 0) {
            return false;
        }
    } catch (error) {
        return false;
    }

    const lower = normalized.toLowerCase();
    if (lower.includes('\\windowsapps\\')) return false;
    if (lower.endsWith('\\system32\\python')) return false;

    return true;
}

function resolveSystemPythonPath() {
    const probeEnv = {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONNOUSERSITE: '1',
    };

    const probeCommands = [
        ['py', ['-3', '-c', 'import sys; print(sys.executable)']],
        ['python', ['-c', 'import sys; print(sys.executable)']],
    ];

    for (const [command, args] of probeCommands) {
        try {
            const result = spawnSync(command, args, {
                env: probeEnv,
                encoding: 'utf-8',
                windowsHide: true,
            });

            const candidate = result.stdout
                ?.split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean)
                .pop();

            if (isUsablePythonPath(candidate)) {
                return candidate;
            }
        } catch (error) {
            // Try the next probe.
        }
    }

    if (process.platform === 'win32') {
        try {
            const result = spawnSync('where.exe', ['python'], {
                env: probeEnv,
                encoding: 'utf-8',
                windowsHide: true,
            });

            const candidates = result.stdout
                ?.split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean) || [];

            for (const candidate of candidates) {
                if (isUsablePythonPath(candidate)) {
                    return candidate;
                }
            }
        } catch (error) {
            // Fall through to plain python.
        }
    }

    return 'python';
}

function parseLastJsonLine(stdout) {
    const lines = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    for (let i = lines.length - 1; i >= 0; i -= 1) {
        const line = lines[i];
        if (!line.startsWith('{')) continue;
        try {
            return JSON.parse(line);
        } catch (error) {
            // Keep scanning earlier lines.
        }
    }

    return null;
}

function runPythonHelper(pythonPath, args, env, label, timeoutMs = 20 * 60 * 1000) {
    return new Promise((resolve, reject) => {
        const helperProcess = spawn(pythonPath, args, { env });
        let stdout = '';
        let stderr = '';
        let settled = false;

        const timeout = setTimeout(() => {
            if (settled) return;
            settled = true;
            try {
                helperProcess.kill('SIGTERM');
            } catch (error) { }
            reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        helperProcess.stdout.on('data', (data) => {
            const chunk = data.toString();
            stdout += chunk;
            for (const line of chunk.split(/\r?\n/)) {
                const trimmed = line.trim();
                if (trimmed) {
                    logToFile(`[${label}] ${trimmed}`);
                }
            }
        });

        helperProcess.stderr.on('data', (data) => {
            const chunk = data.toString();
            stderr += chunk;
            for (const line of chunk.split(/\r?\n/)) {
                const trimmed = line.trim();
                if (trimmed) {
                    logToFile(`[${label} ERR] ${trimmed}`);
                }
            }
        });

        helperProcess.on('error', (error) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            reject(error);
        });

        helperProcess.on('close', (code) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            resolve({ code, stdout, stderr });
        });
    });
}

async function verifyPythonDependencies(pythonPath) {
    const script = [
        'import importlib.util, json',
        'modules = ["flask", "click", "flask_cors", "PIL", "numpy", "cv2", "paddle", "paddleocr", "deep_translator"]',
        'missing = [name for name in modules if importlib.util.find_spec(name) is None]',
        'print(json.dumps({"missing": missing}))',
    ].join('; ');

    try {
        const result = await runPythonHelper(
            pythonPath,
            ['-c', script],
            {
                ...process.env,
                PYTHONIOENCODING: 'utf-8',
                PYTHONNOUSERSITE: '1',
            },
            'Python Check',
            2 * 60 * 1000
        );

        const payload = parseLastJsonLine(result.stdout) || {};
        const missing = Array.isArray(payload.missing) ? payload.missing : [];

        return {
            ok: result.code === 0 && missing.length === 0,
            missing,
            error: result.code === 0 ? null : (result.stderr || result.stdout || 'Dependency check failed').trim(),
        };
    } catch (error) {
        return {
            ok: false,
            missing: [],
            error: error.message,
        };
    }
}

function showBackendSetupError(pythonPath, dependencyCheck) {
    const installerPath = getInstallerHintPath();
    const missingText = dependencyCheck.missing?.length
        ? `Missing modules: ${dependencyCheck.missing.join(', ')}`
        : (dependencyCheck.error || 'Python backend requirements are missing.');

    const detail = [
        `Python executable: ${pythonPath}`,
        missingText,
        '',
        'Run the backend installer, then restart Manga Studio:',
        installerPath,
        '',
        'For manual setup instructions, open SETUP.md from the repository root.',
    ].join('\n');

    logToFile(`[Python] Backend setup required. ${missingText}`);

    dialog.showErrorBox('Backend Setup Required', detail);
}

async function selectOcrRuntime(pythonPath, serverPath) {
    const runtimeManagerPath = getRuntimeManagerPaths().find((candidate) => fs.existsSync(candidate));
    const runtimePaths = createRuntimePaths(pythonPath, serverPath);

    if (!runtimeManagerPath) {
        logToFile('[OCR Runtime] Runtime manager not found, defaulting to cpu');
        return {
            selectedMode: 'cpu',
            env: runtimePaths.env,
            payload: null,
        };
    }

    const hasExistingConfig = fs.existsSync(runtimePaths.configPath);
    logToFile(
        hasExistingConfig
            ? `[OCR Runtime] Reusing or refreshing cached runtime config at: ${runtimePaths.configPath}`
            : `[OCR Runtime] Running first-launch OCR benchmark with: ${runtimePaths.benchmarkImagePath}`
    );

    try {
        const result = await runPythonHelper(
            pythonPath,
            [runtimeManagerPath, 'select'],
            runtimePaths.env,
            'OCR Runtime'
        );
        const payload = parseLastJsonLine(result.stdout);
        const selectedMode = payload?.selected_mode || 'cpu';

        logToFile(`[OCR Runtime] Selected mode: ${selectedMode}`);
        return {
            selectedMode,
            env: runtimePaths.env,
            payload,
        };
    } catch (error) {
        logToFile(`[OCR Runtime] Failed to select runtime, defaulting to cpu: ${error.message}`);
        return {
            selectedMode: 'cpu',
            env: runtimePaths.env,
            payload: null,
        };
    }
}

// ============================================
// PYTHON SERVER MANAGEMENT
// ============================================

async function startPythonServer() {
    try {
        logToFile('[Python] Starting Python server...');
        logToFile(`[Python] isDev: ${isDev}`);
        logToFile(`[Python] __dirname: ${__dirname}`);
        logToFile(`[Python] resourcesPath: ${process.resourcesPath}`);

        const resolvedSystemPython = resolveSystemPythonPath();

        // Python executable paths to try
        const pythonPaths = [
            path.join(__dirname, '..', 'manga-backend', '.venv', 'Scripts', 'python.exe'),
            path.join(__dirname, '..', 'manga-backend', '.venv', 'bin', 'python'),
            path.join(__dirname, '..', '.venv', 'Scripts', 'python.exe'),
            path.join(__dirname, '..', '.venv', 'bin', 'python'),
            path.join(__dirname, '..', 'python-embed', 'python.exe'),
            path.join(process.resourcesPath, 'python-embed', 'python.exe'),
            resolvedSystemPython,
            'python'
        ];

        // Server script paths to try
        const serverPaths = [
            path.join(__dirname, '..', 'manga-backend', 'server.pyc'),
            path.join(__dirname, '..', 'manga-backend', 'server.py'),
            path.join(process.resourcesPath, 'manga-backend', 'server.pyc'),
            path.join(process.resourcesPath, 'manga-backend', 'server.py'),
        ].filter(Boolean);

        let pythonPath = null;

        // Find Python executable
        for (const pyPath of pythonPaths) {
            if (pyPath === 'python') {
                pythonPath = 'python';
                console.log('[Python] Using system Python');
                break;
            } else if (fs.existsSync(pyPath)) {
                pythonPath = pyPath;
                console.log('[Python] Found python at:', pythonPath);
                break;
            } else {
                console.log('[Python] Not found:', pyPath);
            }
        }

        if (!pythonPath) {
            const msg = '[Python] ERROR: Python executable not found!';
            console.error(msg);
            logToFile(msg);
            return;
        }

        // Find server script
        let serverPath = null;
        for (const sPath of serverPaths) {
            console.log('[Python] Checking server at:', sPath);
            if (fs.existsSync(sPath)) {
                serverPath = sPath;
                console.log('[Python] Found server at:', serverPath);
                break;
            }
        }

        if (!serverPath) {
            const msg = '[Python] ERROR: Server script not found!';
            console.error(msg);
            logToFile(msg);
            return;
        }

        logToFile(`[Python] Executable: ${pythonPath}`);
        logToFile(`[Python] Script: ${serverPath}`);

        const usingSystemPython = pythonPath === 'python';
        const dependencyCheck = await verifyPythonDependencies(pythonPath);
        if (!dependencyCheck.ok) {
            if (usingSystemPython) {
                logToFile(`[Python] System Python dependency check failed, attempting direct startup anyway: ${dependencyCheck.error || dependencyCheck.missing?.join(', ') || 'Unknown dependency issue'}`);
            } else {
                showBackendSetupError(pythonPath, dependencyCheck);
                return;
            }
        }

        const runtimeSelection = await selectOcrRuntime(pythonPath, serverPath);
        logToFile(`[Python] OCR runtime mode: ${runtimeSelection.selectedMode}`);

        // Spawn Python process
        pythonProcess = spawn(pythonPath, [serverPath], {
            env: runtimeSelection.env,
        });

        pythonProcess.stdout.on('data', (data) => {
            console.log('[Python OUT]', data.toString().trim());
        });

        pythonProcess.stderr.on('data', (data) => {
            const msg = data.toString().trim();
            if (!msg.includes('FutureWarning')) {
                console.error('[Python ERR]', msg);
            }
        });

        pythonProcess.on('close', (code) => {
            console.log('[Python] Process closed with code:', code);
            pythonProcess = null;
        });

        pythonProcess.on('error', (error) => {
            console.error('[Python] Spawn error:', error);
            if (mainWindow && error.code === 'ENOENT') {
                dialog.showErrorBox('Python Error', 'Python executable not found. Please install Python.');
            }
        });

        console.log('[Python] Server started successfully');
        logToFile('[Python] Server started');

    } catch (error) {
        console.error('[Python] Start error:', error);
        logToFile(`[Python] Start error: ${error.message}`);
    }
}

function stopPythonServer() {
    if (!pythonProcess) {
        console.log('[Python] No process to stop');
        return;
    }

    console.log('[Python] Stopping server...');
    try {
        pythonProcess.kill('SIGTERM');
        setTimeout(() => {
            if (pythonProcess) {
                console.log('[Python] Force killing...');
                pythonProcess.kill('SIGKILL');
                pythonProcess = null;
            }
        }, 3000);
        console.log('[Python] Stop signal sent');
    } catch (error) {
        console.error('[Python] Stop error:', error);
    }
    pythonProcess = null;
}

// ============================================
// DISCORD RICH PRESENCE
// ============================================

async function initDiscordRPC() {
    try {
        discordRPC = require('discord-rpc');
        rpcClient = new discordRPC.Client({ transport: 'ipc' });

        rpcClient.on('ready', () => {
            console.log('[Discord] Rich Presence connected!');
            startTimestamp = new Date();
            updateDiscordActivity();
        });

        rpcClient.on('disconnected', () => {
            console.log('[Discord] Disconnected from Discord');
        });

        await rpcClient.login({ clientId: DISCORD_CLIENT_ID });
    } catch (error) {
        console.log('[Discord] Could not connect to Discord:', error.message);
        // Discord not running or RPC disabled - this is fine
    }
}

function updateDiscordActivity(details = 'In the Studio', state = 'Editing Manga') {
    if (!rpcClient) return;

    try {
        rpcClient.setActivity({
            details: details,
            state: state,
            startTimestamp: startTimestamp,
            largeImageKey: 'manga_studio_logo',  // Upload this image in Discord Developer Portal
            largeImageText: 'Manga Studio',
            smallImageKey: 'editing',  // Optional: smaller icon
            smallImageText: 'Editing',
            buttons: [
                { label: 'Get Manga Studio', url: 'https://mangastudio.space' }
            ]
        });
    } catch (error) {
        console.log('[Discord] Activity update error:', error.message);
    }
}

function destroyDiscordRPC() {
    if (rpcClient) {
        try {
            rpcClient.destroy();
            console.log('[Discord] RPC destroyed');
        } catch (error) {
            console.log('[Discord] Destroy error:', error.message);
        }
        rpcClient = null;
    }
}

// ============================================
// WINDOW CREATION
// ============================================

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 800,
        backgroundColor: '#1a1a2e',
        frame: false,
        titleBarStyle: 'hidden',
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            enableWebSQL: false,
            spellcheck: false,
            backgroundThrottling: false,
            devTools: isDev, 
        }
    });

    if (!isDev) {
        mainWindow.removeMenu();
    }

    let shown = false;
    let forceClose = false; 

    // Show window when ready
    mainWindow.webContents.on('did-finish-load', () => {
        if (!shown) {
            console.log('[App] Window ready, showing...');
            mainWindow.maximize();
            mainWindow.show();
            shown = true;
        }
    });

    // Fallback show
    setTimeout(() => {
        if (!shown && mainWindow) {
            console.log('[App] Fallback: showing window');
            mainWindow.maximize();
            mainWindow.show();
            shown = true;
        }
    }, 2000);

    // Handle close - intercept for confirmation (Alt+F4, X button, etc.)
    mainWindow.on('close', (event) => {
        if (!forceClose) {
            event.preventDefault();
            console.log('[App] Close requested, asking renderer for confirmation...');
            mainWindow.webContents.send('close-requested');
        } else {
            console.log('[App] Force close, proceeding...');
            if (pythonProcess) {
                stopPythonServer();
            }
        }
    });

    mainWindow.on('closed', () => {
        console.log('[App] Window closed');
        mainWindow = null;
        if (pythonProcess) stopPythonServer();
    });

    // Listen for close confirmation from renderer
    ipcMain.on('confirm-close', (event, shouldClose) => {
        if (shouldClose) {
            forceClose = true;
            mainWindow?.close();
        }
    });

    // ========== DEV TOOLS DISABLED IN PRODUCTION ==========
    // Block DevTools shortcuts in production
    if (!isDev) {
        mainWindow.webContents.on('before-input-event', (event, input) => {
            // Block F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
            if (input.key === 'F12' ||
                (input.control && input.shift && input.key === 'I') ||
                (input.control && input.shift && input.key === 'J') ||
                (input.control && input.shift && input.key === 'C')) {
                event.preventDefault();
            }
        });
    }

    // Load app
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
        // DevTools DISABLED in production
    }

    return mainWindow;
}

// ============================================
// AUTO UPDATER
// ============================================

function setupAutoUpdater() {
    if (isDev) {
        console.log('[AutoUpdater] Skipping in dev mode');
        return;
    }

    const updater = getAutoUpdater();
    if (!updater) {
        logToFile('[AutoUpdater] Unavailable in this environment');
        return;
    }

    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = true;

    updater.logger = {
        info: (msg) => console.log('[AutoUpdater]', msg),
        warn: (msg) => console.warn('[AutoUpdater]', msg),
        error: (msg) => console.error('[AutoUpdater]', msg)
    };

    updater.on('checking-for-update', () => {
        console.log('[AutoUpdater] Checking for updates...');
        if (mainWindow) {
            mainWindow.webContents.send('update-status', { status: 'checking' });
        }
    });

    updater.on('update-available', (info) => {
        console.log('[AutoUpdater] Update available:', info.version);
        if (mainWindow) {
            mainWindow.webContents.send('update-status', { status: 'available', version: info.version });
        }
    });

    updater.on('update-not-available', () => {
        console.log('[AutoUpdater] No updates available');
        if (mainWindow) {
            mainWindow.webContents.send('update-status', { status: 'not-available' });
        }
    });

    updater.on('download-progress', (progress) => {
        console.log(`[AutoUpdater] Download: ${progress.percent.toFixed(1)}%`);
        if (mainWindow) {
            mainWindow.webContents.send('update-status', {
                status: 'downloading',
                percent: progress.percent,
                transferred: progress.transferred,
                total: progress.total
            });
        }
    });

    updater.on('update-downloaded', (info) => {
        console.log('[AutoUpdater] Update downloaded:', info.version);
        updateDownloaded = true;
        if (mainWindow) {
            mainWindow.webContents.send('update-status', { status: 'downloaded', version: info.version });
        }

        dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Update Ready',
            message: `Version ${info.version} is ready to install.`,
            detail: 'The application will restart to apply the update.',
            buttons: ['Restart Now'],
            defaultId: 0,
            noLink: true
        }).then(() => {
            updater.quitAndInstall(false, true);
        });
    });

    updater.on('error', (error) => {
        console.error('[AutoUpdater] Error:', error);
        if (mainWindow) {
            mainWindow.webContents.send('update-status', { status: 'error', message: error.message });
        }
    });

    // Check for updates after 3 seconds
    setTimeout(() => {
        updater.checkForUpdates().catch((error) => {
            console.error('[AutoUpdater] Check failed:', error);
        });
    }, 3000);
}

// ============================================
// IPC HANDLERS - Updates
// ============================================

ipcMain.handle('check-for-updates', async () => {
    if (isDev) return { status: 'dev-mode' };
    const updater = getAutoUpdater();
    if (!updater) return { status: 'unavailable', message: 'Auto updater is not available in this environment.' };
    try {
        const result = await updater.checkForUpdates();
        return { status: 'checked', info: result };
    } catch (error) {
        return { status: 'error', message: error.message };
    }
});

ipcMain.handle('install-update', () => {
    const updater = getAutoUpdater();
    if (updateDownloaded && updater) {
        updater.quitAndInstall(false, true);
    }
});

// ============================================
// IPC HANDLERS - Window Controls
// ============================================

ipcMain.handle('minimize-window', () => {
    BrowserWindow.getFocusedWindow()?.minimize();
});

ipcMain.handle('maximize-window', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win?.isMaximized()) {
        win.unmaximize();
    } else {
        win?.maximize();
    }
});

ipcMain.handle('close-window', () => {
    BrowserWindow.getFocusedWindow()?.close();
});

// ============================================
// IPC HANDLERS - File Operations
// ============================================

ipcMain.handle('open-file', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
            { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }
        ]
    });

    if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        const fileData = fs.readFileSync(filePath);
        const base64 = fileData.toString('base64');
        const ext = path.extname(filePath).slice(1);
        return {
            path: filePath,
            data: `data:image/${ext};base64,${base64}`
        };
    }
    return null;
});

ipcMain.handle('save-file', async (event, { data, defaultPath }) => {
    const result = await dialog.showSaveDialog({
        defaultPath: defaultPath || 'exported-image.png',
        filters: [
            { name: 'PNG Image', extensions: ['png'] },
            { name: 'JPEG Image', extensions: ['jpg', 'jpeg'] }
        ]
    });

    if (!result.canceled && result.filePath) {
        const base64Data = data.replace(/^data:image\/\w+;base64,/, '');
        fs.writeFileSync(result.filePath, Buffer.from(base64Data, 'base64'));
        return result.filePath;
    }
    return null;
});

ipcMain.handle('save-file-to-path', async (event, { data, filePath }) => {
    try {
        const base64Data = data.replace(/^data:image\/\w+;base64,/, '');
        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
        return { success: true, path: filePath };
    } catch (error) {
        console.error('[IPC] Save file error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory']
    });
    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
});

ipcMain.handle('get-default-export-path', () => {
    return app.getPath('pictures');
});

// ============================================
// IPC HANDLERS - External Links
// ============================================

ipcMain.on('open-external', (event, url) => {
    shell.openExternal(url);
});

// ============================================
// PROJECT MANAGEMENT
// ============================================

function getProjectsDir() {
    const appData = app.getPath('documents');
    const projectsDir = path.join(appData, 'Manga Studio', 'Projects');
    if (!fs.existsSync(projectsDir)) {
        fs.mkdirSync(projectsDir, { recursive: true });
    }
    return projectsDir;
}

function migrateOldProjects() {
    const projectsDir = getProjectsDir();
    const defaultFolder = path.join(projectsDir, '_default');

    try {
        const items = fs.readdirSync(projectsDir).filter(item =>
            item.endsWith('.msp') && fs.statSync(path.join(projectsDir, item)).isFile()
        );

        if (items.length > 0) {
            if (!fs.existsSync(defaultFolder)) {
                fs.mkdirSync(defaultFolder, { recursive: true });
            }
            items.forEach(item => {
                const oldPath = path.join(projectsDir, item);
                const newPath = path.join(defaultFolder, item);
                fs.renameSync(oldPath, newPath);
            });
            console.log(`[Projects] Migrated ${items.length} projects`);
        }
    } catch (error) {
        console.error('[Projects] Migration error:', error);
    }
}

// IPC: Save Project
ipcMain.handle('save-project', async (event, { projectName, folderName, canvasJSON, thumbnail, textManagerLines }) => {
    try {
        const projectsDir = getProjectsDir();
        const folder = folderName || '_default';
        const folderPath = path.join(projectsDir, folder);

        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }

        const name = projectName || `project_${Date.now()}`;
        const filePath = path.join(folderPath, `${name}.msp`);

        let createdAt = new Date().toISOString();
        if (fs.existsSync(filePath)) {
            try {
                const existing = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                createdAt = existing.createdAt || createdAt;
            } catch (e) { }
        }

        const projectData = {
            id: name,
            name: projectName || 'Untitled Project',
            folder: folder,
            createdAt: createdAt,
            updatedAt: new Date().toISOString(),
            canvasJSON: canvasJSON,
            thumbnail: thumbnail,
            textManagerLines: textManagerLines || []
        };

        fs.writeFileSync(filePath, JSON.stringify(projectData, null, 2));
        return { success: true, path: filePath, id: name, folder: folder };
    } catch (error) {
        console.error('[IPC] Save project error:', error);
        return { success: false, error: error.message };
    }
});

// IPC: Create Folder
ipcMain.handle('create-folder', async (event, folderName) => {
    try {
        const projectsDir = getProjectsDir();
        const folderPath = path.join(projectsDir, folderName);

        if (fs.existsSync(folderPath)) {
            return { success: false, error: 'Folder already exists' };
        }

        fs.mkdirSync(folderPath, { recursive: true });
        return { success: true, path: folderPath, name: folderName };
    } catch (error) {
        console.error('[IPC] Create folder error:', error);
        return { success: false, error: error.message };
    }
});

// IPC: Get All Folders and Projects
ipcMain.handle('get-projects', async () => {
    try {
        const projectsDir = getProjectsDir();
        migrateOldProjects();

        const items = fs.readdirSync(projectsDir);
        const folderNames = items.filter(item => {
            const itemPath = path.join(projectsDir, item);
            return fs.statSync(itemPath).isDirectory();
        });

        const folders = folderNames.map(folderName => {
            try {
                const folderPath = path.join(projectsDir, folderName);
                const projectFiles = fs.readdirSync(folderPath).filter(f => f.endsWith('.msp'));

                const projects = projectFiles.map(fileName => {
                    try {
                        const filePath = path.join(folderPath, fileName);
                        const content = fs.readFileSync(filePath, 'utf-8');
                        const data = JSON.parse(content);
                        return {
                            id: data.id,
                            name: data.name,
                            folder: folderName,
                            createdAt: data.createdAt,
                            updatedAt: data.updatedAt,
                            thumbnail: data.thumbnail,
                            path: filePath
                        };
                    } catch (e) {
                        return null;
                    }
                }).filter(Boolean);

                projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

                return {
                    name: folderName,
                    path: folderPath,
                    projectCount: projects.length,
                    projects: projects
                };
            } catch (e) {
                return null;
            }
        }).filter(Boolean);

        // Sort folders (_default first)
        folders.sort((a, b) => {
            if (a.name === '_default') return -1;
            if (b.name === '_default') return 1;
            return a.name.localeCompare(b.name);
        });

        return { success: true, folders: folders };
    } catch (error) {
        console.error('[IPC] Get projects error:', error);
        return { success: false, error: error.message, folders: [] };
    }
});

// IPC: Load Project
ipcMain.handle('load-project', async (event, projectPath) => {
    try {
        const content = fs.readFileSync(projectPath, 'utf-8');
        const project = JSON.parse(content);
        return { success: true, project: project };
    } catch (error) {
        console.error('[IPC] Load project error:', error);
        return { success: false, error: error.message };
    }
});

// IPC: Delete Project
ipcMain.handle('delete-project', async (event, projectPath) => {
    try {
        fs.unlinkSync(projectPath);
        return { success: true };
    } catch (error) {
        console.error('[IPC] Delete project error:', error);
        return { success: false, error: error.message };
    }
});

// ============================================
// APP LIFECYCLE
// ============================================

app.whenReady().then(() => {
    createWindow();
    setupAutoUpdater();
    initDiscordRPC();  // Start Discord Rich Presence

    // Start Python server after a short delay
    setTimeout(() => {
        startPythonServer().catch((error) => {
            logToFile(`[Python] Start error: ${error.message}`);
        });
    }, 500);

    migrateOldProjects();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    stopPythonServer();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    stopPythonServer();
    destroyDiscordRPC();  // Cleanup Discord RPC
});
