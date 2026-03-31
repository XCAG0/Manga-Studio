/**
 * Manga Studio - Canvas Utilities
 * Helper functions for canvas operations
 */

import * as fabric from 'fabric';
import { CANVAS, SHAPES } from './constants';

/**
 * Create a new Fabric.js canvas with default settings
 * @param {HTMLCanvasElement} canvasElement - The canvas element
 * @param {Object} options - Optional canvas options
 * @returns {fabric.Canvas} - The Fabric.js canvas instance
 */
export function createCanvas(canvasElement, options = {}) {
    const canvas = new fabric.Canvas(canvasElement, {
        backgroundColor: options.backgroundColor || CANVAS.BACKGROUND_COLOR,
        width: options.width || CANVAS.DEFAULT_WIDTH,
        height: options.height || CANVAS.DEFAULT_HEIGHT,
        selection: true,
        preserveObjectStacking: true,
        renderOnAddRemove: false,
        ...options,
    });

    return canvas;
}

/**
 * Zoom canvas to a specific level
 * @param {fabric.Canvas} canvas
 * @param {number} zoomLevel - Zoom percentage (10-400)
 */
export function setCanvasZoom(canvas, zoomLevel) {
    if (!canvas) return;

    const zoom = Math.min(CANVAS.ZOOM_MAX, Math.max(CANVAS.ZOOM_MIN, zoomLevel));
    const center = canvas.getCenter();

    canvas.zoomToPoint(
        new fabric.Point(center.left, center.top),
        zoom / 100
    );
    canvas.renderAll();

    return zoom;
}

/**
 * Reset canvas view to default zoom and position
 * @param {fabric.Canvas} canvas
 */
export function resetCanvasView(canvas) {
    if (!canvas) return;

    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    canvas.renderAll();
}

/**
 * Get canvas center point
 * @param {fabric.Canvas} canvas
 * @returns {{x: number, y: number}}
 */
export function getCanvasCenter(canvas) {
    if (!canvas) return { x: 0, y: 0 };

    const center = canvas.getCenter();
    return { x: center.left, y: center.top };
}

/**
 * Add image to canvas from URL
 * Simple approach: Canvas size = Image size
 * @param {fabric.Canvas} canvas
 * @param {string} imageUrl - Base64 or URL
 * @param {Object} options - Image options
 * @returns {Promise<fabric.Image>}
 */
export async function addImageToCanvas(canvas, imageUrl, options = {}) {
    if (!canvas) return null;

    const img = await fabric.Image.fromURL(imageUrl);

    // Get image dimensions
    const imgWidth = img.width;
    const imgHeight = img.height;

    console.log(`[Canvas] Loading image: ${imgWidth}×${imgHeight}`);

    // Check existing images
    const existingImages = canvas.getObjects().filter(obj => obj.type === 'image');
    const isFirstImage = existingImages.length === 0;

    let positionY = 0;

    if (isFirstImage) {
        // First image: Set canvas to image size
        canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        canvas.setWidth(imgWidth);
        canvas.setHeight(imgHeight);
        positionY = 0;
    } else {
        // Calculate position from actual existing images (in case some were deleted)
        let maxBottom = 0;
        existingImages.forEach(existingImg => {
            const bottom = existingImg.top + (existingImg.height * (existingImg.scaleY || 1));
            maxBottom = Math.max(maxBottom, bottom);
        });
        positionY = maxBottom;
        canvas.setHeight(positionY + imgHeight);
    }

    // Position image
    img.set({
        left: 0,
        top: positionY,
        scaleX: 1,
        scaleY: 1,
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false,
        lockMovementX: true,
        lockMovementY: true,
        originX: 'left',
        originY: 'top',
        isBackgroundImage: true,
        ...options,
    });

    canvas.add(img);
    canvas.renderAll();

    return img;
}

/**
 * Add image to canvas as a TOP layer (selectable and moveable)
 * Used by "Add Up" feature to add images above existing content
 * @param {fabric.Canvas} canvas
 * @param {string} imageUrl - Base64 or URL
 * @param {Object} options - Image options
 * @returns {Promise<fabric.Image>}
 */
export async function addImageToCanvasTop(canvas, imageUrl, options = {}) {
    if (!canvas) return null;

    const img = await fabric.Image.fromURL(imageUrl);

    // Get image dimensions
    const imgWidth = img.width;
    const imgHeight = img.height;

    console.log(`[Canvas] Adding image on top: ${imgWidth}×${imgHeight}`);

    // Position at center of current canvas view
    const canvasWidth = canvas.getWidth();
    const canvasHeight = canvas.getHeight();

    // Center the image on canvas
    const left = Math.max(0, (canvasWidth - imgWidth) / 2);
    const top = Math.max(0, (canvasHeight - imgHeight) / 2);

    // Set as FULLY MOVEABLE and SELECTABLE layer
    img.set({
        left: left,
        top: top,
        scaleX: 1,
        scaleY: 1,
        selectable: true,       //  Can be selected
        evented: true,          //  Can receive events
        hasControls: true,      //  Has resize/rotate controls
        hasBorders: true,       //  Shows selection borders
        lockMovementX: false,   //  Can move horizontally
        lockMovementY: false,   //  Can move vertically
        lockRotation: false,    //  Can rotate
        lockScalingX: false,    //  Can scale horizontally
        lockScalingY: false,    //  Can scale vertically
        originX: 'left',
        originY: 'top',
        isBackgroundImage: false,  // NOT a background
        layerId: Date.now(),    //  Generate unique layer ID
        ...options,
    });

    canvas.add(img);
    canvas.renderAll();

    console.log(`[Canvas]  Image added as top layer (fully moveable and selectable)`);
    return img;
}

