import React, { useState } from 'react';
import {
    MousePointer2,
    Move,
    Brush,
    Eraser,
    Type,
    Square,
    Circle,
    Crop,
    Pipette,
    Sparkles,
    Copy,
    Undo2,
    Redo2,
    ZoomIn,
    ZoomOut,
    Hand,
    Wand2,
    ScanText,
    Scissors,
    RectangleHorizontal,
    Hexagon,
    MessageSquare
} from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import './Toolbar.css';

const tools = [
    { id: 'select', icon: MousePointer2, label: 'Select (V)', shortcut: 'v' },
    { id: 'move', icon: Hand, label: 'Pan (P)', shortcut: 'P' },
    { id: 'color_replace', icon: Wand2, label: 'Color Replace (W)', shortcut: 'w' },
    { id: 'brush', icon: Brush, label: 'Brush (B)', shortcut: 'b' },
    { id: 'eraser', icon: Eraser, label: 'Eraser (E)', shortcut: 'e' },
    { id: 'text', icon: Type, label: 'Text (T)', shortcut: 't' },
    { id: 'rectangle', icon: Square, label: 'Rectangle (U)', shortcut: 'u' },
    { id: 'ellipse', icon: Circle, label: 'Ellipse (O)', shortcut: 'o' },
    { id: 'eyedropper', icon: Pipette, label: 'Eyedropper (I)', shortcut: 'i' },
    { id: 'crop', icon: Crop, label: 'Crop (C)', shortcut: 'c' },
    { id: 'healing', icon: Sparkles, label: 'Healing (J)', shortcut: 'j' },
    { id: 'clone', icon: Copy, label: 'Clone (S)', shortcut: 's', hasSubmenu: true },
    { id: 'region_detect', icon: ScanText, label: 'Region Text Detect (R)', shortcut: 'r' },
    { id: 'quick_erase', icon: Scissors, label: 'Quick Erase (Q)', shortcut: 'q', hasSubmenu: true },
    { id: 'bubble', icon: MessageSquare, label: 'Bubble Creator (G)', shortcut: 'g', hasSubmenu: true },
];

