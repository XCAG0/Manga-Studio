/**
 * Text Manager Panel
 * Now connected to Zustand store for project save/load support
 */

import React, { useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Plus, Trash2, GripVertical, X, FileText, Copy, Wand2 } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { removeTextFromImage } from '../../services/textRemovalService';
import './TextManager.css';

function TextManager() {
    // Use Zustand store for textLines (so it persists with project save/load)
    const textLines = useEditorStore(state => state.textManagerLines);
    const setTextLines = useEditorStore(state => state.setTextManagerLines);
    const addTextLines = useEditorStore(state => state.addTextLines);
    const removeTextLine = useEditorStore(state => state.removeTextLine);
    const clearTextLines = useEditorStore(state => state.clearTextLines);

    const [showInput, setShowInput] = React.useState(false);
    const [draggedIndex, setDraggedIndex] = React.useState(null);
    const [dragOverIndex, setDragOverIndex] = React.useState(null);
    const [isDragOver, setIsDragOver] = React.useState(false);
    const [contextMenu, setContextMenu] = React.useState(null);
    const [isRemoving, setIsRemoving] = React.useState(false);
    const [paddingSlider, setPaddingSlider] = React.useState(null);
    const [magicPadding, setMagicPadding] = React.useState(10); // Default padding
    const textAreaRef = useRef(null);

    // Listen for detected texts from AI
    useEffect(() => {
        const handleAddDetectedTexts = (e) => {
            const texts = e.detail?.texts || [];
            if (texts.length > 0) {
                addTextLines(texts);
            }
        };

        window.addEventListener('addDetectedTexts', handleAddDetectedTexts);
        return () => window.removeEventListener('addDetectedTexts', handleAddDetectedTexts);
    }, [addTextLines]);

    // Process text: split by lines, ignore empty
    const processText = (text) => {
        const lines = text
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        if (lines.length > 0) {
            addTextLines(lines);
        }
    };

    // Handle paste in textarea
    const handlePaste = (e) => {
        const pastedText = e.clipboardData?.getData('text') || '';
        if (pastedText.includes('\n')) {
            processText(pastedText);
            e.preventDefault();
            setShowInput(false);
        }
    };

    // Add button click
    const handleAdd = () => {
        const text = textAreaRef.current?.value || '';
        if (text.trim()) {
            processText(text);
            textAreaRef.current.value = '';
        }
        setShowInput(false);
    };

    // Toggle input
    const toggleInput = () => {
        setShowInput(!showInput);
        if (!showInput) {
            setTimeout(() => textAreaRef.current?.focus(), 100);
        }
    };

    // Cancel input
    const cancelInput = () => {
        setShowInput(false);
        if (textAreaRef.current) textAreaRef.current.value = '';
    };

    // External drop handler (text or .txt file)
    const handleExternalDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        // ✅ CRITICAL FIX: Ignore drops from internal TextManager reordering
        const isInternalReorder = e.dataTransfer?.types?.includes('application/x-textmanager-reorder');
        if (isInternalReorder) {
            console.log('[TextManager] Ignoring internal reorder drop');
            return;
        }

        // Check for files first (.txt)
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            for (let file of files) {
                if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        processText(event.target.result);
                    };
                    reader.readAsText(file);
                }
            }
            return;
        }

        // Check for text data
        const text = e.dataTransfer?.getData('text');
        if (text) {
            processText(text);
        }
    };

    const handleExternalDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Only show drag-over style for external drops (not internal reordering)
        const isInternalReorder = e.dataTransfer?.types?.includes('application/x-textmanager-reorder');
        if (!isInternalReorder) {
            setIsDragOver(true);
        }
    };

    const handleExternalDragLeave = (e) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    // Item reorder drag handlers - also allows dropping on canvas
    const handleItemDragStart = (e, index) => {
        setDraggedIndex(index);
        setIsDragOver(false); // ✅ Reset drag-over state for internal reordering
        e.dataTransfer.effectAllowed = 'copyMove';
        // Set text data for dropping on canvas
        const text = textLines[index]?.text || '';
        e.dataTransfer.setData('text/plain', text);
        // ✅ CRITICAL: Mark this as internal reorder to prevent Canvas from adding it
        e.dataTransfer.setData('application/x-textmanager-reorder', 'true');
    };

    const handleItemDragOver = (e, index) => {
        e.preventDefault();
        if (draggedIndex !== null && draggedIndex !== index) {
            setDragOverIndex(index);
        }
    };

    const handleItemDrop = (e, index) => {
        e.preventDefault();
        e.stopPropagation(); // ✅ CRITICAL: Prevent canvas from also receiving this drop

        if (draggedIndex !== null && draggedIndex !== index) {
            const newLines = [...textLines];
            const [item] = newLines.splice(draggedIndex, 1);
            newLines.splice(index, 0, item);
            setTextLines(newLines);
        }
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const handleItemDragEnd = () => {
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const deleteLine = (id) => {
        removeTextLine(id);
    };

    const copyText = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            console.log('[TextManager] Text copied to clipboard');
        }).catch(err => {
            console.error('[TextManager] Failed to copy text:', err);
        });
    };

    const copyAll = () => {
        const allText = textLines.map(line => line.text).join('\n');
        navigator.clipboard.writeText(allText).then(() => {
            console.log('[TextManager] All texts copied to clipboard');
        }).catch(err => {
            console.error('[TextManager] Failed to copy all texts:', err);
        });
    };

    const clearAll = () => clearTextLines();

    // Context menu handlers
    const handleContextMenu = (e, line) => {
        e.preventDefault();
        console.log('[TextManager] Context menu triggered for:', line.text);
        console.log('[TextManager] Line has bbox?', !!line.bbox);
        const menuData = {
            x: e.clientX,
            y: e.clientY,
            line: line
        };
        console.log('[TextManager] Setting context menu:', menuData);
        setContextMenu(menuData);

        // Force re-render check
        setTimeout(() => {
            console.log('[TextManager] Context menu state after set:', contextMenu);
        }, 100);
    };

    const handleMagicRemover = async () => {
        if (!contextMenu?.line?.bbox) {
            alert('No bbox data available.\nPlease use "Detect Text AI" first to get bbox coordinates.');
            setContextMenu(null);
            return;
        }

        try {
            setIsRemoving(true);
            setContextMenu(null);

            await removeTextFromImage(contextMenu.line.bbox, 10, contextMenu.line.lineBoxes);

            // Remove from Text Manager after successful removal
            removeTextLine(contextMenu.line.id);

            console.log('[TextManager] Magic Remover complete');
        } catch (error) {
            console.error('[TextManager] Magic Remover failed:', error);
            alert('Failed to remove text: ' + error.message);
        } finally {
            setIsRemoving(false);
        }
    };

    // Direct Magic Remover (from button click)
    const handleMagicRemoverDirect = async (line) => {
        if (!line?.bbox) {
            alert('No bbox data available.');
            return;
        }

        try {
            setIsRemoving(true);
            console.log('[TextManager] Magic Remover starting for:', line.text);

            await removeTextFromImage(line.bbox, magicPadding, line.lineBoxes);

            console.log('[TextManager] Magic Remover complete!');
        } catch (error) {
            console.error('[TextManager] Magic Remover failed:', error);
            alert('Failed to remove text: ' + error.message);
        } finally {
            setIsRemoving(false);
        }
    };

    // Close context menu on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            // Ignore right-clicks
            if (e.button === 2) return;

            console.log('[TextManager] Click outside, closing menu');
            setContextMenu(null);
        };

        if (contextMenu) {
            // Use mousedown instead of click to catch it before context menu handler
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [contextMenu]);

    // Close padding slider on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            // Ignore right-clicks
            if (e.button === 2) return;

            // Check if click is inside the slider
            if (e.target.closest('.tm-padding-slider')) return;

            console.log('[TextManager] Click outside, closing padding slider');
            setPaddingSlider(null);
        };

        if (paddingSlider) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [paddingSlider]);

    return (
        <div
            className={`text-manager panel ${isDragOver ? 'drag-active' : ''}`}
            onDrop={handleExternalDrop}
            onDragOver={handleExternalDragOver}
            onDragLeave={handleExternalDragLeave}
        >
            <div className="panel-header">
                <span>Text Manager</span>
                <div className="panel-header-actions">
                    {textLines.length > 0 && (
                        <>
                            <button className="panel-btn" onClick={copyAll} title="Copy all">
                                <Copy size={12} />
                            </button>
                            <button className="panel-btn danger" onClick={clearAll} title="Clear all">
                                <Trash2 size={12} />
                            </button>
                        </>
                    )}
                    <button className="panel-btn" onClick={toggleInput} title="Add text">
                        <Plus size={14} />
                    </button>
                </div>
            </div>

            <div className="text-manager-body">
                {/* Input Area - Toggle */}
                {showInput && (
                    <div className="tm-input-area">
                        <textarea
                            ref={textAreaRef}
                            placeholder=""
                            onPaste={handlePaste}
                            rows={3}
                        />
                        <div className="tm-input-actions">
                            <button className="tm-btn cancel" onClick={cancelInput}>Cancel</button>
                            <button className="tm-btn add" onClick={handleAdd}>Add</button>
                        </div>
                    </div>
                )}

                {/* Text List */}
                <div className="tm-list">
                    {textLines.length === 0 ? (
                        <div className="tm-empty">
                            {isDragOver ? (
                                <>
                                    <FileText size={24} />
                                    <p>Drop here</p>
                                </>
                            ) : (
                                <>
                                    <p>No text lines</p>
                                    <span>Drop text or .txt file here</span>
                                </>
                            )}
                        </div>
                    ) : (
                        textLines.map((line, index) => (
                            <div
                                key={line.id}
                                className={`tm-item ${draggedIndex === index ? 'dragging' : ''} ${dragOverIndex === index ? 'drag-over' : ''}`}
                                draggable
                                onDragStart={(e) => handleItemDragStart(e, index)}
                                onDragOver={(e) => handleItemDragOver(e, index)}
                                onDrop={(e) => handleItemDrop(e, index)}
                                onDragEnd={handleItemDragEnd}
                                onContextMenu={(e) => handleContextMenu(e, line)}
                            >
                                <GripVertical size={10} className="tm-grip" />
                                <span className="tm-num">{index + 1}</span>
                                <span className="tm-text" title={line.bbox ? 'Has bbox data' : 'No bbox data'}>
                                    {line.text}
                                </span>
                                {line.bbox && (
                                    <button
                                        className="tm-magic"
                                        onClick={() => handleMagicRemoverDirect(line)}
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            console.log('[TextManager] Right-click on Wand icon!', { x: e.clientX, y: e.clientY, line });
                                            setPaddingSlider({ x: e.clientX, y: e.clientY, line });
                                        }}
                                        title="Magic Remover - Left click to remove, Right click for settings"
                                        disabled={isRemoving}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: '#ff6b9d',
                                            cursor: isRemoving ? 'wait' : 'pointer',
                                            padding: '2px',
                                            display: 'flex',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <Wand2 size={10} />
                                    </button>
                                )}
                                <button
                                    className="tm-copy"
                                    onClick={() => copyText(line.text)}
                                    title="Copy text"
                                >
                                    <Copy size={10} />
                                </button>
                                <button className="tm-del" onClick={() => deleteLine(line.id)} title="Delete">
                                    <X size={10} />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {/* Context Menu */}
                {contextMenu && (() => {
                    console.log('[TextManager] RENDERING context menu at:', contextMenu.x, contextMenu.y);
                    return (
                        <div
                            className="tm-context-menu"
                            style={{
                                position: 'fixed',
                                left: contextMenu.x,
                                top: contextMenu.y,
                                background: '#2a2a3e',
                                border: '1px solid #444',
                                borderRadius: '4px',
                                padding: '4px 0',
                                zIndex: 10000,
                                minWidth: '160px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                className="tm-context-item"
                                onClick={handleMagicRemover}
                                disabled={!contextMenu.line?.bbox || isRemoving}
                                style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: contextMenu.line?.bbox ? '#fff' : '#666',
                                    cursor: contextMenu.line?.bbox ? 'pointer' : 'not-allowed',
                                    textAlign: 'left',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '13px'
                                }}
                                onMouseEnter={(e) => {
                                    if (contextMenu.line?.bbox) {
                                        e.target.style.background = '#3a3a4e';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    e.target.style.background = 'transparent';
                                }}
                            >
                                <Wand2 size={14} />
                                {isRemoving ? 'Removing...' : 'Magic Remover'}
                            </button>
                        </div>
                    );
                })()}
            </div>

            {/* Padding Slider Popup - Using Portal to render to body */}
            {paddingSlider && ReactDOM.createPortal(
                <div
                    className="tm-padding-slider"
                    style={{
                        position: 'fixed',
                        left: Math.min(paddingSlider.x, window.innerWidth - 180),
                        top: Math.min(paddingSlider.y, window.innerHeight - 100),
                        background: '#1e1e2e',
                        border: '1px solid #3a3a4a',
                        borderRadius: '6px',
                        padding: '10px 12px',
                        zIndex: 99999,
                        minWidth: '160px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: '#888', fontSize: '11px' }}>Padding</span>
                        <span style={{ color: '#ccc', fontSize: '11px' }}>{magicPadding}px</span>
                    </div>
                    <input
                        type="range"
                        min="1"
                        max="30"
                        value={magicPadding}
                        onChange={(e) => setMagicPadding(Number(e.target.value))}
                        style={{
                            width: '100%',
                            height: '4px',
                            accentColor: '#666',
                            cursor: 'pointer'
                        }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px', gap: '6px' }}>
                        <button
                            onClick={() => setPaddingSlider(null)}
                            style={{
                                padding: '4px 10px',
                                background: 'transparent',
                                border: '1px solid #444',
                                borderRadius: '3px',
                                color: '#888',
                                fontSize: '11px',
                                cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => {
                                const lineToProcess = paddingSlider.line;
                                setPaddingSlider(null);
                                handleMagicRemoverDirect(lineToProcess);
                            }}
                            style={{
                                padding: '4px 10px',
                                background: '#3a3a4a',
                                border: 'none',
                                borderRadius: '3px',
                                color: '#ccc',
                                fontSize: '11px',
                                cursor: 'pointer'
                            }}
                        >
                            Apply
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

export default TextManager;
