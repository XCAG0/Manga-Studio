/**
 * OCR Service - Text Detection
 * Communicates with Python backend for text detection
 */

const OCR_SERVER_URL = 'http://127.0.0.1:8765';

/**
 * Check if OCR server is running
 */
export async function checkOCRServer() {
    try {
        const response = await fetch(`${OCR_SERVER_URL}/health`, {
            method: 'GET',
        });
        console.log('OCR server check:', response.ok);
        return response.ok;
    } catch (error) {
        console.error('OCR server not available:', error);
        return false;
    }
}

/**
 * Detect text in entire image
 * @param {Blob|File} imageData - Image data
 * @param {number} confidence - Minimum confidence (0-1)
 * @returns {Promise<Array>} - Array of detected text with bounding boxes
 */
export async function detectTextInImage(imageData, confidence = 0.4) {
    console.log('detectTextInImage called');
    const formData = new FormData();
    formData.append('file', imageData, 'image.png');

    const response = await fetch(`${OCR_SERVER_URL}/detect-text?confidence=${confidence}`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        throw new Error(`OCR request failed: ${response.statusText}`);
    }

    return await response.json();
}

/**
 * Detect text in a specific region
 * @param {Blob|File} imageData - Image data
 * @param {Object} region - {x1, y1, x2, y2}
 * @param {number} confidence - Minimum confidence (0-1)
 * @returns {Promise<Object>} - Detected text in region
 */
export async function detectTextInRegion(imageData, region, confidence = 0.3) {
    console.log('detectTextInRegion called', region);
    console.log('imageData:', imageData);

    const formData = new FormData();
    formData.append('file', imageData, 'image.png');

    const params = new URLSearchParams({
        x1: String(region.x1),
        y1: String(region.y1),
        x2: String(region.x2),
        y2: String(region.y2),
        confidence: String(confidence)
    });

    console.log('Sending to:', `${OCR_SERVER_URL}/detect-region?${params}`);

    const response = await fetch(`${OCR_SERVER_URL}/detect-region?${params}`, {
        method: 'POST',
        body: formData
    });

    console.log('Response:', response.status);

    if (!response.ok) {
        throw new Error(`OCR request failed: ${response.statusText}`);
    }

    return await response.json();
}

/**
 * Convert canvas to blob (without fetch for Electron compatibility)
 * @param {fabric.Canvas} canvas - Fabric canvas
 * @returns {Promise<Blob>}
 */
export async function canvasToBlob(canvas) {
    console.log('canvasToBlob called');

    return new Promise((resolve, reject) => {
        try {
            const dataUrl = canvas.toDataURL({ format: 'png' });

            // Convert base64 to blob without fetch
            const parts = dataUrl.split(',');
            const mime = parts[0].match(/:(.*?);/)[1];
            const bstr = atob(parts[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);

            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }

            const blob = new Blob([u8arr], { type: mime });
            console.log('Created blob:', blob.size, 'bytes');
            resolve(blob);
        } catch (error) {
            console.error('canvasToBlob error:', error);
            reject(error);
        }
    });
}

/**
 * Extract region from canvas as blob
 * @param {fabric.Canvas} canvas - Fabric canvas
 * @param {Object} region - {x1, y1, x2, y2}
 * @returns {Promise<Blob>}
 */
export async function extractRegionAsBlob(canvas, region) {
    const tempCanvas = document.createElement('canvas');
    const width = region.x2 - region.x1;
    const height = region.y2 - region.y1;

    tempCanvas.width = width;
    tempCanvas.height = height;

    const ctx = tempCanvas.getContext('2d');
    const dataUrl = canvas.toDataURL({ format: 'png' });

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, region.x1, region.y1, width, height, 0, 0, width, height);
            tempCanvas.toBlob(resolve, 'image/png');
        };
        img.onerror = reject;
        img.src = dataUrl;
    });
}
