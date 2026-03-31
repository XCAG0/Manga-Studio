/**
 * Manga Studio - Drawing Tools Hook
 * Handles Brush and Eraser tools with dynamic cursor
 */

import { useCallback, useRef } from 'react';
import * as fabric from 'fabric';
import { useEditorStore } from '../store/editorStore';
import { BRUSH, ERASER, TOOLS } from '../utils/constants';
import { createBrushCursor } from '../utils/canvas';

export function useDrawingTools() {
    const isDrawing = useRef(false);

    /**
     * Setup brush tool on canvas
     * @param {fabric.Canvas} canvas
     * @param {number} size
     * @param {string} color
     * @param {number} opacity - 0 to 100
     */
    const setupBrush = useCallback((canvas, size, color, opacity = BRUSH.OPACITY_DEFAULT) => {
        if (!canvas) return;

        // Enable drawing mode
        canvas.isDrawingMode = true;
        canvas.selection = false;

        // Create pencil brush
        const brush = new fabric.PencilBrush(canvas);
        brush.width = Math.max(BRUSH.SIZE_MIN, Math.min(BRUSH.SIZE_MAX, size));
        brush.color = color || BRUSH.COLOR_DEFAULT;

        // Set opacity (0-1 range)
        if (opacity < 100) {
            // Convert hex to rgba for opacity
            const hex = color || BRUSH.COLOR_DEFAULT;
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            brush.color = `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
        }

        canvas.freeDrawingBrush = brush;

        // Use simple crosshair cursor for accurate drawing point
        canvas.freeDrawingCursor = 'crosshair';
        canvas.defaultCursor = 'crosshair';

        canvas.renderAll();
    }, []);

    /**
     * Setup eraser tool on canvas
     * Uses compositing for real erasing effect
     * @param {fabric.Canvas} canvas
     * @param {number} size
     */
    const setupEraser = useCallback((canvas, size) => {
        if (!canvas) return;

        // Enable drawing mode
        canvas.isDrawingMode = true;
        canvas.selection = false;

        // Create pencil brush with background color
        const brush = new fabric.PencilBrush(canvas);
        brush.width = Math.max(ERASER.SIZE_MIN, Math.min(ERASER.SIZE_MAX, size));

        // Use canvas background color for erasing effect
        brush.color = canvas.backgroundColor || '#2a2a2a';

        canvas.freeDrawingBrush = brush;

        // Set eraser cursor (red tint)
        canvas.freeDrawingCursor = createBrushCursor(size, '#ff6666');
        canvas.defaultCursor = 'crosshair';

        canvas.renderAll();
    }, []);

    /**
     * Disable drawing mode
     * @param {fabric.Canvas} canvas
     */
    const disableDrawing = useCallback((canvas) => {
        if (!canvas) return;

        canvas.isDrawingMode = false;
        canvas.selection = true;
        canvas.defaultCursor = 'default';
        canvas.renderAll();
    }, []);

    /**
     * Adjust brush/eraser size with keyboard
     * @param {number} delta - Amount to change (-5 or +5)
     */
    const adjustSize = useCallback((delta) => {
        const store = useEditorStore.getState();
        const { activeTool, brushSize, eraserSize, setBrushSize, setEraserSize, canvas } = store;

        if (activeTool === TOOLS.BRUSH) {
            const newSize = Math.max(BRUSH.SIZE_MIN, Math.min(BRUSH.SIZE_MAX, brushSize + delta));
            setBrushSize(newSize);

            if (canvas && canvas.freeDrawingBrush) {
                canvas.freeDrawingBrush.width = newSize;
                canvas.freeDrawingCursor = createBrushCursor(newSize, store.brushColor);
            }
        } else if (activeTool === TOOLS.ERASER) {
            const newSize = Math.max(ERASER.SIZE_MIN, Math.min(ERASER.SIZE_MAX, eraserSize + delta));
            setEraserSize(newSize);

            if (canvas && canvas.freeDrawingBrush) {
                canvas.freeDrawingBrush.width = newSize;
                canvas.freeDrawingCursor = createBrushCursor(newSize, '#ff6666');
            }
        }
    }, []);

    /**
     * Update brush color
     * @param {string} color - Hex color
     */
    const updateBrushColor = useCallback((color) => {
        const store = useEditorStore.getState();
        const { canvas, brushSize } = store;

        store.setBrushColor(color);

        if (canvas && canvas.freeDrawingBrush) {
            canvas.freeDrawingBrush.color = color;
            canvas.freeDrawingCursor = createBrushCursor(brushSize, color);
        }
    }, []);

    return {
        setupBrush,
        setupEraser,
        disableDrawing,
        adjustSize,
        updateBrushColor,
        isDrawing: () => isDrawing.current,
    };
}
