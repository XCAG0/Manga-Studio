const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_DIR = path.join(ROOT, 'python-embed');
const BUILD_DIR = path.join(ROOT, '.build');
const TARGET_DIR = path.join(BUILD_DIR, 'python-embed-runtime');
const SUMMARY_PATH = path.join(BUILD_DIR, 'python-runtime-summary.json');

const PRUNE_DIR_NAMES = new Set([
    '__pycache__',
    'tests',
    'docs',
    'doc',
    'examples',
    'example',
    '.pytest_cache',
    '.mypy_cache',
]);

const PRUNE_EXTENSIONS = new Set([
    '.lib',
    '.pdb',
    '.exp',
    '.whl',
]);

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function emptyDir(dirPath) {
    fs.rmSync(dirPath, { recursive: true, force: true });
    ensureDir(dirPath);
}

function normalizeRelative(relativePath) {
    return relativePath.replace(/\\/g, '/');
}

function getStats(filePath) {
    return fs.statSync(filePath, { bigint: false });
}

function shouldSkip(relativePath, isDirectory) {
    const rel = normalizeRelative(relativePath);
    const name = path.basename(rel).toLowerCase();

    if (!rel || rel === '.') {
        return false;
    }

    if (PRUNE_DIR_NAMES.has(name)) {
        return true;
    }

    if (rel === 'dml-site-packages' || rel.startsWith('dml-site-packages/')) {
        return true;
    }

    if (rel === 'Scripts' || rel.startsWith('Scripts/')) {
        return true;
    }

    if (
        rel === 'Lib/site-packages/torch/include' ||
        rel.startsWith('Lib/site-packages/torch/include/')
    ) {
        return true;
    }

    if (
        rel === 'Lib/site-packages/torchgen' ||
        rel.startsWith('Lib/site-packages/torchgen/')
    ) {
        return true;
    }

    if (
        rel === 'Lib/site-packages/paddle/include' ||
        rel.startsWith('Lib/site-packages/paddle/include/')
    ) {
        return true;
    }

    if (
        rel === 'gpu-site-packages/paddle/include' ||
        rel.startsWith('gpu-site-packages/paddle/include/')
    ) {
        return true;
    }

    if (
        rel.includes('/include/') &&
        rel.startsWith('gpu-runtime-packages/nvidia/')
    ) {
        return true;
    }

    if (!isDirectory) {
        const ext = path.extname(name).toLowerCase();
        if (PRUNE_EXTENSIONS.has(ext)) {
            return true;
        }

        if (rel === 'Lib/site-packages/torch/bin/protoc.exe') {
            return true;
        }
    }

    return false;
}

function copyTree(srcDir, dstDir) {
    const stats = {
        copiedFiles: 0,
        copiedBytes: 0,
        skippedFiles: 0,
        skippedBytes: 0,
        skippedPaths: {},
    };

    function registerSkip(relativePath, size) {
        const topLevel = normalizeRelative(relativePath).split('/')[0] || '(root)';
        stats.skippedPaths[topLevel] = (stats.skippedPaths[topLevel] || 0) + size;
    }

    function walk(currentSrc, currentDst) {
        ensureDir(currentDst);

        for (const entry of fs.readdirSync(currentSrc, { withFileTypes: true })) {
            const srcPath = path.join(currentSrc, entry.name);
            const dstPath = path.join(currentDst, entry.name);
            const relativePath = path.relative(srcDir, srcPath);

            if (shouldSkip(relativePath, entry.isDirectory())) {
                const size = entry.isDirectory()
                    ? getDirectorySize(srcPath)
                    : getStats(srcPath).size;
                stats.skippedFiles += entry.isDirectory() ? countFiles(srcPath) : 1;
                stats.skippedBytes += size;
                registerSkip(relativePath, size);
                continue;
            }

            if (entry.isDirectory()) {
                walk(srcPath, dstPath);
                continue;
            }

            fs.copyFileSync(srcPath, dstPath);
            const size = getStats(srcPath).size;
            stats.copiedFiles += 1;
            stats.copiedBytes += size;
        }
    }

    walk(srcDir, dstDir);
    return stats;
}

function getDirectorySize(dirPath) {
    let total = 0;
    const stack = [dirPath];
    while (stack.length) {
        const current = stack.pop();
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const fullPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                stack.push(fullPath);
            } else {
                total += getStats(fullPath).size;
            }
        }
    }
    return total;
}

function countFiles(dirPath) {
    let total = 0;
    const stack = [dirPath];
    while (stack.length) {
        const current = stack.pop();
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const fullPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                stack.push(fullPath);
            } else {
                total += 1;
            }
        }
    }
    return total;
}

function formatMb(bytes) {
    return Number((bytes / (1024 * 1024)).toFixed(2));
}

function writeSummary(summary) {
    ensureDir(path.dirname(SUMMARY_PATH));
    fs.writeFileSync(SUMMARY_PATH, JSON.stringify(summary, null, 2), 'utf8');
}

function preparePythonRuntime() {
    if (!fs.existsSync(SOURCE_DIR)) {
        throw new Error(`python-embed directory not found: ${SOURCE_DIR}`);
    }

    ensureDir(BUILD_DIR);
    emptyDir(TARGET_DIR);

    const sourceBytes = getDirectorySize(SOURCE_DIR);
    const copyStats = copyTree(SOURCE_DIR, TARGET_DIR);
    const targetBytes = getDirectorySize(TARGET_DIR);

    const summary = {
        sourceDir: SOURCE_DIR,
        targetDir: TARGET_DIR,
        sourceSizeMB: formatMb(sourceBytes),
        targetSizeMB: formatMb(targetBytes),
        savedMB: formatMb(sourceBytes - targetBytes),
        copiedFiles: copyStats.copiedFiles,
        skippedFiles: copyStats.skippedFiles,
        skippedByTopLevelMB: Object.fromEntries(
            Object.entries(copyStats.skippedPaths)
                .sort((a, b) => b[1] - a[1])
                .map(([key, bytes]) => [key, formatMb(bytes)])
        ),
    };

    writeSummary(summary);

    console.log(
        `[Python Runtime] Prepared trimmed runtime: ${summary.targetSizeMB} MB ` +
        `(saved ${summary.savedMB} MB)`
    );

    return summary;
}

if (require.main === module) {
    try {
        preparePythonRuntime();
    } catch (error) {
        console.error('[Python Runtime] Preparation failed:', error);
        process.exit(1);
    }
}

module.exports = {
    preparePythonRuntime,
    TARGET_DIR,
};
