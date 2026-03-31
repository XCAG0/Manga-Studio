/**
 * Text Removal Service
 * Handles single-bbox removal and batch bubble cleanup using backend inpainting
 */

import { useEditorStore } from '../store/editorStore';
import { replaceCanvasImageSource } from '../utils/canvas';

const TEXT_REMOVAL_API = 'http://localhost:5000/api';

/**
 * Remove text from image using bbox coordinates
 * @param {Array} bbox - [[x1,y1], [x2,y2], [x3,y3], [x4,y4]] in original image coordinates
 * @param {number} padding - Padding around the bbox for inpainting context
 * @param {Array|null} lineBoxes - Optional array of line bounding boxes for precise masking
 * @returns {Promise<boolean>}
 */
export async function removeTextFromImage(bbox, padding = 10, lineBoxes = null) {
    try {
        const canvas = useEditorStore.getState().canvas;
        if (!canvas) {
            throw new Error('No canvas found');
        }

        const bgImage = getImageByIndex(canvas, 0);
        if (!bgImage || !bgImage._element) {
            throw new Error('No image found on canvas');
        }

        console.log(
            '[TextRemoval] Starting removal for bbox:',
            bbox,
            'padding:',
            padding,
            'lineBoxes:',
            lineBoxes?.length || 0
        );

        const normalizedBbox = normalizeBbox(bbox);
        const imgElement = bgImage._element;
        const originalWidth = imgElement.naturalWidth || imgElement.width;
        const originalHeight = imgElement.naturalHeight || imgElement.height;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = originalWidth;
        tempCanvas.height = originalHeight;
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(imgElement, 0, 0);
        const imageData = tempCanvas.toDataURL('image/png');

        const response = await fetch(`${TEXT_REMOVAL_API}/remove-text-bbox`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image: imageData,
                bbox: normalizedBbox,
                padding,
                lineBoxes: lineBoxes || undefined,
            }),
        });

        if (!response.ok) {
            throw new Error(`Backend error: ${response.statusText}`);
        }

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Processing failed');
        }

        await replaceCanvasImage(canvas, bgImage, result.image);
        useEditorStore.getState().saveState();

        console.log('[TextRemoval] Complete');
        return true;
    } catch (error) {
        console.error('[TextRemoval] Error:', error);
        throw error;
    }
}

/**
 * Apply a batch cleanup mode to detected bubbles on a specific image.
 * Used by Clean Bubbles and Auto Translate when Magic Cleaner is selected.
 */
export async function applyBubbleEditToImage(
    imageBase64,
    bubbles,
    {
        imageIndex = 0,
        editMode = 'magic_cleaner',
        padding = 10,
        magicOptions = null,
        saveHistory = true,
    } = {}
) {
    const canvas = useEditorStore.getState().canvas;
    if (!canvas) {
        throw new Error('No canvas found');
    }

    const targetImage = getImageByIndex(canvas, imageIndex);
    if (!targetImage) {
        throw new Error(`No image found for index ${imageIndex}`);
    }

    if (!Array.isArray(bubbles) || bubbles.length === 0) {
        return {
            success: true,
            count: 0,
            image: imageBase64,
            edit_mode: editMode,
        };
    }

    const response = await fetch(`${TEXT_REMOVAL_API}/apply-bubble-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            image: imageBase64,
            bubbles,
            editMode,
            padding,
            magicOptions,
        }),
    });

    if (!response.ok) {
        throw new Error(`Backend error: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
        throw new Error(result.error || 'Bubble cleanup failed');
    }

    await replaceCanvasImage(canvas, targetImage, result.image);

    if (saveHistory) {
        useEditorStore.getState().saveState();
    }

    return result;
}

function normalizeBbox(bbox) {
    let normalizedBbox = bbox;

    if (!Array.isArray(bbox)) {
        throw new Error('Invalid bbox format');
    }

    if (bbox.length >= 8 && typeof bbox[0] === 'number') {
        normalizedBbox = [
            [bbox[0], bbox[1]],
            [bbox[2], bbox[3]],
            [bbox[4], bbox[5]],
            [bbox[6], bbox[7]],
        ];
    } else if (bbox.length === 4 && typeof bbox[0] === 'number') {
        const [x1, y1, x2, y2] = bbox;
        normalizedBbox = [
            [x1, y1],
            [x2, y1],
            [x2, y2],
            [x1, y2],
        ];
    } else if (bbox.length >= 3 && Array.isArray(bbox[0])) {
        normalizedBbox = bbox.map(point => [
            Math.round(Number(point[0])),
            Math.round(Number(point[1])),
        ]);
    } else {
        throw new Error('Invalid bbox format');
    }

    return normalizedBbox;
}

function getImageByIndex(canvas, imageIndex = 0) {
    const images = canvas.getObjects().filter(obj => obj.type === 'image');
    return images[imageIndex] || images[0] || null;
}

async function replaceCanvasImage(canvas, oldImage, newImageDataUrl) {
    try {
        await replaceCanvasImageSource(canvas, oldImage, newImageDataUrl);
        return true;
    } catch (error) {
        console.error('[TextRemoval] Failed to replace image:', error);
        throw error;
    }
}
