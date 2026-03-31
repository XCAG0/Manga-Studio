/**
 * Manga Studio - Context Menu Hook
 * Right-click menu for canvas objects
 */

import { useCallback, useState, useRef, useEffect } from 'react';
import { useEditorStore } from '../store/editorStore';

export function useContextMenu() {
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [targetObject, setTargetObject] = useState(null);
    const menuRef = useRef(null);

    /**
     * Show context menu
     * @param {number} x - Screen X position
     * @param {number} y - Screen Y position
     * @param {fabric.Object} object - Target object
     */
    const showMenu = useCallback((x, y, object) => {
        setPosition({ x, y });
        setTargetObject(object);
        setIsVisible(true);
    }, []);

    /**
     * Hide context menu
     */
    const hideMenu = useCallback(() => {
        setIsVisible(false);
        setTargetObject(null);
    }, []);

    /**
     * Initialize canvas right-click event
     * @param {fabric.Canvas} canvas
     */
    const initContextMenu = useCallback((canvas) => {
        if (!canvas) return;

        const handleContextMenu = (opt) => {
            opt.e.preventDefault();
            opt.e.stopPropagation();

            const target = opt.target;
            if (target) {
                showMenu(opt.e.clientX, opt.e.clientY, target);
            } else {
                hideMenu();
            }
        };

        canvas.on('mouse:down', (opt) => {
            if (opt.e.button !== 2) { // Not right click
                hideMenu();
            }
        });

        // Use native contextmenu event
        canvas.upperCanvasEl?.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const target = canvas.findTarget(e);
            if (target) {
                showMenu(e.clientX, e.clientY, target);
            }
        });
    }, [showMenu, hideMenu]);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                hideMenu();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [hideMenu]);

    // =====================
    // CONTEXT MENU ACTIONS
    // =====================

    /**
     * Fill shape with current brush color
     */
    const fillShape = useCallback(() => {
        if (!targetObject) return;

        const { brushColor, saveState } = useEditorStore.getState();
        targetObject.set('fill', brushColor);
        targetObject.canvas?.renderAll();
        saveState();
        hideMenu();
    }, [targetObject, hideMenu]);

    /**
     * Remove fill (make transparent)
     */
    const removeFill = useCallback(() => {
        if (!targetObject) return;

        const { saveState } = useEditorStore.getState();
        targetObject.set('fill', 'transparent');
        targetObject.canvas?.renderAll();
        saveState();
        hideMenu();
    }, [targetObject, hideMenu]);

    /**
     * Update stroke color
     */
    const updateStrokeColor = useCallback((color) => {
        if (!targetObject) return;

        const { saveState } = useEditorStore.getState();
        targetObject.set('stroke', color);
        targetObject.canvas?.renderAll();
        saveState();
    }, [targetObject]);

    /**
     * Update stroke width
     */
    const updateStrokeWidth = useCallback((width) => {
        if (!targetObject) return;

        const { saveState } = useEditorStore.getState();
        targetObject.set('strokeWidth', width);
        targetObject.canvas?.renderAll();
        saveState();
    }, [targetObject]);

    /**
     * Delete target object
     */
    const deleteObject = useCallback(() => {
        if (!targetObject) return;

        const canvas = targetObject.canvas;
        const { saveState } = useEditorStore.getState();

        canvas?.remove(targetObject);
        canvas?.renderAll();
        saveState();
        hideMenu();
    }, [targetObject, hideMenu]);

    /**
     * Bring to front
     */
    const bringToFront = useCallback(() => {
        if (!targetObject) return;

        const canvas = targetObject.canvas;
        const { saveState } = useEditorStore.getState();

        canvas?.bringObjectToFront(targetObject);
        canvas?.renderAll();
        saveState();
        hideMenu();
    }, [targetObject, hideMenu]);

    /**
     * Send to back
     */
    const sendToBack = useCallback(() => {
        if (!targetObject) return;

        const canvas = targetObject.canvas;
        const { saveState } = useEditorStore.getState();

        canvas?.sendObjectToBack(targetObject);
        canvas?.renderAll();
        saveState();
        hideMenu();
    }, [targetObject, hideMenu]);

    /**
     * Duplicate object
     */
    const duplicateObject = useCallback(() => {
        if (!targetObject) return;

        const canvas = targetObject.canvas;
        const { saveState } = useEditorStore.getState();

        targetObject.clone().then((cloned) => {
            cloned.set({
                left: (targetObject.left || 0) + 20,
                top: (targetObject.top || 0) + 20,
                evented: true,
            });
            canvas?.add(cloned);
            canvas?.setActiveObject(cloned);
            canvas?.renderAll();
            saveState();
        });

        hideMenu();
    }, [targetObject, hideMenu]);

    return {
        isVisible,
        position,
        targetObject,
        menuRef,
        initContextMenu,
        showMenu,
        hideMenu,
        // Actions
        fillShape,
        removeFill,
        updateStrokeColor,
        updateStrokeWidth,
        deleteObject,
        bringToFront,
        sendToBack,
        duplicateObject,
    };
}
