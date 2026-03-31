/**
 * Quick Erase Tool Hook
 * Draw shapes and instantly remove content using LaMa inpainting
 * Supports: Rectangle, Ellipse, Adjustable Rectangle
 */

import { useState, useCallback, useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import * as fabric from 'fabric';
import { replaceCanvasImageSource } from '../utils/canvas';

// Shape modes
export const QUICK_ERASE_MODES = {
    RECTANGLE: 'rectangle',
    ELLIPSE: 'ellipse',
    POLYGON: 'polygon'  // Adjustable rectangle
};

export function useQuickErase() {
    const [isProcessing, setIsProcessing] = useState(false);
    const [mode, setMode] = useState(QUICK_ERASE_MODES.RECTANGLE);

    const startPointRef = useRef(null);
    const shapeRef = useRef(null);

    /**
     * Initialize quick erase events based on mode
     */
    const initQuickEraseEvents = useCallback((canvas, onComplete, currentMode) => {
        if (!canvas) return;

        const activeMode = currentMode || mode;

        if (activeMode === QUICK_ERASE_MODES.POLYGON) {
            return initAdjustableMode(canvas, onComplete);
        } else if (activeMode === QUICK_ERASE_MODES.ELLIPSE) {
            return initEllipseMode(canvas, onComplete);
        } else {
            return initRectangleMode(canvas, onComplete);
        }
    }, [mode]);

    /**
     * Rectangle mode - drag to create rectangle, instant process
     */
    const initRectangleMode = (canvas, onComplete) => {
        let isDown = false;

        const handleMouseDown = (opt) => {
            const pointer = canvas.getPointer(opt.e);
            startPointRef.current = { x: pointer.x, y: pointer.y };
            isDown = true;

            const rect = new fabric.Rect({
                left: pointer.x,
                top: pointer.y,
                width: 0,
                height: 0,
                fill: 'rgba(255, 50, 50, 0.3)',
                stroke: '#ff3333',
                strokeWidth: 2,
                strokeDashArray: [5, 5],
                selectable: false,
                evented: false,
                name: 'quick-erase-shape'
            });

            shapeRef.current = rect;
            canvas.add(rect);
            canvas.renderAll();
        };

        const handleMouseMove = (opt) => {
            if (!isDown || !startPointRef.current || !shapeRef.current) return;

            const pointer = canvas.getPointer(opt.e);
            const startX = startPointRef.current.x;
            const startY = startPointRef.current.y;

            const left = Math.min(startX, pointer.x);
            const top = Math.min(startY, pointer.y);
            const width = Math.abs(pointer.x - startX);
            const height = Math.abs(pointer.y - startY);

            shapeRef.current.set({ left, top, width, height });
            canvas.renderAll();
        };

        const handleMouseUp = async () => {
            if (!isDown || !shapeRef.current) return;
            isDown = false;

            const shape = shapeRef.current;
            const bbox = {
                left: shape.left,
                top: shape.top,
                width: shape.width,
                height: shape.height
            };

            canvas.remove(shape);
            shapeRef.current = null;
            canvas.renderAll();

            if (bbox.width > 5 && bbox.height > 5) {
                await processQuickErase(canvas, bbox, onComplete);
            }
        };

        canvas.on('mouse:down', handleMouseDown);
        canvas.on('mouse:move', handleMouseMove);
        canvas.on('mouse:up', handleMouseUp);

        return () => {
            canvas.off('mouse:down', handleMouseDown);
            canvas.off('mouse:move', handleMouseMove);
            canvas.off('mouse:up', handleMouseUp);
            if (shapeRef.current) {
                canvas.remove(shapeRef.current);
                shapeRef.current = null;
            }
        };
    };

    /**
     * Ellipse mode - drag to create ellipse, instant process
     */
    const initEllipseMode = (canvas, onComplete) => {
        let isDown = false;

        const handleMouseDown = (opt) => {
            const pointer = canvas.getPointer(opt.e);
            startPointRef.current = { x: pointer.x, y: pointer.y };
            isDown = true;

            const ellipse = new fabric.Ellipse({
                left: pointer.x,
                top: pointer.y,
                rx: 0,
                ry: 0,
                fill: 'rgba(255, 50, 50, 0.3)',
                stroke: '#ff3333',
                strokeWidth: 2,
                strokeDashArray: [5, 5],
                selectable: false,
                evented: false,
                name: 'quick-erase-shape'
            });

            shapeRef.current = ellipse;
            canvas.add(ellipse);
            canvas.renderAll();
        };

        const handleMouseMove = (opt) => {
            if (!isDown || !startPointRef.current || !shapeRef.current) return;

            const pointer = canvas.getPointer(opt.e);
            const startX = startPointRef.current.x;
            const startY = startPointRef.current.y;

            const left = Math.min(startX, pointer.x);
            const top = Math.min(startY, pointer.y);
            const rx = Math.abs(pointer.x - startX) / 2;
            const ry = Math.abs(pointer.y - startY) / 2;

            shapeRef.current.set({ left, top, rx, ry });
            canvas.renderAll();
        };

        const handleMouseUp = async () => {
            if (!isDown || !shapeRef.current) return;
            isDown = false;

            const shape = shapeRef.current;
            const bbox = {
                left: shape.left,
                top: shape.top,
                width: shape.rx * 2,
                height: shape.ry * 2
            };

            canvas.remove(shape);
            shapeRef.current = null;
            canvas.renderAll();

            if (bbox.width > 5 && bbox.height > 5) {
                await processQuickErase(canvas, bbox, onComplete);
            }
        };

        canvas.on('mouse:down', handleMouseDown);
        canvas.on('mouse:move', handleMouseMove);
        canvas.on('mouse:up', handleMouseUp);

        return () => {
            canvas.off('mouse:down', handleMouseDown);
            canvas.off('mouse:move', handleMouseMove);
            canvas.off('mouse:up', handleMouseUp);
            if (shapeRef.current) {
                canvas.remove(shapeRef.current);
                shapeRef.current = null;
            }
        };
    };

    /**
     * Adjustable mode - drag to create, adjust with handles, Enter to process
     */
    const initAdjustableMode = (canvas, onComplete) => {
        let isDrawing = false;
        let adjustableRect = null;

        const cleanup = () => {
            if (adjustableRect) {
                canvas.remove(adjustableRect);
                adjustableRect = null;
            }
            shapeRef.current = null;
            canvas.renderAll();
        };

        const handleMouseDown = (opt) => {
            if (adjustableRect) return; // Already have a rect

            const pointer = canvas.getPointer(opt.e);
            startPointRef.current = { x: pointer.x, y: pointer.y };
            isDrawing = true;

            adjustableRect = new fabric.Rect({
                left: pointer.x,
                top: pointer.y,
                width: 0,
                height: 0,
                fill: 'rgba(255, 50, 50, 0.3)',
                stroke: '#ff3333',
                strokeWidth: 2,
                strokeDashArray: [5, 5],
                selectable: true,
                hasControls: true,
                hasBorders: true,
                cornerColor: '#00ff00',
                cornerSize: 10,
                transparentCorners: false,
                name: 'quick-erase-adjustable'
            });

            shapeRef.current = adjustableRect;
            canvas.add(adjustableRect);
            canvas.renderAll();
        };

        const handleMouseMove = (opt) => {
            if (!isDrawing || !adjustableRect || !startPointRef.current) return;

            const pointer = canvas.getPointer(opt.e);
            const startX = startPointRef.current.x;
            const startY = startPointRef.current.y;

            const left = Math.min(startX, pointer.x);
            const top = Math.min(startY, pointer.y);
            const width = Math.abs(pointer.x - startX);
            const height = Math.abs(pointer.y - startY);

            adjustableRect.set({ left, top, width, height });
            canvas.renderAll();
        };

        const handleMouseUp = () => {
            if (isDrawing && adjustableRect) {
                isDrawing = false;
                canvas.setActiveObject(adjustableRect);
                canvas.renderAll();
                console.log('[QuickErase] Adjust the rectangle, then press Enter to process');
            }
        };

        const processRect = async () => {
            if (!adjustableRect) return;

            const bbox = {
                left: adjustableRect.left,
                top: adjustableRect.top,
                width: adjustableRect.width * (adjustableRect.scaleX || 1),
                height: adjustableRect.height * (adjustableRect.scaleY || 1)
            };

            cleanup();

            if (bbox.width > 5 && bbox.height > 5) {
                await processQuickErase(canvas, bbox, onComplete);
            }
        };

        const handleKeyDown = async (e) => {
            if (e.key === 'Escape') {
                cleanup();
            } else if (e.key === 'Enter' && adjustableRect) {
                await processRect();
            }
        };

        const handleDblClick = async () => {
            await processRect();
        };

        canvas.on('mouse:down', handleMouseDown);
        canvas.on('mouse:move', handleMouseMove);
        canvas.on('mouse:up', handleMouseUp);
        canvas.on('mouse:dblclick', handleDblClick);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            canvas.off('mouse:down', handleMouseDown);
            canvas.off('mouse:move', handleMouseMove);
            canvas.off('mouse:up', handleMouseUp);
            canvas.off('mouse:dblclick', handleDblClick);
            document.removeEventListener('keydown', handleKeyDown);
            cleanup();
        };
    };

    /**
     * Process quick erase - send to LaMa
     */
    const processQuickErase = async (canvas, bbox, onComplete) => {
        setIsProcessing(true);

        try {
            const bgImage = canvas.getObjects().find(obj => obj.type === 'image');
            if (!bgImage || !bgImage._element) {
                throw new Error('No image found');
            }

            const imgElement = bgImage._element;
            const originalWidth = imgElement.naturalWidth || imgElement.width;
            const originalHeight = imgElement.naturalHeight || imgElement.height;

            // Image position and scale on canvas
            const imgCanvasLeft = bgImage.left || 0;
            const imgCanvasTop = bgImage.top || 0;
            const imgScaleX = bgImage.scaleX || 1;
            const imgScaleY = bgImage.scaleY || 1;

            // bbox comes from getPointer which is already in canvas coordinates
            // We just need to convert to original image coordinates
            const origLeft = Math.max(0, (bbox.left - imgCanvasLeft) / imgScaleX);
            const origTop = Math.max(0, (bbox.top - imgCanvasTop) / imgScaleY);
            const origWidth = Math.min(bbox.width / imgScaleX, originalWidth - origLeft);
            const origHeight = Math.min(bbox.height / imgScaleY, originalHeight - origTop);

            console.log('[QuickErase] Canvas bbox:', bbox);
            console.log('[QuickErase] Image position:', { left: imgCanvasLeft, top: imgCanvasTop, scaleX: imgScaleX, scaleY: imgScaleY });
            console.log('[QuickErase] Original image coords:', { left: origLeft, top: origTop, width: origWidth, height: origHeight });
            console.log('[QuickErase] Original image size:', originalWidth, 'x', originalHeight);

            // Get full image
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = originalWidth;
            tempCanvas.height = originalHeight;
            const ctx = tempCanvas.getContext('2d');
            ctx.drawImage(imgElement, 0, 0);
            const imageBase64 = tempCanvas.toDataURL('image/png');

            // Create 4-point bbox
            const x1 = Math.round(origLeft);
            const y1 = Math.round(origTop);
            const x2 = Math.round(origLeft + origWidth);
            const y2 = Math.round(origTop + origHeight);

            const apiBbox = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];

            console.log('[QuickErase] Sending bbox:', apiBbox);

            const response = await fetch('http://127.0.0.1:5000/api/remove-text-bbox', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image: imageBase64,
                    bbox: apiBbox
                })
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Processing failed');
            }

            console.log('[QuickErase] Success! Engine:', result.engine);

            await replaceCanvasImageSource(canvas, bgImage, result.image);
            useEditorStore.getState().saveState();

            if (onComplete) {
                onComplete(true);
            }

        } catch (error) {
            console.error('[QuickErase] Error:', error);
            if (onComplete) {
                onComplete(false, error.message);
            }
        } finally {
            setIsProcessing(false);
        }
    };

    return {
        initQuickEraseEvents,
        isProcessing,
        mode,
        setMode,
        MODES: QUICK_ERASE_MODES
    };
}
