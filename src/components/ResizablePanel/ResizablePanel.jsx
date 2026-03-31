/**
 * Resizable Panel Component
 * Allows panels to be resized by dragging the border
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import './ResizablePanel.css';

function ResizablePanel({
    children,
    minHeight = 80,
    maxHeight = 500,
    defaultHeight = 150,
    title,
    className = '',
    isLast = false
}) {
    const [height, setHeight] = useState(defaultHeight);
    const [isResizing, setIsResizing] = useState(false);
    const panelRef = useRef(null);
    const startYRef = useRef(0);
    const startHeightRef = useRef(0);

    const handleMouseDown = useCallback((e) => {
        e.preventDefault();
        setIsResizing(true);
        startYRef.current = e.clientY;
        startHeightRef.current = height;
    }, [height]);

    const handleMouseMove = useCallback((e) => {
        if (!isResizing) return;

        const deltaY = e.clientY - startYRef.current;
        const newHeight = Math.min(maxHeight, Math.max(minHeight, startHeightRef.current + deltaY));
        setHeight(newHeight);
    }, [isResizing, minHeight, maxHeight]);

    const handleMouseUp = useCallback(() => {
        setIsResizing(false);
    }, []);

    useEffect(() => {
        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'ns-resize';
            document.body.style.userSelect = 'none';
        } else {
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isResizing, handleMouseMove, handleMouseUp]);

    return (
        <div
            ref={panelRef}
            className={`resizable-panel ${className} ${isResizing ? 'resizing' : ''}`}
            style={{ height: isLast ? 'auto' : `${height}px`, minHeight: isLast ? 'auto' : `${minHeight}px` }}
        >
            <div className="resizable-panel-content">
                {children}
            </div>
            {!isLast && (
                <div
                    className="resize-handle"
                    onMouseDown={handleMouseDown}
                >
                    <div className="resize-handle-line" />
                </div>
            )}
        </div>
    );
}

export default ResizablePanel;
