/**
 * Manga Studio - Magic Mask Tool
 * Intelligent text removal using OCR + OpenCV inpainting
 */

import { useCallback, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { useEditorStore } from '../store/editorStore';
import { TOOLS, MAGIC_MASK } from '../utils/constants';
import { replaceCanvasImageSource } from '../utils/canvas';

export function useMagicMask() {
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);

    const isSelecting = useRef(false);
    const startPoint = useRef(null);
    const selectionRect = useRef(null);

    const initMagicMaskEvents = useCallback((canvas) => {
        if (!canvas) return;

        const handleMouseDown = (opt) => {
            const { activeTool } = useEditorStore.getState();
            if (activeTool !== TOOLS.MAGIC_MASK) return;

            canvas.selection = false;
            canvas.discardActiveObject();

            const pointer = canvas.getPointer(opt.e);
            isSelecting.current = true;
            startPoint.current = { x: pointer.x, y: pointer.y };

            selectionRect.current = new fabric.Rect({
                left: pointer.x,
                top: pointer.y,
                width: 0,
                height: 0,
                fill: 'rgba(100, 150, 255, 0.1)',
                stroke: '#6496ff',
                strokeWidth: 2,
                strokeDashArray: [5, 5],
                selectable: false,
                evented: false,
                isMagicMaskSelection: true,
            });

            canvas.add(selectionRect.current);
            canvas.renderAll();
        };

        const handleMouseMove = (opt) => {
            if (!isSelecting.current || !selectionRect.current || !startPoint.current) return;

            const pointer = canvas.getPointer(opt.e);
            const width = pointer.x - startPoint.current.x;
            const height = pointer.y - startPoint.current.y;

            if (width < 0) {
                selectionRect.current.set({ left: pointer.x, width: Math.abs(width) });
            } else {
                selectionRect.current.set({ width });
            }

            if (height < 0) {
                selectionRect.current.set({ top: pointer.y, height: Math.abs(height) });
            } else {
                selectionRect.current.set({ height });
            }

            canvas.renderAll();
        };

        const handleMouseUp = async (opt) => {
            if (!isSelecting.current || !selectionRect.current) return;
            isSelecting.current = false;

            const rect = selectionRect.current;
            const width = Math.abs(rect.width);
            const height = Math.abs(rect.height);

            if (width < MAGIC_MASK.MIN_SELECTION || height < MAGIC_MASK.MIN_SELECTION) {
                console.warn(`[Magic Mask] Selection too small (min ${MAGIC_MASK.MIN_SELECTION}px)`);
                removeSelectionRect(canvas);
                return;
            }

            await processSelection(canvas, rect);
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

    const processSelection = async (canvas, rect) => {
        try {
            console.log('[Magic Mask] ===== START =====');
            setIsProcessing(true);
            setProgress(10);

            const bgImage = canvas.getObjects().find(obj => obj.type === 'image');
            if (!bgImage || !bgImage._element) {
                throw new Error('No image found on canvas');
            }
            console.log('[Magic Mask] Found image:', bgImage.width, 'x', bgImage.height);

            setProgress(20);
            const regionData = await extractRegion(canvas, bgImage, rect);
            console.log('[Magic Mask] Extracted region:', regionData.imgWidth, 'x', regionData.imgHeight);

            setProgress(30);
            console.log('[Magic Mask] Sending to backend...');

            const response = await fetch('http://localhost:5000/api/magic-mask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image: regionData.dataUrl,
                    lang: 'en'
                }),
            });

            console.log('[Magic Mask] Response:', response.status, response.statusText);

            if (!response.ok) {
                throw new Error(`Backend error: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('[Magic Mask] Result:', result);

            setProgress(80);

            if (!result.success) {
                throw new Error(result.error || 'Processing failed');
            }

            console.log('[Magic Mask] Processing time:', result.processing_time, 's');
            console.log('[Magic Mask] Text count:', result.text_count);
            console.log('[Magic Mask] Mask generated:', result.mask_generated);

            // Check if mask was actually generated
            if (!result.mask_generated) {
                console.warn('[Magic Mask] No mask generated - check Python logs');
                alert('Magic Mask: No text mask generated. Check backend logs for details.');
                return;
            }

            console.log('[Magic Mask] Applying to canvas...');

            await applyResult(canvas, bgImage, result.cleaned_image, regionData);

            console.log('[Magic Mask] Applied to canvas!');

            setProgress(100);
            removeSelectionRect(canvas);
            useEditorStore.getState().saveState();

            console.log('[Magic Mask] ===== COMPLETE =====');
        } catch (error) {
            console.error('[Magic Mask] ===== ERROR =====');
            console.error(error);
            alert(`Magic Mask failed: ${error.message}`);
        } finally {
            setIsProcessing(false);
            setProgress(0);
            removeSelectionRect(canvas);
        }
    };

    const extractRegion = async (canvas, bgImage, rect) => {
        const vpt = canvas.viewportTransform;
        const zoom = vpt[0];

        const actualLeft = (rect.left - vpt[4]) / zoom;
        const actualTop = (rect.top - vpt[5]) / zoom;
        const actualWidth = rect.width / zoom;
        const actualHeight = rect.height / zoom;

        const imgLeft = bgImage.left || 0;
        const imgTop = bgImage.top || 0;
        const scaleX = bgImage.scaleX || 1;
        const scaleY = bgImage.scaleY || 1;

        const imgX = Math.round((actualLeft - imgLeft) / scaleX);
        const imgY = Math.round((actualTop - imgTop) / scaleY);
        const imgWidth = Math.round(actualWidth / scaleX);
        const imgHeight = Math.round(actualHeight / scaleY);

        const clampedX = Math.max(0, Math.min(imgX, bgImage.width - 1));
        const clampedY = Math.max(0, Math.min(imgY, bgImage.height - 1));
        const clampedWidth = Math.max(1, Math.min(imgWidth, bgImage.width - clampedX));
        const clampedHeight = Math.max(1, Math.min(imgHeight, bgImage.height - clampedY));

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = clampedWidth;
        tempCanvas.height = clampedHeight;
        const ctx = tempCanvas.getContext('2d');

        ctx.drawImage(
            bgImage._element,
            clampedX, clampedY, clampedWidth, clampedHeight,
            0, 0, clampedWidth, clampedHeight
        );

        const dataUrl = tempCanvas.toDataURL('image/png');

        return {
            dataUrl,
            imgX: clampedX,
            imgY: clampedY,
            imgWidth: clampedWidth,
            imgHeight: clampedHeight,
        };
    };

    const applyResult = async (canvas, bgImage, cleanedDataUrl, regionData) => {
        console.log('[Magic Mask] applyResult START');

        return new Promise((resolve, reject) => {
            // Convert data URL to Blob (avoid 431 error for large images)
            const base64Data = cleanedDataUrl.split(',')[1];
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/png' });
            const blobUrl = URL.createObjectURL(blob);

            const img = new Image();

            img.onload = async () => {
                console.log('[Magic Mask] Image loaded:', img.width, 'x', img.height);
                URL.revokeObjectURL(blobUrl);

                try {
                    const fullCanvas = document.createElement('canvas');
                    fullCanvas.width = bgImage.width;
                    fullCanvas.height = bgImage.height;
                    const ctx = fullCanvas.getContext('2d');

                    ctx.drawImage(bgImage._element, 0, 0);
                    ctx.drawImage(img, regionData.imgX, regionData.imgY);

                    const finalDataUrl = fullCanvas.toDataURL('image/png');

                    await replaceCanvasImageSource(canvas, bgImage, finalDataUrl);
                    canvas.renderAll();
                    console.log('[Magic Mask] Canvas updated!');
                    resolve();
                } catch (err) {
                    reject(err);
                }
            };

            img.onerror = () => {
                URL.revokeObjectURL(blobUrl);
                reject(new Error('Failed to load cleaned image'));
            };

            img.src = blobUrl;
        });
    };

    const removeSelectionRect = (canvas) => {
        if (selectionRect.current) {
            canvas.remove(selectionRect.current);
            selectionRect.current = null;
        }
        const orphaned = canvas.getObjects().filter(obj => obj.isMagicMaskSelection);
        orphaned.forEach(obj => canvas.remove(obj));
        canvas.renderAll();
    };

    const setupMagicMaskCursor = useCallback((canvas) => {
        if (!canvas) return;
        canvas.defaultCursor = 'crosshair';
        canvas.hoverCursor = 'crosshair';
    }, []);

    return {
        initMagicMaskEvents,
        setupMagicMaskCursor,
        isProcessing,
        progress,
    };
}
