/**
 * Manga Studio - Crop Tool Hook
 * Handles image cropping with selection overlay
 */

import { useCallback, useRef } from 'react';
import * as fabric from 'fabric';
import { useEditorStore } from '../store/editorStore';

export function useCropTool() {
    const cropRectRef = useRef(null);
    const isDrawingRef = useRef(false);
    const startPointRef = useRef({ x: 0, y: 0 });

    /**
     * Start crop selection mode
     */
    const initCropEvents = useCallback((canvas) => {
        if (!canvas) return;

        const handleMouseDown = (opt) => {
            const currentTool = useEditorStore.getState().activeTool;
            if (currentTool !== 'crop') return;

            // Remove any existing crop rect
            if (cropRectRef.current) {
                canvas.remove(cropRectRef.current);
            }

            isDrawingRef.current = true;
            const pointer = canvas.getPointer(opt.e);
            startPointRef.current = { x: pointer.x, y: pointer.y };

            // Create crop selection rectangle
            cropRectRef.current = new fabric.Rect({
                left: pointer.x,
                top: pointer.y,
                width: 0,
                height: 0,
                fill: 'rgba(0, 100, 255, 0.2)',
                stroke: '#0066ff',
                strokeWidth: 2,
                strokeDashArray: [5, 5],
                selectable: false,
                evented: false,
                excludeFromExport: true,
            });

            canvas.add(cropRectRef.current);
        };

        const handleMouseMove = (opt) => {
            if (!isDrawingRef.current || !cropRectRef.current) return;

            const pointer = canvas.getPointer(opt.e);
            const startX = startPointRef.current.x;
            const startY = startPointRef.current.y;

            const left = Math.min(startX, pointer.x);
            const top = Math.min(startY, pointer.y);
            const width = Math.abs(pointer.x - startX);
            const height = Math.abs(pointer.y - startY);

            cropRectRef.current.set({
                left: left,
                top: top,
                width: width,
                height: height,
            });

            canvas.renderAll();
        };

        const handleMouseUp = () => {
            if (!isDrawingRef.current) return;
            isDrawingRef.current = false;

            // Store crop rect in store for later use
            if (cropRectRef.current && cropRectRef.current.width > 10 && cropRectRef.current.height > 10) {
                useEditorStore.setState({ cropRect: cropRectRef.current });
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
     * Apply crop to selected image
     */
    const applyCrop = useCallback(() => {
        const { canvas, cropRect, saveState } = useEditorStore.getState();
        if (!canvas || !cropRect) return false;

        // Find the image under the crop rect
        const objects = canvas.getObjects();
        const imageObj = objects.find(obj =>
            obj.type === 'image' &&
            obj !== cropRect
        );

        if (!imageObj) {
            cancelCrop();
            return false;
        }

        // Get crop dimensions relative to image
        const cropLeft = cropRect.left - imageObj.left;
        const cropTop = cropRect.top - imageObj.top;
        const cropWidth = cropRect.width;
        const cropHeight = cropRect.height;

        // Create cropped image using canvas
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = cropWidth;
        tempCanvas.height = cropHeight;
        const ctx = tempCanvas.getContext('2d');

        // Get the source image element
        const imgElement = imageObj._element;
        if (!imgElement) {
            cancelCrop();
            return false;
        }

        // Calculate source coordinates considering image scale
        const scaleX = imageObj.scaleX || 1;
        const scaleY = imageObj.scaleY || 1;

        ctx.drawImage(
            imgElement,
            cropLeft / scaleX,
            cropTop / scaleY,
            cropWidth / scaleX,
            cropHeight / scaleY,
            0,
            0,
            cropWidth,
            cropHeight
        );

        // Create new image from cropped data
        const croppedDataUrl = tempCanvas.toDataURL('image/png');

        fabric.Image.fromURL(croppedDataUrl).then((croppedImg) => {
            croppedImg.set({
                left: cropRect.left,
                top: cropRect.top,
                selectable: true,
            });

            // Remove original image and crop rect
            canvas.remove(imageObj);
            canvas.remove(cropRect);
            cropRectRef.current = null;

            // Add cropped image
            canvas.add(croppedImg);
            canvas.setActiveObject(croppedImg);
            canvas.renderAll();

            useEditorStore.setState({ cropRect: null });
            saveState();
        });

        return true;
    }, []);

    /**
     * Cancel crop selection
     */
    const cancelCrop = useCallback(() => {
        const { canvas } = useEditorStore.getState();
        if (!canvas) return;

        if (cropRectRef.current) {
            canvas.remove(cropRectRef.current);
            cropRectRef.current = null;
        }

        useEditorStore.setState({ cropRect: null });
        canvas.renderAll();
    }, []);

    /**
     * Check if crop is active
     */
    const hasCropSelection = useCallback(() => {
        return cropRectRef.current !== null && cropRectRef.current.width > 10;
    }, []);

    return {
        initCropEvents,
        applyCrop,
        cancelCrop,
        hasCropSelection,
    };
}
