/**
 * Manga Studio - Properties Panel
 * Dynamic properties for tools and selected objects
 */

import React, { useEffect, useRef, useState } from 'react';
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, ChevronDown } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { useTextTool } from '../../hooks/useTextTool';
import { BRUSH, ERASER, TEXT, SHAPES } from '../../utils/constants';
import { checkBackendHealth, autoTranslate, canvasToBase64, LANGUAGES } from '../../services/translationService';
import './PropertiesPanel.css';

/**
 * ObjectColorPicker - A robust color picker that works even when canvas deselects
 * Stores the object reference internally on mount
 */
function ObjectColorPicker({ object, property = 'fill', label = 'Color', saveState }) {
    // Store object reference on mount - this survives canvas deselection
    const objectRef = useRef(object);
    const [color, setColor] = useState(object?.[property] || '#ffffff');

    // Only update ref when we get a NEW valid object
    useEffect(() => {
        if (object && object !== objectRef.current) {
            objectRef.current = object;
            setColor(object[property] || '#ffffff');
        }
    }, [object, property]);

    // Throttle using requestAnimationFrame for smooth color updates
    const frameRef = useRef(null);
    const pendingColorRef = useRef(null);

    const handleChange = (e) => {
        const newColor = e.target.value;
        setColor(newColor);
        pendingColorRef.current = newColor;

        // Cancel previous frame to prevent buildup
        if (frameRef.current) {
            cancelAnimationFrame(frameRef.current);
        }

        // Schedule update for next animation frame
        frameRef.current = requestAnimationFrame(() => {
            let obj = objectRef.current;
            if (!obj || !obj.canvas) {
                obj = useEditorStore.getState().lastSelectedObject;
            }

            if (obj && obj.canvas && pendingColorRef.current) {
                obj.set(property, pendingColorRef.current);
                obj.canvas.renderAll();
            }
        });
    };

    const handleMouseDown = (e) => {
        e.stopPropagation();
        useEditorStore.getState().setIsEditingProperty(true);
    };

    const handleBlur = () => {
        useEditorStore.getState().setIsEditingProperty(false);
        if (saveState) saveState();
    };

    return (
        <div className="property-row">
            <label>{label}</label>
            <input
                type="color"
                value={color}
                onMouseDown={handleMouseDown}
                onChange={handleChange}
                onBlur={handleBlur}
                className="color-input"
            />
        </div>
    );
}

/**
 * Custom Font Picker with Hover Preview
 */
