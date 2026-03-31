/**
 * Region Text Detection Modal
 * Modal for detecting text in a selected region
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2, Trash2, Languages } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import './RegionDetectModal.css';

const LANGUAGES = [
    { code: 'japan', label: 'Japanese (日本語)' },
    { code: 'korean', label: 'Korean (한국어)' },
    { code: 'ch', label: 'Chinese (中文)' },
    { code: 'en', label: 'English' },
];

function RegionDetectModal({ isOpen, onClose, region }) {
    const { canvas, addTextLines } = useEditorStore();

    const [language, setLanguage] = useState('jpn');
    const [step, setStep] = useState('config'); // 'config' | 'detecting' | 'results'
    const [localTexts, setLocalTexts] = useState([]);
    const [drawnBoxes, setDrawnBoxes] = useState([]);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [enhanceImage, setEnhanceImage] = useState(false);

    // Track current request ID to prevent stale results
    const requestIdRef = useRef(0);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen && region) {
            // Increment request ID to invalidate any pending requests
            requestIdRef.current += 1;

            setStep('config');
            setLocalTexts([]);
            setDrawnBoxes([]);
            setError(null);
            setIsLoading(false);

            // Clear boxes from canvas
            if (canvas) {
                const toRemove = canvas.getObjects().filter(obj =>
                    obj.name && obj.name.startsWith('detected-text-')
                );
                toRemove.forEach(obj => canvas.remove(obj));
                canvas.renderAll();
            }
        }
    }, [isOpen, region]);

    // Cleanup when modal closes
    useEffect(() => {
        if (!isOpen && canvas) {
            const toRemove = canvas.getObjects().filter(obj =>
                obj.name && obj.name.startsWith('detected-text-')
            );
            toRemove.forEach(obj => canvas.remove(obj));
            canvas.renderAll();
        }
    }, [isOpen]);

    const extractRegionImage = () => {
        if (!canvas || !region) return null;

        try {
            // Get the background image
            const bgImage = canvas.getObjects().find(obj => obj.type === 'image');
            if (!bgImage || !bgImage._element) {
                console.error('[RegionDetect] No background image found');
                return null;
            }

            const imgElement = bgImage._element;
            const originalWidth = imgElement.naturalWidth || imgElement.width;
            const originalHeight = imgElement.naturalHeight || imgElement.height;

            // Image position and scale on canvas
            const imgCanvasLeft = bgImage.left || 0;
            const imgCanvasTop = bgImage.top || 0;
            const imgScaleX = bgImage.scaleX || 1;
            const imgScaleY = bgImage.scaleY || 1;

            // IMPORTANT: region coordinates come from canvas.getPointer() which ALREADY 
            // returns canvas coordinates (accounts for zoom/pan). So we should NOT 
            // apply viewport transform again. Just use them directly.
            const canvasLeft = region.left;
            const canvasTop = region.top;
            const canvasWidth = region.width;
            const canvasHeight = region.height;

            // Convert canvas coordinates to original image coordinates
            const origLeft = (canvasLeft - imgCanvasLeft) / imgScaleX;
            const origTop = (canvasTop - imgCanvasTop) / imgScaleY;
            const origWidth = canvasWidth / imgScaleX;
            const origHeight = canvasHeight / imgScaleY;

            // Clamp to image bounds
            const clampedLeft = Math.max(0, Math.min(origLeft, originalWidth));
            const clampedTop = Math.max(0, Math.min(origTop, originalHeight));
            const clampedWidth = Math.min(origWidth, originalWidth - clampedLeft);
            const clampedHeight = Math.min(origHeight, originalHeight - clampedTop);

            console.log('[RegionDetect] Extracting region:', {
                original: { w: originalWidth, h: originalHeight },
                region: { left: clampedLeft, top: clampedTop, width: clampedWidth, height: clampedHeight },
                scale: { x: imgScaleX, y: imgScaleY }
            });

            // Create temporary canvas at original resolution
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = Math.max(1, Math.round(clampedWidth));
            tempCanvas.height = Math.max(1, Math.round(clampedHeight));
            const ctx = tempCanvas.getContext('2d');

            // Draw the region from original image
            ctx.drawImage(
                imgElement,
                clampedLeft, clampedTop, clampedWidth, clampedHeight,
                0, 0, clampedWidth, clampedHeight
            );

            return tempCanvas.toDataURL('image/png');
        } catch (error) {
            console.error('[RegionDetect] Extract error:', error);
            return null;
        }
    };

    // Enhance image for better OCR (invert, grayscale, contrast)
    const enhanceImageData = (dataUrl) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = img.width;
                tempCanvas.height = img.height;
                const ctx = tempCanvas.getContext('2d');

                // Draw original
                ctx.drawImage(img, 0, 0);

                // Get image data
                const imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                const data = imageData.data;

                // Apply enhancements
                for (let i = 0; i < data.length; i += 4) {
                    // Convert to grayscale
                    const gray = (data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11);

                    // Increase contrast
                    const contrast = 1.5;
                    const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
                    let newGray = factor * (gray - 128) + 128;

                    // Invert colors (white text on dark bg -> dark text on white bg)
                    newGray = 255 - newGray;

                    // Clamp
                    newGray = Math.max(0, Math.min(255, newGray));

                    data[i] = newGray;
                    data[i + 1] = newGray;
                    data[i + 2] = newGray;
                }

                ctx.putImageData(imageData, 0, 0);
                resolve(tempCanvas.toDataURL('image/png'));
            };
            img.src = dataUrl;
        });
    };

    const handleDetect = async () => {
        if (!canvas || !region) return;

        // Save request ID at start
        const currentRequestId = ++requestIdRef.current;

        setError(null);
        setLocalTexts([]);
        setDrawnBoxes([]);
        setStep('detecting');
        setIsLoading(true);

        // Clear existing boxes
        const toRemove = canvas.getObjects().filter(obj =>
            obj.name && obj.name.startsWith('detected-text-')
        );
        toRemove.forEach(obj => canvas.remove(obj));
        canvas.renderAll();

        try {
            let imageData = extractRegionImage();
            if (!imageData) {
                throw new Error('Failed to extract region');
            }

            // Apply image enhancement if enabled
            if (enhanceImage) {
                console.log('[RegionDetect] Applying image enhancement...');
                imageData = await enhanceImageData(imageData);
            }

            const response = await fetch('http://127.0.0.1:5000/api/detect-bubbles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image: imageData,
                    lang: language,
                    engine: 'paddleocr'
                }),
            });

            // Check if this request is still valid
            if (currentRequestId !== requestIdRef.current) {
                console.log('[RegionDetect] Request outdated, ignoring');
                return;
            }

            if (!response.ok) {
                throw new Error(`OCR failed: ${response.status}`);
            }

            const result = await response.json();
            console.log('[RegionDetect] OCR Result:', result);
            console.log('[RegionDetect] Bubbles found:', result.bubbles?.length || 0);

            // Check again after parsing
            if (currentRequestId !== requestIdRef.current) {
                console.log('[RegionDetect] Request outdated, ignoring');
                return;
            }

            if (!result.success) {
                throw new Error(result.error || 'Detection failed');
            }

            // Adjust coordinates to ORIGINAL IMAGE space (not screen space)
            // bbox comes as [[x1,y1], [x2,y2], [x3,y3], [x4,y4]] relative to cropped region
            // We need to add the region offset in ORIGINAL IMAGE coordinates

            // Get background image info for coordinate conversion
            const bgImage = canvas.getObjects().find(obj => obj.type === 'image');
            const imgCanvasLeft = bgImage?.left || 0;
            const imgCanvasTop = bgImage?.top || 0;
            const imgScaleX = bgImage?.scaleX || 1;
            const imgScaleY = bgImage?.scaleY || 1;

            // IMPORTANT: region coordinates come from getPointer() which ALREADY
            // accounts for zoom/pan. Do NOT apply viewport transform again!
            // This must match the logic in extractRegionImage exactly.
            const canvasLeft = region.left;
            const canvasTop = region.top;
            const origRegionLeft = (canvasLeft - imgCanvasLeft) / imgScaleX;
            const origRegionTop = (canvasTop - imgCanvasTop) / imgScaleY;

            console.log('[RegionDetect] Region offset in original image:', { origRegionLeft, origRegionTop });

            // Log original bbox from OCR for debugging
            if (result.bubbles && result.bubbles.length > 0) {
                console.log('[RegionDetect] Original OCR bbox:', result.bubbles[0].bbox);
            }

            const adjustedTexts = (result.bubbles || []).map(bubble => ({
                text: bubble.text,
                // Bbox from OCR is relative to cropped region, add region offset in original image space
                bbox: bubble.bbox ? bubble.bbox.map(point => [
                    Math.round(point[0] + origRegionLeft),
                    Math.round(point[1] + origRegionTop)
                ]) : null
            }));

            console.log('[RegionDetect] Adjusted texts with original image coords:', adjustedTexts);

            // Final check
            if (currentRequestId !== requestIdRef.current) {
                console.log('[RegionDetect] Request outdated, ignoring');
                return;
            }

            setLocalTexts(adjustedTexts);

            if (adjustedTexts.length > 0) {
                // Draw boxes
                const boxes = [];
                const { Polygon } = await import('fabric');

                adjustedTexts.forEach((text, index) => {
                    if (!text.bbox || text.bbox.length < 3) {
                        console.log('[RegionDetect] Skipping text with invalid bbox:', text);
                        return;
                    }

                    console.log('[RegionDetect] Creating box for:', text.text, 'bbox:', text.bbox);

                    // Handle both [[x,y], [x,y]...] and [x1,y1,x2,y2...] formats
                    const points = [];
                    if (Array.isArray(text.bbox[0])) {
                        // Nested array format [[x,y], [x,y], ...]
                        text.bbox.forEach(point => {
                            points.push({ x: point[0], y: point[1] });
                        });
                    } else {
                        // Flat array format [x1, y1, x2, y2, ...]
                        for (let i = 0; i < text.bbox.length; i += 2) {
                            points.push({ x: text.bbox[i], y: text.bbox[i + 1] });
                        }
                    }

                    if (points.length < 3) {
                        console.log('[RegionDetect] Not enough points:', points.length);
                        return;
                    }

                    const polygon = new Polygon(points, {
                        fill: 'rgba(255, 100, 100, 0.3)',
                        stroke: '#ff6464',
                        strokeWidth: 2,
                        selectable: true,
                        evented: true,
                        name: `detected-text-${index}`,
                        detectedText: text.text,
                        hasControls: false,
                        lockMovementX: true,
                        lockMovementY: true
                    });

                    canvas.add(polygon);
                    boxes.push(polygon);
                    console.log('[RegionDetect] Added box for index:', index);
                });

                canvas.renderAll();
                setDrawnBoxes(boxes);
                setStep('results');
            } else {
                setStep('config');
                setError('No text detected in the selected region');
            }

        } catch (err) {
            // Only update if still valid
            if (currentRequestId === requestIdRef.current) {
                setStep('config');
                setError(err.message || 'Detection failed');
            }
        } finally {
            if (currentRequestId === requestIdRef.current) {
                setIsLoading(false);
            }
        }
    };

    const handleRemoveText = async (index) => {
        console.log('[RegionDetect] handleRemoveText called, index:', index);
        console.log('[RegionDetect] drawnBoxes:', drawnBoxes);
        console.log('[RegionDetect] localTexts:', localTexts);

        if (!canvas) {
            console.log('[RegionDetect] No canvas!');
            return;
        }

        if (!drawnBoxes[index]) {
            console.log('[RegionDetect] No box at index:', index);
            return;
        }

        try {
            // Remove the visual box
            canvas.remove(drawnBoxes[index]);
            canvas.renderAll();
            console.log('[RegionDetect] Box removed from canvas');

            const newTexts = [...localTexts];
            newTexts.splice(index, 1);
            setLocalTexts(newTexts);

            const newBoxes = [...drawnBoxes];
            newBoxes.splice(index, 1);
            setDrawnBoxes(newBoxes);

            console.log('[RegionDetect] Updated state, remaining texts:', newTexts.length);

            if (newTexts.length === 0) {
                onClose();
            }
        } catch (err) {
            console.error('[RegionDetect] Error removing text:', err);
            setError(err.message || 'Failed to remove text');
        }
    };

    const handleRemoveAll = () => {
        if (!canvas) return;

        drawnBoxes.forEach(box => canvas.remove(box));
        canvas.renderAll();

        setLocalTexts([]);
        setDrawnBoxes([]);
        onClose();
    };

    const handleKeepAll = () => {
        if (addTextLines && localTexts.length > 0) {
            const textsToAdd = localTexts
                .filter(t => t.text && t.text.trim())
                .map(t => ({ text: t.text, bbox: t.bbox }));

            if (textsToAdd.length > 0) {
                addTextLines(textsToAdd);
            }
        }

        // Clear boxes
        drawnBoxes.forEach(box => canvas.remove(box));
        canvas.renderAll();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="region-detect-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>
                        <Languages size={20} />
                        {step === 'results' ? 'Detected Texts' : 'Text Detection'}
                    </h3>
                    <button className="modal-close" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                <div className="modal-content">
                    {step === 'detecting' && (
                        <div className="detecting-state">
                            <Loader2 size={48} className="spin" />
                            <p>Detecting text in selected region...</p>
                            <span className="region-size">
                                {Math.round(region?.width || 0)} × {Math.round(region?.height || 0)} px
                            </span>
                        </div>
                    )}

                    {step === 'config' && (
                        <>
                            <div className="form-group">
                                <label>Language</label>
                                <select
                                    value={language}
                                    onChange={(e) => setLanguage(e.target.value)}
                                    className="form-select"
                                >
                                    {LANGUAGES.map(lang => (
                                        <option key={lang.code} value={lang.code}>
                                            {lang.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group checkbox-group">
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={enhanceImage}
                                        onChange={(e) => setEnhanceImage(e.target.checked)}
                                    />
                                    <span>Enhance Image (for difficult text)</span>
                                </label>
                                <small className="form-hint">Inverts colors and increases contrast for better detection</small>
                            </div>

                            <div className="region-info">
                                <span>Selected Region:</span>
                                <span className="region-size">
                                    {Math.round(region?.width || 0)} × {Math.round(region?.height || 0)} px
                                </span>
                            </div>
                        </>
                    )}

                    {step === 'results' && (
                        <div className="detected-texts-list">
                            {localTexts.map((text, index) => (
                                <div key={index} className="detected-text-item">
                                    <span className="text-content">{text.text}</span>
                                    <button
                                        className="remove-btn"
                                        onClick={() => handleRemoveText(index)}
                                        disabled={isLoading}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {error && (
                        <div className="error-message">{error}</div>
                    )}
                </div>

                <div className="modal-footer">
                    {step === 'config' && (
                        <>
                            <button className="btn btn-secondary" onClick={onClose}>
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleDetect}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 size={16} className="spin" />
                                        Detecting...
                                    </>
                                ) : (
                                    'Detect Text'
                                )}
                            </button>
                        </>
                    )}

                    {step === 'results' && (
                        <>
                            <button
                                className="btn btn-secondary"
                                onClick={handleKeepAll}
                            >
                                Keep All
                            </button>
                            <button
                                className="btn btn-danger"
                                onClick={handleRemoveAll}
                                disabled={isLoading}
                            >
                                Remove All
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default RegionDetectModal;
