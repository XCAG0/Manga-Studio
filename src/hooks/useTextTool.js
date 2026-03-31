/**
 * Manga Studio - Text Tool Hook
 * Handles text creation and styling
 */

import { useCallback } from 'react';
import * as fabric from 'fabric';
import { useEditorStore } from '../store/editorStore';
import { TEXT, CURSORS } from '../utils/constants';
import { useSystemFonts } from './useSystemFonts';

export function useTextTool() {
    // Get system fonts dynamically
    const { fonts: systemFonts, isLoading: fontsLoading } = useSystemFonts();

    /**
     * Create new text at specified position
     * @param {fabric.Canvas} canvas
     * @param {number} x
     * @param {number} y
     * @param {Object} options
     */
    const createText = useCallback((canvas, x, y, options = {}) => {
        if (!canvas) return null;

        const { brushColor } = useEditorStore.getState();

        const textConfig = {
            left: x,
            top: y,
            fontSize: options.fontSize || TEXT.FONT_SIZE_DEFAULT,
            fontFamily: options.fontFamily || TEXT.FONT_FAMILY_DEFAULT,
            fill: options.fill || brushColor,
            editable: true,
            // Styling
            fontWeight: options.fontWeight || 'normal',
            fontStyle: options.fontStyle || 'normal',
            underline: options.underline || false,
            linethrough: options.linethrough || false,
            // Outline (important for manga)
            stroke: options.stroke || null,
            strokeWidth: options.strokeWidth || 0,
            // Alignment
            textAlign: options.textAlign || 'left',
            lineHeight: options.lineHeight || 1.16,
            charSpacing: options.charSpacing || 0,
            // Textbox specific - allows text wrapping
            width: options.width || 200,
            splitByGrapheme: true, // Better for CJK characters
        };

        // Use Textbox instead of IText for text wrapping when resized
        const text = new fabric.Textbox(options.text || 'Enter text', textConfig);

        // Allow uniform scaling from corners for resizing text

        canvas.add(text);
        // Text should always be on top of brush strokes
        canvas.bringObjectToFront(text);
        canvas.setActiveObject(text);
        text.enterEditing();
        text.selectAll();
        canvas.renderAll();

        useEditorStore.getState().saveState();

        return text;
    }, []);

    /**
     * Update text style property
     * @param {string} property
     * @param {any} value
     */
    const updateTextStyle = useCallback((property, value) => {
        const { canvas, saveState } = useEditorStore.getState();
        if (!canvas) return;

        const activeObject = canvas.getActiveObject();
        if (!activeObject || activeObject.type !== 'textbox') return;

        activeObject.set(property, value);
        canvas.renderAll();
        saveState();
    }, []);

    /**
     * Add outline to text
     * @param {string} color
     * @param {number} width
     */
    const addTextOutline = useCallback((color, width) => {
        const { canvas, saveState } = useEditorStore.getState();
        if (!canvas) return;

        const activeObject = canvas.getActiveObject();
        if (!activeObject || activeObject.type !== 'textbox') return;

        activeObject.set({
            stroke: color,
            strokeWidth: width,
        });
        canvas.renderAll();
        saveState();
    }, []);

    /**
     * Toggle text style (bold, italic, underline)
     * @param {'bold'|'italic'|'underline'} style
     */
    const toggleTextStyle = useCallback((style) => {
        const { canvas, saveState } = useEditorStore.getState();
        if (!canvas) return;

        const activeObject = canvas.getActiveObject();
        if (!activeObject || activeObject.type !== 'textbox') return;

        switch (style) {
            case 'bold':
                activeObject.set('fontWeight', activeObject.fontWeight === 'bold' ? 'normal' : 'bold');
                break;
            case 'italic':
                activeObject.set('fontStyle', activeObject.fontStyle === 'italic' ? 'normal' : 'italic');
                break;
            case 'underline':
                activeObject.set('underline', !activeObject.underline);
                break;
        }

        canvas.renderAll();
        saveState();
    }, []);

    /**
     * Set text font
     * @param {string} fontFamily
     */
    const setFont = useCallback((fontFamily) => {
        updateTextStyle('fontFamily', fontFamily);
    }, [updateTextStyle]);

    /**
     * Set text size
     * @param {number} size
     */
    const setFontSize = useCallback((size) => {
        const validSize = Math.max(TEXT.FONT_SIZE_MIN, Math.min(TEXT.FONT_SIZE_MAX, size));
        updateTextStyle('fontSize', validSize);
    }, [updateTextStyle]);

    /**
     * Set text alignment
     * @param {'left'|'center'|'right'} align
     */
    const setTextAlign = useCallback((align) => {
        updateTextStyle('textAlign', align);
    }, [updateTextStyle]);

    return {
        createText,
        updateTextStyle,
        addTextOutline,
        toggleTextStyle,
        setFont,
        setFontSize,
        setTextAlign,
        availableFonts: systemFonts,
        fontsLoading,
    };
}

