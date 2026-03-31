/**
 * Manga Studio - File Operations Hook
 * Handles file save, export, and file management
 */

import { useCallback } from 'react';
import { useEditorStore } from '../store/editorStore';
import { FILE } from '../utils/constants';

export function useFileOperations() {
    /**
     * Save canvas as project (JSON)
     */
    const saveProject = useCallback(async () => {
        const { canvas, fileName } = useEditorStore.getState();
        if (!canvas) return;

        const json = JSON.stringify(canvas.toJSON());
        const defaultName = fileName?.replace(/\.[^/.]+$/, '.json') || 'manga-project.json';

        const result = await window.electronAPI?.saveFile(
            `data:application/json;charset=utf-8,${encodeURIComponent(json)}`,
            defaultName
        );

        if (result) {
            useEditorStore.getState().setIsModified(false);
        }

        return result;
    }, []);

    /**
     * Export canvas as PNG (without background)
     */
    const exportPNG = useCallback(async () => {
        const { canvas, fileName } = useEditorStore.getState();
        if (!canvas) return;

        const objects = canvas.getObjects();
        if (objects.length === 0) return;

        // Save and reset viewport transform for accurate export
        const originalVPT = canvas.viewportTransform.slice();
        canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

        // Calculate actual content bounds using object properties
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

        console.log(`[Export] Bounds: (${minX}, ${minY}) to (${maxX}, ${maxY}), Size: ${maxX - minX}x${maxY - minY}`);

        // Temporarily remove background for transparent export
        const originalBg = canvas.backgroundColor;
        canvas.backgroundColor = null;
        canvas.renderAll();

        // Export the full content area
        const dataURL = canvas.toDataURL({
            format: 'png',
            multiplier: 1,
            left: minX,
            top: minY,
            width: maxX - minX,
            height: maxY - minY,
        });

        // Restore background and viewport
        canvas.backgroundColor = originalBg;
        canvas.setViewportTransform(originalVPT);
        canvas.renderAll();

        const baseName = fileName?.replace(/\.[^/.]+$/, '') || FILE.DEFAULT_EXPORT_NAME;
        const exportName = `${baseName}.png`;

        const result = await window.electronAPI?.saveFile(dataURL, exportName);
        return result;
    }, []);

    /**
     * Export canvas as JPG
     * @param {number} quality - 0 to 1
     */
    const exportJPG = useCallback(async (quality = 0.92) => {
        const { canvas, fileName } = useEditorStore.getState();
        if (!canvas) return;

        // Calculate actual content bounds
        const objects = canvas.getObjects();
        if (objects.length === 0) return;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        objects.forEach(obj => {
            const bounds = obj.getBoundingRect(true, true);
            minX = Math.min(minX, bounds.left);
            minY = Math.min(minY, bounds.top);
            maxX = Math.max(maxX, bounds.left + bounds.width);
            maxY = Math.max(maxY, bounds.top + bounds.height);
        });

        // Export only the content area (cropped)
        const dataURL = canvas.toDataURL({
            format: 'jpeg',
            quality: quality,
            multiplier: 1,
            left: minX,
            top: minY,
            width: maxX - minX,
            height: maxY - minY,
        });

        const baseName = fileName?.replace(/\.[^/.]+$/, '') || FILE.DEFAULT_EXPORT_NAME;
        const exportName = `${baseName}.jpg`;

        const result = await window.electronAPI?.saveFile(dataURL, exportName);
        return result;
    }, []);

    /**
     * Export with dialog (let user choose format)
     */
    const exportImage = useCallback(async () => {
        const { canvas, fileName } = useEditorStore.getState();
        if (!canvas) return;

        // Calculate actual content bounds
        const objects = canvas.getObjects();
        if (objects.length === 0) return;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        objects.forEach(obj => {
            const bounds = obj.getBoundingRect(true, true);
            minX = Math.min(minX, bounds.left);
            minY = Math.min(minY, bounds.top);
            maxX = Math.max(maxX, bounds.left + bounds.width);
            maxY = Math.max(maxY, bounds.top + bounds.height);
        });

        // Export only the content area (cropped)
        const dataURL = canvas.toDataURL({
            format: 'png',
            multiplier: 1,
            left: minX,
            top: minY,
            width: maxX - minX,
            height: maxY - minY,
        });

        const baseName = fileName?.replace(/\.[^/.]+$/, '') || FILE.DEFAULT_EXPORT_NAME;

        const result = await window.electronAPI?.saveFile(dataURL, `${baseName}.png`);
        return result;
    }, []);

    /**
     * Open file dialog
     */
    const openFile = useCallback(async () => {
        const result = await window.electronAPI?.openFile();
        if (!result) return null;

        const { canvas, setFileName, setFilePath, saveState } = useEditorStore.getState();
        if (!canvas) return null;

        // Import addImageToCanvas for proper stacking
        const { addImageToCanvas } = await import('../utils/canvas');

        // Add image to canvas (stacks below existing images)
        await addImageToCanvas(canvas, result.data);

        setFileName(result.path.split(/[\\/]/).pop());
        setFilePath(result.path);
        saveState();

        return result;
    }, []);

    /**
     * Add image on top (Add Up feature) - loads as selectable layer
     */
    const addImageUp = useCallback(async () => {
        const result = await window.electronAPI?.openFile();
        if (!result) return null;

        const { canvas, saveState, setActiveLayer } = useEditorStore.getState();
        if (!canvas) return null;

        // Import addImageToCanvasTop for top-layer stacking
        const { addImageToCanvasTop } = await import('../utils/canvas');

        // Add image on top (as selectable layer)
        // Note: Layer is automatically created by object:added event in Canvas.jsx
        const img = await addImageToCanvasTop(canvas, result.data);

        if (img) {
            // Select the newly added image
            canvas.setActiveObject(img);
            canvas.renderAll();

            // Set active layer (layerId was set by addImageToCanvasTop)
            if (img.layerId) {
                setActiveLayer(img.layerId);
            }

            console.log('[AddUp] Image added as layer:', img.layerId);
        }

        saveState();

        return result;
    }, []);

    /**
     * New project (clear canvas)
     */
    const newProject = useCallback(() => {
        const { canvas, reset, saveState } = useEditorStore.getState();
        if (!canvas) return;

        // Clear all objects
        canvas.clear();
        canvas.backgroundColor = '#2a2a2a';
        canvas.renderAll();

        // Reset store
        reset();
        saveState();
    }, []);

    return {
        saveProject,
        exportPNG,
        exportJPG,
        exportImage,
        openFile,
        addImageUp,
        newProject,
    };
}