/**
 * Replace the bitmap source of an existing fabric image without replacing the object.
 * This preserves the current layer identity and avoids duplicate image layers.
 * @param {fabric.Canvas} canvas
 * @param {fabric.Image} imageObject
 * @param {string} imageUrl
 * @param {Object} options
 * @returns {Promise<fabric.Image|null>}
 */
export async function replaceCanvasImageSource(canvas, imageObject, imageUrl, options = {}) {
    if (!canvas || !imageObject || !imageUrl) return null;

    const { objectProps = {}, render = true } = options;

    const preservedProps = {
        left: imageObject.left ?? 0,
        top: imageObject.top ?? 0,
        scaleX: imageObject.scaleX ?? 1,
        scaleY: imageObject.scaleY ?? 1,
        angle: imageObject.angle ?? 0,
        flipX: !!imageObject.flipX,
        flipY: !!imageObject.flipY,
        opacity: imageObject.opacity ?? 1,
        selectable: imageObject.selectable ?? false,
        evented: imageObject.evented ?? false,
        hasControls: imageObject.hasControls ?? false,
        hasBorders: imageObject.hasBorders ?? false,
        lockMovementX: imageObject.lockMovementX ?? false,
        lockMovementY: imageObject.lockMovementY ?? false,
        lockRotation: imageObject.lockRotation ?? false,
        lockScalingX: imageObject.lockScalingX ?? false,
        lockScalingY: imageObject.lockScalingY ?? false,
        originX: imageObject.originX ?? 'left',
        originY: imageObject.originY ?? 'top',
        isBackgroundImage: imageObject.isBackgroundImage,
    };

    await imageObject.setSrc(imageUrl);
    imageObject.set({
        ...preservedProps,
        ...objectProps,
    });
    imageObject.dirty = true;
    imageObject.setCoords();

    if (render) {
        canvas.requestRenderAll();
    }

    return imageObject;
}

/**
 * Create brush cursor as data URL
 * @param {number} size - Brush size
 * @param {string} color - Brush color (optional)
 * @returns {string} - CSS cursor value
 */
export function createBrushCursor(size, color = '#ffffff') {
    // Minimum cursor size
    const cursorSize = Math.max(size, 6);
    // Canvas needs slight padding for stroke
    const padding = 2;
    const canvasSize = cursorSize + padding * 2;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasSize;
    tempCanvas.height = canvasSize;

    const ctx = tempCanvas.getContext('2d');
    // Center of the canvas is the hotspot
    const centerX = canvasSize / 2;
    const centerY = canvasSize / 2;
    const radius = cursorSize / 2;

    // Draw circle outline
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Dark outer ring for visibility
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 1, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Center crosshair for precision
    ctx.beginPath();
    ctx.moveTo(centerX - 3, centerY);
    ctx.lineTo(centerX + 3, centerY);
    ctx.moveTo(centerX, centerY - 3);
    ctx.lineTo(centerX, centerY + 3);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Hotspot: the exact center (must be integers)
    const hotspotX = Math.round(centerX);
    const hotspotY = Math.round(centerY);

    return `url(${tempCanvas.toDataURL()}) ${hotspotX} ${hotspotY}, crosshair`;
}

/**
 * Export canvas as image data URL
 * @param {fabric.Canvas} canvas
 * @param {string} format - 'png' or 'jpg'
 * @param {number} quality - Quality for jpg (0-1)
 * @returns {string} - Base64 data URL
 */
export function exportCanvasAsImage(canvas, format = 'png', quality = 0.92) {
    if (!canvas) return null;

    const multiplier = 1;
    const options = {
        format: format,
        multiplier: multiplier,
    };

    if (format === 'jpeg' || format === 'jpg') {
        options.quality = quality;
    }

    return canvas.toDataURL(options);
}

/**
 * Check if a shape has minimum valid size
 * @param {fabric.Object} shape
 * @returns {boolean}
 */
export function isValidShapeSize(shape) {
    if (!shape) return false;

    if (shape.type === 'rect') {
        return shape.width >= SHAPES.MIN_SIZE && shape.height >= SHAPES.MIN_SIZE;
    }

    if (shape.type === 'ellipse') {
        return shape.rx >= SHAPES.MIN_SIZE / 2 && shape.ry >= SHAPES.MIN_SIZE / 2;
    }

    return true;
}

/**
 * Get all objects from canvas
 * @param {fabric.Canvas} canvas
 * @returns {fabric.Object[]}
 */
export function getAllObjects(canvas) {
    if (!canvas) return [];
    return canvas.getObjects();
}

/**
 * Clear all objects from canvas
 * @param {fabric.Canvas} canvas
 * @param {boolean} keepBackground - Keep background color
 */
export function clearCanvas(canvas, keepBackground = true) {
    if (!canvas) return;

    const bgColor = canvas.backgroundColor;
    canvas.clear();

    if (keepBackground) {
        canvas.backgroundColor = bgColor;
    }

    canvas.renderAll();
}
