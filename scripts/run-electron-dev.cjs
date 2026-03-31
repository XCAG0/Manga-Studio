const { spawn } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const electronBinary = require('electron');
const env = { ...process.env };

if (env.ELECTRON_RUN_AS_NODE) {
    console.log('[Electron Launcher] Clearing ELECTRON_RUN_AS_NODE for normal app startup');
    delete env.ELECTRON_RUN_AS_NODE;
}

const child = spawn(electronBinary, ['.'], {
    cwd: projectRoot,
    env,
    stdio: 'inherit',
    windowsHide: false,
});

child.on('error', (error) => {
    console.error('[Electron Launcher] Failed to start Electron:', error.message);
    process.exit(1);
});

child.on('close', (code) => {
    process.exit(code ?? 0);
});
