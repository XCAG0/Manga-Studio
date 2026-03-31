/**
 * Region Text Detection Tool Hook
 * Allows selecting a region and detecting text within it
 */

import { useState, useCallback, useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import * as fabric from 'fabric';
import { replaceCanvasImageSource } from '../utils/canvas';

export function useRegionDetect() {
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectedRegion, setSelectedRegion] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [detectedTexts, setDetectedTexts] = useState([]);

    const startPointRef = useRef(null);
    const selectionRectRef = useRef(null);

    /**
     * Initialize region detection events
     */
    const initRegionDetectEvents = useCallback((canvas, onRegionSelected) => {
        if (!canvas) return;

        let isDown = false;

        const handleMouseDown = (opt) => {
            const pointer = canvas.getPointer(opt.e);
            startPointRef.current = { x: pointer.x, y: pointer.y };
            isDown = true;

            // Create selection rectangle
            const rect = new fabric.Rect({
                left: pointer.x,
                top: pointer.y,
                width: 0,
                height: 0,
                fill: 'rgba(255, 100, 100, 0.2)',
                stroke: '#ff6464',
                strokeWidth: 2,
                strokeDashArray: [5, 5],
                selectable: false,
                evented: false,
                name: 'region-select-rect'
            });

            selectionRectRef.current = rect;
            canvas.add(rect);
            canvas.renderAll();
        };

        const handleMouseMove = (opt) => {
            if (!isDown || !startPointRef.current || !selectionRectRef.current) return;

            const pointer = canvas.getPointer(opt.e);
            const startX = startPointRef.current.x;
            const startY = startPointRef.current.y;

            const left = Math.min(startX, pointer.x);
            const top = Math.min(startY, pointer.y);
            const width = Math.abs(pointer.x - startX);
            const height = Math.abs(pointer.y - startY);

            selectionRectRef.current.set({
                left,
                top,
                width,
                height
            });

            canvas.renderAll();
        };

        const handleMouseUp = (opt) => {
            if (!isDown || !selectionRectRef.current) return;
            isDown = false;

            const rect = selectionRectRef.current;
            const region = {
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height
            };

            // Remove selection rectangle
            canvas.remove(rect);
            selectionRectRef.current = null;
            canvas.renderAll();

            // Only trigger if region is large enough
            if (region.width > 10 && region.height > 10) {
                setSelectedRegion(region);
                if (onRegionSelected) {
                    onRegionSelected(region);
                }
            }
        };

        canvas.on('mouse:down', handleMouseDown);
        canvas.on('mouse:move', handleMouseMove);
        canvas.on('mouse:up', handleMouseUp);

        return () => {
            canvas.off('mouse:down', handleMouseDown);
            canvas.off('mouse:move', handleMouseMove);
            canvas.off('mouse:up', handleMouseUp);
        };
    }, []);

    /**
     * Extract image data from selected region
     */
    const extractRegionImage = useCallback((canvas, region) => {
        if (!canvas || !region) return null;

        // Get the viewport transform
        const vpt = canvas.viewportTransform;

        // Calculate actual coordinates considering zoom/pan
        const actualLeft = (region.left - vpt[4]) / vpt[0];
        const actualTop = (region.top - vpt[5]) / vpt[3];
        const actualWidth = region.width / vpt[0];
        const actualHeight = region.height / vpt[3];

        // Create a temporary canvas for the region
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = actualWidth;
        tempCanvas.height = actualHeight;
        const ctx = tempCanvas.getContext('2d');

        // Export the region
        const dataURL = canvas.toDataURL({
            format: 'png',
            left: region.left,
            top: region.top,
            width: region.width,
            height: region.height,
            multiplier: 1
        });

        return dataURL;
    }, []);

    /**
     * Detect text in the selected region
     */
    const detectTextInRegion = useCallback(async (canvas, region, language = 'jpn') => {
        if (!canvas || !region) return [];

        setIsProcessing(true);
        setDetectedTexts([]);

        try {
            // Extract the region as base64 image
            const imageData = extractRegionImage(canvas, region);
            if (!imageData) {
                throw new Error('Failed to extract region');
            }

            // Send to OCR API (detect-bubbles endpoint)
            const response = await fetch('http://127.0.0.1:5000/api/detect-bubbles', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    image: imageData,
                    lang: language,
                    engine: 'paddleocr'
                }),
            });

            if (!response.ok) {
                throw new Error(`OCR failed: ${response.status}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Detection failed');
            }

            // Adjust bounding box coordinates relative to the region
            const adjustedTexts = (result.bubbles || []).map(bubble => ({
                text: bubble.text,
                bbox: bubble.bbox ? bubble.bbox.map((coord, i) =>
                    i % 2 === 0 ? coord + region.left : coord + region.top
                ) : null,
                regionLeft: region.left,
                regionTop: region.top
            }));

            setDetectedTexts(adjustedTexts);
            return adjustedTexts;

        } catch (error) {
            console.error('[RegionDetect] Error:', error);
            throw error;
        } finally {
            setIsProcessing(false);
        }
    }, [extractRegionImage]);

    /**
     * Draw detected text bounding boxes on canvas
     */
    const drawDetectedBoxes = useCallback((canvas, texts) => {
        if (!canvas || !texts.length) return [];

        const boxes = [];

        texts.forEach((text, index) => {
            if (!text.bbox || text.bbox.length < 8) return;

            // Create polygon from bbox points
            const points = [];
            for (let i = 0; i < text.bbox.length; i += 2) {
                points.push({ x: text.bbox[i], y: text.bbox[i + 1] });
            }

            const polygon = new fabric.Polygon(points, {
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
        });

        canvas.renderAll();
        return boxes;
    }, []);

    /**
     * Remove text from image using inpainting
     */
    const removeDetectedText = useCallback(async (canvas, textBox) => {
        if (!canvas || !textBox) return;

        setIsProcessing(true);

        try {
            // Get the bounding box from the polygon points
            let bbox = null;

            if (textBox.points && Array.isArray(textBox.points)) {
                // fabric.Polygon stores points as array of {x, y} objects
                bbox = textBox.points.flatMap(p => [p.x, p.y]);
            } else if (textBox.bbox) {
                // Direct bbox array
                bbox = textBox.bbox;
            }

            if (!bbox || bbox.length < 8) {
                console.warn('[RegionDetect] No valid bbox found, removing box only');
                canvas.remove(textBox);
                canvas.renderAll();
                return;
            }

            console.log('[RegionDetect] Removing text with bbox:', bbox);

            // Get the full canvas as base64
            const canvasData = canvas.toDataURL({ format: 'png' });

            // Send to text removal API
            const response = await fetch('http://127.0.0.1:5000/api/remove-text-bbox', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    image: canvasData,
                    bbox: bbox
                }),
            });

            if (!response.ok) {
                throw new Error(`Text removal failed: ${response.status}`);
            }

            const result = await response.json();

            // Update the canvas with the cleaned image
            if (result.image) {
                // Find and update the background image
                const objects = canvas.getObjects();
                const bgImage = objects.find(obj => obj.type === 'image');

                if (bgImage) {
                    await replaceCanvasImageSource(canvas, bgImage, result.image);
                    canvas.remove(textBox);
                    canvas.renderAll();
                    useEditorStore.getState().saveState();
                }
            } else {
                // Just remove the box if no image returned
                canvas.remove(textBox);
                canvas.renderAll();
            }

        } catch (error) {
            console.error('[RegionDetect] Remove text error:', error);
            // Still remove the box on error
            canvas.remove(textBox);
            canvas.renderAll();
            throw error;
        } finally {
            setIsProcessing(false);
        }
    }, []);

    /**
     * Clear all detected boxes
     */
    const clearDetectedBoxes = useCallback((canvas) => {
        if (!canvas) return;

        const toRemove = canvas.getObjects().filter(obj =>
            obj.name && obj.name.startsWith('detected-text-')
        );

        toRemove.forEach(obj => canvas.remove(obj));
        canvas.renderAll();
        setDetectedTexts([]);
    }, []);

    return {
        isSelecting,
        setIsSelecting,
        selectedRegion,
        setSelectedRegion,
        isProcessing,
        detectedTexts,
        initRegionDetectEvents,
        extractRegionImage,
        detectTextInRegion,
        drawDetectedBoxes,
        removeDetectedText,
        clearDetectedBoxes
    };
}
