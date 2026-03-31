/**
 * Manga Studio - Professional Clone Tool (Photoshop-Style)
 * 
 * BRUSH MODE (default):
 * 1. Alt+Click = Set source point
 * 2. Click = Calculate fixed offset, start cloning
 * 3. Drag = Clone with fixed offset, source indicator follows
 * 
 * SQUARE MODE:
 * 1. Alt+Drag = Draw rectangle to select source area
 * 2. Double-click = Paste selected rectangle at location
 * 3. Selection clears after paste
 */

import { useCallback, useRef } from 'react';
import * as fabric from 'fabric';
import { useEditorStore } from '../store/editorStore';
import { TOOLS, CLONE } from '../utils/constants';
import { replaceCanvasImageSource } from '../utils/canvas';

export function useCloneTool() {
    // ==========================================
    // SHARED STATE REFS
    // ==========================================
    const imageInfo = useRef(null);

    // ==========================================
    // BRUSH MODE REFS
    // ==========================================
    const isCloning = useRef(false);
    const sourceSetPoint = useRef(null);    // Initial Alt+Click point (image coords)
    const cloneOffset = useRef(null);        // Fixed offset: target - source
    const sourceImageData = useRef(null);    // Original image pixels (frozen at source set)
    const cloneCanvas = useRef(null);        // Working canvas
    const cloneCtx = useRef(null);
    const sourceIndicator = useRef(null);    // Moving source crosshair
    const targetPreview = useRef(null);      // Orange preview circle

    // ==========================================
    // SQUARE MODE REFS
    // ==========================================
    const isDrawingRect = useRef(false);
    const rectStartPoint = useRef(null);     // Where Alt+Drag started
    const selectionRect = useRef(null);      // Visual selection rectangle on canvas
    const capturedRectData = useRef(null);   // { imageData, bounds: {x, y, width, height} }
    const cursorPreview = useRef(null);      // Preview image following cursor

    const initCloneEvents = useCallback((canvas) => {
        if (!canvas) return;

        const handleMouseDown = (opt) => {
            const { activeTool, cloneSize, cloneMode } = useEditorStore.getState();
            if (activeTool !== TOOLS.CLONE) return;

            const pointer = canvas.getPointer(opt.e);

            // ==========================================
            // SQUARE MODE
            // ==========================================
            if (cloneMode === 'square') {
                // Alt+Click = Start drawing selection rectangle
                if (opt.e.altKey) {
                    startRectSelection(canvas, pointer.x, pointer.y);
                    return;
                }
                // Not alt key - ignore mouse down (paste is on double-click)
                return;
            }

            // ==========================================
            // BRUSH MODE (default)
            // ==========================================
            // Alt+Click = Set source
            if (opt.e.altKey) {
                setCloneSource(canvas, pointer.x, pointer.y);
                return;
            }

            // Normal click = Start cloning
            if (!sourceSetPoint.current || !sourceImageData.current) {
                console.warn('[Clone] Hold Alt and click to set source first');
                return;
            }

            // Get background image
            const bgImage = canvas.getObjects().find(obj => obj.type === 'image');
            if (!bgImage || !bgImage._element) {
                console.warn('[Clone] No image found');
                return;
            }

            // Setup working canvas
            const imgEl = bgImage._element;
            const imgWidth = bgImage.width;
            const imgHeight = bgImage.height;

            cloneCanvas.current = document.createElement('canvas');
            cloneCanvas.current.width = imgWidth;
            cloneCanvas.current.height = imgHeight;
            cloneCtx.current = cloneCanvas.current.getContext('2d');
            cloneCtx.current.drawImage(imgEl, 0, 0, imgWidth, imgHeight);

            imageInfo.current = {
                bgImage,
                imgWidth,
                imgHeight,
                left: bgImage.left || 0,
                top: bgImage.top || 0,
                scaleX: bgImage.scaleX || 1,
                scaleY: bgImage.scaleY || 1,
            };

            // Calculate FIXED offset (only once at start of stroke)
            const targetImg = canvasToImage(pointer.x, pointer.y);
            cloneOffset.current = {
                x: targetImg.x - sourceSetPoint.current.x,
                y: targetImg.y - sourceSetPoint.current.y,
            };

            isCloning.current = true;

            // Apply clone at initial point
            applyCloneAt(targetImg.x, targetImg.y, cloneSize || CLONE.SIZE_DEFAULT);

            // Show source indicator and target preview
            updateSourceIndicator(canvas, pointer.x, pointer.y);
            drawTargetPreview(canvas, pointer.x, pointer.y, cloneSize || CLONE.SIZE_DEFAULT);
        };

        const handleMouseMove = (opt) => {
            const { activeTool, cloneSize, cloneMode } = useEditorStore.getState();
            if (activeTool !== TOOLS.CLONE) return;

            const pointer = canvas.getPointer(opt.e);

            // ==========================================
            // SQUARE MODE - Drawing rectangle
            // ==========================================
            if (cloneMode === 'square') {
                if (isDrawingRect.current && rectStartPoint.current) {
                    updateSelectionRect(canvas, pointer.x, pointer.y);
                }
                // Show cursor preview if we have captured data
                if (capturedRectData.current && !isDrawingRect.current) {
                    updateCursorPreview(canvas, pointer.x, pointer.y);
                }
                return;
            }

            // ==========================================
            // BRUSH MODE
            // ==========================================
            if (!isCloning.current || !cloneCtx.current) {
                // Just hovering - show where source would be if we started cloning
                if (sourceSetPoint.current && cloneOffset.current) {
                    updateSourceIndicator(canvas, pointer.x, pointer.y);
                }
                return;
            }

            // Cloning in progress - show both indicators
            const targetImg = canvasToImage(pointer.x, pointer.y);
            applyCloneAt(targetImg.x, targetImg.y, cloneSize || CLONE.SIZE_DEFAULT);
            updateSourceIndicator(canvas, pointer.x, pointer.y);
            drawTargetPreview(canvas, pointer.x, pointer.y, cloneSize || CLONE.SIZE_DEFAULT);
        };

        const handleMouseUp = async (opt) => {
            const { cloneMode } = useEditorStore.getState();

            // ==========================================
            // SQUARE MODE - Finish drawing rectangle
            // ==========================================
            if (cloneMode === 'square' && isDrawingRect.current) {
                finishRectSelection(canvas);
                return;
            }

            // ==========================================
            // BRUSH MODE
            // ==========================================
            if (!isCloning.current) return;
            isCloning.current = false;

            // Hide all indicators
            hideSourceIndicator(canvas);
            removeTargetPreview(canvas);

            if (!cloneCanvas.current) return;
            await applyClonedResult(canvas);
        };

        const handleDoubleClick = async (opt) => {
            const { activeTool, cloneMode } = useEditorStore.getState();
            if (activeTool !== TOOLS.CLONE || cloneMode !== 'square') return;

            // Double-click in Square mode = Paste captured rectangle
            if (!capturedRectData.current) {
                console.warn('[Clone Square] No selection. Hold Alt and drag to select area first.');
                return;
            }

            const pointer = canvas.getPointer(opt.e);
            await pasteRectAtPosition(canvas, pointer.x, pointer.y);
        };

        canvas.on('mouse:down', handleMouseDown);
        canvas.on('mouse:move', handleMouseMove);
        canvas.on('mouse:up', handleMouseUp);
        canvas.on('mouse:dblclick', handleDoubleClick);

        return () => {
            canvas.off('mouse:down', handleMouseDown);
            canvas.off('mouse:move', handleMouseMove);
            canvas.off('mouse:up', handleMouseUp);
            canvas.off('mouse:dblclick', handleDoubleClick);
        };
    }, []);

    // ==========================================
    // SQUARE MODE FUNCTIONS
    // ==========================================

    /**
     * Start drawing selection rectangle (Alt+MouseDown)
     */
    const startRectSelection = (canvas, x, y) => {
        // Clear any previous selection
        clearSquareSelection(canvas);

        rectStartPoint.current = { x, y };
        isDrawingRect.current = true;

        // Create selection rectangle
        selectionRect.current = new fabric.Rect({
            left: x,
            top: y,
            width: 0,
            height: 0,
            fill: 'rgba(0, 200, 255, 0.2)',
            stroke: '#00c8ff',
            strokeWidth: 2,
            strokeDashArray: [5, 5],
            selectable: false,
            evented: false,
            isCloneSelectionRect: true,
        });

        canvas.add(selectionRect.current);
        canvas.renderAll();
    };

    /**
     * Update selection rectangle during drag
     */
    const updateSelectionRect = (canvas, x, y) => {
        if (!selectionRect.current || !rectStartPoint.current) return;

        const startX = rectStartPoint.current.x;
        const startY = rectStartPoint.current.y;

        const left = Math.min(startX, x);
        const top = Math.min(startY, y);
        const width = Math.abs(x - startX);
        const height = Math.abs(y - startY);

        selectionRect.current.set({
            left, top, width, height
        });
        canvas.renderAll();
    };

    /**
     * Finish selection and capture the rectangle
     */
    const finishRectSelection = (canvas) => {
        isDrawingRect.current = false;

        if (!selectionRect.current) return;

        const rect = selectionRect.current;
        const width = rect.width;
        const height = rect.height;

        // Minimum size check
        if (width < 5 || height < 5) {
            console.warn('[Clone Square] Selection too small');
            clearSquareSelection(canvas);
            return;
        }

        // Get background image
        const bgImage = canvas.getObjects().find(obj => obj.type === 'image');
        if (!bgImage || !bgImage._element) {
            console.warn('[Clone Square] No image found');
            clearSquareSelection(canvas);
            return;
        }

        // Store image info
        imageInfo.current = {
            bgImage,
            imgWidth: bgImage.width,
            imgHeight: bgImage.height,
            left: bgImage.left || 0,
            top: bgImage.top || 0,
            scaleX: bgImage.scaleX || 1,
            scaleY: bgImage.scaleY || 1,
        };

        // Convert canvas coords to image coords
        const rectLeft = rect.left;
        const rectTop = rect.top;
        const imgCoords = canvasToImage(rectLeft, rectTop);
        const imgWidth = Math.round(width / (imageInfo.current.scaleX || 1));
        const imgHeight = Math.round(height / (imageInfo.current.scaleY || 1));

        // Capture the selected region from image
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imgWidth;
        tempCanvas.height = imgHeight;
        const ctx = tempCanvas.getContext('2d');

        ctx.drawImage(
            bgImage._element,
            imgCoords.x, imgCoords.y, imgWidth, imgHeight,
            0, 0, imgWidth, imgHeight
        );

        // Store captured data
        capturedRectData.current = {
            dataUrl: tempCanvas.toDataURL('image/png'),
            bounds: {
                x: imgCoords.x,
                y: imgCoords.y,
                width: imgWidth,
                height: imgHeight,
                canvasWidth: width,
                canvasHeight: height,
            }
        };

        // Cleanup temp canvas
        tempCanvas.width = 0;
        tempCanvas.height = 0;

        // Change selection rect to solid green (captured!)
        selectionRect.current.set({
            stroke: '#00ff00',
            strokeDashArray: null,
            fill: 'rgba(0, 255, 0, 0.15)',
        });
        canvas.renderAll();

        console.log(`[Clone Square] Captured ${imgWidth}x${imgHeight} area. Double-click to paste.`);
    };

    /**
     * Show preview of captured rect at cursor - using simple rectangle (not async image)
     */
    const updateCursorPreview = (canvas, x, y) => {
        if (!capturedRectData.current) return;

        const { canvasWidth, canvasHeight } = capturedRectData.current.bounds;

        // If preview exists, just move it (don't create new one)
        if (cursorPreview.current) {
            cursorPreview.current.set({
                left: x - canvasWidth / 2,
                top: y - canvasHeight / 2,
            });
            canvas.renderAll();
            return;
        }

        // Create simple rectangle preview (not image)
        const rect = new fabric.Rect({
            left: x - canvasWidth / 2,
            top: y - canvasHeight / 2,
            width: canvasWidth,
            height: canvasHeight,
            fill: 'rgba(0, 200, 255, 0.3)',
            stroke: '#00c8ff',
            strokeWidth: 2,
            strokeDashArray: [8, 4],
            selectable: false,
            evented: false,
            isCloneCursorPreview: true,
        });

        canvas.add(rect);
        cursorPreview.current = rect;
        canvas.renderAll();
    };

    /**
     * Paste the captured rectangle at position
     */
    const pasteRectAtPosition = async (canvas, x, y) => {
        if (!capturedRectData.current || !imageInfo.current) return;

        const { bgImage, imgWidth, imgHeight, left, top, scaleX, scaleY } = imageInfo.current;
        const { bounds } = capturedRectData.current;

        // Convert paste position to image coords (center of pasted rect)
        const pasteImgX = Math.round((x - left) / scaleX - bounds.width / 2);
        const pasteImgY = Math.round((y - top) / scaleY - bounds.height / 2);

        // Create working canvas from current image
        const workCanvas = document.createElement('canvas');
        workCanvas.width = imgWidth;
        workCanvas.height = imgHeight;
        const ctx = workCanvas.getContext('2d');
        ctx.drawImage(bgImage._element, 0, 0, imgWidth, imgHeight);

        // Load captured image and draw at paste position
        const pasteImg = new Image();
        pasteImg.src = capturedRectData.current.dataUrl;

        await new Promise((resolve) => {
            pasteImg.onload = () => {
                ctx.drawImage(pasteImg, pasteImgX, pasteImgY, bounds.width, bounds.height);
                resolve();
            };
            pasteImg.onerror = resolve;
        });

        // Apply to canvas
        const dataUrl = workCanvas.toDataURL('image/png');
        await replaceCanvasImageSource(canvas, bgImage, dataUrl, {
            objectProps: {
                left,
                top,
                scaleX,
                scaleY,
            },
        });

        // Save state
        useEditorStore.getState().saveState();

        // Cleanup
        workCanvas.width = 0;
        workCanvas.height = 0;

        console.log(`[Clone Square] Pasted at (${pasteImgX}, ${pasteImgY})`);

        // Clear selection after paste
        clearSquareSelection(canvas);
    };

    /**
     * Clear square selection
     */
    const clearSquareSelection = (canvas) => {
        if (selectionRect.current) {
            canvas.remove(selectionRect.current);
            selectionRect.current = null;
        }
        if (cursorPreview.current) {
            canvas.remove(cursorPreview.current);
            cursorPreview.current = null;
        }
        capturedRectData.current = null;
        rectStartPoint.current = null;
        isDrawingRect.current = false;

        // Also clean by tag
        const toRemove = canvas.getObjects().filter(obj =>
            obj.isCloneSelectionRect || obj.isCloneCursorPreview
        );
        toRemove.forEach(obj => canvas.remove(obj));

        canvas.renderAll();
    };

    // ==========================================
    // BRUSH MODE FUNCTIONS (unchanged logic)
    // ==========================================

    /**
     * Set clone source (Alt+Click) - BRUSH MODE
     */
    const setCloneSource = (canvas, canvasX, canvasY) => {
        const bgImage = canvas.getObjects().find(obj => obj.type === 'image');
        if (!bgImage || !bgImage._element) {
            console.warn('[Clone] No image');
            return;
        }

        const imgEl = bgImage._element;
        const imgWidth = bgImage.width;
        const imgHeight = bgImage.height;
        const left = bgImage.left || 0;
        const top = bgImage.top || 0;
        const scaleX = bgImage.scaleX || 1;
        const scaleY = bgImage.scaleY || 1;

        imageInfo.current = { bgImage, imgWidth, imgHeight, left, top, scaleX, scaleY };

        // Convert to image coords
        const imgX = Math.round((canvasX - left) / scaleX);
        const imgY = Math.round((canvasY - top) / scaleY);

        sourceSetPoint.current = { x: imgX, y: imgY };
        cloneOffset.current = null; // Reset offset - will be calculated on first paint

        // Capture source image data (frozen snapshot)
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imgWidth;
        tempCanvas.height = imgHeight;
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(imgEl, 0, 0, imgWidth, imgHeight);
        sourceImageData.current = ctx.getImageData(0, 0, imgWidth, imgHeight);

        // Cleanup temp canvas to prevent memory leak
        tempCanvas.width = 0;
        tempCanvas.height = 0;

        console.log(`[Clone] Source set at (${imgX}, ${imgY})`);

        // Remove old source marker
        removeSourceMarker(canvas);

        // Draw permanent source marker (red crosshair)
        drawSourceMarker(canvas, canvasX, canvasY);
    };

    /**
     * Convert canvas coordinates to image coordinates
     */
    const canvasToImage = (canvasX, canvasY) => {
        if (!imageInfo.current) return { x: 0, y: 0 };
        const { left, top, scaleX, scaleY } = imageInfo.current;
        // Safe division check
        const safeScaleX = scaleX || 1;
        const safeScaleY = scaleY || 1;
        return {
            x: Math.round((canvasX - left) / safeScaleX),
            y: Math.round((canvasY - top) / safeScaleY),
        };
    };

    /**
     * Convert image coordinates to canvas coordinates
     */
    const imageToCanvas = (imgX, imgY) => {
        if (!imageInfo.current) return { x: 0, y: 0 };
        const { left, top, scaleX, scaleY } = imageInfo.current;
        return {
            x: imgX * scaleX + left,
            y: imgY * scaleY + top,
        };
    };

    /**
     * Apply clone at target point (using fixed offset) - BRUSH MODE
     */
    const applyCloneAt = (targetX, targetY, size) => {
        if (!sourceImageData.current || !cloneCtx.current || !cloneOffset.current) return;

        const ctx = cloneCtx.current;
        const srcData = sourceImageData.current;
        const { imgWidth, imgHeight } = imageInfo.current;
        const radius = Math.round(size / 2);

        // Source point = Target - Offset (FIXED offset)
        const sourceX = targetX - cloneOffset.current.x;
        const sourceY = targetY - cloneOffset.current.y;

        // LARGE area for ultra-smooth falloff (4x brush size)
        const extendedRadius = Math.round(radius * 4);
        const startX = Math.max(0, Math.round(targetX - extendedRadius));
        const startY = Math.max(0, Math.round(targetY - extendedRadius));
        const endX = Math.min(imgWidth, Math.round(targetX + extendedRadius));
        const endY = Math.min(imgHeight, Math.round(targetY + extendedRadius));

        const width = endX - startX;
        const height = endY - startY;
        if (width <= 0 || height <= 0) return;

        const targetData = ctx.getImageData(startX, startY, width, height);

        // === ENHANCED COLOR MATCHING ===
        const destAvg = sampleRingAverage(targetData.data, width, height,
            targetX - startX, targetY - startY, radius * 0.8, radius * 2);

        const srcAvg = sampleSourceAverage(srcData.data, imgWidth,
            Math.round(sourceX), Math.round(sourceY), radius);

        // Stronger color shift with gradual falloff
        const colorShift = {
            r: (destAvg.r - srcAvg.r) * 0.8,
            g: (destAvg.g - srcAvg.g) * 0.8,
            b: (destAvg.b - srcAvg.b) * 0.8,
        };

        // Apply cloning with ULTRA-SMOOTH blending
        for (let py = 0; py < height; py++) {
            for (let px = 0; px < width; px++) {
                const tx = startX + px;
                const ty = startY + py;

                const dx = tx - targetX;
                const dy = ty - targetY;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // No hard cutoff - let smoothstep handle falloff
                const sx = sourceX + dx;
                const sy = sourceY + dy;

                if (sx >= 1 && sx < imgWidth - 1 && sy >= 1 && sy < imgHeight - 1) {
                    const dstIdx = (py * width + px) * 4;

                    // Bilinear sample from source
                    const srcColor = bilinearSample(srcData.data, imgWidth, sx, sy);

                    // Gradual color shift based on distance
                    const colorFade = Math.max(0, 1 - dist / (radius * 2));
                    const matchedColor = {
                        r: Math.max(0, Math.min(255, srcColor.r + colorShift.r * colorFade)),
                        g: Math.max(0, Math.min(255, srcColor.g + colorShift.g * colorFade)),
                        b: Math.max(0, Math.min(255, srcColor.b + colorShift.b * colorFade)),
                    };

                    // DOUBLE QUINTIC smoothstep for ULTRA smooth edges
                    const t1 = Math.min(dist / (radius * 0.7), 1);
                    const quintic1 = 1 - (t1 * t1 * t1 * (t1 * (t1 * 6 - 15) + 10));

                    // Second layer for extra smoothness
                    const t2 = quintic1;
                    const alpha = t2 * t2 * (3 - 2 * t2);

                    // Skip invisible
                    if (alpha < 0.001) continue;

                    // Blend with high precision
                    targetData.data[dstIdx] = Math.round(
                        matchedColor.r * alpha + targetData.data[dstIdx] * (1 - alpha)
                    );
                    targetData.data[dstIdx + 1] = Math.round(
                        matchedColor.g * alpha + targetData.data[dstIdx + 1] * (1 - alpha)
                    );
                    targetData.data[dstIdx + 2] = Math.round(
                        matchedColor.b * alpha + targetData.data[dstIdx + 2] * (1 - alpha)
                    );
                }
            }
        }

        ctx.putImageData(targetData, startX, startY);
    };

    /**
     * Sample average color from a ring around center (for color matching)
     */
    const sampleRingAverage = (pixels, width, height, cx, cy, innerR, outerR) => {
        let sumR = 0, sumG = 0, sumB = 0, count = 0;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const dx = x - cx;
                const dy = y - cy;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist >= innerR && dist <= outerR) {
                    const idx = (y * width + x) * 4;
                    sumR += pixels[idx];
                    sumG += pixels[idx + 1];
                    sumB += pixels[idx + 2];
                    count++;
                }
            }
        }

        if (count === 0) return { r: 128, g: 128, b: 128 };
        return { r: sumR / count, g: sumG / count, b: sumB / count };
    };

    /**
     * Sample average color from source area
     */
    const sampleSourceAverage = (pixels, width, cx, cy, radius) => {
        let sumR = 0, sumG = 0, sumB = 0, count = 0;
        const r = Math.round(radius * 0.8);

        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                if (dx * dx + dy * dy > r * r) continue;
                const x = cx + dx;
                const y = cy + dy;
                if (x < 0 || x >= width || y < 0) continue;

                const idx = (y * width + x) * 4;
                sumR += pixels[idx];
                sumG += pixels[idx + 1];
                sumB += pixels[idx + 2];
                count++;
            }
        }

        if (count === 0) return { r: 128, g: 128, b: 128 };
        return { r: sumR / count, g: sumG / count, b: sumB / count };
    };

    /**
     * Bilinear interpolation for sub-pixel sampling (Photoshop-quality)
     */
    const bilinearSample = (pixels, width, x, y) => {
        const x0 = Math.floor(x);
        const y0 = Math.floor(y);
        const x1 = x0 + 1;
        const y1 = y0 + 1;

        const fx = x - x0;
        const fy = y - y0;

        const getPixel = (px, py) => {
            const idx = (py * width + px) * 4;
            return {
                r: pixels[idx],
                g: pixels[idx + 1],
                b: pixels[idx + 2],
            };
        };

        const p00 = getPixel(x0, y0);
        const p10 = getPixel(x1, y0);
        const p01 = getPixel(x0, y1);
        const p11 = getPixel(x1, y1);

        // Bilinear interpolation
        const r = p00.r * (1 - fx) * (1 - fy) + p10.r * fx * (1 - fy) +
            p01.r * (1 - fx) * fy + p11.r * fx * fy;
        const g = p00.g * (1 - fx) * (1 - fy) + p10.g * fx * (1 - fy) +
            p01.g * (1 - fx) * fy + p11.g * fx * fy;
        const b = p00.b * (1 - fx) * (1 - fy) + p10.b * fx * (1 - fy) +
            p01.b * (1 - fx) * fy + p11.b * fx * fy;

        return { r, g, b };
    };

    /**
     * Update moving source indicator (shows where we're copying FROM)
     */
    const updateSourceIndicator = (canvas, targetCanvasX, targetCanvasY) => {
        if (!cloneOffset.current || !imageInfo.current) return;

        // Calculate current source position in canvas coords
        const targetImg = canvasToImage(targetCanvasX, targetCanvasY);
        const sourceImgX = targetImg.x - cloneOffset.current.x;
        const sourceImgY = targetImg.y - cloneOffset.current.y;
        const sourceCanvas = imageToCanvas(sourceImgX, sourceImgY);

        // Remove old indicator
        if (sourceIndicator.current) {
            sourceIndicator.current.forEach(obj => canvas.remove(obj));
        }

        // Draw new indicator (green crosshair that moves)
        const size = 15;
        const objects = [];

        const circle = new fabric.Circle({
            left: sourceCanvas.x - size,
            top: sourceCanvas.y - size,
            radius: size,
            fill: 'transparent',
            stroke: 'rgba(0, 255, 0, 0.8)',
            strokeWidth: 2,
            selectable: false,
            evented: false,
            isCloneSourceIndicator: true,
        });
        objects.push(circle);

        const line1 = new fabric.Line([
            sourceCanvas.x - size * 1.5, sourceCanvas.y,
            sourceCanvas.x + size * 1.5, sourceCanvas.y
        ], {
            stroke: 'rgba(0, 255, 0, 0.8)',
            strokeWidth: 1,
            selectable: false,
            evented: false,
            isCloneSourceIndicator: true,
        });
        objects.push(line1);

        const line2 = new fabric.Line([
            sourceCanvas.x, sourceCanvas.y - size * 1.5,
            sourceCanvas.x, sourceCanvas.y + size * 1.5
        ], {
            stroke: 'rgba(0, 255, 0, 0.8)',
            strokeWidth: 1,
            selectable: false,
            evented: false,
            isCloneSourceIndicator: true,
        });
        objects.push(line2);

        objects.forEach(obj => canvas.add(obj));
        sourceIndicator.current = objects;
        canvas.renderAll();
    };

    /**
     * Hide moving source indicator
     */
    const hideSourceIndicator = (canvas) => {
        if (sourceIndicator.current) {
            sourceIndicator.current.forEach(obj => canvas.remove(obj));
            sourceIndicator.current = null;
            canvas.renderAll();
        }
    };

    /**
     * Draw target preview (orange circle showing where you're painting)
     */
    const drawTargetPreview = (canvas, x, y, size) => {
        // Remove old preview first
        if (targetPreview.current) {
            canvas.remove(targetPreview.current);
        }

        const circle = new fabric.Circle({
            left: x - size / 2,
            top: y - size / 2,
            radius: size / 2,
            fill: 'rgba(255, 165, 0, 0.25)',
            stroke: 'rgba(255, 165, 0, 0.9)',
            strokeWidth: 2,
            selectable: false,
            evented: false,
            isCloneTargetPreview: true,
        });

        canvas.add(circle);
        targetPreview.current = circle;
        canvas.renderAll();
    };

    /**
     * Remove target preview
     */
    const removeTargetPreview = (canvas) => {
        if (targetPreview.current) {
            canvas.remove(targetPreview.current);
            targetPreview.current = null;
        }
        // Also cleanup any orphaned previews
        const previews = canvas.getObjects().filter(obj => obj.isCloneTargetPreview);
        previews.forEach(p => canvas.remove(p));
        canvas.renderAll();
    };

    /**
     * Draw permanent source marker (red - shows where Alt+Click was)
     */
    const drawSourceMarker = (canvas, x, y) => {
        const size = 12;

        const circle = new fabric.Circle({
            left: x - size,
            top: y - size,
            radius: size,
            fill: 'transparent',
            stroke: 'rgba(255, 50, 50, 0.9)',
            strokeWidth: 2,
            selectable: false,
            evented: false,
            isCloneSourceMarker: true,
        });

        const line1 = new fabric.Line([x - size * 1.2, y, x + size * 1.2, y], {
            stroke: 'rgba(255, 50, 50, 0.9)',
            strokeWidth: 2,
            selectable: false,
            evented: false,
            isCloneSourceMarker: true,
        });

        const line2 = new fabric.Line([x, y - size * 1.2, x, y + size * 1.2], {
            stroke: 'rgba(255, 50, 50, 0.9)',
            strokeWidth: 2,
            selectable: false,
            evented: false,
            isCloneSourceMarker: true,
        });

        canvas.add(circle, line1, line2);
        canvas.renderAll();
    };

    /**
     * Remove source marker
     */
    const removeSourceMarker = (canvas) => {
        const markers = canvas.getObjects().filter(obj => obj.isCloneSourceMarker);
        markers.forEach(obj => canvas.remove(obj));
    };

    /**
     * Apply final result - BRUSH MODE
     */
    const applyClonedResult = async (canvas) => {
        if (!cloneCanvas.current || !imageInfo.current) return;

        const { bgImage, left, top, scaleX, scaleY } = imageInfo.current;
        const dataUrl = cloneCanvas.current.toDataURL('image/png');

        try {
            await replaceCanvasImageSource(canvas, bgImage, dataUrl, {
                objectProps: {
                    left,
                    top,
                    scaleX,
                    scaleY,
                },
            });
            useEditorStore.getState().saveState();
        } catch (error) {
            console.error('[Clone] Error:', error);
        }

        // Cleanup working canvas to prevent memory leak
        if (cloneCanvas.current) {
            cloneCanvas.current.width = 0;
            cloneCanvas.current.height = 0;
        }
        cloneCanvas.current = null;
        cloneCtx.current = null;
    };

    /**
     * Reset source - BRUSH MODE
     */
    const resetCloneSource = useCallback((canvas) => {
        sourceSetPoint.current = null;
        sourceImageData.current = null;
        cloneOffset.current = null;

        if (canvas) {
            removeSourceMarker(canvas);
            hideSourceIndicator(canvas);
        }
    }, []);

    /**
     * Setup cursor
     */
    const setupCloneCursor = useCallback((canvas, size) => {
        if (!canvas) return;

        const cursorSize = size || CLONE.SIZE_DEFAULT;
        const cursorCanvas = document.createElement('canvas');
        const padding = 4;
        cursorCanvas.width = cursorSize + padding * 2;
        cursorCanvas.height = cursorSize + padding * 2;
        const ctx = cursorCanvas.getContext('2d');

        const center = cursorSize / 2 + padding;

        ctx.strokeStyle = '#FFA500';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(center, center, cursorSize / 2, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(center, center, cursorSize / 2 - 1, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = '#FFA500';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(center - 4, center);
        ctx.lineTo(center + 4, center);
        ctx.moveTo(center, center - 4);
        ctx.lineTo(center, center + 4);
        ctx.stroke();

        const dataUrl = cursorCanvas.toDataURL();
        const hotspot = Math.round(center);
        canvas.defaultCursor = `url(${dataUrl}) ${hotspot} ${hotspot}, crosshair`;
        canvas.hoverCursor = `url(${dataUrl}) ${hotspot} ${hotspot}, crosshair`;
    }, []);

    /**
     * Cleanup all clone tool indicators (call when tool changes)
     */
    const cleanupIndicators = useCallback((canvas) => {
        if (!canvas) return;

        // Remove source marker (red)
        const markers = canvas.getObjects().filter(obj => obj.isCloneSourceMarker);
        markers.forEach(obj => canvas.remove(obj));

        // Remove source indicator (green) - by ref
        if (sourceIndicator.current) {
            sourceIndicator.current.forEach(obj => canvas.remove(obj));
            sourceIndicator.current = null;
        }

        // Remove source indicator (green) - by tag (backup)
        const greenIndicators = canvas.getObjects().filter(obj => obj.isCloneSourceIndicator);
        greenIndicators.forEach(obj => canvas.remove(obj));

        // Remove target preview (orange) - by ref
        if (targetPreview.current) {
            canvas.remove(targetPreview.current);
            targetPreview.current = null;
        }

        // Remove target preview (orange) - by tag (backup)
        const previews = canvas.getObjects().filter(obj => obj.isCloneTargetPreview);
        previews.forEach(p => canvas.remove(p));

        // SQUARE MODE: Clear selection and cursor preview
        clearSquareSelection(canvas);

        canvas.renderAll();
    }, []);

    return {
        initCloneEvents,
        setupCloneCursor,
        resetCloneSource,
        cleanupIndicators,
        isCloning: () => isCloning.current,
        hasSource: () => sourceSetPoint.current !== null,
        hasSquareSelection: () => capturedRectData.current !== null,
    };
}
