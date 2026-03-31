/**
 * useMagicWand Hook - Auto-select areas of similar color
 * Uses flood fill algorithm to fill connected regions with brush color
 */

import { useCallback, useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import { TOOLS } from '../utils/constants';
import { replaceCanvasImageSource } from '../utils/canvas';

export function useMagicWand() {
    const toleranceRef = useRef(32); // Default tolerance (0-255)

    /**
     * Get pixel color at coordinates
     */
    const getPixelColor = (imageData, x, y) => {
        const idx = (y * imageData.width + x) * 4;
        return {
            r: imageData.data[idx],
            g: imageData.data[idx + 1],
            b: imageData.data[idx + 2],
            a: imageData.data[idx + 3]
        };
    };

    /**
     * Check if two colors match within tolerance
     */
    const colorMatch = (c1, c2, tolerance) => {
        return Math.abs(c1.r - c2.r) <= tolerance &&
            Math.abs(c1.g - c2.g) <= tolerance &&
            Math.abs(c1.b - c2.b) <= tolerance;
    };

    /**
     * Flood fill algorithm to find connected region
     */
    const floodFill = (imageData, startX, startY, tolerance) => {
        const width = imageData.width;
        const height = imageData.height;

        // Bounds check
        if (startX < 0 || startX >= width || startY < 0 || startY >= height) {
            return { pixels: [], bounds: null };
        }

        const targetColor = getPixelColor(imageData, startX, startY);
        const visited = new Uint8Array(width * height);
        const pixels = [];

        let minX = startX, maxX = startX;
        let minY = startY, maxY = startY;

        // Queue-based flood fill
        const queue = [[startX, startY]];
        const maxPixels = 500000;

        while (queue.length > 0 && pixels.length < maxPixels) {
            const [x, y] = queue.shift();

            if (x < 0 || x >= width || y < 0 || y >= height) continue;

            const idx = y * width + x;
            if (visited[idx]) continue;

            const currentColor = getPixelColor(imageData, x, y);
            if (!colorMatch(targetColor, currentColor, tolerance)) continue;

            visited[idx] = 1;
            pixels.push([x, y]);

            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);

            queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }

        return {
            pixels,
            bounds: { minX, minY, maxX, maxY }
        };
    };

    /**
     * Fill pixels with color on the image
     */
    const fillPixelsOnImage = (canvas, pixels, fillColor) => {
        if (pixels.length === 0) return;

        // Find background image
        const objects = canvas.getObjects();
        const bgImage = objects.find(obj => obj.isBackgroundImage || obj.type === 'image');

        if (!bgImage) {
            console.log('No background image found');
            return;
        }

        const imgElement = bgImage._element || bgImage.getElement();
        if (!imgElement) return;

        // Create temp canvas
        const tempCanvas = document.createElement('canvas');
        const imgWidth = imgElement.naturalWidth || imgElement.width;
        const imgHeight = imgElement.naturalHeight || imgElement.height;
        tempCanvas.width = imgWidth;
        tempCanvas.height = imgHeight;
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(imgElement, 0, 0);

        // Fill pixels
        ctx.fillStyle = fillColor;
        for (const [x, y] of pixels) {
            ctx.fillRect(x, y, 1, 1);
        }

        // Create new image
        const newDataUrl = tempCanvas.toDataURL('image/png');

        replaceCanvasImageSource(canvas, bgImage, newDataUrl, {
            objectProps: {
                left: bgImage.left || 0,
                top: bgImage.top || 0,
                scaleX: bgImage.scaleX || 1,
                scaleY: bgImage.scaleY || 1,
                isBackgroundImage: bgImage.isBackgroundImage,
            },
        }).then(() => {
            canvas.renderAll();

            useEditorStore.getState().saveState();
            console.log(`Filled ${pixels.length} pixels with ${fillColor}`);
        });
    };

    /**
     * Initialize magic wand events on canvas
     */
    const initMagicWandEvents = useCallback((canvas) => {
        if (!canvas) return;

        const handleMouseDown = (opt) => {
            const { activeTool, brushColor } = useEditorStore.getState();

            // Only work when magic wand is active
            if (activeTool !== TOOLS.MAGIC_WAND) return;

            console.log('Magic Wand: Click detected');

            const pointer = canvas.getPointer(opt.e);

            // Find background image
            const objects = canvas.getObjects();
            const bgImage = objects.find(obj => obj.isBackgroundImage || obj.type === 'image');

            if (!bgImage) {
                alert('يرجى تحميل صوره اولاً');
                return;
            }

            const imgElement = bgImage._element || bgImage.getElement();
            if (!imgElement) {
                console.log('No image element found');
                return;
            }

            // Convert pointer to image coordinates
            const scaleX = bgImage.scaleX || 1;
            const scaleY = bgImage.scaleY || 1;
            const imgX = Math.floor((pointer.x - (bgImage.left || 0)) / scaleX);
            const imgY = Math.floor((pointer.y - (bgImage.top || 0)) / scaleY);

            console.log(`Click at image coords: (${imgX}, ${imgY})`);

            // Get image data
            const tempCanvas = document.createElement('canvas');
            const imgWidth = imgElement.naturalWidth || imgElement.width;
            const imgHeight = imgElement.naturalHeight || imgElement.height;
            tempCanvas.width = imgWidth;
            tempCanvas.height = imgHeight;
            const ctx = tempCanvas.getContext('2d');
            ctx.drawImage(imgElement, 0, 0);

            const imageData = ctx.getImageData(0, 0, imgWidth, imgHeight);

            // Run flood fill
            const tolerance = toleranceRef.current;
            console.log(`Running flood fill with tolerance ${tolerance}`);

            const { pixels, bounds } = floodFill(imageData, imgX, imgY, tolerance);

            if (pixels.length === 0) {
                console.log('No pixels selected');
                return;
            }

            console.log(`Selected ${pixels.length} pixels`);

            // Fill with brush color
            const fillColor = brushColor || '#ffffff';
            fillPixelsOnImage(canvas, pixels, fillColor);
        };

        canvas.on('mouse:down', handleMouseDown);

        return () => {
            canvas.off('mouse:down', handleMouseDown);
        };
    }, []);

    /**
     * Setup magic wand (called when tool is selected)
     */
    const setupMagicWand = useCallback((canvas) => {
        console.log('Magic Wand tool activated');
    }, []);

    /**
     * Deactivate magic wand
     */
    const deactivateMagicWand = useCallback((canvas) => {
        console.log('Magic Wand tool deactivated');
    }, []);

    /**
     * Set tolerance (0-255)
     */
    const setTolerance = useCallback((value) => {
        toleranceRef.current = Math.max(0, Math.min(255, value));
    }, []);

    return {
        initMagicWandEvents,
        setupMagicWand,
        deactivateMagicWand,
        setTolerance,
        getTolerance: () => toleranceRef.current
    };
}
