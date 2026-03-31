const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

function resourceIfExists(from, to, filter = ['**/*']) {
    const absolutePath = path.join(ROOT, from);
    if (!fs.existsSync(absolutePath)) {
        return null;
    }

    return { from, to, filter };
}

const extraResources = [
    resourceIfExists('python-embed', 'python-embed', ['**/*']),
    resourceIfExists('manga-backend', 'manga-backend', ['**/*.py', 'test.png']),
].filter(Boolean);

module.exports = {
    appId: 'com.mangastudio.app',
    productName: 'Manga Studio',
    asar: true,
    compression: 'maximum',
    asarUnpack: ['**/*.node'],
    directories: {
        output: 'dist-electron-portable',
    },
    files: [
        'dist/**/*',
        'electron/**/*',
        '!electron/backup/**',
    ],
    extraResources,
    win: {
        target: [
            {
                target: 'nsis',
                arch: ['x64'],
            },
        ],
        icon: 'public/icon.ico',
    },
    nsis: {
        oneClick: false,
        allowElevation: true,
        allowToChangeInstallationDirectory: true,
        installerIcon: 'public/icon.ico',
        uninstallerIcon: 'public/icon.ico',
        installerHeaderIcon: 'public/icon.ico',
        createDesktopShortcut: 'always',
        createStartMenuShortcut: true,
        shortcutName: 'Manga Studio',
        license: 'LICENSE.txt',
        warningsAsErrors: false,
        perMachine: false,
        runAfterFinish: true,
        deleteAppDataOnUninstall: false,
        menuCategory: true,
        displayLanguageSelector: false,
    },
    portable: {
        artifactName: '${productName}-${version}-portable.${ext}',
    },
};
