/**
 * Manga Studio - Pan Tool Hook
 * Handles canvas panning with mouse drag and Space+Drag
 */

import { useCallback, useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import { TOOLS, CURSORS } from '../utils/constants';

export function usePanTool() {
    const isPanning = useRef(false);
    const lastPos = useRef({ x: 0, y: 0 });

    /**
     * Initialize pan events on canvas
     * @param {fabric.Canvas} canvas
     */
    const initPanEvents = useCallback((canvas) => {
        if (!canvas) return;

        // Mouse down - start panning
        canvas.on('mouse:down', (opt) => {
            const { activeTool } = useEditorStore.getState();

            // Only pan with move tool (always pan when move tool is active, even on objects)
            if (activeTool !== TOOLS.MOVE) return;

            isPanning.current = true;
            canvas.selection = false;
            canvas.setCursor(CURSORS.GRABBING);
            canvas.discardActiveObject(); // Deselect any selected object

            lastPos.current = {
                x: opt.e.clientX,
                y: opt.e.clientY,
            };

            opt.e.preventDefault();
            opt.e.stopPropagation();
        });

        // Mouse move - perform panning (move viewport, not objects)
        canvas.on('mouse:move', (opt) => {
            if (!isPanning.current) return;

            const vpt = canvas.viewportTransform;
            const deltaX = opt.e.clientX - lastPos.current.x;
            const deltaY = opt.e.clientY - lastPos.current.y;

            // Move viewport (this moves the view, not the objects)
            vpt[4] += deltaX;
            vpt[5] += deltaY;

            lastPos.current = {
                x: opt.e.clientX,
                y: opt.e.clientY,
            };

            canvas.requestRenderAll();
        });

        // Mouse up - stop panning
        canvas.on('mouse:up', () => {
            if (!isPanning.current) return;

            isPanning.current = false;
            canvas.selection = true;

            const { activeTool } = useEditorStore.getState();
            if (activeTool === TOOLS.MOVE) {
                canvas.setCursor(CURSORS.GRAB);
            } else {
                canvas.setCursor(CURSORS.DEFAULT);
            }
        });

        // Mouse wheel - scroll vertically
        canvas.on('mouse:wheel', (opt) => {
            opt.e.preventDefault();
            opt.e.stopPropagation();

            const vpt = canvas.viewportTransform;
            const delta = opt.e.deltaY;

            // Scroll speed
            const scrollSpeed = 1;

            // Pan vertically (move viewport)
            vpt[5] -= delta * scrollSpeed;

            canvas.requestRenderAll();
        });
    }, []);

    /**
     * Start temporary pan (for Space key)
     */
    const startTempPan = useCallback((canvas) => {
        if (!canvas) return;

        canvas.selection = false;
        canvas.setCursor(CURSORS.GRAB);
        canvas.isDrawingMode = false;
    }, []);

    /**
     * End temporary pan
     */
    const endTempPan = useCallback((canvas, previousTool) => {
        if (!canvas) return;

        canvas.selection = true;

        // Restore tool state
        if (previousTool === TOOLS.BRUSH || previousTool === TOOLS.ERASER) {
            canvas.isDrawingMode = true;
        }

        canvas.setCursor(CURSORS.DEFAULT);
    }, []);

    /**
     * Reset canvas view to default
     */
    const resetView = useCallback(() => {
        const { canvas, setZoom } = useEditorStore.getState();
        if (!canvas) return;

        canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        setZoom(100);
        canvas.renderAll();
    }, []);

    return {
        initPanEvents,
        startTempPan,
        endTempPan,
        resetView,
        isPanning: () => isPanning.current,
    };
}
