/**
 * Manga Studio - Professional Healing Tool
 * Implements Telea-style Fast Marching Method with gradient-aware interpolation
 * Produces professional results similar to Photoshop
 */

import { useCallback, useRef } from 'react';
import * as fabric from 'fabric';
import { useEditorStore } from '../store/editorStore';
import { TOOLS, HEALING } from '../utils/constants';
import { replaceCanvasImageSource } from '../utils/canvas';

export function useHealingTool() {
    const isHealing = useRef(false);
    const healCanvas = useRef(null);
    const healCtx = useRef(null);
    const originalImageData = useRef(null);
    const strokePath = useRef([]);

    const initHealingEvents = useCallback((canvas) => {
        if (!canvas) return;

        const handleMouseDown = (opt) => {
            const { activeTool, healingSize } = useEditorStore.getState();
            if (activeTool !== TOOLS.HEALING) return;

            const bgImage = canvas.getObjects().find(obj => obj.type === 'image');
            if (!bgImage || !bgImage._element) {
                console.warn('[Healing] No image found');
                return;
            }

            isHealing.current = true;
            strokePath.current = [];

            // Objects are already disabled by Canvas.jsx when HEALING tool is selected
            // No need to save/restore properties here

            const imgEl = bgImage._element;
            const imgWidth = bgImage.width;
            const imgHeight = bgImage.height;

            healCanvas.current = document.createElement('canvas');
            healCanvas.current.width = imgWidth;
            healCanvas.current.height = imgHeight;
            healCtx.current = healCanvas.current.getContext('2d');
            healCtx.current.drawImage(imgEl, 0, 0, imgWidth, imgHeight);

            originalImageData.current = {
                bgImage,
                imgWidth,
                imgHeight,
                left: bgImage.left || 0,
                top: bgImage.top || 0,
                scaleX: bgImage.scaleX || 1,
                scaleY: bgImage.scaleY || 1,
            };

            const pointer = canvas.getPointer(opt.e);
            const { x, y } = canvasToImageCoords(pointer.x, pointer.y);
            strokePath.current.push({ x, y });
            drawPreviewCircle(canvas, pointer.x, pointer.y, healingSize || HEALING.SIZE_DEFAULT);
        };

        const handleMouseMove = (opt) => {
            if (!isHealing.current || !healCtx.current) return;

            const { activeTool, healingSize } = useEditorStore.getState();
            if (activeTool !== TOOLS.HEALING) return;

            const pointer = canvas.getPointer(opt.e);
            const { x, y } = canvasToImageCoords(pointer.x, pointer.y);
            strokePath.current.push({ x, y });
            drawPreviewCircle(canvas, pointer.x, pointer.y, healingSize || HEALING.SIZE_DEFAULT);
        };

        const handleMouseUp = async () => {
            if (!isHealing.current) return;
            isHealing.current = false;

            removePreviewCircles(canvas);

            // Objects stay disabled - Canvas.jsx will re-enable them when user switches tools

            if (!healCanvas.current || strokePath.current.length === 0) return;

            const { healingSize } = useEditorStore.getState();

            // Debug logging
            console.log('[Healing] Processing with brushSize:', healingSize);
            console.log('[Healing] Stroke points:', strokePath.current.length);
            console.log('[Healing] Image scale:', originalImageData.current?.scaleX);

            await processTelaInpainting(canvas, healingSize || HEALING.SIZE_DEFAULT);
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

    const canvasToImageCoords = (canvasX, canvasY) => {
        if (!originalImageData.current) return { x: 0, y: 0 };
        const { left, top, scaleX, scaleY } = originalImageData.current;
        // Safe division check
        const safeScaleX = scaleX || 1;
        const safeScaleY = scaleY || 1;
        return {
            x: Math.round((canvasX - left) / safeScaleX),
            y: Math.round((canvasY - top) / safeScaleY),
        };
    };

    const drawPreviewCircle = (canvas, x, y, size) => {
        const circle = new fabric.Circle({
            left: x - size / 2,
            top: y - size / 2,
            radius: size / 2,
            fill: 'rgba(100, 200, 255, 0.25)',
            stroke: 'rgba(100, 200, 255, 0.6)',
            strokeWidth: 1,
            selectable: false,
            evented: false,
            isHealingPreview: true,
        });
        canvas.add(circle);
        canvas.renderAll();
    };

    const removePreviewCircles = (canvas) => {
        const previews = canvas.getObjects().filter(obj => obj.isHealingPreview);
        previews.forEach(p => canvas.remove(p));
        canvas.renderAll();
    };

    /**
     * Telea-style Fast Marching Inpainting
     * Key insight: Weight neighbors by direction perpendicular to gradient (isophote direction)
     */
    const processTelaInpainting = async (canvas, brushSize) => {
        if (!healCtx.current || !originalImageData.current) return;

        const ctx = healCtx.current;
        const { imgWidth, imgHeight, scaleX, scaleY } = originalImageData.current;

        // Adjust brush size for image scale (important for high zoom)
        // When zoomed in, the visible brush is larger, but we need the actual pixel radius
        const effectiveSize = Math.max(brushSize / (scaleX || 1), 3); // Minimum 3px
        const radius = Math.max(2, Math.round(effectiveSize / 2)); // Minimum radius 2

        // Get bounds with extra margin for small strokes
        const margin = Math.max(radius, 4); // At least 4px margin
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        strokePath.current.forEach(p => {
            minX = Math.min(minX, p.x - margin);
            minY = Math.min(minY, p.y - margin);
            maxX = Math.max(maxX, p.x + margin);
            maxY = Math.max(maxY, p.y + margin);
        });

        minX = Math.max(0, Math.floor(minX));
        minY = Math.max(0, Math.floor(minY));
        maxX = Math.min(imgWidth - 1, Math.ceil(maxX));
        maxY = Math.min(imgHeight - 1, Math.ceil(maxY));

        const regionWidth = maxX - minX + 1;
        const regionHeight = maxY - minY + 1;

        // Debug logging
        console.log('[Healing] Effective radius:', radius, 'Region:', regionWidth, 'x', regionHeight);

        // Skip if region is too small to process
        if (regionWidth < 3 || regionHeight < 3) {
            console.warn('[Healing] Region too small, minimum 3x3 required');
            return;
        }

        // Get image data
        const imageData = ctx.getImageData(minX, minY, regionWidth, regionHeight);
        const pixels = imageData.data;

        // Create working arrays
        // mask: 0=known, 1=unknown (to inpaint), 2=boundary
        const mask = new Uint8Array(regionWidth * regionHeight);
        const distance = new Float32Array(regionWidth * regionHeight);

        // Initialize mask
        for (let y = 0; y < regionHeight; y++) {
            for (let x = 0; x < regionWidth; x++) {
                const imgX = x + minX;
                const imgY = y + minY;
                let isInStroke = false;

                for (const p of strokePath.current) {
                    const dx = imgX - p.x;
                    const dy = imgY - p.y;
                    if (dx * dx + dy * dy <= radius * radius) {
                        isInStroke = true;
                        break;
                    }
                }

                const idx = y * regionWidth + x;
                mask[idx] = isInStroke ? 1 : 0;
                distance[idx] = isInStroke ? Infinity : 0;
            }
        }

        // Mark boundary pixels (unknown pixels adjacent to known)
        const boundary = [];
        for (let y = 1; y < regionHeight - 1; y++) {
            for (let x = 1; x < regionWidth - 1; x++) {
                const idx = y * regionWidth + x;
                if (mask[idx] === 1) {
                    // Check if adjacent to known pixel
                    const hasKnownNeighbor =
                        mask[idx - 1] === 0 ||
                        mask[idx + 1] === 0 ||
                        mask[idx - regionWidth] === 0 ||
                        mask[idx + regionWidth] === 0;

                    if (hasKnownNeighbor) {
                        mask[idx] = 2; // boundary
                        distance[idx] = 1;
                        boundary.push({ x, y, dist: 1 });
                    }
                }
            }
        }

        // Sort boundary by distance (Fast Marching)
        boundary.sort((a, b) => a.dist - b.dist);

        // Process pixels in order of distance from boundary
        while (boundary.length > 0) {
            const current = boundary.shift();
            const { x, y } = current;
            const idx = y * regionWidth + x;

            if (mask[idx] === 0) continue; // Already processed

            // Inpaint this pixel using gradient-aware interpolation
            inpaintPixel(pixels, regionWidth, regionHeight, x, y, mask, distance);
            mask[idx] = 0; // Mark as known

            // Add unknown neighbors to boundary
            const neighbors = [
                { dx: -1, dy: 0 },
                { dx: 1, dy: 0 },
                { dx: 0, dy: -1 },
                { dx: 0, dy: 1 },
            ];

            for (const n of neighbors) {
                const nx = x + n.dx;
                const ny = y + n.dy;
                if (nx < 1 || nx >= regionWidth - 1 || ny < 1 || ny >= regionHeight - 1) continue;

                const nIdx = ny * regionWidth + nx;
                if (mask[nIdx] === 1) {
                    mask[nIdx] = 2;
                    const newDist = distance[idx] + 1;
                    distance[nIdx] = newDist;

                    // Insert in sorted order
                    let inserted = false;
                    for (let i = 0; i < boundary.length; i++) {
                        if (boundary[i].dist > newDist) {
                            boundary.splice(i, 0, { x: nx, y: ny, dist: newDist });
                            inserted = true;
                            break;
                        }
                    }
                    if (!inserted) {
                        boundary.push({ x: nx, y: ny, dist: newDist });
                    }
                }
            }
        }

        ctx.putImageData(imageData, minX, minY);
        await applyHealedResult(canvas);
    };

    /**
     * Inpaint a single pixel using Telea's method
     * Weights neighbors by:
     * 1. Distance weight (closer = more weight)
     * 2. Directional weight (perpendicular to gradient = more weight)
     * 3. Level-line (isophote) weight
     */
    const inpaintPixel = (pixels, width, height, x, y, mask, distance) => {
        const idx = y * width + x;
        const pIdx = idx * 4;

        let sumR = 0, sumG = 0, sumB = 0;
        let totalWeight = 0;

        // Sample from 8-connected neighborhood, but look further for known pixels
        const searchRadius = 5;

        for (let dy = -searchRadius; dy <= searchRadius; dy++) {
            for (let dx = -searchRadius; dx <= searchRadius; dx++) {
                if (dx === 0 && dy === 0) continue;

                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

                const nIdx = ny * width + nx;
                if (mask[nIdx] !== 0) continue; // Only use known pixels

                const nPIdx = nIdx * 4;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // Distance weight: closer pixels have more influence
                const distWeight = 1 / (dist * dist + 0.1);

                // Direction weight: favor pixels aligned with the likely gradient direction
                // Calculate gradient at neighbor
                const gx = getGradientX(pixels, width, height, nx, ny, mask);
                const gy = getGradientY(pixels, width, height, nx, ny, mask);
                const gradMag = Math.sqrt(gx * gx + gy * gy) + 0.001;

                // Direction from neighbor to current pixel
                const dirX = -dx / dist;
                const dirY = -dy / dist;

                // Isophote direction (perpendicular to gradient)
                const isoX = -gy / gradMag;
                const isoY = gx / gradMag;

                // Weight by alignment with isophote (perpendicular to gradient)
                const dotProduct = Math.abs(dirX * isoX + dirY * isoY);
                const dirWeight = 0.5 + 0.5 * dotProduct;

                // Level line continuity weight
                const levelWeight = 1 / (1 + distance[nIdx]);

                const weight = distWeight * dirWeight * levelWeight;

                sumR += pixels[nPIdx] * weight;
                sumG += pixels[nPIdx + 1] * weight;
                sumB += pixels[nPIdx + 2] * weight;
                totalWeight += weight;
            }
        }

        if (totalWeight > 0) {
            pixels[pIdx] = Math.round(sumR / totalWeight);
            pixels[pIdx + 1] = Math.round(sumG / totalWeight);
            pixels[pIdx + 2] = Math.round(sumB / totalWeight);
        }
    };

    /**
     * Calculate gradient in X direction using Sobel operator
     */
    const getGradientX = (pixels, width, height, x, y, mask) => {
        if (x <= 0 || x >= width - 1) return 0;

        const getPixelValue = (px, py) => {
            if (px < 0 || px >= width || py < 0 || py >= height) return 128;
            const idx = py * width + px;
            if (mask[idx] !== 0) return 128; // Unknown pixel, use neutral
            const pIdx = idx * 4;
            return (pixels[pIdx] + pixels[pIdx + 1] + pixels[pIdx + 2]) / 3;
        };

        // Sobel X: [-1 0 1; -2 0 2; -1 0 1]
        const gx =
            -getPixelValue(x - 1, y - 1) + getPixelValue(x + 1, y - 1) +
            -2 * getPixelValue(x - 1, y) + 2 * getPixelValue(x + 1, y) +
            -getPixelValue(x - 1, y + 1) + getPixelValue(x + 1, y + 1);

        return gx / 8;
    };

    /**
     * Calculate gradient in Y direction using Sobel operator
     */
    const getGradientY = (pixels, width, height, x, y, mask) => {
        if (y <= 0 || y >= height - 1) return 0;

        const getPixelValue = (px, py) => {
            if (px < 0 || px >= width || py < 0 || py >= height) return 128;
            const idx = py * width + px;
            if (mask[idx] !== 0) return 128;
            const pIdx = idx * 4;
            return (pixels[pIdx] + pixels[pIdx + 1] + pixels[pIdx + 2]) / 3;
        };

        // Sobel Y: [-1 -2 -1; 0 0 0; 1 2 1]
        const gy =
            -getPixelValue(x - 1, y - 1) - 2 * getPixelValue(x, y - 1) - getPixelValue(x + 1, y - 1) +
            getPixelValue(x - 1, y + 1) + 2 * getPixelValue(x, y + 1) + getPixelValue(x + 1, y + 1);

        return gy / 8;
    };

    const applyHealedResult = async (canvas) => {
        if (!healCanvas.current || !originalImageData.current) return;

        const { bgImage, left, top, scaleX, scaleY } = originalImageData.current;
        const dataUrl = healCanvas.current.toDataURL('image/png');

        try {
            await replaceCanvasImageSource(canvas, bgImage, dataUrl, {
                objectProps: {
                    left,
                    top,
                    scaleX,
                    scaleY,
                    isBackgroundImage: true,
                },
            });
            useEditorStore.getState().saveState();

            console.log('[Healing] Applied Telea inpainting');
        } catch (error) {
            console.error('[Healing] Error:', error);
        }

        // Cleanup working canvas to prevent memory leak
        if (healCanvas.current) {
            healCanvas.current.width = 0;
            healCanvas.current.height = 0;
        }
        healCanvas.current = null;
        healCtx.current = null;
        originalImageData.current = null;
        strokePath.current = [];
    };

    const setupHealingCursor = useCallback((canvas, size) => {
        if (!canvas) return;

        const cursorSize = size || HEALING.SIZE_DEFAULT;
        const cursorCanvas = document.createElement('canvas');
        const padding = 4;
        cursorCanvas.width = cursorSize + padding * 2;
        cursorCanvas.height = cursorSize + padding * 2;
        const ctx = cursorCanvas.getContext('2d');

        const center = cursorSize / 2 + padding;

        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(center, center, cursorSize / 2, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(center, center, cursorSize / 2 - 1, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(center - 3, center);
        ctx.lineTo(center + 3, center);
        ctx.moveTo(center, center - 3);
        ctx.lineTo(center, center + 3);
        ctx.stroke();

        const dataUrl = cursorCanvas.toDataURL();
        const hotspot = Math.round(center);
        canvas.defaultCursor = `url(${dataUrl}) ${hotspot} ${hotspot}, crosshair`;
        canvas.hoverCursor = `url(${dataUrl}) ${hotspot} ${hotspot}, crosshair`;
    }, []);

    return {
        initHealingEvents,
        setupHealingCursor,
        isHealing: () => isHealing.current,
    };
}
