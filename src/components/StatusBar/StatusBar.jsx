import React from 'react';
import { useEditorStore } from '../../store/editorStore';
import './StatusBar.css';

function StatusBar() {
    const { zoom, activeTool, fileName, selectedObject } = useEditorStore();

    const getToolName = (tool) => {
        const toolNames = {
            select: 'Selection Tool',
            move: 'Pan Tool',
            brush: 'Brush Tool',
            eraser: 'Eraser Tool',
            text: 'Text Tool',
            rectangle: 'Rectangle Tool',
            ellipse: 'Ellipse Tool',
            eyedropper: 'Eyedropper Tool',
            crop: 'Crop Tool'
        };
        return toolNames[tool] || 'Unknown Tool';
    };

    return (
        <div className="status-bar">
            <div className="status-left">
                <span className="status-item">
                    <span className="status-label">Tool:</span>
                    <span className="status-value">{getToolName(activeTool)}</span>
                </span>

                {selectedObject && (
                    <span className="status-item">
                        <span className="status-label">Selected:</span>
                        <span className="status-value">{selectedObject.type}</span>
                    </span>
                )}
            </div>

            <div className="status-center">
                {fileName && (
                    <span className="status-filename">{fileName.split(/[\\/]/).pop()}</span>
                )}
            </div>

            <div className="status-right">
                <span className="status-item">
                    <span className="status-label">Zoom:</span>
                    <span className="status-value">{zoom}%</span>
                </span>

                <span className="status-item">
                    <span className="status-label">Canvas:</span>
                    <span className="status-value">600 × 900 px</span>
                </span>
            </div>
        </div>
    );
}

export default StatusBar;
