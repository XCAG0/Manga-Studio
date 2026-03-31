/**
 * Manga Studio - Shape Tools Hook
 * Handles Rectangle and Ellipse drawing with proper event handling
 */

import { useCallback, useRef } from 'react';
import * as fabric from 'fabric';
import { useEditorStore } from '../store/editorStore';
import { TOOLS, SHAPES } from '../utils/constants';

export function useShapeTools() {
    const isDrawingShape = useRef(false);
    const startPoint = useRef({ x: 0, y: 0 });
    const currentShape = useRef(null);
    const cleanupRef = useRef(null);

    /**
     * Initialize shape drawing events on canvas
     * @param {fabric.Canvas} canvas
     */
    const initShapeEvents = useCallback((canvas) => {
        if (!canvas) return;

        // Clean up previous listeners
        if (cleanupRef.current) {
            cleanupRef.current();
        }

        const handleMouseDown = (opt) => {
            const { activeTool, brushColor } = useEditorStore.getState();

            // Only handle shape tools
            if (activeTool !== TOOLS.RECTANGLE && activeTool !== TOOLS.ELLIPSE) {
                return;
            }

            // CRITICAL: Don't create new shape if clicking on existing object
            if (opt.target) {
                return;
            }

            isDrawingShape.current = true;
            const pointer = canvas.getPointer(opt.e);
            startPoint.current = { x: pointer.x, y: pointer.y };

            // Create initial shape
            const shapeConfig = {
                left: pointer.x,
                top: pointer.y,
                fill: SHAPES.FILL_DEFAULT,
                stroke: brushColor || SHAPES.STROKE_DEFAULT,
                strokeWidth: SHAPES.STROKE_WIDTH_DEFAULT,
                selectable: false,
                evented: false,
                originX: 'left',
                originY: 'top',
            };

            if (activeTool === TOOLS.RECTANGLE) {
                currentShape.current = new fabric.Rect({
                    ...shapeConfig,
                    width: 0,
                    height: 0,
                });
            } else if (activeTool === TOOLS.ELLIPSE) {
                currentShape.current = new fabric.Ellipse({
                    ...shapeConfig,
                    rx: 0,
                    ry: 0,
                    originX: 'center',
                    originY: 'center',
                });
            }

            if (currentShape.current) {
                canvas.add(currentShape.current);
                canvas.renderAll();
            }
        };

        const handleMouseMove = (opt) => {
            if (!isDrawingShape.current || !currentShape.current) return;

            const { activeTool } = useEditorStore.getState();
            if (activeTool !== TOOLS.RECTANGLE && activeTool !== TOOLS.ELLIPSE) return;

            const pointer = canvas.getPointer(opt.e);
            let width = pointer.x - startPoint.current.x;
            let height = pointer.y - startPoint.current.y;

            // Shift for square/circle
            if (opt.e.shiftKey) {
                const size = Math.max(Math.abs(width), Math.abs(height));
                width = width < 0 ? -size : size;
                height = height < 0 ? -size : size;
            }

            if (activeTool === TOOLS.RECTANGLE) {
                currentShape.current.set({
                    left: width < 0 ? startPoint.current.x + width : startPoint.current.x,
                    top: height < 0 ? startPoint.current.y + height : startPoint.current.y,
                    width: Math.abs(width),
                    height: Math.abs(height),
                });
            } else if (activeTool === TOOLS.ELLIPSE) {
                currentShape.current.set({
                    left: startPoint.current.x + width / 2,
                    top: startPoint.current.y + height / 2,
                    rx: Math.abs(width) / 2,
                    ry: Math.abs(height) / 2,
                });
            }

            canvas.renderAll();
        };

        const handleMouseUp = () => {
            if (!isDrawingShape.current || !currentShape.current) return;

            isDrawingShape.current = false;
            const shape = currentShape.current;

            // Check minimum size
            let isValidSize = false;
            if (shape.type === 'rect') {
                isValidSize = shape.width >= SHAPES.MIN_SIZE && shape.height >= SHAPES.MIN_SIZE;
            } else if (shape.type === 'ellipse') {
                isValidSize = shape.rx >= SHAPES.MIN_SIZE / 2 && shape.ry >= SHAPES.MIN_SIZE / 2;
            }

            if (isValidSize) {
                shape.set({
                    selectable: true,
                    evented: true,
                });
                // IMPORTANT: Update coordinates after changing selectable to fix position shift
                shape.setCoords();
                canvas.setActiveObject(shape);
                useEditorStore.getState().saveState();
            } else {
                canvas.remove(shape);
            }

            canvas.renderAll();
            currentShape.current = null;
        };

        // Register events
        canvas.on('mouse:down', handleMouseDown);
        canvas.on('mouse:move', handleMouseMove);
        canvas.on('mouse:up', handleMouseUp);

        // Store cleanup
        cleanupRef.current = () => {
            canvas.off('mouse:down', handleMouseDown);
            canvas.off('mouse:move', handleMouseMove);
            canvas.off('mouse:up', handleMouseUp);
        };

        return cleanupRef.current;
    }, []);

    /**
     * Cancel current shape drawing
     */
    const cancelShape = useCallback(() => {
        const canvas = useEditorStore.getState().canvas;
        if (currentShape.current && canvas) {
            canvas.remove(currentShape.current);
            canvas.renderAll();
        }
        isDrawingShape.current = false;
        currentShape.current = null;
    }, []);

    return {
        initShapeEvents,
        cancelShape,
        isDrawingShape: () => isDrawingShape.current,
    };
}