function FontPicker({ selectedObject, availableFonts, saveState }) {
    const [isOpen, setIsOpen] = useState(false);
    const [originalFont, setOriginalFont] = useState(null);
    const dropdownRef = useRef(null);

    const currentFont = selectedObject?.fontFamily || 'Arial';

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                // Restore original font if closing without selection
                if (originalFont && selectedObject && selectedObject.canvas) {
                    selectedObject.set('fontFamily', originalFont);
                    selectedObject.canvas.renderAll();
                }
                setIsOpen(false);
                setOriginalFont(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [originalFont, selectedObject]);

    // Open dropdown and store original font
    const handleOpen = () => {
        if (!isOpen) {
            setOriginalFont(currentFont);
        }
        setIsOpen(!isOpen);
    };

    // Preview font on hover
    const handleHover = (font) => {
        if (selectedObject && selectedObject.canvas) {
            selectedObject.set('fontFamily', font);
            selectedObject.canvas.renderAll();
        }
    };

    // Confirm font selection on click
    const handleSelect = (font) => {
        if (selectedObject && selectedObject.canvas) {
            selectedObject.set('fontFamily', font);
            selectedObject.canvas.renderAll();
            saveState();
        }
        setIsOpen(false);
        setOriginalFont(null);
    };

    return (
        <div className="property-row">
            <label>Font</label>
            <div className="font-picker" ref={dropdownRef}>
                <button
                    className="font-picker-trigger"
                    onClick={handleOpen}
                    style={{ fontFamily: currentFont }}
                >
                    <span>{currentFont}</span>
                    <ChevronDown size={14} />
                </button>

                {isOpen && (
                    <div className="font-picker-dropdown">
                        {availableFonts.map((font) => (
                            <div
                                key={font}
                                className={`font-option ${font === currentFont ? 'active' : ''}`}
                                style={{ fontFamily: font }}
                                onMouseEnter={() => handleHover(font)}
                                onClick={() => handleSelect(font)}
                            >
                                {font}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function PropertiesPanel() {
    const {
        activeTool,
        brushSize,
        setBrushSize,
        brushColor,
        setBrushColor,
        brushOpacity,
        setBrushOpacity,
        eraserSize,
        setEraserSize,
        selectedObject,
        saveState,
        setIsEditingProperty
    } = useEditorStore();

    const { toggleTextStyle, availableFonts } = useTextTool();

    // Refs for color inputs (to prevent re-render issues)
    const strokeColorRef = useRef(null);
    const fillColorRef = useRef(null);

    // Ref to preserve selected object during color picking (prevents deselection issue)
    const selectedObjectRef = useRef(null);

    // Update ref when selection changes
    useEffect(() => {
        if (selectedObject) {
            selectedObjectRef.current = selectedObject;
        }
    }, [selectedObject]);

    // State for filter reset - changes key to force slider re-render
    const [filterResetKey, setFilterResetKey] = useState(0);

    // Update refs when object changes
    useEffect(() => {
        if (selectedObject) {
            if (strokeColorRef.current && selectedObject.stroke) {
                strokeColorRef.current.value = selectedObject.stroke;
            }
            if (fillColorRef.current && selectedObject.fill && selectedObject.fill !== 'transparent') {
                fillColorRef.current.value = selectedObject.fill;
            }
        }
        // Reset filter key when object changes to reset slider positions
        setFilterResetKey(prev => prev + 1);
    }, [selectedObject]);

    // Check if shape is selected
    const isShape = selectedObject && (selectedObject.type === 'rect' || selectedObject.type === 'ellipse');
    const isText = selectedObject && (selectedObject.type === 'i-text' || selectedObject.type === 'textbox');
    const isImage = selectedObject && selectedObject.type === 'image';
    const isPath = selectedObject && selectedObject.type === 'path';

    // =========================================
    // HELPER: Render text properties (used by Select tool)
    // =========================================
    const renderTextProperties = () => (
        <div className="property-group text-settings-advanced">
            <h4>Text Properties</h4>

            <FontPicker
                selectedObject={selectedObject}
                availableFonts={availableFonts}
                saveState={saveState}
            />

            <div className="property-row">
                <label>Size</label>
                <input
                    type="number"
                    min={1}
                    max={200}
                    value={selectedObject?.fontSize || 24}
                    onChange={(e) => {
                        if (selectedObject && selectedObject.canvas) {
                            selectedObject.set('fontSize', parseInt(e.target.value));
                            selectedObject.canvas.renderAll();
                            saveState();
                        }
                    }}
                    className="property-number full"
                />
            </div>

            <ObjectColorPicker
                object={selectedObject}
                property="fill"
                label="Color"
                saveState={saveState}
            />

            <div className="property-row">
                <label>Style</label>
                <div className="style-buttons">
                    <button
                        className={`style-btn ${selectedObject?.fontWeight === 'bold' ? 'active' : ''}`}
                        onClick={() => toggleTextStyle('bold')}
                        title="Bold"
                    >
                        <Bold size={14} />
                    </button>
                    <button
                        className={`style-btn ${selectedObject?.fontStyle === 'italic' ? 'active' : ''}`}
                        onClick={() => toggleTextStyle('italic')}
                        title="Italic"
                    >
                        <Italic size={14} />
                    </button>
                    <button
                        className={`style-btn ${selectedObject?.underline ? 'active' : ''}`}
                        onClick={() => toggleTextStyle('underline')}
                        title="Underline"
                    >
                        <Underline size={14} />
                    </button>
                </div>
            </div>

            <div className="property-row">
                <label>Align</label>
                <div className="style-buttons">
                    <button
                        className={`style-btn ${selectedObject?.textAlign === 'left' ? 'active' : ''}`}
                        onClick={() => {
                            if (selectedObject && selectedObject.canvas) {
                                selectedObject.set('textAlign', 'left');
                                selectedObject.canvas.renderAll();
                                saveState();
                            }
                        }}
                    >
                        <AlignLeft size={14} />
                    </button>
                    <button
                        className={`style-btn ${selectedObject?.textAlign === 'center' ? 'active' : ''}`}
                        onClick={() => {
                            if (selectedObject && selectedObject.canvas) {
                                selectedObject.set('textAlign', 'center');
                                selectedObject.canvas.renderAll();
                                saveState();
                            }
                        }}
                    >
                        <AlignCenter size={14} />
                    </button>
                    <button
                        className={`style-btn ${selectedObject?.textAlign === 'right' ? 'active' : ''}`}
                        onClick={() => {
                            if (selectedObject && selectedObject.canvas) {
                                selectedObject.set('textAlign', 'right');
                                selectedObject.canvas.renderAll();
                                saveState();
                            }
                        }}
                    >
                        <AlignRight size={14} />
                    </button>
                </div>
            </div>

            {/* Letter Spacing */}
            <div className="property-row">
                <label>Spacing</label>
                <div className="property-control">
                    <input
                        type="range"
                        min={-200}
                        max={800}
                        value={selectedObject?.charSpacing || 0}
                        onChange={(e) => {
                            if (selectedObject && selectedObject.canvas) {
                                selectedObject.set('charSpacing', parseInt(e.target.value));
                                selectedObject.canvas.renderAll();
                            }
                        }}
                        onMouseUp={() => saveState()}
                    />
                    <input
                        type="number"
                        min={-200}
                        max={800}
                        value={selectedObject?.charSpacing || 0}
                        onChange={(e) => {
                            if (selectedObject && selectedObject.canvas) {
                                selectedObject.set('charSpacing', parseInt(e.target.value));
                                selectedObject.canvas.renderAll();
                                saveState();
                            }
                        }}
                        className="property-number"
                    />
                </div>
            </div>

            {/* Line Height */}
            <div className="property-row">
                <label>Line H.</label>
                <div className="property-control">
                    <input
                        type="range"
                        min={50}
                        max={300}
                        value={Math.round((selectedObject?.lineHeight || 1.16) * 100)}
                        onChange={(e) => {
                            if (selectedObject && selectedObject.canvas) {
                                selectedObject.set('lineHeight', parseInt(e.target.value) / 100);
                                selectedObject.canvas.renderAll();
                            }
                        }}
                        onMouseUp={() => saveState()}
                    />
                    <span className="property-value">{(selectedObject?.lineHeight || 1.16).toFixed(2)}</span>
                </div>
            </div>

            {/* Opacity */}
            <div className="property-row">
                <label>Opacity</label>
                <div className="property-control">
                    <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round((selectedObject?.opacity || 1) * 100)}
                        onChange={(e) => {
                            if (selectedObject && selectedObject.canvas) {
                                selectedObject.set('opacity', parseInt(e.target.value) / 100);
                                selectedObject.canvas.renderAll();
                            }
                        }}
                        onMouseUp={() => saveState()}
                    />
                    <span className="property-value">{Math.round((selectedObject?.opacity || 1) * 100)}%</span>
                </div>
            </div>

            {/* Rotation */}
            <div className="property-row">
                <label>Rotation</label>
                <div className="property-control">
                    <input
                        type="range"
                        min={-180}
                        max={180}
                        value={Math.round(selectedObject?.angle || 0)}
                        onChange={(e) => {
                            if (selectedObject && selectedObject.canvas) {
                                selectedObject.rotate(parseInt(e.target.value));
                                selectedObject.canvas.renderAll();
                            }
                        }}
                        onMouseUp={() => saveState()}
                    />
                    <input
                        type="number"
                        min={-180}
                        max={180}
                        value={Math.round(selectedObject?.angle || 0)}
                        onChange={(e) => {
                            if (selectedObject && selectedObject.canvas) {
                                selectedObject.rotate(parseInt(e.target.value));
                                selectedObject.canvas.renderAll();
                                saveState();
                            }
                        }}
                        className="property-number"
                    />
                </div>
            </div>

            {/* Direction */}
            <div className="property-row">
                <label>Direction</label>
                <div className="style-buttons">
                    <button
                        className={`style-btn ${selectedObject?.direction !== 'rtl' ? 'active' : ''}`}
                        onClick={() => {
                            if (selectedObject && selectedObject.canvas) {
                                selectedObject.set('direction', 'ltr');
                                selectedObject.canvas.renderAll();
                                saveState();
                            }
                        }}
                    >
                        LTR
                    </button>
                    <button
                        className={`style-btn ${selectedObject?.direction === 'rtl' ? 'active' : ''}`}
                        onClick={() => {
                            if (selectedObject && selectedObject.canvas) {
                                selectedObject.set('direction', 'rtl');
                                selectedObject.canvas.renderAll();
                                saveState();
                            }
                        }}
                    >
                        RTL
                    </button>
                </div>
            </div>

            {/* Stroke */}
            <div className="property-section">
                <h5>Stroke</h5>
                <div className="property-row">
                    <label>Color</label>
                    <input
                        type="color"
                        value={selectedObject?.stroke || '#000000'}
                        onChange={(e) => {
                            if (selectedObject && selectedObject.canvas) {
                                selectedObject.set('stroke', e.target.value);
                                selectedObject.canvas.renderAll();
                                saveState();
                            }
                        }}
                        className="color-input"
                    />
                </div>
                <div className="property-row">
                    <label>Width</label>
                    <div className="property-control">
                        <input
                            type="range"
                            min={0}
                            max={10}
                            value={selectedObject?.strokeWidth || 0}
                            onChange={(e) => {
                                if (selectedObject && selectedObject.canvas) {
                                    selectedObject.set('strokeWidth', parseInt(e.target.value));
                                    selectedObject.canvas.renderAll();
                                }
                            }}
                            onMouseUp={() => saveState()}
                        />
                        <span className="property-value">{selectedObject?.strokeWidth || 0}px</span>
                    </div>
                </div>
            </div>

            {/* Shadow / Glow - Mutually Exclusive */}
            <div className="property-section">
                <h5>Effect</h5>
                <div className="property-row">
                    <label>Type</label>
                    <select
                        value={
                            !selectedObject?.shadow ? 'none' :
                                (selectedObject.shadow.offsetX === 0 && selectedObject.shadow.offsetY === 0) ? 'glow' : 'shadow'
                        }
                        onChange={(e) => {
                            if (selectedObject && selectedObject.canvas) {
                                const type = e.target.value;
                                if (type === 'none') {
                                    selectedObject.set('shadow', null);
                                    selectedObject.canvas.renderAll();
                                    saveState();
                                } else if (type === 'shadow') {
                                    import('fabric').then(({ Shadow }) => {
                                        selectedObject.set('shadow', new Shadow({
                                            color: 'rgba(0,0,0,0.5)',
                                            blur: 10,
                                            offsetX: 3,
                                            offsetY: 3
                                        }));
                                        selectedObject.canvas.renderAll();
                                        saveState();
                                    });
                                } else if (type === 'glow') {
                                    import('fabric').then(({ Shadow }) => {
                                        selectedObject.set('shadow', new Shadow({
                                            color: '#00ffff',
                                            blur: 25,
                                            offsetX: 0,
                                            offsetY: 0
                                        }));
                                        selectedObject.canvas.renderAll();
                                        saveState();
                                    });
                                }
                            }
                        }}
                        className="property-select"
                    >
                        <option value="none">None</option>
                        <option value="shadow">Shadow</option>
                        <option value="glow">Glow</option>
                    </select>
                </div>
                <div className={`expandable-content ${selectedObject?.shadow ? 'expanded' : ''}`}>
                    <div className="property-row">
                        <label>Color</label>
                        <input
                            type="color"
                            defaultValue={selectedObject?.shadow?.color || '#000000'}
                            onChange={(e) => {
                                if (selectedObject?.shadow) {
                                    selectedObject.shadow.color = e.target.value;
                                    selectedObject.canvas.renderAll();
                                    saveState();
                                }
                            }}
                            className="color-input"
                        />
                    </div>
                    <div className="property-row">
                        <label>Blur</label>
                        <input
                            type="range"
                            min={0}
                            max={50}
                            defaultValue={selectedObject?.shadow?.blur || 10}
                            onChange={(e) => {
                                if (selectedObject?.shadow) {
                                    selectedObject.shadow.blur = parseInt(e.target.value);
                                    selectedObject.canvas.renderAll();
                                }
                            }}
                            onMouseUp={() => saveState()}
                        />
                    </div>
                    {/* Show Offset controls only for Shadow mode */}
                    {selectedObject?.shadow && (selectedObject.shadow.offsetX !== 0 || selectedObject.shadow.offsetY !== 0) && (
                        <>
                            <div className="property-row">
                                <label>Offset X</label>
                                <input
                                    type="range"
                                    min={-30}
                                    max={30}
                                    defaultValue={selectedObject?.shadow?.offsetX || 3}
                                    onChange={(e) => {
                                        if (selectedObject?.shadow) {
                                            selectedObject.shadow.offsetX = parseInt(e.target.value);
                                            selectedObject.canvas.renderAll();
                                        }
                                    }}
                                    onMouseUp={() => saveState()}
                                />
                            </div>
                            <div className="property-row">
                                <label>Offset Y</label>
                                <input
                                    type="range"
                                    min={-30}
                                    max={30}
                                    defaultValue={selectedObject?.shadow?.offsetY || 3}
                                    onChange={(e) => {
                                        if (selectedObject?.shadow) {
                                            selectedObject.shadow.offsetY = parseInt(e.target.value);
                                            selectedObject.canvas.renderAll();
                                        }
                                    }}
                                    onMouseUp={() => saveState()}
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Background */}
            <div className="property-section">
                <h5>Background</h5>
                <div className="property-row">
                    <label>Color</label>
                    <input
                        type="color"
                        value={selectedObject?.backgroundColor || '#ffffff'}
                        onChange={(e) => {
                            if (selectedObject && selectedObject.canvas) {
                                selectedObject.set('backgroundColor', e.target.value);
                                selectedObject.canvas.renderAll();
                                saveState();
                            }
                        }}
                        className="color-input"
                    />
                </div>
                <div className="property-row">
                    <label>Clear</label>
                    <button
                        className="style-btn"
                        onClick={() => {
                            if (selectedObject && selectedObject.canvas) {
                                selectedObject.set('backgroundColor', '');
                                selectedObject.canvas.renderAll();
                                saveState();
                            }
                        }}
                        style={{ fontSize: '11px', padding: '4px 8px' }}
                    >
                        Remove BG
                    </button>
                </div>
            </div>
        </div>
    );

    // =========================================
    // HELPER: Render shape properties
    // =========================================
    const renderShapeProperties = () => (
        <div className="property-group">
            <h4>Shape Properties</h4>

            <ObjectColorPicker
                object={selectedObject}
                property="stroke"
                label="Stroke"
                saveState={saveState}
            />

            <div className="property-row">
                <label>Width</label>
                <input
                    type="number"
                    min={1}
                    max={50}
                    value={selectedObject?.strokeWidth || 2}
                    onChange={(e) => {
                        if (selectedObject && selectedObject.canvas) {
                            selectedObject.set('strokeWidth', parseInt(e.target.value));
                            selectedObject.canvas.renderAll();
                            saveState();
                        }
                    }}
                    className="property-number full"
                />
            </div>

            <ObjectColorPicker
                object={selectedObject}
                property="fill"
                label="Fill"
                saveState={saveState}
            />
        </div>
    );

    // =========================================
    // HELPER: Render path/drawing properties
    // =========================================
    const renderPathProperties = () => (
        <div className="property-group">
            <h4>Drawing Properties</h4>

            <ObjectColorPicker
                object={selectedObject}
                property="stroke"
                label="Color"
                saveState={saveState}
            />

            <div className="property-row">
                <label>Width</label>
                <input
                    type="number"
                    min={1}
                    max={100}
                    value={selectedObject?.strokeWidth || 5}
                    onChange={(e) => {
                        if (selectedObject && selectedObject.canvas) {
                            selectedObject.set('strokeWidth', parseInt(e.target.value));
                            selectedObject.canvas.renderAll();
                            saveState();
                        }
                    }}
                    className="property-number full"
                />
            </div>

            <div className="property-row">
                <label>Opacity</label>
                <input
                    type="range"
                    min={0}
                    max={100}
                    value={(selectedObject?.opacity || 1) * 100}
                    onChange={(e) => {
                        if (selectedObject && selectedObject.canvas) {
                            selectedObject.set('opacity', parseInt(e.target.value) / 100);
                            selectedObject.canvas.renderAll();
                            saveState();
                        }
                    }}
                />
            </div>
        </div>
    );

    // =========================================
    // RENDER BASED ON TOOL (or selected object for select tool)
    // =========================================
    const renderContent = () => {
        // PRIORITY: If an object is selected, show its properties regardless of active tool
        if (selectedObject) {
            if (isText) {
                // Show text properties
                return renderTextProperties();
            } else if (isShape) {
                // Show shape properties
                return renderShapeProperties();
            } else if (isPath) {
                // Show path/drawing properties
                return renderPathProperties();
            }
        }

        switch (activeTool) {
            case 'brush':
                return (
                    <div className="property-group">
                        <h4>Brush Settings</h4>
                        <div className="property-row">
                            <label>Size</label>
                            <div className="property-control">
                                <input
                                    type="range"
                                    min={BRUSH.SIZE_MIN}
                                    max={BRUSH.SIZE_MAX}
                                    value={brushSize}
                                    onChange={(e) => setBrushSize(parseInt(e.target.value))}
                                />
                                <input
                                    type="number"
                                    min={BRUSH.SIZE_MIN}
                                    max={BRUSH.SIZE_MAX}
                                    value={brushSize}
                                    onChange={(e) => setBrushSize(parseInt(e.target.value))}
                                    className="property-number"
                                />
                            </div>
                        </div>
                        <div className="property-row">
                            <label>Opacity</label>
                            <div className="property-control">
                                <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    value={brushOpacity}
                                    onChange={(e) => setBrushOpacity(parseInt(e.target.value))}
                                />
                                <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={brushOpacity}
                                    onChange={(e) => setBrushOpacity(parseInt(e.target.value))}
                                    className="property-number"
                                />
                            </div>
                        </div>
                        <div className="property-row">
                            <label>Color</label>
                            <input
                                type="color"
                                value={brushColor}
                                onChange={(e) => setBrushColor(e.target.value)}
                                className="color-input"
                            />
                        </div>
                    </div>
                );

            case 'eraser':
                return (
                    <div className="property-group">
                        <h4>Eraser Settings</h4>
                        <div className="property-row">
                            <label>Size</label>
                            <div className="property-control">
                                <input
                                    type="range"
                                    min={ERASER.SIZE_MIN}
                                    max={ERASER.SIZE_MAX}
                                    value={eraserSize}
                                    onChange={(e) => setEraserSize(parseInt(e.target.value))}
                                />
                                <input
                                    type="number"
                                    min={ERASER.SIZE_MIN}
                                    max={ERASER.SIZE_MAX}
                                    value={eraserSize}
                                    onChange={(e) => setEraserSize(parseInt(e.target.value))}
                                    className="property-number"
                                />
                            </div>
                        </div>
                    </div>
                );

            case 'translate':
                return (
                    <div className="property-group">
                        <h4>Auto Translation</h4>

                        {/* Backend Status */}
                        <div className="property-row">
                            <label>Backend</label>
                            <button
                                className="translate-status-btn"
                                onClick={async () => {
                                    const isHealthy = await checkBackendHealth();
                                    alert(isHealthy ? 'Backend is running!' : 'Backend not available. Run: python main.py');
                                }}
                            >
                                Check Status
                            </button>
                        </div>

                        {/* Language Selection */}
                        <div className="property-row">
                            <label>Target</label>
                            <select
                                id="target-lang"
                                className="property-select"
                                defaultValue="ar"
                            >
                                {Object.entries(LANGUAGES).map(([code, name]) => (
                                    <option key={code} value={code}>{name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Translate Button */}
                        <div className="property-row">
                            <button
                                className="translate-btn primary"
                                onClick={async () => {
                                    const canvas = useEditorStore.getState().canvas;
                                    if (!canvas) return;

                                    const targetLang = document.getElementById('target-lang')?.value || 'ar';

                                    try {
                                        // Show loading
                                        alert('Extracting and translating text...');

                                        // Get canvas as base64
                                        const imageBase64 = canvas.toDataURL('image/png');

                                        // Call auto-translate
                                        const results = await autoTranslate(imageBase64, targetLang);

                                        if (results.length > 0) {
                                            const region = results[0];

                                            // Add translated text to canvas
                                            import('fabric').then(({ IText }) => {
                                                const textObj = new IText(region.translated_text, {
                                                    left: 50,
                                                    top: 50,
                                                    fontSize: 24,
                                                    fontFamily: 'Arial',
                                                    fill: '#000000',
                                                    backgroundColor: 'rgba(255,255,255,0.8)',
                                                    padding: 10,
                                                });
                                                canvas.add(textObj);
                                                canvas.setActiveObject(textObj);
                                                canvas.renderAll();
                                                useEditorStore.getState().saveState();
                                            });

                                            alert(`Translation complete!\n\nOriginal: ${region.original_text}\nTranslated: ${region.translated_text}`);
                                        } else {
                                            alert('No text detected in image.');
                                        }
                                    } catch (error) {
                                        console.error('Translation error:', error);
                                        alert('Translation failed. Make sure backend is running.');
                                    }
                                }}
                            >
                                Extract & Translate
                            </button>
                        </div>

                        <p className="translate-hint">
                            Extracts Japanese text from the image and translates it.
                        </p>
                    </div>
                );

            case 'crop':
                return (
                    <div className="property-group">
                        <h4>Crop Tool</h4>
                        <p className="crop-hint">Draw a rectangle on the canvas to select the crop area.</p>

                        <div className="crop-buttons">
                            <button
                                className="crop-btn apply"
                                onClick={() => {
                                    import('../../hooks/useCropTool').then(({ useCropTool }) => {
                                        // Get applyCrop directly from hook result
                                        const { canvas, cropRect, saveState } = useEditorStore.getState();
                                        if (canvas && cropRect) {
                                            // Apply crop logic
                                            const objects = canvas.getObjects();
                                            const imageObj = objects.find(obj => obj.type === 'image' && obj !== cropRect);

                                            if (imageObj) {
                                                const tempCanvas = document.createElement('canvas');
                                                tempCanvas.width = cropRect.width;
                                                tempCanvas.height = cropRect.height;
                                                const ctx = tempCanvas.getContext('2d');

                                                const imgElement = imageObj._element;
                                                if (imgElement) {
                                                    const scaleX = imageObj.scaleX || 1;
                                                    const scaleY = imageObj.scaleY || 1;
                                                    const cropLeft = (cropRect.left - imageObj.left) / scaleX;
                                                    const cropTop = (cropRect.top - imageObj.top) / scaleY;

                                                    ctx.drawImage(
                                                        imgElement,
                                                        cropLeft, cropTop,
                                                        cropRect.width / scaleX, cropRect.height / scaleY,
                                                        0, 0,
                                                        cropRect.width, cropRect.height
                                                    );

                                                    const croppedDataUrl = tempCanvas.toDataURL('image/png');

                                                    import('fabric').then(({ Image }) => {
                                                        Image.fromURL(croppedDataUrl).then((croppedImg) => {
                                                            croppedImg.set({
                                                                left: cropRect.left,
                                                                top: cropRect.top,
                                                                selectable: true,
                                                            });

                                                            canvas.remove(imageObj);
                                                            canvas.remove(cropRect);
                                                            canvas.add(croppedImg);
                                                            canvas.setActiveObject(croppedImg);
                                                            canvas.renderAll();

                                                            useEditorStore.setState({ cropRect: null });
                                                            saveState();
                                                        });
                                                    });
                                                }
                                            }
                                        }
                                    });
                                }}
                            >
                                ✓ Apply Crop
                            </button>
                            <button
                                className="crop-btn cancel"
                                onClick={() => {
                                    const { canvas, cropRect } = useEditorStore.getState();
                                    if (canvas && cropRect) {
                                        canvas.remove(cropRect);
                                        canvas.renderAll();
                                    }
                                    useEditorStore.setState({ cropRect: null });
                                }}
                            >
                                ✕ Cancel
                            </button>
                        </div>
                    </div>
                );

            case 'healing':
                return (
                    <div className="property-group">
                        <h4>Healing Tool</h4>
                        <div className="property-row">
                            <label>Size</label>
                            <div className="property-control">
                                <input
                                    type="range"
                                    min="5"
                                    max="150"
                                    value={useEditorStore.getState().healingSize || 25}
                                    onChange={(e) => useEditorStore.getState().setHealingSize(parseInt(e.target.value))}
                                />
                                <input
                                    type="number"
                                    value={useEditorStore.getState().healingSize || 25}
                                    min="5"
                                    max="150"
                                    onChange={(e) => useEditorStore.getState().setHealingSize(parseInt(e.target.value))}
                                    className="property-number"
                                />
                            </div>
                        </div>
                        <p className="tool-hint">
                            Paint over text to remove it. The tool samples surrounding colors to fill the area.
                        </p>
                    </div>
                );

            case 'clone':
                return (
                    <div className="property-group">
                        <h4>Clone Tool</h4>
                        <div className="property-row">
                            <label>Size</label>
                            <div className="property-control">
                                <input
                                    type="range"
                                    min="5"
                                    max="150"
                                    value={useEditorStore.getState().cloneSize || 25}
                                    onChange={(e) => useEditorStore.getState().setCloneSize(parseInt(e.target.value))}
                                />
                                <input
                                    type="number"
                                    value={useEditorStore.getState().cloneSize || 25}
                                    min="5"
                                    max="150"
                                    onChange={(e) => useEditorStore.getState().setCloneSize(parseInt(e.target.value))}
                                    className="property-number"
                                />
                            </div>
                        </div>
                        <p className="tool-hint">
                            <strong>Alt+Click</strong> to set source point, then paint to clone from that area.
                        </p>
                    </div>
                );

            case 'color_replace':
                return (
                    <div className="property-group">
                        <h4>Color Replace</h4>
                        <p className="tool-hint">
                            Draw a rectangle. All pixels matching source color will be replaced.
                        </p>
                        <div className="property-row">
                            <label>Source Color</label>
                            <input
                                type="color"
                                value={useEditorStore.getState().colorReplaceSource}
                                onChange={(e) => useEditorStore.getState().setColorReplaceSource(e.target.value)}
                                className="color-input"
                            />
                        </div>
                        <div className="property-row">
                            <label>Replace With</label>
                            <input
                                type="color"
                                value={useEditorStore.getState().colorReplaceTarget}
                                onChange={(e) => useEditorStore.getState().setColorReplaceTarget(e.target.value)}
                                className="color-input"
                            />
                        </div>
                        <div className="property-row">
                            <label>Tolerance</label>
                            <div className="property-control">
                                <input
                                    type="range"
                                    min="1"
                                    max="150"
                                    value={useEditorStore.getState().colorReplaceTolerance}
                                    onChange={(e) => useEditorStore.getState().setColorReplaceTolerance(parseInt(e.target.value))}
                                />
                                <input
                                    type="number"
                                    value={useEditorStore.getState().colorReplaceTolerance}
                                    min="1"
                                    max="150"
                                    onChange={(e) => useEditorStore.getState().setColorReplaceTolerance(parseInt(e.target.value))}
                                    className="property-number"
                                />
                            </div>
                        </div>
                    </div>
                );

            case 'rectangle':
            case 'ellipse':
                return (
                    <div className="property-group">
                        <h4>Shape Settings</h4>

                        {/* STROKE COLOR - Color Palette */}
                        <div className="property-row">
                            <label>Stroke</label>
                            <div className="color-palette">
                                {[
                                    '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff',
                                    '#ffff00', '#ff00ff', '#00ffff', '#ff6600', '#6600ff',
                                    '#333333', '#666666', '#999999', '#cccccc', '#990000',
                                    '#009900', '#000099', '#996600', '#006699', '#660066'
                                ].map((color) => (
                                    <button
                                        key={color}
                                        className={`color-swatch ${isShape && selectedObject.stroke === color ? 'active' : ''}`}
                                        style={{ backgroundColor: color }}
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            const obj = useEditorStore.getState().selectedObject;
                                            if (obj && obj.canvas) {
                                                obj.set('stroke', color);
                                                obj.canvas.setActiveObject(obj);  // Keep selected
                                                obj.canvas.renderAll();
                                                setBrushColor(color);
                                                saveState();
                                            }
                                        }}
                                        title={color}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* STROKE WIDTH */}
                        <div className="property-row">
                            <label>Width</label>
                            <input
                                type="number"
                                min={1}
                                max={50}
                                defaultValue={isShape ? (selectedObject.strokeWidth || 2) : 2}
                                onChange={(e) => {
                                    const obj = useEditorStore.getState().selectedObject;
                                    if (obj && obj.canvas) {
                                        obj.set('strokeWidth', parseInt(e.target.value));
                                        obj.canvas.renderAll();
                                        saveState();
                                    }
                                }}
                                className="property-number full"
                            />
                        </div>

                        {/* FILL COLOR - Using ref to prevent re-render */}
                        <div className="property-row">
                            <label>Fill</label>
                            <div className="property-control">
                                <input
                                    ref={fillColorRef}
                                    type="color"
                                    defaultValue={isShape && selectedObject.fill !== 'transparent' ? selectedObject.fill : '#ffffff'}
                                    onInput={(e) => {
                                        const obj = useEditorStore.getState().selectedObject;
                                        if (obj && obj.canvas) {
                                            obj.set('fill', e.target.value);
                                            obj.canvas.renderAll();
                                        }
                                    }}
                                    onChange={() => saveState()}
                                    className="color-input"
                                />
                                <button
                                    className={`style-btn ${isShape && selectedObject.fill === 'transparent' ? 'active' : ''}`}
                                    onClick={() => {
                                        const obj = useEditorStore.getState().selectedObject;
                                        if (obj && obj.canvas) {
                                            obj.set('fill', 'transparent');
                                            obj.canvas.renderAll();
                                            saveState();
                                        }
                                    }}
                                    title="No Fill"
                                >
                                    ∅
                                </button>
                            </div>
                        </div>

                        <div className="property-row hint">
                            <span>💡 Right-click shape for more options</span>
                        </div>
                    </div>
                );

            case 'text':
                return (
                    <div className="property-group text-settings-advanced">
                        <h4>Text Settings</h4>

                        {/* Font Picker */}
                        <FontPicker
                            selectedObject={selectedObject}
                            availableFonts={availableFonts}
                            saveState={saveState}
                        />

                        {/* Size */}
                        <div className="property-row">
                            <label>Size</label>
                            <input
                                type="number"
                                min={1}
                                max={200}
                                defaultValue={isText ? selectedObject.fontSize : 24}
                                onChange={(e) => {
                                    const obj = useEditorStore.getState().selectedObject;
                                    if (obj && obj.canvas) {
                                        obj.set('fontSize', parseInt(e.target.value));
                                        obj.canvas.renderAll();
                                        saveState();
                                    }
                                }}
                                className="property-number full"
                            />
                        </div>

                        {/* Color */}
                        <div className="property-row">
                            <label>Color</label>
                            <input
                                type="color"
                                defaultValue={isText ? (selectedObject.fill || '#ffffff') : brushColor}
                                onChange={(e) => {
                                    setBrushColor(e.target.value);
                                    const obj = useEditorStore.getState().selectedObject;
                                    if (obj && obj.canvas) {
                                        obj.set('fill', e.target.value);
                                        obj.canvas.renderAll();
                                        saveState();
                                    }
                                }}
                                className="color-input"
                            />
                        </div>

                        {/* Style Buttons */}
                        <div className="property-row">
                            <label>Style</label>
                            <div className="style-buttons">
                                <button
                                    className={`style-btn ${isText && selectedObject.fontWeight === 'bold' ? 'active' : ''}`}
                                    onClick={() => isText && toggleTextStyle('bold')}
                                    title="Bold"
                                >
                                    <Bold size={14} />
                                </button>
                                <button
                                    className={`style-btn ${isText && selectedObject.fontStyle === 'italic' ? 'active' : ''}`}
                                    onClick={() => isText && toggleTextStyle('italic')}
                                    title="Italic"
                                >
                                    <Italic size={14} />
                                </button>
                                <button
                                    className={`style-btn ${isText && selectedObject.underline ? 'active' : ''}`}
                                    onClick={() => isText && toggleTextStyle('underline')}
                                    title="Underline"
                                >
                                    <Underline size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Align */}
                        <div className="property-row">
                            <label>Align</label>
                            <div className="style-buttons">
                                <button
                                    className={`style-btn ${isText && selectedObject.textAlign === 'left' ? 'active' : ''}`}
                                    onClick={() => {
                                        const obj = useEditorStore.getState().selectedObject;
                                        if (obj && obj.canvas) {
                                            obj.set('textAlign', 'left');
                                            obj.canvas.renderAll();
                                            saveState();
                                        }
                                    }}
                                >
                                    <AlignLeft size={14} />
                                </button>
                                <button
                                    className={`style-btn ${isText && selectedObject.textAlign === 'center' ? 'active' : ''}`}
                                    onClick={() => {
                                        const obj = useEditorStore.getState().selectedObject;
                                        if (obj && obj.canvas) {
                                            obj.set('textAlign', 'center');
                                            obj.canvas.renderAll();
                                            saveState();
                                        }
                                    }}
                                >
                                    <AlignCenter size={14} />
                                </button>
                                <button
                                    className={`style-btn ${isText && selectedObject.textAlign === 'right' ? 'active' : ''}`}
                                    onClick={() => {
                                        const obj = useEditorStore.getState().selectedObject;
                                        if (obj && obj.canvas) {
                                            obj.set('textAlign', 'right');
                                            obj.canvas.renderAll();
                                            saveState();
                                        }
                                    }}
                                >
                                    <AlignRight size={14} />
                                </button>
                            </div>
                        </div>

                        {/* ========== NEW FEATURES ========== */}

                        {/* Letter Spacing */}
                        <div className="property-row">
                            <label>Spacing</label>
                            <div className="property-control">
                                <input
                                    type="range"
                                    min={-200}
                                    max={800}
                                    defaultValue={isText ? (selectedObject.charSpacing || 0) : 0}
                                    onChange={(e) => {
                                        const obj = useEditorStore.getState().selectedObject;
                                        if (obj && obj.canvas) {
                                            obj.set('charSpacing', parseInt(e.target.value));
                                            obj.canvas.renderAll();
                                        }
                                    }}
                                    onMouseUp={() => saveState()}
                                />
                                <input
                                    type="number"
                                    min={-200}
                                    max={800}
                                    defaultValue={isText ? (selectedObject.charSpacing || 0) : 0}
                                    onChange={(e) => {
                                        const obj = useEditorStore.getState().selectedObject;
                                        if (obj && obj.canvas) {
                                            obj.set('charSpacing', parseInt(e.target.value));
                                            obj.canvas.renderAll();
                                            saveState();
                                        }
                                    }}
                                    className="property-number"
                                />
                            </div>
                        </div>

                        {/* Line Height */}
                        <div className="property-row">
                            <label>Line H.</label>
                            <div className="property-control">
                                <input
                                    type="range"
                                    min={50}
                                    max={300}
                                    defaultValue={isText ? Math.round((selectedObject.lineHeight || 1.16) * 100) : 116}
                                    onChange={(e) => {
                                        const obj = useEditorStore.getState().selectedObject;
                                        if (obj && obj.canvas) {
                                            obj.set('lineHeight', parseInt(e.target.value) / 100);
                                            obj.canvas.renderAll();
                                        }
                                    }}
                                    onMouseUp={() => saveState()}
                                />
                                <span className="property-value">{isText ? (selectedObject.lineHeight || 1.16).toFixed(2) : '1.16'}</span>
                            </div>
                        </div>

                        {/* Opacity */}
                        <div className="property-row">
                            <label>Opacity</label>
                            <div className="property-control">
                                <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    defaultValue={isText ? Math.round((selectedObject.opacity || 1) * 100) : 100}
                                    onChange={(e) => {
                                        const obj = useEditorStore.getState().selectedObject;
                                        if (obj && obj.canvas) {
                                            obj.set('opacity', parseInt(e.target.value) / 100);
                                            obj.canvas.renderAll();
                                        }
                                    }}
                                    onMouseUp={() => saveState()}
                                />
                                <span className="property-value">{isText ? Math.round((selectedObject.opacity || 1) * 100) : 100}%</span>
                            </div>
                        </div>

                        {/* Rotation */}
                        <div className="property-row">
                            <label>Rotation</label>
                            <div className="property-control">
                                <input
                                    type="range"
                                    min={-180}
                                    max={180}
                                    defaultValue={isText ? Math.round(selectedObject.angle || 0) : 0}
                                    onChange={(e) => {
                                        const obj = useEditorStore.getState().selectedObject;
                                        if (obj && obj.canvas) {
                                            obj.rotate(parseInt(e.target.value));
                                            obj.canvas.renderAll();
                                        }
                                    }}
                                    onMouseUp={() => saveState()}
                                />
                                <input
                                    type="number"
                                    min={-180}
                                    max={180}
                                    defaultValue={isText ? Math.round(selectedObject.angle || 0) : 0}
                                    onChange={(e) => {
                                        const obj = useEditorStore.getState().selectedObject;
                                        if (obj && obj.canvas) {
                                            obj.rotate(parseInt(e.target.value));
                                            obj.canvas.renderAll();
                                            saveState();
                                        }
                                    }}
                                    className="property-number"
                                />
                            </div>
                        </div>

                        {/* Text Direction */}
                        <div className="property-row">
                            <label>Direction</label>
                            <div className="style-buttons">
                                <button
                                    className={`style-btn ${isText && selectedObject.direction !== 'rtl' ? 'active' : ''}`}
                                    onClick={() => {
                                        const obj = useEditorStore.getState().selectedObject;
                                        if (obj && obj.canvas) {
                                            obj.set('direction', 'ltr');
                                            obj.canvas.renderAll();
                                            saveState();
                                        }
                                    }}
                                    title="Left to Right"
                                >
                                    LTR
                                </button>
                                <button
                                    className={`style-btn ${isText && selectedObject.direction === 'rtl' ? 'active' : ''}`}
                                    onClick={() => {
                                        const obj = useEditorStore.getState().selectedObject;
                                        if (obj && obj.canvas) {
                                            obj.set('direction', 'rtl');
                                            obj.canvas.renderAll();
                                            saveState();
                                        }
                                    }}
                                    title="Right to Left"
                                >
                                    RTL
                                </button>
                            </div>
                        </div>

                        {/* ========== STROKE/OUTLINE ========== */}
                        <div className="property-section">
                            <h5>Stroke</h5>
                            <div className="property-row">
                                <label>Color</label>
                                <input
                                    type="color"
                                    defaultValue={isText && selectedObject.stroke ? selectedObject.stroke : '#000000'}
                                    onChange={(e) => {
                                        const obj = useEditorStore.getState().selectedObject;
                                        if (obj && obj.canvas) {
                                            obj.set('stroke', e.target.value);
                                            obj.canvas.renderAll();
                                            saveState();
                                        }
                                    }}
                                    className="color-input"
                                />
                            </div>
                            <div className="property-row">
                                <label>Width</label>
                                <div className="property-control">
                                    <input
                                        type="range"
                                        min={0}
                                        max={10}
                                        defaultValue={isText ? (selectedObject.strokeWidth || 0) : 0}
                                        onChange={(e) => {
                                            const obj = useEditorStore.getState().selectedObject;
                                            if (obj && obj.canvas) {
                                                obj.set('strokeWidth', parseInt(e.target.value));
                                                obj.canvas.renderAll();
                                            }
                                        }}
                                        onMouseUp={() => saveState()}
                                    />
                                    <span className="property-value">{isText ? (selectedObject.strokeWidth || 0) : 0}px</span>
                                </div>
                            </div>
                        </div>

                        {/* ========== SHADOW / GLOW ========== */}
                        <div className="property-section">
                            <h5>Effect</h5>
                            <div className="property-row">
                                <label>Type</label>
                                <select
                                    value={
                                        !(isText && selectedObject.shadow) ? 'none' :
                                            (selectedObject.shadow.offsetX === 0 && selectedObject.shadow.offsetY === 0) ? 'glow' : 'shadow'
                                    }
                                    onChange={(e) => {
                                        const obj = useEditorStore.getState().selectedObject;
                                        if (obj && obj.canvas) {
                                            const type = e.target.value;
                                            if (type === 'none') {
                                                obj.set('shadow', null);
                                                obj.canvas.renderAll();
                                                saveState();
                                            } else if (type === 'shadow') {
                                                import('fabric').then(({ Shadow }) => {
                                                    obj.set('shadow', new Shadow({
                                                        color: 'rgba(0,0,0,0.5)',
                                                        blur: 10,
                                                        offsetX: 3,
                                                        offsetY: 3
                                                    }));
                                                    obj.canvas.renderAll();
                                                    saveState();
                                                });
                                            } else if (type === 'glow') {
                                                import('fabric').then(({ Shadow }) => {
                                                    obj.set('shadow', new Shadow({
                                                        color: '#00ffff',
                                                        blur: 25,
                                                        offsetX: 0,
                                                        offsetY: 0
                                                    }));
                                                    obj.canvas.renderAll();
                                                    saveState();
                                                });
                                            }
                                        }
                                    }}
                                    className="property-select"
                                >
                                    <option value="none">None</option>
                                    <option value="shadow">Shadow</option>
                                    <option value="glow">Glow</option>
                                </select>
                            </div>
                            <div className={`expandable-content ${isText && selectedObject.shadow ? 'expanded' : ''}`}>
                                <div className="property-row">
                                    <label>Color</label>
                                    <input
                                        type="color"
                                        defaultValue={selectedObject?.shadow?.color || '#000000'}
                                        onChange={(e) => {
                                            const obj = useEditorStore.getState().selectedObject;
                                            if (obj && obj.shadow) {
                                                obj.shadow.color = e.target.value;
                                                obj.canvas.renderAll();
                                                saveState();
                                            }
                                        }}
                                        className="color-input"
                                    />
                                </div>
                                <div className="property-row">
                                    <label>Blur</label>
                                    <input
                                        type="range"
                                        min={0}
                                        max={50}
                                        defaultValue={selectedObject?.shadow?.blur || 10}
                                        onChange={(e) => {
                                            const obj = useEditorStore.getState().selectedObject;
                                            if (obj && obj.shadow) {
                                                obj.shadow.blur = parseInt(e.target.value);
                                                obj.canvas.renderAll();
                                            }
                                        }}
                                        onMouseUp={() => saveState()}
                                    />
                                </div>
                                {/* Show Offset controls only for Shadow mode */}
                                {isText && selectedObject.shadow && (selectedObject.shadow.offsetX !== 0 || selectedObject.shadow.offsetY !== 0) && (
                                    <>
                                        <div className="property-row">
                                            <label>Offset X</label>
                                            <input
                                                type="range"
                                                min={-30}
                                                max={30}
                                                defaultValue={selectedObject?.shadow?.offsetX || 3}
                                                onChange={(e) => {
                                                    const obj = useEditorStore.getState().selectedObject;
                                                    if (obj && obj.shadow) {
                                                        obj.shadow.offsetX = parseInt(e.target.value);
                                                        obj.canvas.renderAll();
                                                    }
                                                }}
                                                onMouseUp={() => saveState()}
                                            />
                                        </div>
                                        <div className="property-row">
                                            <label>Offset Y</label>
                                            <input
                                                type="range"
                                                min={-30}
                                                max={30}
                                                defaultValue={selectedObject?.shadow?.offsetY || 3}
                                                onChange={(e) => {
                                                    const obj = useEditorStore.getState().selectedObject;
                                                    if (obj && obj.shadow) {
                                                        obj.shadow.offsetY = parseInt(e.target.value);
                                                        obj.canvas.renderAll();
                                                    }
                                                }}
                                                onMouseUp={() => saveState()}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>


                        {/* ========== BACKGROUND ========== */}
                        <div className="property-section">
                            <h5>Background</h5>
                            <div className="property-row">
                                <label>Color</label>
                                <input
                                    type="color"
                                    defaultValue={isText && selectedObject.backgroundColor ? selectedObject.backgroundColor : '#ffffff'}
                                    onChange={(e) => {
                                        const obj = useEditorStore.getState().selectedObject;
                                        if (obj && obj.canvas) {
                                            obj.set('backgroundColor', e.target.value);
                                            obj.canvas.renderAll();
                                            saveState();
                                        }
                                    }}
                                    className="color-input"
                                />
                            </div>
                            <div className="property-row">
                                <label>Clear</label>
                                <button
                                    className="style-btn"
                                    onClick={() => {
                                        const obj = useEditorStore.getState().selectedObject;
                                        if (obj && obj.canvas) {
                                            obj.set('backgroundColor', '');
                                            obj.canvas.renderAll();
                                            saveState();
                                        }
                                    }}
                                    style={{ fontSize: '11px', padding: '4px 8px' }}
                                >
                                    Remove BG
                                </button>
                            </div>
                        </div>

                    </div>
                );

            default:
                if (!selectedObject) {
                    return (
                        <div className="property-empty">
                            <p>Select a tool or object</p>
                        </div>
                    );
                }

                // Show image filters if image is selected
                if (isImage) {
                    return (
                        <div className="property-group" key={`filters-${filterResetKey}`}>
                            <h4>Image Filters</h4>

                            {/* Brightness */}
                            <div className="property-row">
                                <label>Brightness</label>
                                <div className="property-control">
                                    <input
                                        type="range"
                                        min={-100}
                                        max={100}
                                        defaultValue={0}
                                        onChange={(e) => {
                                            const obj = useEditorStore.getState().selectedObject;
                                            if (obj && obj.canvas && obj.filters) {
                                                // Find or create brightness filter
                                                let brightnessFilter = obj.filters.find(f => f && f.type === 'Brightness');
                                                if (!brightnessFilter) {
                                                    import('fabric').then(({ filters }) => {
                                                        brightnessFilter = new filters.Brightness({ brightness: parseFloat(e.target.value) / 100 });
                                                        obj.filters.push(brightnessFilter);
                                                        obj.applyFilters();
                                                        obj.canvas.renderAll();
                                                    });
                                                } else {
                                                    brightnessFilter.brightness = parseFloat(e.target.value) / 100;
                                                    obj.applyFilters();
                                                    obj.canvas.renderAll();
                                                }
                                            }
                                        }}
                                    />
                                    <span className="filter-value">0</span>
                                </div>
                            </div>

                            {/* Contrast */}
                            <div className="property-row">
                                <label>Contrast</label>
                                <div className="property-control">
                                    <input
                                        type="range"
                                        min={-100}
                                        max={100}
                                        defaultValue={0}
                                        onChange={(e) => {
                                            const obj = useEditorStore.getState().selectedObject;
                                            if (obj && obj.canvas && obj.filters) {
                                                let contrastFilter = obj.filters.find(f => f && f.type === 'Contrast');
                                                if (!contrastFilter) {
                                                    import('fabric').then(({ filters }) => {
                                                        contrastFilter = new filters.Contrast({ contrast: parseFloat(e.target.value) / 100 });
                                                        obj.filters.push(contrastFilter);
                                                        obj.applyFilters();
                                                        obj.canvas.renderAll();
                                                    });
                                                } else {
                                                    contrastFilter.contrast = parseFloat(e.target.value) / 100;
                                                    obj.applyFilters();
                                                    obj.canvas.renderAll();
                                                }
                                            }
                                        }}
                                    />
                                    <span className="filter-value">0</span>
                                </div>
                            </div>

                            {/* Saturation */}
                            <div className="property-row">
                                <label>Saturation</label>
                                <div className="property-control">
                                    <input
                                        type="range"
                                        min={-100}
                                        max={100}
                                        defaultValue={0}
                                        onChange={(e) => {
                                            const obj = useEditorStore.getState().selectedObject;
                                            if (obj && obj.canvas && obj.filters) {
                                                let saturationFilter = obj.filters.find(f => f && f.type === 'Saturation');
                                                if (!saturationFilter) {
                                                    import('fabric').then(({ filters }) => {
                                                        saturationFilter = new filters.Saturation({ saturation: parseFloat(e.target.value) / 100 });
                                                        obj.filters.push(saturationFilter);
                                                        obj.applyFilters();
                                                        obj.canvas.renderAll();
                                                    });
                                                } else {
                                                    saturationFilter.saturation = parseFloat(e.target.value) / 100;
                                                    obj.applyFilters();
                                                    obj.canvas.renderAll();
                                                }
                                            }
                                        }}
                                    />
                                    <span className="filter-value">0</span>
                                </div>
                            </div>

                            {/* Reset Filters Button */}
                            <div className="property-row">
                                <button
                                    className="reset-filters-btn"
                                    onClick={() => {
                                        const obj = useEditorStore.getState().selectedObject;
                                        if (obj && obj.canvas) {
                                            obj.filters = [];
                                            obj.applyFilters();
                                            obj.canvas.renderAll();
                                            saveState();
                                            // Reset slider positions
                                            setFilterResetKey(prev => prev + 1);
                                        }
                                    }}
                                >
                                    Reset Filters
                                </button>
                            </div>
                        </div>
                    );
                }

                return null;
        }
    };

    // =========================================
    // OBJECT TRANSFORM (for selected objects)
    // =========================================
    const renderObjectTransform = () => {
        if (!selectedObject) return null;

        return (
            <div className="property-group">
                <h4>Transform</h4>

                <div className="property-row">
                    <label>X</label>
                    <input
                        type="number"
                        value={Math.round(selectedObject.left || 0)}
                        onChange={(e) => {
                            selectedObject.set('left', parseInt(e.target.value));
                            selectedObject.canvas?.renderAll();
                            saveState();
                        }}
                        className="property-number full"
                    />
                </div>

                <div className="property-row">
                    <label>Y</label>
                    <input
                        type="number"
                        value={Math.round(selectedObject.top || 0)}
                        onChange={(e) => {
                            selectedObject.set('top', parseInt(e.target.value));
                            selectedObject.canvas?.renderAll();
                            saveState();
                        }}
                        className="property-number full"
                    />
                </div>

                <div className="property-row">
                    <label>Rotation</label>
                    <input
                        type="number"
                        value={Math.round(selectedObject.angle || 0)}
                        onChange={(e) => {
                            selectedObject.set('angle', parseInt(e.target.value));
                            selectedObject.canvas?.renderAll();
                            saveState();
                        }}
                        className="property-number full"
                    />
                </div>

                <div className="property-row">
                    <label>Opacity</label>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={(selectedObject.opacity || 1) * 100}
                        onChange={(e) => {
                            selectedObject.set('opacity', parseInt(e.target.value) / 100);
                            selectedObject.canvas?.renderAll();
                            saveState();
                        }}
                    />
                </div>
            </div>
        );
    };

    return (
        <div
            className="properties-panel panel"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="panel-header">
                <span>Properties</span>
            </div>
            <div className="properties-content">
                {renderContent()}
                {renderObjectTransform()}
            </div>
        </div>
    );
}

export default PropertiesPanel;
