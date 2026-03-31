/**
 * useTextDetection - Hook for text detection tool
 * Allows user to draw a box and detect text inside it
 */

import { useCallback, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { useEditorStore } from '../store/editorStore';
import { detectTextInRegion, canvasToBlob, checkOCRServer } from '../services/ocrService';
import { TOOLS } from '../utils/constants';

export function useTextDetection() {
    const [isDetecting, setIsDetecting] = useState(false);
    const [detectedText, setDetectedText] = useState(null);
    const selectionBoxRef = useRef(null);
    const startPointRef = useRef(null);
    const isDrawingRef = useRef(false);

    const initTextDetectionEvents = useCallback((canvas) => {
        if (!canvas) return;

        const handleMouseDown = (opt) => {
            const { activeTool } = useEditorStore.getState();
            if (activeTool !== TOOLS.TEXT_DETECT) return;

            const pointer = canvas.getPointer(opt.e);
            startPointRef.current = { x: pointer.x, y: pointer.y };
            isDrawingRef.current = true;

            // Create selection rectangle
            selectionBoxRef.current = new fabric.Rect({
                left: pointer.x,
                top: pointer.y,
                width: 0,
                height: 0,
                fill: 'rgba(0, 120, 255, 0.2)',
                stroke: '#0078ff',
                strokeWidth: 2,
                strokeDashArray: [5, 5],
                selectable: false,
                evented: false,
            });

            canvas.add(selectionBoxRef.current);
            canvas.renderAll();
        };

        const handleMouseMove = (opt) => {
            const { activeTool } = useEditorStore.getState();
            if (activeTool !== TOOLS.TEXT_DETECT) return;
            if (!isDrawingRef.current || !startPointRef.current || !selectionBoxRef.current) return;

            const pointer = canvas.getPointer(opt.e);
            const startX = startPointRef.current.x;
            const startY = startPointRef.current.y;

            const left = Math.min(startX, pointer.x);
            const top = Math.min(startY, pointer.y);
            const width = Math.abs(pointer.x - startX);
            const height = Math.abs(pointer.y - startY);

            selectionBoxRef.current.set({
                left,
                top,
                width,
                height
            });

            canvas.renderAll();
        };

        const handleMouseUp = async (opt) => {
            const { activeTool } = useEditorStore.getState();
            if (activeTool !== TOOLS.TEXT_DETECT) return;
            if (!isDrawingRef.current || !selectionBoxRef.current) return;

            isDrawingRef.current = false;

            const box = selectionBoxRef.current;
            const region = {
                x1: Math.round(box.left),
                y1: Math.round(box.top),
                x2: Math.round(box.left + box.width),
                y2: Math.round(box.top + box.height)
            };

            // Remove selection box
            canvas.remove(selectionBoxRef.current);
            selectionBoxRef.current = null;
            canvas.renderAll();

            // Check if region is too small
            if (region.x2 - region.x1 < 10 || region.y2 - region.y1 < 10) {
                console.log('Selection too small');
                return;
            }

            console.log('Detecting text in region:', region);

            // Detect text in region
            setIsDetecting(true);
            setDetectedText(null);

            try {
                // Check server
                const serverOk = await checkOCRServer();
                if (!serverOk) {
                    alert('OCR server is not running. Please start server.py');
                    setIsDetecting(false);
                    return;
                }

                // Get canvas as blob
                const blob = await canvasToBlob(canvas);

                // Detect text
                const result = await detectTextInRegion(blob, region);

                if (result.success && result.text) {
                    setDetectedText({
                        text: result.text,
                        region: region
                    });

                    // Show result
                    alert(`Detected text:\n\n${result.text}`);
                } else {
                    alert('No text detected in this region');
                }
            } catch (error) {
                console.error('Text detection error:', error);
                alert('Error detecting text: ' + error.message);
            } finally {
                setIsDetecting(false);
            }
        };

        // Register events
        canvas.on('mouse:down', handleMouseDown);
        canvas.on('mouse:move', handleMouseMove);
        canvas.on('mouse:up', handleMouseUp);

        console.log('Text detection events initialized');
    }, []);

    // Empty function for compatibility (events are registered once in initTextDetectionEvents)
    const setupTextDetection = useCallback((canvas) => {
        // Events are already registered by initTextDetectionEvents
        // This is called when tool is selected
        console.log('Text detection tool activated');
    }, []);

    return {
        initTextDetectionEvents,
        setupTextDetection,
        isDetecting,
        detectedText,
        setDetectedText
    };
}