function Toolbar() {
    const { activeTool, setActiveTool, undo, redo, zoom, setZoom, quickEraseMode, setQuickEraseMode, setShowBubbleCreator, cloneMode, setCloneMode } = useEditorStore();
    const [showQuickEraseMenu, setShowQuickEraseMenu] = useState(false);
    const [showCloneMenu, setShowCloneMenu] = useState(false);

    const handleToolClick = (toolId) => {
        setActiveTool(toolId);
        setShowQuickEraseMenu(false);
        setShowCloneMenu(false);

        // Open BubbleCreator panel when bubble tool is selected
        if (toolId === 'bubble') {
            setShowBubbleCreator(true);
        } else {
            // Close BubbleCreator when switching to any other tool
            setShowBubbleCreator(false);
        }
    };

    const handleToolRightClick = (e, toolId) => {
        e.preventDefault();
        if (toolId === 'quick_erase') {
            setShowQuickEraseMenu(!showQuickEraseMenu);
            setShowCloneMenu(false);
        } else if (toolId === 'clone') {
            setShowCloneMenu(!showCloneMenu);
            setShowQuickEraseMenu(false);
        }
    };

    const handleQuickEraseModeSelect = (mode) => {
        setQuickEraseMode(mode);
        setActiveTool('quick_erase');
        setShowQuickEraseMenu(false);
    };

    const getQuickEraseModeIcon = () => {
        switch (quickEraseMode) {
            case 'ellipse': return Circle;
            case 'polygon': return Hexagon;
            default: return RectangleHorizontal;
        }
    };

    const handleCloneModeSelect = (mode) => {
        setCloneMode(mode);
        setActiveTool('clone');
        setShowCloneMenu(false);
    };

    return (
        <div className="toolbar">
            <div className="toolbar-section">
                {tools.map((tool) => (
                    <div key={tool.id} className="tool-btn-wrapper">
                        <button
                            className={`tool-btn ${activeTool === tool.id ? 'active' : ''}`}
                            onClick={() => handleToolClick(tool.id)}
                            onContextMenu={(e) => handleToolRightClick(e, tool.id)}
                            data-tooltip={tool.label}
                        >
                            {tool.id === 'quick_erase' ? (
                                <>
                                    <tool.icon size={20} />
                                    <span className="tool-mode-indicator">
                                        {quickEraseMode === 'rectangle' && '▢'}
                                        {quickEraseMode === 'ellipse' && '○'}
                                        {quickEraseMode === 'polygon' && '⬡'}
                                    </span>
                                </>
                            ) : tool.id === 'clone' ? (
                                <>
                                    <tool.icon size={20} />
                                    <span className="tool-mode-indicator">
                                        {cloneMode === 'brush' && '●'}
                                        {cloneMode === 'square' && '▢'}
                                    </span>
                                </>
                            ) : (
                                <tool.icon size={20} />
                            )}
                        </button>

                        {/* Quick Erase Context Menu */}
                        {tool.id === 'quick_erase' && showQuickEraseMenu && (
                            <div className="tool-submenu">
                                <button
                                    className={`submenu-item ${quickEraseMode === 'rectangle' ? 'active' : ''}`}
                                    onClick={() => handleQuickEraseModeSelect('rectangle')}
                                >
                                    <RectangleHorizontal size={16} />
                                    <span>Rectangle</span>
                                </button>
                                <button
                                    className={`submenu-item ${quickEraseMode === 'ellipse' ? 'active' : ''}`}
                                    onClick={() => handleQuickEraseModeSelect('ellipse')}
                                >
                                    <Circle size={16} />
                                    <span>Ellipse</span>
                                </button>
                                <button
                                    className={`submenu-item ${quickEraseMode === 'polygon' ? 'active' : ''}`}
                                    onClick={() => handleQuickEraseModeSelect('polygon')}
                                >
                                    <Hexagon size={16} />
                                    <span>Adjustable (Fine-tune)</span>
                                </button>
                            </div>
                        )}

                        {/* Clone Tool Context Menu */}
                        {tool.id === 'clone' && showCloneMenu && (
                            <div className="tool-submenu">
                                <button
                                    className={`submenu-item ${cloneMode === 'brush' ? 'active' : ''}`}
                                    onClick={() => handleCloneModeSelect('brush')}
                                >
                                    <Brush size={16} />
                                    <span>Brush (Alt+Drag)</span>
                                </button>
                                <button
                                    className={`submenu-item ${cloneMode === 'square' ? 'active' : ''}`}
                                    onClick={() => handleCloneModeSelect('square')}
                                >
                                    <RectangleHorizontal size={16} />
                                    <span>Square (Select & Paste)</span>
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="toolbar-divider" />

            <div className="toolbar-section">
                <button className="tool-btn" onClick={undo} data-tooltip="Undo (Ctrl+Z)">
                    <Undo2 size={20} />
                </button>
                <button className="tool-btn" onClick={redo} data-tooltip="Redo (Ctrl+Shift+Z)">
                    <Redo2 size={20} />
                </button>
            </div>

            <div className="toolbar-divider" />

            <div className="toolbar-section">
                <button className="tool-btn" onClick={() => setZoom(zoom - 10)} data-tooltip="Zoom Out">
                    <ZoomOut size={20} />
                </button>
                <span className="zoom-label">{zoom}%</span>
                <button className="tool-btn" onClick={() => setZoom(zoom + 10)} data-tooltip="Zoom In">
                    <ZoomIn size={20} />
                </button>
            </div>

            <div className="toolbar-spacer" />

            <div className="toolbar-colors">
                <div className="color-picker-wrapper">
                    <input
                        type="color"
                        className="color-picker-fg"
                        value={useEditorStore.getState().brushColor}
                        onChange={(e) => useEditorStore.getState().setBrushColor(e.target.value)}
                    />
                    <input
                        type="color"
                        className="color-picker-bg"
                        defaultValue="#000000"
                    />
                </div>
            </div>
        </div>
    );
}

export default Toolbar;
