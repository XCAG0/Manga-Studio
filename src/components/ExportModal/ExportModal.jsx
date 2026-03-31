/**
 * Export Modal Component
 * Unified export dialog with filename, format, and path selection
 */

import React, { useState, useEffect } from 'react';
import { X, FolderOpen } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import './ExportModal.css';

const IMAGE_FORMATS = [
    { value: 'png', label: 'PNG (.png)', mime: 'image/png', transparent: true },
    { value: 'jpg', label: 'JPG (.jpg)', mime: 'image/jpeg', transparent: false },
    { value: 'jpeg', label: 'JPEG (.jpeg)', mime: 'image/jpeg', transparent: false },
    { value: 'webp', label: 'WebP (.webp)', mime: 'image/webp', transparent: true },
    { value: 'bmp', label: 'BMP (.bmp)', mime: 'image/bmp', transparent: false },
    { value: 'gif', label: 'GIF (.gif)', mime: 'image/gif', transparent: true },
];

function ExportModal({ isOpen, onClose }) {
    const { canvas, fileName, filePath } = useEditorStore();

    const [exportFileName, setExportFileName] = useState('');
    const [format, setFormat] = useState('png');
    const [exportPath, setExportPath] = useState('');
    const [quality, setQuality] = useState(92);
    const [isExporting, setIsExporting] = useState(false);

    // Initialize filename from current file
    useEffect(() => {
        if (isOpen && fileName) {
            const baseName = fileName.replace(/\.[^/.]+$/, '');
            setExportFileName(baseName);
        } else if (isOpen) {
            setExportFileName('manga-export');
        }
    }, [isOpen, fileName]);

    // Get default export path - prioritize current file's directory
    useEffect(() => {
        const getDefaultPath = async () => {
            if (isOpen) {
                // Use current image's directory if available
                if (filePath) {
                    // Extract directory from file path
                    const directory = filePath.substring(0, filePath.lastIndexOf('\\'));
                    if (directory) {
                        setExportPath(directory);
                        return;
                    }
                }

                // Fallback to Pictures folder
                if (window.electronAPI?.getDefaultExportPath) {
                    const path = await window.electronAPI.getDefaultExportPath();
                    setExportPath(path || '');
                }
            }
        };
        getDefaultPath();
    }, [isOpen, filePath]);

    const handleSelectPath = async () => {
        if (window.electronAPI?.selectFolder) {
            const path = await window.electronAPI.selectFolder();
            if (path) {
                setExportPath(path);
            }
        }
    };

    const handleExport = async () => {
        if (!canvas || !exportFileName || !exportPath) return;

        setIsExporting(true);

        try {
            const objects = canvas.getObjects();
            if (objects.length === 0) {
                alert('Nothing to export');
                return;
            }

            // Save and reset viewport transform
            const originalVPT = canvas.viewportTransform.slice();
            canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

            // Calculate content bounds
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            objects.forEach(obj => {
                const left = obj.left || 0;
                const top = obj.top || 0;
                const width = (obj.width || 0) * (obj.scaleX || 1);
                const height = (obj.height || 0) * (obj.scaleY || 1);
                minX = Math.min(minX, left);
                minY = Math.min(minY, top);
                maxX = Math.max(maxX, left + width);
                maxY = Math.max(maxY, top + height);
            });

            // Get format info
            const formatInfo = IMAGE_FORMATS.find(f => f.value === format);

            // Handle transparent background for supported formats
            let originalBg = null;
            if (formatInfo?.transparent) {
                originalBg = canvas.backgroundColor;
                canvas.backgroundColor = null;
                canvas.renderAll();
            }

            // Export options
            const exportOptions = {
                format: format === 'jpg' ? 'jpeg' : format,
                multiplier: 1,
                left: minX,
                top: minY,
                width: maxX - minX,
                height: maxY - minY,
            };

            // Add quality for JPEG/WebP
            if (['jpg', 'jpeg', 'webp'].includes(format)) {
                exportOptions.quality = quality / 100;
            }

            const dataURL = canvas.toDataURL(exportOptions);

            // Restore background and viewport
            if (originalBg !== null) {
                canvas.backgroundColor = originalBg;
            }
            canvas.setViewportTransform(originalVPT);
            canvas.renderAll();

            // Build full path
            const fullFileName = `${exportFileName}.${format}`;
            const fullPath = `${exportPath}\\${fullFileName}`;

            // Save file
            const result = await window.electronAPI?.saveFileToPath(dataURL, fullPath);

            if (result?.success) {
                onClose();
            } else {
                alert('Export failed: ' + (result?.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Export error:', error);
            alert('Export failed: ' + error.message);
        } finally {
            setIsExporting(false);
        }
    };

    if (!isOpen) return null;

    const selectedFormat = IMAGE_FORMATS.find(f => f.value === format);
    const showQuality = ['jpg', 'jpeg', 'webp'].includes(format);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="export-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Export Image</h3>
                    <button className="modal-close" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                <div className="modal-content">
                    {/* Filename */}
                    <div className="form-group">
                        <label>Filename</label>
                        <input
                            type="text"
                            value={exportFileName}
                            onChange={(e) => setExportFileName(e.target.value)}
                            placeholder="Enter filename"
                            className="form-input"
                        />
                    </div>

                    {/* Format */}
                    <div className="form-group">
                        <label>Format</label>
                        <select
                            value={format}
                            onChange={(e) => setFormat(e.target.value)}
                            className="form-select"
                        >
                            {IMAGE_FORMATS.map(f => (
                                <option key={f.value} value={f.value}>
                                    {f.label}
                                </option>
                            ))}
                        </select>
                        {selectedFormat?.transparent && (
                            <span className="format-hint">Supports transparency</span>
                        )}
                    </div>

                    {/* Quality (for JPG/WebP) */}
                    {showQuality && (
                        <div className="form-group">
                            <label>Quality: {quality}%</label>
                            <input
                                type="range"
                                min={10}
                                max={100}
                                value={quality}
                                onChange={(e) => setQuality(parseInt(e.target.value))}
                                className="form-range"
                            />
                        </div>
                    )}

                    {/* Export Path */}
                    <div className="form-group">
                        <label>Save to</label>
                        <div className="path-input-group">
                            <input
                                type="text"
                                value={exportPath}
                                onChange={(e) => setExportPath(e.target.value)}
                                placeholder="Select folder..."
                                className="form-input path-input"
                                readOnly
                            />
                            <button className="path-btn" onClick={handleSelectPath}>
                                <FolderOpen size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Preview filename */}
                    <div className="export-preview">
                        <span className="preview-label">Will save as:</span>
                        <span className="preview-filename">{exportFileName}.{format}</span>
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleExport}
                        disabled={!exportFileName || !exportPath || isExporting}
                    >
                        {isExporting ? 'Exporting...' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ExportModal;
