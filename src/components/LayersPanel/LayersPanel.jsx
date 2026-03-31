/**
 * Manga Studio - Layers Panel
 * Displays and controls layers linked to canvas objects
 */

import React, { useEffect, useRef } from 'react';
import { Trash2, Eye, EyeOff } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import './LayersPanel.css';

function LayersPanel() {
    const layers = useEditorStore((state) => state.layers);
    const activeLayerId = useEditorStore((state) => state.activeLayerId);
    const thumbnailRefs = useRef({});

    // Generate thumbnails for layers
    useEffect(() => {
        layers.forEach((layer) => {
            if (layer.objectRef && thumbnailRefs.current[layer.id]) {
                const canvas = thumbnailRefs.current[layer.id];
                const ctx = canvas.getContext('2d');
                const obj = layer.objectRef;

                // Clear canvas
                ctx.clearRect(0, 0, 32, 32);

                // Draw based on object type
                if (obj.type === 'rect') {
                    ctx.fillStyle = obj.fill !== 'transparent' ? obj.fill : '#333';
                    ctx.strokeStyle = obj.stroke || '#666';
                    ctx.lineWidth = 2;
                    ctx.fillRect(4, 4, 24, 24);
                    ctx.strokeRect(4, 4, 24, 24);
                } else if (obj.type === 'ellipse' || obj.type === 'circle') {
                    ctx.fillStyle = obj.fill !== 'transparent' ? obj.fill : '#333';
                    ctx.strokeStyle = obj.stroke || '#666';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.ellipse(16, 16, 12, 12, 0, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.stroke();
                } else if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') {
                    ctx.fillStyle = obj.fill || '#fff';
                    ctx.font = 'bold 18px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('T', 16, 16);
                } else if (obj.type === 'path') {
                    // Draw brush/pencil icon
                    ctx.strokeStyle = obj.stroke || '#888';
                    ctx.lineWidth = 2;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(8, 24);
                    ctx.lineTo(12, 20);
                    ctx.quadraticCurveTo(16, 12, 24, 8);
                    ctx.stroke();
                    // Brush tip
                    ctx.fillStyle = obj.stroke || '#888';
                    ctx.beginPath();
                    ctx.arc(8, 24, 2, 0, 2 * Math.PI);
                    ctx.fill();
                } else if (obj.type === 'image') {
                    // Draw image preview
                    if (obj._element) {
                        ctx.drawImage(obj._element, 0, 0, 32, 32);
                    } else {
                        // Draw image icon
                        ctx.strokeStyle = '#888';
                        ctx.lineWidth = 1.5;
                        ctx.strokeRect(6, 8, 20, 16);
                        // Mountain
                        ctx.beginPath();
                        ctx.moveTo(6, 20);
                        ctx.lineTo(12, 14);
                        ctx.lineTo(18, 18);
                        ctx.lineTo(26, 12);
                        ctx.stroke();
                        // Sun
                        ctx.beginPath();
                        ctx.arc(22, 12, 3, 0, 2 * Math.PI);
                        ctx.stroke();
                    }
                } else {
                    // Generic layer icon
                    ctx.strokeStyle = '#888';
                    ctx.lineWidth = 1.5;
                    ctx.strokeRect(6, 6, 20, 20);
                    ctx.beginPath();
                    ctx.moveTo(6, 16);
                    ctx.lineTo(26, 16);
                    ctx.stroke();
                }
            }
        });
    }, [layers]);

    // Handle layer click - select the object on canvas
    const handleLayerClick = (layerId) => {
        useEditorStore.getState().setActiveLayer(layerId);
    };

    // Toggle visibility
    const handleToggleVisibility = (layerId, e) => {
        e.stopPropagation();
        useEditorStore.getState().toggleLayerVisibility(layerId);
    };

    // Change opacity
    const handleOpacityChange = (layerId, value, e) => {
        e.stopPropagation();
        useEditorStore.getState().updateLayer(layerId, { opacity: parseInt(value) });
    };

    // Delete layer (and object)
    const handleDeleteLayer = (layerId, e) => {
        e.stopPropagation();
        useEditorStore.getState().removeLayer(layerId);
    };

    return (
        <div className="layers-panel panel">
            <div className="panel-header">
                <span>Layers</span>
                <span className="layer-count">{layers.length}</span>
            </div>

            <div className="layers-list">
                {layers.length === 0 ? (
                    <div className="layers-empty">
                        <p>No objects on canvas</p>
                        <span className="hint">Draw shapes or add text to create layers</span>
                    </div>
                ) : (
                    layers.map((layer) => (
                        <div
                            key={layer.id}
                            className={`layer-item ${activeLayerId === layer.id ? 'active' : ''} ${!layer.visible ? 'hidden-layer' : ''}`}
                            onClick={() => handleLayerClick(layer.id)}
                        >
                            {/* Layer Thumbnail - Canvas Preview */}
                            <div className="layer-thumbnail">
                                <canvas
                                    ref={(el) => thumbnailRefs.current[layer.id] = el}
                                    width={32}
                                    height={32}
                                    className="thumbnail-canvas"
                                />
                            </div>

                            {/* Layer Info */}
                            <div className="layer-info">
                                <span className="layer-name">{layer.name}</span>
                                <div className="layer-opacity-control">
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={layer.opacity}
                                        onChange={(e) => handleOpacityChange(layer.id, e.target.value, e)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    <span className="opacity-value">{layer.opacity}%</span>
                                </div>
                            </div>

                            {/* Layer Actions - Only Visibility and Delete */}
                            <div className="layer-actions">
                                {/* Visibility */}
                                <button
                                    className="layer-btn"
                                    onClick={(e) => handleToggleVisibility(layer.id, e)}
                                    title={layer.visible ? 'Hide' : 'Show'}
                                >
                                    {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                                </button>

                                {/* Delete */}
                                <button
                                    className="layer-btn danger"
                                    onClick={(e) => handleDeleteLayer(layer.id, e)}
                                    title="Delete"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default LayersPanel;
