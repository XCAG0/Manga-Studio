/**
 * Manga Studio - Selection Tool Hook
 * Handles object selection, multi-select, and selection events
 */

import { useCallback, useEffect } from 'react';
import { useEditorStore } from '../store/editorStore';
import { TOOLS } from '../utils/constants';

export function useSelectionTool() {
    const { canvas, activeTool, setSelectedObject } = useEditorStore();

    // Initialize selection events
    const initSelectionEvents = useCallback((canvas) => {
        if (!canvas) return;

        // Selection created
        canvas.on('selection:created', (e) => {
            const selected = e.selected;
            if (selected && selected.length > 0) {
                const obj = selected[0];
                setSelectedObject(obj);
                // Also update activeLayerId if object has a layerId
                if (obj.layerId) {
                    useEditorStore.getState().activeLayerId = obj.layerId;
                    useEditorStore.setState({ activeLayerId: obj.layerId });
                }
            }
        });

        // Selection updated
        canvas.on('selection:updated', (e) => {
            const selected = e.selected;
            if (selected && selected.length > 0) {
                const obj = selected[0];
                setSelectedObject(obj);
                // Also update activeLayerId if object has a layerId
                if (obj.layerId) {
                    useEditorStore.setState({ activeLayerId: obj.layerId });
                }
            }
        });

        // Selection cleared - ONLY when clicking empty canvas area (upper canvas)
        canvas.on('selection:cleared', (e) => {
            const clickEvent = e.e;

            // If no click event, fabric called this programmatically - allow it
            if (!clickEvent) {
                setSelectedObject(null);
                useEditorStore.setState({ activeLayerId: null });
                return;
            }

            // Check if click was DIRECTLY on the upper canvas element
            const upperCanvas = canvas.upperCanvasEl;
            if (clickEvent.target === upperCanvas) {
                // Clicked on empty area of canvas - clear selection
                setSelectedObject(null);
                useEditorStore.setState({ activeLayerId: null });
            }
            // If click target is NOT the upper canvas (e.g., color picker, panels)
            // do NOT clear selection
        });
    }, [setSelectedObject]);

    // Enable selection mode
    const enableSelection = useCallback((canvas) => {
        if (!canvas) return;

        canvas.selection = true;
        canvas.forEachObject((obj) => {
            // For images: ONLY allow selection if explicitly marked as overlay
            if (obj.type === 'image') {
                if (obj.isBackgroundImage === false) {
                    // Overlay image - selectable
                    obj.selectable = true;
                    obj.evented = true;
                } else {
                    // Background image or undefined - LOCK IT
                    obj.selectable = false;
                    obj.evented = false;
                    obj.lockMovementX = true;
                    obj.lockMovementY = true;
                }
            } else {
                // Non-image objects can be selected
                obj.selectable = true;
                obj.evented = true;
            }
        });
        canvas.defaultCursor = 'default';
        canvas.hoverCursor = 'move';
    }, []);

    // Disable selection mode (for drawing tools)
    const disableSelection = useCallback((canvas) => {
        if (!canvas) return;

        canvas.selection = false;
        canvas.discardActiveObject();
        canvas.renderAll();
    }, []);

    // Select all objects
    const selectAll = useCallback(() => {
        const canvas = useEditorStore.getState().canvas;
        if (!canvas) return;

        canvas.discardActiveObject();
        const allObjects = canvas.getObjects();

        if (allObjects.length === 0) return;

        if (allObjects.length === 1) {
            canvas.setActiveObject(allObjects[0]);
        } else {
            // Import fabric dynamically to create ActiveSelection
            import('fabric').then(({ ActiveSelection }) => {
                const selection = new ActiveSelection(allObjects, {
                    canvas: canvas,
                });
                canvas.setActiveObject(selection);
                canvas.renderAll();
            });
        }

        canvas.renderAll();
    }, []);

    // Deselect all
    const deselectAll = useCallback(() => {
        const canvas = useEditorStore.getState().canvas;
        if (!canvas) return;

        canvas.discardActiveObject();
        canvas.renderAll();
        setSelectedObject(null);
    }, [setSelectedObject]);

    // Delete selected objects
    const deleteSelected = useCallback(() => {
        const canvas = useEditorStore.getState().canvas;
        if (!canvas) return;

        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length === 0) return;

        activeObjects.forEach((obj) => {
            canvas.remove(obj);
        });

        canvas.discardActiveObject();
        canvas.renderAll();
        useEditorStore.getState().saveState();
    }, []);

    // Move selected objects with arrow keys
    const moveSelected = useCallback((direction, distance = 1) => {
        const canvas = useEditorStore.getState().canvas;
        if (!canvas) return;

        const activeObject = canvas.getActiveObject();
        if (!activeObject) return;

        switch (direction) {
            case 'up':
                activeObject.top -= distance;
                break;
            case 'down':
                activeObject.top += distance;
                break;
            case 'left':
                activeObject.left -= distance;
                break;
            case 'right':
                activeObject.left += distance;
                break;
        }

        activeObject.setCoords();
        canvas.renderAll();
    }, []);

    // Bring selected to front
    const bringToFront = useCallback(() => {
        const canvas = useEditorStore.getState().canvas;
        if (!canvas) return;

        const activeObject = canvas.getActiveObject();
        if (!activeObject) return;

        canvas.bringObjectToFront(activeObject);
        canvas.renderAll();
        useEditorStore.getState().saveState();
    }, []);

    // Send selected to back
    const sendToBack = useCallback(() => {
        const canvas = useEditorStore.getState().canvas;
        if (!canvas) return;

        const activeObject = canvas.getActiveObject();
        if (!activeObject) return;

        canvas.sendObjectToBack(activeObject);
        canvas.renderAll();
        useEditorStore.getState().saveState();
    }, []);

    // Update selection mode based on active tool
    useEffect(() => {
        if (!canvas) return;

        if (activeTool === TOOLS.SELECT) {
            enableSelection(canvas);
        }
    }, [canvas, activeTool, enableSelection]);

    return {
        initSelectionEvents,
        enableSelection,
        disableSelection,
        selectAll,
        deselectAll,
        deleteSelected,
        moveSelected,
        bringToFront,
        sendToBack,
    };
}
