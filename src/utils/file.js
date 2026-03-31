/**
 * Manga Studio - File Utilities
 * Helper functions for file operations
 */

import { FILE } from './constants';

/**
 * Check if file type is supported image format
 * @param {File} file
 * @returns {boolean}
 */
export function isSupportedImageFormat(file) {
    if (!file) return false;

    const extension = file.name.split('.').pop().toLowerCase();
    return FILE.SUPPORTED_FORMATS.includes(extension);
}

/**
 * Read file as data URL (base64)
 * @param {File} file
 * @returns {Promise<string>}
 */
export function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            resolve(event.target.result);
        };

        reader.onerror = (error) => {
            reject(error);
        };

        reader.readAsDataURL(file);
    });
}

/**
 * Get file extension from path
 * @param {string} filePath
 * @returns {string}
 */
export function getFileExtension(filePath) {
    if (!filePath) return '';
    return filePath.split('.').pop().toLowerCase();
}

/**
 * Get file name from path (without extension)
 * @param {string} filePath
 * @returns {string}
 */
export function getFileName(filePath) {
    if (!filePath) return '';
    const name = filePath.split(/[\\/]/).pop();
    return name.split('.').slice(0, -1).join('.');
}

/**
 * Get file name with extension from path
 * @param {string} filePath
 * @returns {string}
 */
export function getFileNameWithExtension(filePath) {
    if (!filePath) return '';
    return filePath.split(/[\\/]/).pop();
}

/**
 * Convert base64 data URL to Blob
 * @param {string} dataURL
 * @returns {Blob}
 */
export function dataURLToBlob(dataURL) {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);

    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }

    return new Blob([u8arr], { type: mime });
}

/**
 * Generate export filename with timestamp
 * @param {string} baseName
 * @param {string} format
 * @returns {string}
 */
export function generateExportFileName(baseName = FILE.DEFAULT_EXPORT_NAME, format = FILE.DEFAULT_EXPORT_FORMAT) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `${baseName}_${timestamp}.${format}`;
}

/**
 * Get MIME type for file format
 * @param {string} format
 * @returns {string}
 */
export function getMimeType(format) {
    return FILE.MIME_TYPES[format.toLowerCase()] || 'image/png';
}

/**
 * Download data as file (browser)
 * @param {string} data - Base64 data URL
 * @param {string} filename
 */
export function downloadFile(data, filename) {
    const link = document.createElement('a');
    link.href = data;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Handle drag and drop file
 * @param {DragEvent} event
 * @returns {File|null}
 */
export function getDroppedFile(event) {
    event.preventDefault();
    event.stopPropagation();

    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return null;

    const file = files[0];
    if (!file.type.startsWith('image/')) return null;

    return file;
}

/**
 * Create file info object
 * @param {string} path
 * @returns {Object}
 */
export function createFileInfo(path) {
    return {
        path: path,
        name: getFileNameWithExtension(path),
        baseName: getFileName(path),
        extension: getFileExtension(path),
    };
}
