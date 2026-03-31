import React, { useState, useRef, useEffect } from 'react';
import { Minus, Square, X, ChevronDown, Home, Check } from 'lucide-react';
import { useFileOperations } from '../../hooks/useFileOperations';
import { saveProject as saveProjectToFile } from '../../services/projectService';
import { useEditorStore } from '../../store/editorStore';
import { cleanFabricCanvas } from '../../utils/bubbleCleaner';
import { detectBubbles, canvasToBase64ForDetection } from '../../services/textDetectionService';
import { applyBubbleEditToImage } from '../../services/textRemovalService';
import LanguageSelectModal from '../LanguageSelectModal/LanguageSelectModal';
import TranslateModal from '../TranslateModal/TranslateModal';
import ExportModal from '../ExportModal/ExportModal';
import { useAutoTranslate } from '../../hooks/useAutoTranslate';
import { TEXT_EDIT_MODES } from '../../utils/textEditModes';
import * as fabric from 'fabric';
import logoImage from '../../images/logo.png';
import './TitleBar.css';

function applyWhiteBubbleCovers(canvas, bubbles, imageInfo) {
    let totalLines = 0;

    bubbles.forEach((bubble, idx) => {
        const lineBoxes = bubble.lineBoxes || [];

        lineBoxes.forEach((box, lineIdx) => {
            const transformedLeft = (box.x * imageInfo.scaleX) + imageInfo.left;
            const transformedTop = (box.y * imageInfo.scaleY) + imageInfo.top;
            const transformedWidth = box.width * imageInfo.scaleX;
            const transformedHeight = box.height * imageInfo.scaleY;

            const textCover = new fabric.Rect({
                left: transformedLeft - 2,
                top: transformedTop - 2,
                width: transformedWidth + 4,
                height: transformedHeight + 4,
                fill: 'white',
                stroke: 'white',
                strokeWidth: 0,
                selectable: true,
                evented: true,
                bubbleData: {
                    bubbleId: bubble.id,
                    lineIndex: lineIdx,
                    text: bubble.text,
                    confidence: bubble.confidence,
                },
            });

            canvas.add(textCover);
            totalLines += 1;
        });

        console.log(`[CleanBubbles] Bubble ${idx + 1}: ${lineBoxes.length} lines`);
    });

    console.log(`[CleanBubbles] Whitened ${totalLines} text lines`);
}

