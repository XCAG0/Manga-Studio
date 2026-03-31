/**
 * Manga Studio - Keyboard Shortcuts Hook
 * Language-independent keyboard shortcuts using e.code
 */

import { useEffect, useCallback, useRef } from 'react';
import * as fabric from 'fabric';
import { useEditorStore } from '../store/editorStore';
import { TOOL_KEYCODES, TOOLS } from '../utils/constants';

export function useKeyboardShortcuts() {
    const clipboardRef = useRef(null);

    const handleKeyDown = useCallback((e) => {
        // Ignore if typing in input fields
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        const { canvas, setActiveTool, undo, redo, saveState } = useEditorStore.getState();
        if (!canvas) return;

        // Tool shortcuts (single keys, no modifiers)
        if (!e.ctrlKey && !e.altKey && !e.metaKey) {
            // Check tool keycodes
            const tool = TOOL_KEYCODES[e.code];
            if (tool && e.code !== 'KeyC') { // KeyC reserved for Ctrl+C
                e.preventDefault();
                setActiveTool(tool);

                // Toggle BubbleCreator panel based on selected tool
                const { setShowBubbleCreator } = useEditorStore.getState();
                if (tool === TOOLS.BUBBLE) {
                    setShowBubbleCreator(true);
                } else {
                    setShowBubbleCreator(false);
                }
                return;
            }

            // Special keys
            switch (e.code) {
                case 'Delete':
                case 'Backspace':
                    e.preventDefault();
                    deleteSelected(canvas, saveState);
                    break;
                case 'Escape':
                    canvas.discardActiveObject();
                    canvas.renderAll();
                    break;
                case 'BracketLeft': // [ - decrease brush size
                    e.preventDefault();
                    adjustBrushSize(-5);
                    break;
                case 'BracketRight': // ] - increase brush size
                    e.preventDefault();
                    adjustBrushSize(5);
                    break;
            }
        }

        // Ctrl/Cmd shortcuts
        if (e.ctrlKey || e.metaKey) {
            switch (e.code) {
                case 'KeyZ':
                    e.preventDefault();
                    e.shiftKey ? redo() : undo();
                    break;
                case 'KeyY':
                    e.preventDefault();
                    redo();
                    break;
                case 'KeyC':
                    e.preventDefault();
                    copySelected(canvas);
                    break;
                case 'KeyV':
                    e.preventDefault();
                    pasteClipboard(canvas, saveState);
                    break;
                case 'KeyX':
                    e.preventDefault();
                    cutSelected(canvas, saveState);
                    break;
                case 'KeyA':
                    e.preventDefault();
                    selectAll(canvas);
                    break;
                case 'KeyD':
                    e.preventDefault();
                    duplicateSelected(canvas, saveState);
                    break;
                case 'KeyS':
                    e.preventDefault();
                    // Trigger auto-save via global function set by TitleBar
                    if (window.handleQuickSave) {
                        window.handleQuickSave();
                    }
                    break;
                case 'KeyO':
                    e.preventDefault();
                    // Ctrl+O: Open file, Ctrl+Shift+O: Add Up
                    if (e.shiftKey) {
                        if (window.handleAddImageUp) {
                            window.handleAddImageUp();
                        }
                    } else {
                        if (window.handleOpenFile) {
                            window.handleOpenFile();
                        }
                    }
                    break;
                case 'KeyN':
                    e.preventDefault();
                    // Ctrl+N: New Project
                    if (window.handleNewProject) {
                        window.handleNewProject();
                    }
                    break;
                case 'KeyE':
                    e.preventDefault();
                    // Ctrl+E: Export Image
                    if (window.handleExportImage) {
                        window.handleExportImage();
                    }
                    break;
            }
        }
    }, []);

    // Delete selected objects
    const deleteSelected = useCallback((canvas, saveState) => {
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length === 0) return;

        activeObjects.forEach((obj) => canvas.remove(obj));
        canvas.discardActiveObject();
        canvas.renderAll();
        saveState();
    }, []);

    // Copy selected to clipboard
    const copySelected = useCallback((canvas) => {
        const activeObject = canvas.getActiveObject();
        if (!activeObject) return;

        activeObject.clone().then((cloned) => {
            clipboardRef.current = cloned;
        });
    }, []);

    // Paste from clipboard
    const pasteClipboard = useCallback((canvas, saveState) => {
        if (!clipboardRef.current) return;

        clipboardRef.current.clone().then((cloned) => {
            canvas.discardActiveObject();

            cloned.set({
                left: (cloned.left || 0) + 20,
                top: (cloned.top || 0) + 20,
                evented: true,
            });

            if (cloned.type === 'activeSelection') {
                cloned.canvas = canvas;
                cloned.forEachObject((obj) => canvas.add(obj));
                cloned.setCoords();
            } else {
                canvas.add(cloned);
            }

            // Update clipboard for next paste
            clipboardRef.current.left = (clipboardRef.current.left || 0) + 20;
            clipboardRef.current.top = (clipboardRef.current.top || 0) + 20;

            canvas.setActiveObject(cloned);
            canvas.renderAll();
            saveState();
        });
    }, []);

    // Cut = Copy + Delete
    const cutSelected = useCallback((canvas, saveState) => {
        copySelected(canvas);
        deleteSelected(canvas, saveState);
    }, [copySelected, deleteSelected]);

    // Select all
    const selectAll = useCallback((canvas) => {
        canvas.discardActiveObject();
        const allObjects = canvas.getObjects();
        if (allObjects.length === 0) return;

        const selection = new fabric.ActiveSelection(allObjects, { canvas });
        canvas.setActiveObject(selection);
        canvas.renderAll();
    }, []);

    // Duplicate selected
    const duplicateSelected = useCallback((canvas, saveState) => {
        const activeObject = canvas.getActiveObject();
        if (!activeObject) return;

        activeObject.clone().then((cloned) => {
            cloned.set({
                left: (activeObject.left || 0) + 20,
                top: (activeObject.top || 0) + 20,
                evented: true,
            });

            if (cloned.type === 'activeSelection') {
                cloned.canvas = canvas;
                cloned.forEachObject((obj) => canvas.add(obj));
                cloned.setCoords();
            } else {
                canvas.add(cloned);
            }

            canvas.setActiveObject(cloned);
            canvas.renderAll();
            saveState();
        });
    }, []);

    // Adjust brush size
    const adjustBrushSize = useCallback((delta) => {
        const { activeTool, brushSize, eraserSize, setBrushSize, setEraserSize } = useEditorStore.getState();

        if (activeTool === TOOLS.BRUSH) {
            setBrushSize(Math.max(1, Math.min(200, brushSize + delta)));
        } else if (activeTool === TOOLS.ERASER) {
            setEraserSize(Math.max(1, Math.min(200, eraserSize + delta)));
        }
    }, []);

    // Register event listener
    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    return {
        deleteSelected,
        copySelected,
        pasteClipboard,
        selectAll,
        duplicateSelected,
    };
}
