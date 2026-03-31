/**
 * useColorReplace Hook
 * Draw rectangle and replace all pixels of source color with target color
 */

import { useCallback, useRef } from 'react';
import * as fabric from 'fabric';
import { useEditorStore } from '../store/editorStore';
import { TOOLS } from '../utils/constants';
import { replaceCanvasImageSource } from '../utils/canvas';

export function useColorReplace() {
    const isDrawingRef = useRef(false);
    const startPointRef = useRef({ x: 0, y: 0 });
    const rectRef = useRef(null);

    // Default colors - can be customized via store
    const sourceColorRef = useRef('#000000'); // Color to remove (black/text)
    const targetColorRef = useRef('#ffffff'); // Replacement color (white)
    const toleranceRef = useRef(50);          // Tolerance 0-255

    /**
     * Check if colors match within tolerance
     */
    const colorMatch = (r1, g1, b1, r2, g2, b2, tolerance) => {
        return Math.abs(r1 - r2) <= tolerance &&
            Math.abs(g1 - g2) <= tolerance &&
            Math.abs(b1 - b2) <= tolerance;
    };

    /**
     * Parse hex color to RGB
     */
    const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    };

    /**
     * Replace colors in rectangle region
     */
    const replaceColorsInRegion = (canvas, x1, y1, x2, y2) => {
        // Find background image
        const objects = canvas.getObjects();
        const bgImage = objects.find(obj => obj.isBackgroundImage || obj.type === 'image');

        if (!bgImage) {
            alert('يرجى تحميل صوره اولاً');
            return;
        }

        const imgElement = bgImage._element || bgImage.getElement();
        if (!imgElement) return;

        // Convert canvas coords to image coords
        const scaleX = bgImage.scaleX || 1;
        const scaleY = bgImage.scaleY || 1;
        const imgLeft = bgImage.left || 0;
        const imgTop = bgImage.top || 0;

        // Image coordinates
        const imgX1 = Math.max(0, Math.floor((x1 - imgLeft) / scaleX));
        const imgY1 = Math.max(0, Math.floor((y1 - imgTop) / scaleY));
        const imgX2 = Math.floor((x2 - imgLeft) / scaleX);
        const imgY2 = Math.floor((y2 - imgTop) / scaleY);

        // Create offscreen canvas
        const tempCanvas = document.createElement('canvas');
        const imgWidth = imgElement.naturalWidth || imgElement.width;
        const imgHeight = imgElement.naturalHeight || imgElement.height;
        tempCanvas.width = imgWidth;
        tempCanvas.height = imgHeight;
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(imgElement, 0, 0);

        // Get image data
        const imageData = ctx.getImageData(0, 0, imgWidth, imgHeight);
        const data = imageData.data;

        // Get colors from editorStore (persistent settings)
        const state = useEditorStore.getState();
        const sourceColor = state.colorReplaceSource || '#000000';
        const targetColor = state.colorReplaceTarget || '#ffffff';
        const tolerance = state.colorReplaceTolerance || 50;

        console.log(`Color Replace: Source=${sourceColor}, Target=${targetColor}, Tolerance=${tolerance}`);

        // Parse colors
        const source = hexToRgb(sourceColor);
        const target = hexToRgb(targetColor);

        // Clamp coordinates
        const rx1 = Math.max(0, Math.min(imgX1, imgWidth));
        const ry1 = Math.max(0, Math.min(imgY1, imgHeight));
        const rx2 = Math.max(0, Math.min(imgX2, imgWidth));
        const ry2 = Math.max(0, Math.min(imgY2, imgHeight));

        let replacedCount = 0;

        // First pass: Replace colors in region
        for (let y = ry1; y < ry2; y++) {
            for (let x = rx1; x < rx2; x++) {
                const idx = (y * imgWidth + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];

                if (colorMatch(r, g, b, source.r, source.g, source.b, tolerance)) {
                    data[idx] = target.r;
                    data[idx + 1] = target.g;
                    data[idx + 2] = target.b;
                    replacedCount++;
                }
            }
        }

        // Second pass: Clean up isolated dark pixels (anti-aliasing artifacts)
        // Run multiple passes to catch all edge pixels
        for (let pass = 0; pass < 5; pass++) {
            for (let y = ry1 + 1; y < ry2 - 1; y++) {
                for (let x = rx1 + 1; x < rx2 - 1; x++) {
                    const idx = (y * imgWidth + x) * 4;
                    const r = data[idx];
                    const g = data[idx + 1];
                    const b = data[idx + 2];

                    // Skip if already target color
                    if (r === target.r && g === target.g && b === target.b) continue;

                    // Check if pixel is darker than target (potential leftover)
                    const brightness = (r + g + b) / 3;
                    const targetBrightness = (target.r + target.g + target.b) / 3;

                    // If pixel is darker than target minus a threshold, check neighbors
                    if (brightness < targetBrightness - 10) {
                        // Check if ANY neighbor is target color
                        let hasTargetNeighbor = false;
                        const neighbors = [
                            [-1, 0], [1, 0], [0, -1], [0, 1],
                            [-1, -1], [1, -1], [-1, 1], [1, 1]
                        ];

                        for (const [dx, dy] of neighbors) {
                            const nIdx = ((y + dy) * imgWidth + (x + dx)) * 4;
                            if (data[nIdx] === target.r && data[nIdx + 1] === target.g && data[nIdx + 2] === target.b) {
                                hasTargetNeighbor = true;
                                break;
                            }
                        }

                        // Replace if HAS ANY target neighbor (very aggressive)
                        if (hasTargetNeighbor) {
                            data[idx] = target.r;
                            data[idx + 1] = target.g;
                            data[idx + 2] = target.b;
                            replacedCount++;
                        }
                    }
                }
            }
        }

        if (replacedCount === 0) {
            console.log('No matching colors found');
            return;
        }

        // Put modified image data back
        ctx.putImageData(imageData, 0, 0);

        // Create new fabric image
        const newDataUrl = tempCanvas.toDataURL('image/png');

        replaceCanvasImageSource(canvas, bgImage, newDataUrl, {
            objectProps: {
                left: imgLeft,
                top: imgTop,
                scaleX,
                scaleY,
                isBackgroundImage: bgImage.isBackgroundImage,
            },
        }).then(() => {
            canvas.renderAll();

            useEditorStore.getState().saveState();
            console.log(`Replaced ${replacedCount} pixels`);
        });
    };

    /**
     * Initialize color replace events
     */
    const initColorReplaceEvents = useCallback((canvas) => {
        if (!canvas) return;

        const handleMouseDown = (opt) => {
            const { activeTool } = useEditorStore.getState();
            if (activeTool !== TOOLS.COLOR_REPLACE) return;

            isDrawingRef.current = true;
            const pointer = canvas.getPointer(opt.e);
            startPointRef.current = { x: pointer.x, y: pointer.y };

            // Create selection rectangle
            rectRef.current = new fabric.Rect({
                left: pointer.x,
                top: pointer.y,
                width: 0,
                height: 0,
                fill: 'rgba(0, 120, 255, 0.2)',
                stroke: '#0078ff',
                strokeWidth: 2,
                strokeDashArray: [5, 5],
                selectable: false,
                evented: false
            });

            canvas.add(rectRef.current);
        };

        const handleMouseMove = (opt) => {
            if (!isDrawingRef.current || !rectRef.current) return;

            const { activeTool } = useEditorStore.getState();
            if (activeTool !== TOOLS.COLOR_REPLACE) return;

            const pointer = canvas.getPointer(opt.e);
            const startX = startPointRef.current.x;
            const startY = startPointRef.current.y;

            const left = Math.min(startX, pointer.x);
            const top = Math.min(startY, pointer.y);
            const width = Math.abs(pointer.x - startX);
            const height = Math.abs(pointer.y - startY);

            rectRef.current.set({ left, top, width, height });
            canvas.renderAll();
        };

        const handleMouseUp = (opt) => {
            if (!isDrawingRef.current || !rectRef.current) return;

            const { activeTool } = useEditorStore.getState();
            if (activeTool !== TOOLS.COLOR_REPLACE) return;

            isDrawingRef.current = false;

            const rect = rectRef.current;
            const x1 = rect.left;
            const y1 = rect.top;
            const x2 = rect.left + rect.width;
            const y2 = rect.top + rect.height;

            // Remove selection rectangle
            canvas.remove(rectRef.current);
            rectRef.current = null;
            canvas.renderAll();

            // Only process if rectangle is meaningful size
            if (rect.width > 5 && rect.height > 5) {
                console.log(`Color Replace: region (${x1.toFixed(0)},${y1.toFixed(0)}) to (${x2.toFixed(0)},${y2.toFixed(0)})`);
                replaceColorsInRegion(canvas, x1, y1, x2, y2);
            }
        };

        canvas.on('mouse:down', handleMouseDown);
        canvas.on('mouse:move', handleMouseMove);
        canvas.on('mouse:up', handleMouseUp);

        return () => {
            canvas.off('mouse:down', handleMouseDown);
            canvas.off('mouse:move', handleMouseMove);
            canvas.off('mouse:up', handleMouseUp);
        };
    }, []);

    /**
     * Setup color replace tool
     */
    const setupColorReplace = useCallback((canvas) => {
        console.log('Color Replace tool activated');
        console.log(`Source: ${sourceColorRef.current}, Target: ${targetColorRef.current}, Tolerance: ${toleranceRef.current}`);
    }, []);

    /**
     * Set colors and tolerance
     */
    const setSourceColor = (color) => { sourceColorRef.current = color; };
    const setTargetColor = (color) => { targetColorRef.current = color; };
    const setTolerance = (value) => { toleranceRef.current = Math.max(0, Math.min(255, value)); };

    return {
        initColorReplaceEvents,
        setupColorReplace,
        setSourceColor,
        setTargetColor,
        setTolerance,
        getSourceColor: () => sourceColorRef.current,
        getTargetColor: () => targetColorRef.current,
        getTolerance: () => toleranceRef.current
    };
}
