/**
 * Manga Studio - Main Canvas Component
 * The central editing area with Fabric.js integration
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as fabric from 'fabric';
import { FolderOpen } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { usePanTool } from '../../hooks/usePanTool';
import { useDrawingTools } from '../../hooks/useDrawingTools';
import { useShapeTools } from '../../hooks/useShapeTools';
import { useTextTool } from '../../hooks/useTextTool';
import { useSelectionTool } from '../../hooks/useSelectionTool';
import { useCropTool } from '../../hooks/useCropTool';
import { useHealingTool } from '../../hooks/useHealingTool';
import { useCloneTool } from '../../hooks/useCloneTool';
import { useColorReplace } from '../../hooks/useColorReplace';
import { useMagicMask } from '../../hooks/useMagicMask';
import { useRegionDetect } from '../../hooks/useRegionDetect';
import { useQuickErase } from '../../hooks/useQuickErase';

import { useContextMenu } from '../../hooks/useContextMenu';
import { CANVAS, TOOLS, CURSORS } from '../../utils/constants';
import { addImageToCanvas } from '../../utils/canvas';
import { readFileAsDataURL, getDroppedFile, isSupportedImageFormat } from '../../utils/file';
import ContextMenu from '../ContextMenu/ContextMenu';
import RegionDetectModal from '../RegionDetectModal/RegionDetectModal';
import './Canvas.css';

function Canvas() {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const spaceKeyRef = useRef(false);
    const previousToolRef = useRef(null);
    const regionDetectCleanupRef = useRef(null);

    // Loading state for project loading
    const [isLoadingProject, setIsLoadingProject] = useState(!!window.pendingProjectData);

    // Region Detection state
    const [showRegionModal, setShowRegionModal] = useState(false);
    const [selectedRegion, setSelectedRegion] = useState(null);

    // Store
    const {
        setCanvas,
        activeTool,
        brushSize,
        brushColor,
        brushOpacity,
        eraserSize,
        zoom,
        setZoom,
        saveState,
        setSelectedObject,
        setFileName,
        setFilePath,
        canvas: storeCanvas,
        createLayerFromObject,
        removeLayerByObjectId,
        quickEraseMode,
    } = useEditorStore();

    // Initialize hooks
    useKeyboardShortcuts();
    const { initPanEvents, startTempPan, endTempPan } = usePanTool();
    const { setupBrush, setupEraser } = useDrawingTools();
    const { initShapeEvents } = useShapeTools();
    const { createText } = useTextTool();
    const { initSelectionEvents, enableSelection, disableSelection } = useSelectionTool();
    const { initCropEvents } = useCropTool();
    const { initHealingEvents, setupHealingCursor } = useHealingTool();
    const { initCloneEvents, setupCloneCursor, cleanupIndicators: cleanupCloneIndicators } = useCloneTool();
    const { initColorReplaceEvents, setupColorReplace } = useColorReplace();
    const { initMagicMaskEvents, setupMagicMaskCursor, isProcessing: isMagicMaskProcessing, progress: magicMaskProgress } = useMagicMask();
    const { initRegionDetectEvents, isProcessing: isRegionProcessing } = useRegionDetect();
    const { initQuickEraseEvents, isProcessing: isQuickEraseProcessing } = useQuickErase();

    // Cleanup refs
    const quickEraseCleanupRef = useRef(null);

    // Region detection callback
    const handleRegionSelected = useCallback((region) => {
        setSelectedRegion(region);
        setShowRegionModal(true);
    }, []);

    // Quick erase callback
    const handleQuickEraseComplete = useCallback((success, error) => {
        if (!success && error) {
            console.error('[Canvas] Quick erase failed:', error);
        }
    }, []);


    // Context Menu
    const {
        isVisible: contextMenuVisible,
        position: contextMenuPosition,
        targetObject: contextMenuTarget,
        menuRef: contextMenuRef,
        initContextMenu,
        hideMenu: hideContextMenu,
        fillShape,
        removeFill,
        deleteObject,
        duplicateObject,
        bringToFront,
        sendToBack,
    } = useContextMenu();

    // ==========================================
    // CANVAS INITIALIZATION
    // ==========================================
    useEffect(() => {
        if (!canvasRef.current) return;

        // Start canvas at minimal size - will resize to match first image
        const canvas = new fabric.Canvas(canvasRef.current, {
            backgroundColor: '#2a2a2a',
            width: 100,
            height: 100,
            selection: true,
            preserveObjectStacking: true,
            renderOnAddRemove: false,
        });

        // Initialize all tool events
        initSelectionEvents(canvas);
        initPanEvents(canvas);
        initShapeEvents(canvas);
        initContextMenu(canvas);
        initCropEvents(canvas);
        initHealingEvents(canvas);
        initCloneEvents(canvas);
        initColorReplaceEvents(canvas);
        initMagicMaskEvents(canvas);


        // Object modification events
        canvas.on('object:modified', () => saveState());

        // Save state when brush path is created
        canvas.on('path:created', () => {
            saveState();
        });

        // Layer sync events
        canvas.on('object:added', (e) => {
            canvas.renderAll();
            // Create layer for new object
            if (e.target) {
                // Skip temporary objects (previews, indicators, selection rects)
                if (
                    e.target.isHealingPreview ||
                    e.target.isCloneSelectionRect ||
                    e.target.isCloneCursorPreview ||
                    e.target.isCloneSourceMarker ||
                    e.target.isCloneSourceIndicator ||
                    e.target.isCloneTargetPreview ||
                    e.target.name === 'quick-erase-shape' ||
                    e.target.name === 'quick-erase-adjustable' ||
                    e.target.name === 'region-select-rect'
                ) {
                    return; // Don't create layer for temporary objects
                }

                useEditorStore.getState().createLayerFromObject(e.target);

                // For images: Lock by default, only allow selection for explicit overlays
                if (e.target.type === 'image') {
                    console.log('[Canvas] object:added image - isBackgroundImage:', e.target.isBackgroundImage, 'type:', typeof e.target.isBackgroundImage);
                    // Only Add Up images (isBackgroundImage: false) should be selectable
                    // ALL other images (isBackgroundImage: true or undefined) should be LOCKED
                    if (e.target.isBackgroundImage === false) {
                        // This is an overlay image from "Add Up" - keep it selectable
                        e.target.set({
                            selectable: true,
                            evented: true,
                            hasControls: true,
                            hasBorders: true,
                            lockMovementX: false,
                            lockMovementY: false
                        });
                        console.log('[Canvas] Added overlay image (selectable)');
                    } else {
                        // Background image or any image without explicit false - LOCK IT
                        e.target.set({
                            selectable: false,
                            evented: false,
                            hasControls: false,
                            hasBorders: false,
                            lockMovementX: true,
                            lockMovementY: true,
                            isBackgroundImage: true  // Mark it as background if not set
                        });
                        console.log('[Canvas] Added background image (locked)');
                    }
                }
            }
        });

        canvas.on('object:removed', (e) => {
            // Remove layer when object is removed
            if (e.target && e.target.layerId) {
                useEditorStore.getState().removeLayerByObjectId(e.target.layerId);
            }
        });

        // Set canvas in store
        setCanvas(canvas);
        saveState();
        canvas.renderAll();

        // Load pending project if coming from HomePage
        if (window.pendingProjectData) {
            const projectData = window.pendingProjectData;

            const loadPendingProject = async () => {
                try {
                    const { restoreCanvasFromProject } = await import('../../services/projectService');

                    console.log('[Canvas] Loading project:', projectData?.name || 'Unknown');
                    console.log('[Canvas] Project data keys:', Object.keys(projectData || {}));

                    if (!projectData) {
                        console.error('[Canvas] No project data available');
                        setIsLoadingProject(false);
                        return;
                    }

                    const success = await restoreCanvasFromProject(canvas, projectData);

                    if (success) {
                        console.log('[Canvas] ✅ Project restored successfully');
                        console.log('[Canvas] Objects after restore:', canvas.getObjects().length);

                        // Force canvas update
                        canvas.requestRenderAll();
                    } else {
                        console.error('[Canvas] Failed to restore project');
                    }

                    // Clear pending data and update loading state
                    window.pendingProjectData = null;
                    setIsLoadingProject(false);
                } catch (error) {
                    console.error('[Canvas] Load error:', error);
                    window.pendingProjectData = null;
                    setIsLoadingProject(false);
                }
            };

            // Small delay to ensure canvas is fully initialized
            setTimeout(loadPendingProject, 300);
        }

        // Add scroll listener to recalculate canvas offset when container scrolls
        const container = containerRef.current;
        const handleScroll = () => {
            if (canvas) {
                canvas.calcOffset();
            }
        };
        if (container) {
            container.addEventListener('scroll', handleScroll);
        }

        return () => {
            if (container) {
                container.removeEventListener('scroll', handleScroll);
            }
            canvas.dispose();
        };
    }, []);

    // ==========================================
    // TOOL CHANGE HANDLER
    // ==========================================
    useEffect(() => {
        const canvas = useEditorStore.getState().canvas;
        if (!canvas) return;

        // Cleanup indicators from previous tool
        cleanupCloneIndicators(canvas);

        // Cleanup region detect events if switching away from that tool
        if (regionDetectCleanupRef.current && activeTool !== TOOLS.REGION_DETECT) {
            regionDetectCleanupRef.current();
            regionDetectCleanupRef.current = null;
        }

        // Cleanup quick erase events if switching away from that tool
        if (quickEraseCleanupRef.current && activeTool !== TOOLS.QUICK_ERASE) {
            quickEraseCleanupRef.current();
            quickEraseCleanupRef.current = null;
        }

        // Reset canvas state
        canvas.isDrawingMode = false;
        canvas.selection = true;

        switch (activeTool) {
            case TOOLS.SELECT:
                enableSelection(canvas);
                canvas.defaultCursor = CURSORS.DEFAULT;
                canvas.hoverCursor = CURSORS.MOVE;
                break;

            case TOOLS.MOVE:
                disableSelection(canvas);
                canvas.defaultCursor = CURSORS.GRAB;
                canvas.hoverCursor = CURSORS.GRAB;
                break;

            case TOOLS.BRUSH:
                disableSelection(canvas);
                setupBrush(canvas, brushSize, brushColor, brushOpacity);
                break;

            case TOOLS.ERASER:
                disableSelection(canvas);
                setupEraser(canvas, eraserSize);
                break;

            case TOOLS.TEXT:
                // For text tool, keep text objects selectable so we can edit their properties
                canvas.selection = true;
                canvas.defaultCursor = CURSORS.TEXT;
                canvas.hoverCursor = CURSORS.TEXT;
                // Make text objects selectable, but not other objects
                canvas.forEachObject((obj) => {
                    if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') {
                        obj.evented = true;
                        obj.selectable = true;
                    } else {
                        obj.evented = false;
                        obj.selectable = false;
                    }
                });
                break;

            case TOOLS.RECTANGLE:
            case TOOLS.ELLIPSE:
                disableSelection(canvas);
                canvas.defaultCursor = CURSORS.CROSSHAIR;
                canvas.hoverCursor = CURSORS.CROSSHAIR;
                canvas.forEachObject((obj) => {
                    obj.evented = false;
                    obj.selectable = false;
                });
                break;

            case TOOLS.EYEDROPPER:
                disableSelection(canvas);
                canvas.defaultCursor = CURSORS.CROSSHAIR;
                canvas.hoverCursor = CURSORS.CROSSHAIR;
                break;

            case TOOLS.CROP:
                disableSelection(canvas);
                canvas.defaultCursor = CURSORS.CROSSHAIR;
                canvas.hoverCursor = CURSORS.CROSSHAIR;
                // Make all objects non-evented so crop can draw over them
                canvas.forEachObject((obj) => {
                    obj.evented = false;
                    obj.selectable = false;
                });
                break;

            case TOOLS.HEALING:
                disableSelection(canvas);
                canvas.isDrawingMode = false;
                canvas.defaultCursor = CURSORS.CROSSHAIR;
                canvas.hoverCursor = CURSORS.CROSSHAIR;
                // Make all objects non-interactive during healing
                canvas.forEachObject((obj) => {
                    obj.evented = false;
                    obj.selectable = false;
                });
                break;

            case TOOLS.CLONE:
                disableSelection(canvas);
                canvas.isDrawingMode = false;
                canvas.defaultCursor = 'copy';
                canvas.hoverCursor = 'copy';
                // Make all objects non-interactive during cloning
                canvas.forEachObject((obj) => {
                    obj.evented = false;
                    obj.selectable = false;
                });
                break;

            case TOOLS.COLOR_REPLACE:
                disableSelection(canvas);
                canvas.isDrawingMode = false;
                canvas.defaultCursor = CURSORS.CROSSHAIR;
                canvas.hoverCursor = CURSORS.CROSSHAIR;
                // Make all objects non-interactive so we can draw rectangle
                canvas.getObjects().forEach(obj => {
                    obj.set({ selectable: false, evented: false });
                });
                setupColorReplace(canvas);
                break;

            case TOOLS.MAGIC_MASK:
                disableSelection(canvas);
                canvas.isDrawingMode = false;
                setupMagicMaskCursor(canvas);
                // Make all objects non-interactive
                canvas.getObjects().forEach(obj => {
                    obj.set({ selectable: false, evented: false });
                });
                break;

            case TOOLS.REGION_DETECT:
                disableSelection(canvas);
                canvas.isDrawingMode = false;
                canvas.defaultCursor = CURSORS.CROSSHAIR;
                canvas.hoverCursor = CURSORS.CROSSHAIR;
                // Make all objects non-interactive
                canvas.getObjects().forEach(obj => {
                    obj.set({ selectable: false, evented: false });
                });
                // Cleanup previous region detect events first
                if (regionDetectCleanupRef.current) {
                    regionDetectCleanupRef.current();
                }
                // Initialize region selection events and store cleanup
                regionDetectCleanupRef.current = initRegionDetectEvents(canvas, handleRegionSelected);
                break;

            case TOOLS.QUICK_ERASE:
                disableSelection(canvas);
                canvas.isDrawingMode = false;
                canvas.defaultCursor = CURSORS.CROSSHAIR;
                canvas.hoverCursor = CURSORS.CROSSHAIR;
                // Make all objects non-interactive and lock movement
                canvas.getObjects().forEach(obj => {
                    obj.set({
                        selectable: false,
                        evented: false,
                        lockMovementX: true,
                        lockMovementY: true
                    });
                });
                // Cleanup previous quick erase events first
                if (quickEraseCleanupRef.current) {
                    quickEraseCleanupRef.current();
                }
                // Initialize quick erase events with current mode
                quickEraseCleanupRef.current = initQuickEraseEvents(canvas, handleQuickEraseComplete, quickEraseMode);
                break;



            default:
                canvas.defaultCursor = CURSORS.DEFAULT;
        }

        canvas.renderAll();
    }, [activeTool, brushSize, brushColor, brushOpacity, eraserSize, setupBrush, setupEraser, enableSelection, disableSelection, quickEraseMode]);

    // ==========================================
    // TEXT TOOL DOUBLE-CLICK HANDLER
    // ==========================================
    useEffect(() => {
        const canvas = useEditorStore.getState().canvas;
        if (!canvas) return;

        const handleTextDblClick = (opt) => {
            const currentTool = useEditorStore.getState().activeTool;
            if (currentTool !== TOOLS.TEXT) return;

            // Don't create text if clicking on an existing object
            if (opt.target) return;

            const pointer = canvas.getPointer(opt.e);
            createText(canvas, pointer.x, pointer.y);
        };

        canvas.on('mouse:dblclick', handleTextDblClick);

        return () => {
            canvas.off('mouse:dblclick', handleTextDblClick);
        };
    }, [createText]);

    // ==========================================
    // ZOOM HANDLER
    // ==========================================
    useEffect(() => {
        const canvas = useEditorStore.getState().canvas;
        if (!canvas) return;

        const center = canvas.getCenter();
        canvas.zoomToPoint(new fabric.Point(center.left, center.top), zoom / 100);
        canvas.renderAll();
    }, [zoom]);

    // ==========================================
    // SPACE KEY HANDLER (Temporary Pan)
    // ==========================================
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Skip pan shortcut if text tool is active or text is being edited
            const { activeTool, canvas } = useEditorStore.getState();
            if (activeTool === TOOLS.TEXT) return;

            // Also skip if any text object is currently being edited
            const activeObj = canvas?.getActiveObject();
            if (activeObj && (activeObj.type === 'textbox' || activeObj.type === 'i-text') && activeObj.isEditing) {
                return;
            }

            if (e.code === 'KeyP' && !spaceKeyRef.current) {
                e.preventDefault();
                spaceKeyRef.current = true;
                previousToolRef.current = activeTool;

                if (canvas) {
                    startTempPan(canvas);
                }
            }
        };

        const handleKeyUp = (e) => {
            if (e.code === 'KeyP' && spaceKeyRef.current) {
                spaceKeyRef.current = false;

                const canvas = useEditorStore.getState().canvas;
                if (canvas) {
                    endTempPan(canvas, previousToolRef.current);

                    // Restore previous tool state
                    const prevTool = previousToolRef.current;
                    if (prevTool === TOOLS.BRUSH) {
                        const { brushSize, brushColor, brushOpacity } = useEditorStore.getState();
                        setupBrush(canvas, brushSize, brushColor, brushOpacity);
                    } else if (prevTool === TOOLS.ERASER) {
                        const { eraserSize } = useEditorStore.getState();
                        setupEraser(canvas, eraserSize);
                    }
                }
                previousToolRef.current = null;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [startTempPan, endTempPan, setupBrush, setupEraser]);

    // ==========================================
    // WHEEL ZOOM HANDLER
    // ==========================================
    const handleWheel = useCallback((e) => {
        if (e.ctrlKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -CANVAS.ZOOM_STEP : CANVAS.ZOOM_STEP;
            setZoom(zoom + delta);
        }
    }, [zoom, setZoom]);

    // ==========================================
    // CANVAS CLICK HANDLER
    // ==========================================
    const handleCanvasClick = useCallback((e) => {
        const canvas = useEditorStore.getState().canvas;
        const currentTool = useEditorStore.getState().activeTool;
        if (!canvas) return;

        // Text tool - create text on click
        if (currentTool === TOOLS.TEXT) {
            const target = canvas.findTarget(e);
            if (target && (target.type === 'i-text' || target.type === 'textbox')) return;

            const rect = canvasRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            createText(canvas, x, y);
        }

        // Eyedropper - pick color
        if (currentTool === TOOLS.EYEDROPPER) {
            const rect = canvasRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const ctx = canvas.getContext('2d');
            const pixel = ctx.getImageData(x, y, 1, 1).data;
            const color = `#${[pixel[0], pixel[1], pixel[2]].map((c) => c.toString(16).padStart(2, '0')).join('')}`;

            useEditorStore.getState().setBrushColor(color);
            useEditorStore.getState().setActiveTool(TOOLS.BRUSH);
        }
    }, [createText]);

    // ==========================================
    // FILE OPEN HANDLER
    // ==========================================
    const handleOpenFile = async () => {
        const result = await window.electronAPI?.openFile();
        if (result) {
            const canvas = useEditorStore.getState().canvas;
            await addImageToCanvas(canvas, result.data);
            setFileName(result.path.split(/[\\/]/).pop());
            setFilePath(result.path);
            saveState();
        }
    };

    // ==========================================
    // DRAG & DROP HANDLER
    // ==========================================
    const handleDrop = useCallback(async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const canvas = useEditorStore.getState().canvas;
        if (!canvas) return;

        // Check for text from TextManager (via custom data type)
        const textData = e.dataTransfer?.getData('text/plain');
        const textManagerData = e.dataTransfer?.getData('application/x-manga-text');

        if (textManagerData || textData) {
            const text = textManagerData || textData;
            if (text && text.trim()) {
                // Calculate position relative to canvas
                const rect = containerRef.current.getBoundingClientRect();
                const canvasElement = canvasRef.current;
                const canvasRect = canvasElement.getBoundingClientRect();

                // Get drop position relative to canvas
                const x = e.clientX - canvasRect.left;
                const y = e.clientY - canvasRect.top;

                // Account for viewport transform (pan/zoom)
                const vpt = canvas.viewportTransform;
                const actualX = (x - vpt[4]) / vpt[0];
                const actualY = (y - vpt[5]) / vpt[3];

                // Create text at drop position
                createText(canvas, actualX, actualY, { text: text });
                return;
            }
        }

        // Handle image drops
        const file = getDroppedFile(e);
        if (!file || !isSupportedImageFormat(file)) return;

        const dataURL = await readFileAsDataURL(file);
        await addImageToCanvas(canvas, dataURL);
        setFileName(file.name);
        saveState();
    }, [saveState, setFileName, createText]);

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    // Check if canvas has content or is loading
    const hasContent = storeCanvas?.getObjects()?.length > 0;
    const showOverlay = !hasContent && !isLoadingProject;

    // ==========================================
    // RENDER
    // ==========================================
    return (
        <div
            className="canvas-container"
            ref={containerRef}
            onWheel={handleWheel}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
        >
            <div className="canvas-wrapper" style={{ visibility: (hasContent || isLoadingProject) ? 'visible' : 'hidden' }}>
                <canvas ref={canvasRef} onDoubleClick={handleCanvasClick} />
            </div>

            {isLoadingProject && (
                <div className="canvas-overlay">
                    <div className="loading-indicator">
                        <span>Loading project...</span>
                    </div>
                </div>
            )}

            {showOverlay && (
                <div className="canvas-overlay">
                    <button className="open-file-btn" onClick={handleOpenFile}>
                        <FolderOpen size={28} className="drop-icon" />
                        <span>Drop image here or click to open</span>
                        <span className="drop-hint">Supports PNG, JPG, WebP</span>
                    </button>
                </div>
            )}

            <div className="canvas-controls">
                <button
                    className="reset-view-btn"
                    onClick={() => {
                        const canvas = storeCanvas;
                        if (canvas) {
                            canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
                            canvas.renderAll();
                        }
                    }}
                    title="Reset View (Home)"
                >
                    ⌂
                </button>
            </div>

            {/* Context Menu */}
            <ContextMenu
                isVisible={contextMenuVisible}
                position={contextMenuPosition}
                targetObject={contextMenuTarget}
                menuRef={contextMenuRef}
                onFill={fillShape}
                onRemoveFill={removeFill}
                onDelete={deleteObject}
                onDuplicate={duplicateObject}
                onBringToFront={bringToFront}
                onSendToBack={sendToBack}
                onClose={hideContextMenu}
            />

            {/* Region Detection Modal */}
            <RegionDetectModal
                isOpen={showRegionModal}
                onClose={() => {
                    setShowRegionModal(false);
                    setSelectedRegion(null);
                }}
                region={selectedRegion}
            />
        </div>
    );
}

export default Canvas;