function TitleBar() {
    const [activeMenu, setActiveMenu] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showLangModal, setShowLangModal] = useState(false);
    const [showTranslateModal, setShowTranslateModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [showSaveConfirm, setShowSaveConfirm] = useState(false);  // Save confirmation modal
    const [pendingAction, setPendingAction] = useState(null);       // 'home' or 'close'
    const menuRef = useRef(null);

    const { openFile, addImageUp, newProject } = useFileOperations();
    const { undo, redo, canUndo, canRedo, fileName, isModified, setCurrentPage, currentPage } = useEditorStore();
    const { performAutoTranslate } = useAutoTranslate();

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setActiveMenu(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Listen for close-requested event from main process (Alt+F4, system close)
    useEffect(() => {
        const cleanup = window.electronAPI?.onCloseRequested?.(() => {
            const currentCanvas = useEditorStore.getState().canvas;
            const currentPageState = useEditorStore.getState().currentPage;

            // If in editor with content, show confirmation modal
            if (currentPageState === 'editor' && currentCanvas && currentCanvas.getObjects().length > 0) {
                setPendingAction('close');
                setShowSaveConfirm(true);
            } else {
                // No content or not in editor, close directly
                window.electronAPI?.confirmClose?.(true);
            }
        });

        return cleanup;
    }, []);

    const handleMinimize = () => window.electronAPI?.minimize();
    const handleMaximize = () => window.electronAPI?.maximize();

    // Quick save project (Ctrl+S, File > Save, Close button, Home button)
    const handleQuickSave = async () => {
        const currentCanvas = useEditorStore.getState().canvas;
        const currentFileName = useEditorStore.getState().fileName;

        if (!currentCanvas) {
            console.warn('[TitleBar] No canvas to save');
            return null;
        }

        const objects = currentCanvas.getObjects();
        console.log(`[TitleBar] Saving - Canvas has ${objects.length} objects`);

        if (objects.length === 0) {
            console.log('[TitleBar] Nothing to save');
            return null;
        }

        const projectName = currentFileName || `Project_${Date.now()}`;
        const result = await saveProjectToFile(projectName);

        if (result && result.success) {
            console.log('✅ Project saved:', projectName);
        } else {
            console.error('❌ Save failed:', result?.error);
        }

        return result;
    };

    // Request close - show confirmation if unsaved changes
    const handleClose = () => {
        const currentCanvas = useEditorStore.getState().canvas;

        if (currentPage === 'editor' && currentCanvas && currentCanvas.getObjects().length > 0) {
            setPendingAction('close');
            setShowSaveConfirm(true);
        } else {
            window.electronAPI?.close();
        }
    };

    // Go back to home - show confirmation if unsaved changes
    const handleGoHome = () => {
        const currentCanvas = useEditorStore.getState().canvas;

        if (currentPage === 'editor' && currentCanvas && currentCanvas.getObjects().length > 0) {
            setPendingAction('home');
            setShowSaveConfirm(true);
        } else {
            setCurrentPage('home');
        }
    };

    // Save and proceed with pending action
    const handleSaveAndProceed = async () => {
        setShowSaveConfirm(false);
        await handleQuickSave();

        if (pendingAction === 'close') {
            window.electronAPI?.confirmClose?.(true);
        } else if (pendingAction === 'home') {
            setCurrentPage('home');
        }
        setPendingAction(null);
    };

    // Discard changes and proceed
    const handleDiscardAndProceed = () => {
        setShowSaveConfirm(false);

        if (pendingAction === 'close') {
            window.electronAPI?.confirmClose?.(true);
        } else if (pendingAction === 'home') {
            setCurrentPage('home');
        }
        setPendingAction(null);
    };

    // Cancel - stay in editor
    const handleCancelExit = () => {
        setShowSaveConfirm(false);
        setPendingAction(null);
    };

    // Expose handleQuickSave, openFile, and addImageUp globally for keyboard shortcuts
    useEffect(() => {
        window.handleQuickSave = handleQuickSave;
        window.handleOpenFile = openFile;
        window.handleAddImageUp = addImageUp;
        window.handleNewProject = newProject;
        window.handleExportImage = () => setShowExportModal(true);

        return () => {
            delete window.handleQuickSave;
            delete window.handleOpenFile;
            delete window.handleAddImageUp;
            delete window.handleNewProject;
            delete window.handleExportImage;
        };
    }, [handleQuickSave, openFile, addImageUp, newProject]);

    const toggleMenu = (menu) => {
        setActiveMenu(activeMenu === menu ? null : menu);
    };

    const handleMenuAction = (action) => {
        setActiveMenu(null);
        action();
    };



    // Detect text action (AI) - عرض مربع اختيار اللغه
    const [actionMode, setActionMode] = useState('whiten'); // 'whiten' or 'extract'

    const handleCleanBubbles = () => {
        const canvas = useEditorStore.getState().canvas;
        if (!canvas) {
            alert('Please open an image first');
            return;
        }
        setActionMode('whiten');
        setShowLangModal(true);
    };

    const handleDetectTextAI = () => {
        const canvas = useEditorStore.getState().canvas;
        if (!canvas) {
            alert('Please open an image first');
            return;
        }
        setActionMode('extract');
        setShowLangModal(true);
    };

    const handleAutoTranslate = async (options) => {
        setShowTranslateModal(false);
        setIsProcessing(true);

        try {
            const result = await performAutoTranslate(options);

            if (result.success) {
                console.log('[TitleBar] ✅ Auto Translate complete!');
            } else {
                console.error('[TitleBar] Auto Translate failed:', result.error);
                alert('Translation failed: ' + result.error);
            }
        } catch (error) {
            console.error('[TitleBar] Auto Translate error:', error);
            alert('Translation error: ' + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    // Handle language selection and run detection
    const handleLanguageSelect = async (
        selectedLang,
        processingMode = 'cpu',
        engine = 'paddleocr',
        selectedImageIds = [],
        editMode = TEXT_EDIT_MODES.WHITE_BB,
        magicCleanerSettings = null
    ) => {
        setShowLangModal(false);
        console.log(
            `[Detection] Language: ${selectedLang}, Engine: ${engine}, Mode: ${actionMode}, ` +
            `Edit: ${editMode}, Images: ${selectedImageIds}`
        );

        const canvas = useEditorStore.getState().canvas;
        if (!canvas) return;

        // If no images selected, default to first image
        const imagesToProcess = selectedImageIds.length > 0 ? selectedImageIds : [0];

        setIsProcessing(true);

        let totalBubblesDetected = 0;
        let allExtractedTexts = [];
        let canvasModified = false;

        try {
            // Process each selected image
            for (const imageIndex of imagesToProcess) {
                console.log(`[Detection] Processing image index ${imageIndex}...`);

                const exportResult = canvasToBase64ForDetection(canvas, imageIndex);

                if (!exportResult || !exportResult.image) {
                    console.warn(`[Detection] Failed to export image ${imageIndex}`);
                    continue;
                }

                const { image: imageBase64, imageInfo } = exportResult;
                console.log(`[Detection] Sending image ${imageIndex + 1} for analysis using ${engine}...`);

                const result = await detectBubbles(imageBase64, selectedLang, engine, {
                    includeText: actionMode !== 'whiten'
                });

                if (!result.success) {
                    console.error(`[Detection] Failed for image ${imageIndex}: ${result.error}`);
                    continue;
                }

                console.log(`[Detection] Image ${imageIndex + 1}: Detected ${result.count} bubbles`);
                totalBubblesDetected += result.count;

                if (actionMode === 'whiten' && editMode === TEXT_EDIT_MODES.MAGIC_CLEANER) {
                    await applyBubbleEditToImage(imageBase64, result.bubbles, {
                        imageIndex,
                        editMode,
                        magicOptions: magicCleanerSettings,
                        saveHistory: false
                    });
                    canvasModified = true;

                } else if (actionMode === 'whiten') {
                    // Clean Bubbles mode - draw white rectangles
                    let totalLines = 0;
                    result.bubbles.forEach((bubble, idx) => {
                        const lineBoxes = bubble.lineBoxes || [];

                        lineBoxes.forEach((box, lineIdx) => {
                            const transformedLeft = (box.x * imageInfo.scaleX) + imageInfo.left;
                            const transformedTop = (box.y * imageInfo.scaleY) + imageInfo.top;
                            const transformedWidth = box.width * imageInfo.scaleX;
                            const transformedHeight = box.height * imageInfo.scaleY;

                            const textCover = new fabric.Rect({
                                left: transformedLeft - 2,
                                top: transformedTop - 2,
                                width: transformedWidth + 4,
                                height: transformedHeight + 4,
                                fill: 'white',
                                stroke: 'white',
                                strokeWidth: 0,
                                selectable: true,
                                evented: true,
                                bubbleData: {
                                    bubbleId: bubble.id,
                                    lineIndex: lineIdx,
                                    text: bubble.text,
                                    confidence: bubble.confidence
                                }
                            });

                            canvas.add(textCover);
                            totalLines++;
                        });

                        console.log(`[CleanBubbles] Bubble ${idx + 1}: ${lineBoxes.length} lines`);
                    });

                    console.log(`[CleanBubbles] Whitened ${totalLines} text lines`);
                    canvasModified = true;

                } else if (actionMode === 'extract') {
                    // Detect Text AI mode - extract texts WITH bbox to Text Manager
                    const extractedTexts = result.bubbles.map(b => ({
                        text: b.text,
                        bbox: b.bbox,
                        lineBoxes: b.lineBoxes || []
                    })).filter(item => item.text && item.text.trim().length > 0);
                    allExtractedTexts.push(...extractedTexts);
                }

                console.log(`[Detection] Completed in ${result.processingTime}s`);
            } // End of for loop

            // Send all extracted texts at once (for extract mode)
            if (actionMode === 'extract' && allExtractedTexts.length > 0) {
                window.dispatchEvent(new CustomEvent('addDetectedTexts', {
                    detail: { texts: allExtractedTexts }
                }));
                console.log(`[DetectTextAI] Sent ${allExtractedTexts.length} texts to Text Manager`);
            } else if (actionMode === 'extract' && allExtractedTexts.length === 0) {
                alert('No text detected in selected images');
            }

            if (canvasModified) {
                canvas.renderAll();
                useEditorStore.getState().saveState();
            }

            console.log(`[Detection] Total bubbles detected: ${totalBubblesDetected}`);

        } catch (error) {
            console.error('[Detection] Error:', error);
            alert(`Error: ${error.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    // Menu items
    const menus = {
        file: [
            { label: 'New', shortcut: 'Ctrl+N', action: newProject },
            { label: 'Open...', shortcut: 'Ctrl+O', action: openFile },
            { label: 'Add Up...', shortcut: 'Ctrl+Shift+O', action: addImageUp },
            { type: 'separator' },
            { label: 'Save Project', shortcut: 'Ctrl+S', action: handleQuickSave },
            { type: 'separator' },
            { label: 'Export Image...', shortcut: 'Ctrl+E', action: () => setShowExportModal(true) },
        ],
        edit: [
            { label: 'Undo', shortcut: 'Ctrl+Z', action: undo, disabled: !canUndo },
            { label: 'Redo', shortcut: 'Ctrl+Y', action: redo, disabled: !canRedo },
            { type: 'separator' },
            { label: 'Cut', shortcut: 'Ctrl+X', action: () => { } },
            { label: 'Copy', shortcut: 'Ctrl+C', action: () => { } },
            { label: 'Paste', shortcut: 'Ctrl+V', action: () => { } },
            { type: 'separator' },
            { label: 'Select All', shortcut: 'Ctrl+A', action: () => { } },
        ],
        view: [
            { label: 'Zoom In', shortcut: 'Ctrl++', action: () => useEditorStore.getState().setZoom(useEditorStore.getState().zoom + 10) },
            { label: 'Zoom Out', shortcut: 'Ctrl+-', action: () => useEditorStore.getState().setZoom(useEditorStore.getState().zoom - 10) },
            { label: 'Fit to Window', shortcut: 'Ctrl+0', action: () => useEditorStore.getState().setZoom(100) },
            { type: 'separator' },
            {
                label: 'Properties Panel',
                checked: useEditorStore.getState().showProperties,
                action: () => useEditorStore.getState().toggleProperties()
            },
            {
                label: 'Layers Panel',
                checked: useEditorStore.getState().showLayers,
                action: () => useEditorStore.getState().toggleLayers()
            },
            {
                label: 'Text Manager',
                checked: useEditorStore.getState().showTextManager,
                action: () => useEditorStore.getState().toggleTextManager()
            },
        ],
        tools: [
            { label: isProcessing ? 'Processing...' : 'Clean Bubbles', shortcut: '', action: handleCleanBubbles, disabled: isProcessing },
            { label: 'Detect Text AI', shortcut: '', action: handleDetectTextAI, disabled: isProcessing },
            {
                label: 'Auto Translate', shortcut: '', action: () => {
                    const canvas = useEditorStore.getState().canvas;
                    if (!canvas) {
                        alert('Please open an image first');
                        return;
                    }
                    setShowTranslateModal(true);
                }, disabled: isProcessing
            },
            { type: 'separator' },
            {
                label: 'How To Use', shortcut: '', action: () => {
                    const url = 'https://discord.gg/9eRvV5WMsg';
                    console.log('[TitleBar] Opening:', url);
                    if (window.electronAPI?.openExternal) {
                        console.log('[TitleBar] Using Electron API');
                        window.electronAPI.openExternal(url);
                    } else {
                        console.log('[TitleBar] Using window.location');
                        window.location.href = url;
                    }
                }
            },
        ],
        help: [
            {
                label: 'Discord Server', shortcut: '', action: () => {
                    const url = 'https://discord.gg/9eRvV5WMsg';
                    console.log('[TitleBar] Opening:', url);
                    if (window.electronAPI?.openExternal) {
                        console.log('[TitleBar] Using Electron API');
                        window.electronAPI.openExternal(url);
                    } else {
                        console.log('[TitleBar] Using window.location');
                        window.location.href = url;
                    }
                }
            },
            {
                label: 'YouTube Channel', shortcut: '', action: () => {
                    const url = 'https://www.youtube.com/@xa9c';
                    console.log('[TitleBar] Opening:', url);
                    if (window.electronAPI?.openExternal) {
                        console.log('[TitleBar] Using Electron API');
                        window.electronAPI.openExternal(url);
                    } else {
                        console.log('[TitleBar] Using window.location');
                        window.location.href = url;
                    }
                }
            },
        ],
    };

    // Truncate filename if too long (max 25 chars)
    const truncatedName = fileName && fileName.length > 25
        ? fileName.substring(0, 10) + '...'
        : fileName;

    const displayTitle = truncatedName
        ? `${truncatedName}${isModified ? ' *' : ''} - Manga Studio`
        : 'Manga Studio';

    return (
        <div className="title-bar">
            <div className="title-bar-drag">
                <div className="title-bar-logo">
                    <img src={logoImage} alt="Manga Studio" className="logo-icon" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
                    <span className="logo-text">{displayTitle}</span>
                </div>

                <div className="title-bar-menu" ref={menuRef}>
                    {/* File Menu */}
                    <div className="menu-wrapper">
                        <button
                            className={`menu-item ${activeMenu === 'file' ? 'active' : ''}`}
                            onClick={() => toggleMenu('file')}
                        >
                            File
                        </button>
                        {activeMenu === 'file' && (
                            <div className="menu-dropdown">
                                {menus.file.map((item, i) =>
                                    item.type === 'separator' ? (
                                        <div key={i} className="menu-separator" />
                                    ) : (
                                        <button
                                            key={i}
                                            className="menu-dropdown-item"
                                            onClick={() => handleMenuAction(item.action)}
                                            disabled={item.disabled}
                                        >
                                            <span>{item.label}</span>
                                            <span className="menu-shortcut">{item.shortcut}</span>
                                        </button>
                                    )
                                )}
                            </div>
                        )}
                    </div>

                    {/* Edit Menu */}
                    <div className="menu-wrapper">
                        <button
                            className={`menu-item ${activeMenu === 'edit' ? 'active' : ''}`}
                            onClick={() => toggleMenu('edit')}
                        >
                            Edit
                        </button>
                        {activeMenu === 'edit' && (
                            <div className="menu-dropdown">
                                {menus.edit.map((item, i) =>
                                    item.type === 'separator' ? (
                                        <div key={i} className="menu-separator" />
                                    ) : (
                                        <button
                                            key={i}
                                            className="menu-dropdown-item"
                                            onClick={() => handleMenuAction(item.action)}
                                            disabled={item.disabled}
                                        >
                                            <span>{item.label}</span>
                                            <span className="menu-shortcut">{item.shortcut}</span>
                                        </button>
                                    )
                                )}
                            </div>
                        )}
                    </div>

                    {/* View Menu */}
                    <div className="menu-wrapper">
                        <button
                            className={`menu-item ${activeMenu === 'view' ? 'active' : ''}`}
                            onClick={() => toggleMenu('view')}
                        >
                            View
                        </button>
                        {activeMenu === 'view' && (
                            <div className="menu-dropdown">
                                {menus.view.map((item, i) =>
                                    item.type === 'separator' ? (
                                        <div key={i} className="menu-separator" />
                                    ) : (
                                        <button
                                            key={i}
                                            className="menu-dropdown-item"
                                            onClick={() => handleMenuAction(item.action)}
                                            disabled={item.disabled}
                                        >
                                            <span>{item.label}</span>
                                            {item.checked !== undefined && (
                                                <span className="menu-check">{item.checked ? <Check size={14} /> : ''}</span>
                                            )}
                                            {item.shortcut && <span className="menu-shortcut">{item.shortcut}</span>}
                                        </button>
                                    )
                                )}
                            </div>
                        )}
                    </div>

                    {/* Tools Menu */}
                    <div className="menu-wrapper">
                        <button
                            className={`menu-item ${activeMenu === 'tools' ? 'active' : ''}`}
                            onClick={() => toggleMenu('tools')}
                        >
                            Tools
                        </button>
                        {activeMenu === 'tools' && (
                            <div className="menu-dropdown">
                                {menus.tools.map((item, i) =>
                                    item.type === 'separator' ? (
                                        <div key={i} className="menu-separator" />
                                    ) : (
                                        <button
                                            key={i}
                                            className="menu-dropdown-item"
                                            onClick={() => handleMenuAction(item.action)}
                                            disabled={item.disabled}
                                        >
                                            <span>{item.label}</span>
                                            <span className="menu-shortcut">{item.shortcut}</span>
                                        </button>
                                    )
                                )}
                            </div>
                        )}
                    </div>

                    {/* Help Menu */}
                    <div className="menu-wrapper">
                        <button
                            className={`menu-item ${activeMenu === 'help' ? 'active' : ''}`}
                            onClick={() => toggleMenu('help')}
                        >
                            Help
                        </button>
                        {activeMenu === 'help' && (
                            <div className="menu-dropdown">
                                {menus.help.map((item, i) => (
                                    <button
                                        key={i}
                                        className="menu-dropdown-item"
                                        onClick={() => handleMenuAction(item.action)}
                                    >
                                        <span>{item.label}</span>
                                        <span className="menu-shortcut">{item.shortcut}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="title-bar-controls">
                <button className="control-btn home-btn" onClick={handleGoHome} title="Go to Home">
                    <Home size={16} />
                </button>
                <button className="control-btn" onClick={handleMinimize}>
                    <Minus size={16} />
                </button>
                <button className="control-btn" onClick={handleMaximize}>
                    <Square size={14} />
                </button>
                <button className="control-btn close" onClick={handleClose}>
                    <X size={16} />
                </button>
            </div>

            {/* مربع اختيار اللغه */}
            <LanguageSelectModal
                isOpen={showLangModal}
                onSelect={handleLanguageSelect}
                onClose={() => setShowLangModal(false)}
                actionMode={actionMode}
            />

            {/* مربع الترجمه التلقائيه */}
            <TranslateModal
                isOpen={showTranslateModal}
                onTranslate={handleAutoTranslate}
                onClose={() => setShowTranslateModal(false)}
            />

            {/* Export Modal */}
            <ExportModal
                isOpen={showExportModal}
                onClose={() => setShowExportModal(false)}
            />

            {/* Save Confirmation Modal */}
            {showSaveConfirm && (
                <div className="modal-overlay" onClick={handleCancelExit}>
                    <div className="save-confirm-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="save-confirm-header">
                            <span>Save Changes?</span>
                        </div>
                        <div className="save-confirm-body">
                            <p>Do you want to save your project before {pendingAction === 'close' ? 'closing' : 'leaving'}?</p>
                        </div>
                        <div className="save-confirm-footer">
                            <button className="btn btn-secondary" onClick={handleCancelExit}>
                                Cancel
                            </button>
                            <button className="btn btn-danger" onClick={handleDiscardAndProceed}>
                                Don't Save
                            </button>
                            <button className="btn btn-primary" onClick={handleSaveAndProceed}>
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TitleBar;
