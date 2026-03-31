/**
 * Manga Studio - Bubble Cleaner Utility
 * Uses Tesseract.js for real OCR-based text detection
 * Then fills detected text bounding boxes with white
 */

import Tesseract from 'tesseract.js';

// Store worker instance for reuse
let tesseractWorker = null;

/**
 * Initialize Tesseract worker (call once)
 */
async function getWorker() {
    if (!tesseractWorker) {
        console.log('Initializing Tesseract.js worker...');
        try {
            tesseractWorker = await Tesseract.createWorker('eng', 1, {
                logger: m => console.log('Tesseract:', m.status, m.progress ? Math.round(m.progress * 100) + '%' : '')
            });
            console.log('Tesseract.js worker ready');
        } catch (error) {
            console.error('Failed to create Tesseract worker:', error);
            throw new Error('Failed to initialize OCR engine: ' + (error.message || String(error)));
        }
    }
    return tesseractWorker;
}

/**
 * Detect text regions using Tesseract.js OCR
 * @param {string} imageDataUrl - Base64 image data URL
 * @returns {Array} - Array of bounding boxes {x0, y0, x1, y1}
 */
export async function detectTextRegions(imageDataUrl) {
    try {
        const worker = await getWorker();

        console.log('Running OCR to detect text...');
        const result = await worker.recognize(imageDataUrl);

        const textBoxes = [];

        // Get word-level bounding boxes
        if (result.data && result.data.words) {
            result.data.words.forEach(word => {
                if (word.confidence > 50) { // Lower threshold
                    textBoxes.push({
                        x0: word.bbox.x0,
                        y0: word.bbox.y0,
                        x1: word.bbox.x1,
                        y1: word.bbox.y1,
                        text: word.text,
                        confidence: word.confidence
                    });
                }
            });
        }

        console.log(`Detected ${textBoxes.length} text regions`);
        return textBoxes;
    } catch (error) {
        console.error('OCR detection failed:', error);
        throw new Error('OCR failed: ' + (error.message || String(error)));
    }
}

/**
 * Clean text from image by filling detected regions with white
 * @param {HTMLCanvasElement} canvas - Canvas to clean
 * @param {Array} textBoxes - Array of bounding boxes
 */
export function cleanTextRegions(canvas, textBoxes) {
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'white';

    textBoxes.forEach(box => {
        const width = box.x1 - box.x0;
        const height = box.y1 - box.y0;

        // Add padding around text
        const padding = 3;
        ctx.fillRect(
            box.x0 - padding,
            box.y0 - padding,
            width + padding * 2,
            height + padding * 2
        );
    });

    console.log(`Cleaned ${textBoxes.length} text regions`);
}

/**
 * Main function: Clean bubbles from Fabric.js canvas
 * @param {fabric.Canvas} fabricCanvas
 */
export async function cleanFabricCanvas(fabricCanvas) {
    if (!fabricCanvas) {
        throw new Error('No canvas provided');
    }

    console.log('Starting bubble cleaning with Tesseract.js...');

    // Get canvas as data URL
    const dataUrl = fabricCanvas.toDataURL({ format: 'png' });
    console.log('Got canvas data URL');

    // Detect text using Tesseract.js
    const textBoxes = await detectTextRegions(dataUrl);

    if (textBoxes.length === 0) {
        throw new Error('No text detected. The image may not contain readable text.');
    }

    // Create temp canvas for cleaning
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = fabricCanvas.width;
    tempCanvas.height = fabricCanvas.height;
    const tempCtx = tempCanvas.getContext('2d');

    // Load and process image
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = async () => {
            try {
                // Draw original
                tempCtx.drawImage(img, 0, 0);

                // Clean text regions
                cleanTextRegions(tempCanvas, textBoxes);

                // Convert to data URL
                const cleanedDataUrl = tempCanvas.toDataURL('image/png');

                // Create new fabric image
                const cleanedImg = new Image();
                cleanedImg.onload = () => {
                    import('fabric').then((fabricModule) => {
                        const fabric = fabricModule.fabric || fabricModule;

                        // Create fabric image
                        const newFabricImg = new fabric.Image(cleanedImg, {
                            left: 0,
                            top: 0,
                            selectable: false,
                            evented: false,
                        });

                        // Remove old images
                        const objects = fabricCanvas.getObjects();
                        objects.forEach(obj => {
                            if (obj.type === 'image' || String(obj.type).toLowerCase().includes('image')) {
                                fabricCanvas.remove(obj);
                            }
                        });

                        // Add cleaned image
                        fabricCanvas.add(newFabricImg);

                        // Move to back
                        try {
                            newFabricImg.moveTo(0);
                        } catch (e) {
                            // Ignore
                        }

                        fabricCanvas.renderAll();
                        console.log('Canvas updated successfully!');
                        resolve(textBoxes.length);
                    }).catch(err => {
                        reject(new Error('Failed to create image: ' + (err.message || String(err))));
                    });
                };
                cleanedImg.onerror = () => reject(new Error('Failed to load cleaned image'));
                cleanedImg.src = cleanedDataUrl;

            } catch (err) {
                reject(new Error('Processing error: ' + (err.message || String(err))));
            }
        };
        img.onerror = () => reject(new Error('Failed to load canvas image'));
        img.src = dataUrl;
    });
}

/**
 * Terminate Tesseract worker (call when done)
 */
export async function terminateWorker() {
    if (tesseractWorker) {
        await tesseractWorker.terminate();
        tesseractWorker = null;
        console.log('Tesseract worker terminated');
    }
}
