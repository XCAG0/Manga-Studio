/**
 * Manga Studio - Global State Store
 * Zustand store for application state management
 */

import { create } from 'zustand';
import { TOOLS, BRUSH, ERASER, CANVAS, HISTORY, HEALING, CLONE } from '../utils/constants';

export const useEditorStore = create((set, get) => ({
    // ==========================================
    // NAVIGATION STATE
    // ==========================================
    currentPage: 'home', // 'home' or 'editor'
    setCurrentPage: (page) => set({ currentPage: page }),

    // ==========================================
    // CANVAS STATE
    // ==========================================
    canvas: null,
    setCanvas: (canvas) => set({ canvas }),

    // ==========================================
    // ACTIVE TOOL
    // ==========================================
    activeTool: TOOLS.SELECT,
    setActiveTool: (tool) => set({ activeTool: tool }),

    // Quick Erase mode (rectangle, ellipse, polygon)
    quickEraseMode: 'rectangle',
    setQuickEraseMode: (mode) => set({ quickEraseMode: mode }),

    // ==========================================
    // BRUSH SETTINGS
    // ==========================================
    brushSize: BRUSH.SIZE_DEFAULT,
    brushColor: BRUSH.COLOR_DEFAULT,
    brushOpacity: BRUSH.OPACITY_DEFAULT,

    setBrushSize: (size) => set({
        brushSize: Math.max(BRUSH.SIZE_MIN, Math.min(BRUSH.SIZE_MAX, size))
    }),
    setBrushColor: (color) => set({ brushColor: color }),
    setBrushOpacity: (opacity) => set({
        brushOpacity: Math.max(BRUSH.OPACITY_MIN, Math.min(BRUSH.OPACITY_MAX, opacity))
    }),

    // ==========================================
    // ERASER SETTINGS
    // ==========================================
    eraserSize: ERASER.SIZE_DEFAULT,
    setEraserSize: (size) => set({
        eraserSize: Math.max(ERASER.SIZE_MIN, Math.min(ERASER.SIZE_MAX, size))
    }),

    // ==========================================
    // HEALING TOOL SETTINGS
    // ==========================================
    healingSize: HEALING.SIZE_DEFAULT,
    setHealingSize: (size) => set({
        healingSize: Math.max(HEALING.SIZE_MIN, Math.min(HEALING.SIZE_MAX, size))
    }),

    // ==========================================
    // CLONE TOOL SETTINGS
    // ==========================================
    cloneSize: CLONE.SIZE_DEFAULT,
    setCloneSize: (size) => set({
        cloneSize: Math.max(CLONE.SIZE_MIN, Math.min(CLONE.SIZE_MAX, size))
    }),

    // Clone mode: 'brush' (default) or 'square' (rectangle copy-paste)
    cloneMode: 'brush',
    setCloneMode: (mode) => set({ cloneMode: mode }),

    // ==========================================
    // COLOR REPLACE SETTINGS
    // ==========================================
    colorReplaceSource: '#000000',
    colorReplaceTarget: '#ffffff',
    colorReplaceTolerance: 50,
    setColorReplaceSource: (color) => set({ colorReplaceSource: color }),
    setColorReplaceTarget: (color) => set({ colorReplaceTarget: color }),
    setColorReplaceTolerance: (value) => set({ colorReplaceTolerance: Math.max(1, Math.min(255, value)) }),

    // ==========================================
    // ZOOM
    // ==========================================
    zoom: CANVAS.ZOOM_DEFAULT,
    setZoom: (zoom) => set({
        zoom: Math.max(CANVAS.ZOOM_MIN, Math.min(CANVAS.ZOOM_MAX, zoom))
    }),

    // ==========================================
    // SELECTED OBJECT
    // ==========================================
    selectedObject: null,
    lastSelectedObject: null, // Persists even after deselection - for color pickers
    setSelectedObject: (obj) => {
        if (obj) {
            // When selecting, also store as last selected
            set({ selectedObject: obj, lastSelectedObject: obj });
        } else {
            // When deselecting, only clear current selection (keep lastSelectedObject)
            set({ selectedObject: null });
        }
    },

    // Flag to prevent deselection while editing properties (like color picker)
    isEditingProperty: false,
    setIsEditingProperty: (val) => set({ isEditingProperty: val }),

    // ==========================================
    // CROP TOOL
    // ==========================================
    cropRect: null,
    setCropRect: (rect) => set({ cropRect: rect }),

    // ==========================================
    // PANEL VISIBILITY
    // ==========================================
    showProperties: true,
    showLayers: true,
    showTextManager: true,
    showBubbleCreator: false,
    toggleProperties: () => set((state) => ({ showProperties: !state.showProperties })),
    toggleLayers: () => set((state) => ({ showLayers: !state.showLayers })),
    toggleTextManager: () => set((state) => ({ showTextManager: !state.showTextManager })),
    toggleBubbleCreator: () => set((state) => ({ showBubbleCreator: !state.showBubbleCreator })),
    setShowBubbleCreator: (show) => set({ showBubbleCreator: show }),

    // ==========================================
    // FILE INFO
    // ==========================================
    fileName: null,
    filePath: null,
    isModified: false,

    setFileName: (name) => set({ fileName: name }),
    setFilePath: (path) => set({ filePath: path }),
    setIsModified: (modified) => set({ isModified: modified }),

    // ==========================================
    // LAYERS
    // ==========================================
    layers: [],
    activeLayerId: null,

    addLayer: (layer) => set((state) => {
        const newLayer = {
            id: Date.now(),
            name: `Layer ${state.layers.length + 1}`,
            visible: true,
            locked: false,
            opacity: 100,
            ...layer,
        };
        return {
            layers: [...state.layers, newLayer],
            activeLayerId: newLayer.id,
        };
    }),

    removeLayer: (id) => {
        const state = get();
        const layer = state.layers.find((l) => l.id === id);

        // Remove object from canvas
        if (layer && layer.objectRef && state.canvas) {
            state.canvas.remove(layer.objectRef);
            state.canvas.renderAll();
        }

        const filteredLayers = state.layers.filter((l) => l.id !== id);
        set({
            layers: filteredLayers,
            activeLayerId: state.activeLayerId === id
                ? filteredLayers[0]?.id || null
                : state.activeLayerId,
        });
    },

    setActiveLayer: (id) => {
        const state = get();
        const layer = state.layers.find((l) => l.id === id);

        // Select the canvas object when layer is clicked
        if (layer && layer.objectRef && state.canvas) {
            state.canvas.setActiveObject(layer.objectRef);
            state.canvas.renderAll();
            // Also update selectedObject in store
            set({ selectedObject: layer.objectRef, activeLayerId: id });
        } else {
            set({ activeLayerId: id });
        }
    },

    updateLayer: (id, updates) => {
        const state = get();
        const layer = state.layers.find((l) => l.id === id);
        if (!layer) return;

        // If opacity is being updated, sync with canvas object
        if (updates.opacity !== undefined && layer.objectRef) {
            layer.objectRef.opacity = updates.opacity / 100;
            if (state.canvas) {
                state.canvas.renderAll();
            }
        }

        // Update layer state
        set({
            layers: state.layers.map((l) => (l.id === id ? { ...l, ...updates } : l)),
        });
    },

    reorderLayers: (fromIndex, toIndex) => {
        const state = get();
        const newLayers = [...state.layers];
        const [moved] = newLayers.splice(fromIndex, 1);
        newLayers.splice(toIndex, 0, moved);

        // Update z-index on canvas
        // Layers are displayed top-to-bottom, but canvas z-index is bottom-to-top
        // So we need to reverse the order when applying to canvas
        if (state.canvas) {
            newLayers.slice().reverse().forEach((layer, index) => {
                if (layer.objectRef) {
                    state.canvas.moveTo(layer.objectRef, index);
                }
            });
            state.canvas.renderAll();
        }

        set({ layers: newLayers });
    },

    toggleLayerVisibility: (id) => {
        const state = get();
        const layer = state.layers.find((l) => l.id === id);
        if (!layer) return;

        const newVisible = !layer.visible;

        // Update canvas object visibility
        if (layer.objectRef) {
            layer.objectRef.visible = newVisible;
            if (state.canvas) {
                state.canvas.renderAll();
            }
        }

        // Update layer state
        set({
            layers: state.layers.map((l) =>
                l.id === id ? { ...l, visible: newVisible } : l
            ),
        });
    },

    toggleLayerLock: (id) => {
        const state = get();
        const layer = state.layers.find((l) => l.id === id);
        if (!layer) return;

        const newLocked = !layer.locked;

        // Update canvas object lock state
        if (layer.objectRef) {
            layer.objectRef.selectable = !newLocked;
            layer.objectRef.evented = !newLocked;
            if (state.canvas) {
                state.canvas.renderAll();
            }
        }

        set({
            layers: state.layers.map((l) =>
                l.id === id ? { ...l, locked: newLocked } : l
            ),
        });
    },

    // ==========================================
    // LAYER-OBJECT SYNC FUNCTIONS
    // ==========================================

    /**
     * Create a layer from a canvas object
     * Called when object:added fires on canvas
     */
    createLayerFromObject: (fabricObject) => {
        // Check if layer with this ID already exists in store
        const existingLayers = get().layers;
        if (fabricObject.layerId && existingLayers.some(l => l.id === fabricObject.layerId)) {
            // Layer already exists, skip
            return;
        }

        // Generate unique layer ID if not present
        const layerId = fabricObject.layerId || Date.now() + Math.random();

        // Assign layerId to the fabric object
        fabricObject.layerId = layerId;

        // Determine layer name based on object type
        let name = 'Object';
        switch (fabricObject.type) {
            case 'rect': name = 'Rectangle'; break;
            case 'ellipse': case 'circle': name = 'Ellipse'; break;
            case 'i-text': case 'text': name = `Text: "${(fabricObject.text || '').substring(0, 10)}"`; break;
            case 'path': name = 'Drawing'; break;
            case 'image': name = 'Image'; break;
            case 'group': name = 'Group'; break;
            default: name = fabricObject.type || 'Object';
        }

        set((state) => ({
            layers: [
                {
                    id: layerId,
                    name: name,
                    visible: true,
                    locked: false,
                    opacity: 100,
                    objectRef: fabricObject,  // Reference to fabric object
                },
                ...state.layers,  // New layers on top
            ],
            activeLayerId: layerId,
        }));
    },

    /**
     * Remove layer when object is removed from canvas
     */
    removeLayerByObjectId: (layerId) => set((state) => ({
        layers: state.layers.filter((l) => l.id !== layerId),
        activeLayerId: state.activeLayerId === layerId
            ? state.layers[0]?.id || null
            : state.activeLayerId,
    })),

    /**
     * Get layer by its ID
     */
    getLayerById: (id) => {
        return get().layers.find((l) => l.id === id);
    },

    /**
     * Get layer by fabric object
     */
    getLayerByObject: (fabricObject) => {
        if (!fabricObject?.layerId) return null;
        return get().layers.find((l) => l.id === fabricObject.layerId);
    },

    // ==========================================
    // TEXT MANAGER LINES (for project save/load)
    // ==========================================
    textManagerLines: [],

    setTextManagerLines: (lines) => set({ textManagerLines: lines }),

    addTextLine: (text) => set((state) => ({
        textManagerLines: [...state.textManagerLines, {
            id: Date.now() + Math.random(),
            text: text
        }]
    })),

    addTextLines: (items) => set((state) => ({
        textManagerLines: [
            ...state.textManagerLines,
            ...items.map((item, i) => {
                // Support both string format (old) and object format (new with bbox)
                if (typeof item === 'string') {
                    return {
                        id: Date.now() + i + Math.random(),
                        text: item
                    };
                } else {
                    return {
                        id: Date.now() + i + Math.random(),
                        text: item.text,
                        bbox: item.bbox || null,
                        lineBoxes: item.lineBoxes || null,
                    };
                }
            })
        ]
    })),

    removeTextLine: (id) => set((state) => ({
        textManagerLines: state.textManagerLines.filter(l => l.id !== id)
    })),

    clearTextLines: () => set({ textManagerLines: [] }),

    // ==========================================
    // HISTORY (UNDO/REDO)
    // ==========================================
    history: [],
    historyIndex: -1,
    canUndo: false,
    canRedo: false,

    saveState: () => {
        const { canvas, history, historyIndex } = get();
        if (!canvas) return;

        // Remove temporary objects before saving (selection shapes, preview circles, etc.)
        const tempObjects = canvas.getObjects().filter(obj =>
            obj.name === 'quick-erase-shape' ||
            obj.name === 'quick-erase-adjustable' ||
            obj.name === 'region-select-rect' ||
            obj.isHealingPreview === true ||
            // Clone tool temporary objects
            obj.isCloneSelectionRect === true ||
            obj.isCloneCursorPreview === true ||
            obj.isCloneSourceMarker === true ||
            obj.isCloneSourceIndicator === true ||
            obj.isCloneTargetPreview === true
        );

        // Temporarily remove them
        tempObjects.forEach(obj => canvas.remove(obj));

        const json = canvas.toJSON();

        // Add them back (in case they're still needed)
        tempObjects.forEach(obj => canvas.add(obj));

        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(json);

        // Limit history
        if (newHistory.length > HISTORY.MAX_STATES) {
            newHistory.shift();
        }

        set({
            history: newHistory,
            historyIndex: newHistory.length - 1,
            canUndo: newHistory.length > 1,
            canRedo: false,
            isModified: true,
        });
    },

    undo: () => {
        const { canvas, history, historyIndex } = get();
        if (!canvas || historyIndex <= 0) return;

        // Remove any temporary Clone tool objects before restoring state
        const tempCloneObjects = canvas.getObjects().filter(obj =>
            obj.isCloneSelectionRect ||
            obj.isCloneCursorPreview ||
            obj.isCloneSourceMarker ||
            obj.isCloneSourceIndicator ||
            obj.isCloneTargetPreview
        );
        tempCloneObjects.forEach(obj => canvas.remove(obj));

        const newIndex = historyIndex - 1;
        canvas.loadFromJSON(history[newIndex], () => {
            canvas.renderAll();
            set({
                historyIndex: newIndex,
                canUndo: newIndex > 0,
                canRedo: true,
            });
        });
    },

    redo: () => {
        const { canvas, history, historyIndex } = get();
        if (!canvas || historyIndex >= history.length - 1) return;

        const newIndex = historyIndex + 1;
        canvas.loadFromJSON(history[newIndex], () => {
            canvas.renderAll();
            set({
                historyIndex: newIndex,
                canUndo: true,
                canRedo: newIndex < history.length - 1,
            });
        });
    },

    clearHistory: () => set({
        history: [],
        historyIndex: -1,
        canUndo: false,
        canRedo: false,
    }),

    // ==========================================
    // RESET STATE
    // ==========================================
    reset: () => set({
        activeTool: TOOLS.SELECT,
        brushSize: BRUSH.SIZE_DEFAULT,
        brushColor: BRUSH.COLOR_DEFAULT,
        brushOpacity: BRUSH.OPACITY_DEFAULT,
        eraserSize: ERASER.SIZE_DEFAULT,
        zoom: CANVAS.ZOOM_DEFAULT,
        selectedObject: null,
        fileName: null,
        filePath: null,
        isModified: false,
        layers: [],
        activeLayerId: null,
        textManagerLines: [],
        history: [],
        historyIndex: -1,
        canUndo: false,
        canRedo: false,
    }),
}));
