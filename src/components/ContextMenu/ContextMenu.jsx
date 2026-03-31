/**
 * Manga Studio - Context Menu Component
 * Right-click menu for canvas objects
 */

import React from 'react';
import { Trash2, Copy, ArrowUp, ArrowDown, Paintbrush, Square } from 'lucide-react';
import './ContextMenu.css';

function ContextMenu({
    isVisible,
    position,
    targetObject,
    menuRef,
    onFill,
    onRemoveFill,
    onDelete,
    onDuplicate,
    onBringToFront,
    onSendToBack,
    onClose
}) {
    if (!isVisible || !targetObject) return null;

    const isShape = targetObject.type === 'rect' || targetObject.type === 'ellipse';
    const hasFill = targetObject.fill && targetObject.fill !== 'transparent';

    return (
        <div
            className="context-menu"
            ref={menuRef}
            style={{
                left: position.x,
                top: position.y,
            }}
        >
            {/* Shape-specific options */}
            {isShape && (
                <>
                    <button className="context-menu-item" onClick={onFill}>
                        <Paintbrush size={14} />
                        <span>Fill with Color</span>
                    </button>
                    {hasFill && (
                        <button className="context-menu-item" onClick={onRemoveFill}>
                            <Square size={14} />
                            <span>Remove Fill</span>
                        </button>
                    )}
                    <div className="context-menu-separator" />
                </>
            )}

            {/* Common options */}
            <button className="context-menu-item" onClick={onDuplicate}>
                <Copy size={14} />
                <span>Duplicate</span>
                <span className="context-menu-shortcut">Ctrl+D</span>
            </button>

            <div className="context-menu-separator" />

            <button className="context-menu-item" onClick={onBringToFront}>
                <ArrowUp size={14} />
                <span>Bring to Front</span>
            </button>
            <button className="context-menu-item" onClick={onSendToBack}>
                <ArrowDown size={14} />
                <span>Send to Back</span>
            </button>

            <div className="context-menu-separator" />

            <button className="context-menu-item danger" onClick={onDelete}>
                <Trash2 size={14} />
                <span>Delete</span>
                <span className="context-menu-shortcut">Del</span>
            </button>
        </div>
    );
}

export default ContextMenu;
