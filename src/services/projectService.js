/**
 * Manga Studio - Project Save/Load Service
 * ==========================================
 * Robust system for saving and loading projects with images, texts, and all content
 */

import * as fabric from 'fabric';
import { useEditorStore } from '../store/editorStore';

/**
 * Properties to include in canvas JSON for full state restoration
 */
const CANVAS_PROPERTIES = [
    'src',
    'crossOrigin',
    'selectable',
    'evented',
    'hasControls',
    'hasBorders',
    'lockMovementX',
    'lockMovementY',
    'layerId',
    'isBackgroundImage',
    'visible',
    'opacity'
];

/**
 * Save current canvas state to a project file
 * @param {string} projectName - Name of the project
 * @param {string} folderName - Name of the folder (optional, defaults to '_default')
 * @returns {Promise<{success: boolean, path?: string, error?: string}>}
 */
export async function saveProject(projectName, folderName = '_default') {
    const canvas = useEditorStore.getState().canvas;
    const textManagerLines = useEditorStore.getState().textManagerLines;

    if (!canvas) {
        console.warn('[ProjectService] No canvas available');
        return { success: false, error: 'No canvas' };
    }

    const objects = canvas.getObjects();
    console.log(`[ProjectService] Saving project with ${objects.length} objects`);

    if (objects.length === 0) {
        console.log('[ProjectService] Canvas is empty, nothing to save');
        return { success: false, error: 'Canvas is empty' };
    }

    try {
        // Get canvas dimensions
        const canvasWidth = canvas.getWidth();
        const canvasHeight = canvas.getHeight();

        // Get canvas state with ALL required properties including image src
        const canvasJSON = canvas.toJSON(CANVAS_PROPERTIES);

        // Add canvas dimensions to JSON
        canvasJSON.canvasWidth = canvasWidth;
        canvasJSON.canvasHeight = canvasHeight;

        const canvasString = JSON.stringify(canvasJSON);
        console.log(`[ProjectService] Canvas JSON size: ${(canvasString.length / 1024).toFixed(2)} KB`);

        // Generate thumbnail
        const thumbnail = canvas.toDataURL({
            format: 'png',
            quality: 0.5,
            multiplier: 0.15
        });

        // Generate project name if not provided
        const name = projectName || `Project_${Date.now()}`;

        // Prepare project data with TextManager lines
        const projectData = {
            canvasJSON: canvasString,
            thumbnail: thumbnail,
            textManagerLines: textManagerLines || [],
            canvasWidth: canvasWidth,
            canvasHeight: canvasHeight,
            folderName: folderName
        };

        // Check if Electron API is available
        if (window.electronAPI?.saveProject) {
            const result = await window.electronAPI.saveProject({
                projectName: name,
                folderName: folderName,
                canvasJSON: canvasString,
                thumbnail: thumbnail,
                textManagerLines: textManagerLines
            });

            if (result.success) {
                console.log(`[ProjectService] ✅ Saved to: ${result.path}`);
                useEditorStore.getState().setFileName(name);
                useEditorStore.getState().setIsModified(false);
            }
            return result;
        } else {
            // Fallback: save to localStorage
            return saveToLocalStorage(name, projectData);
        }
    } catch (error) {
        console.error('[ProjectService] Save error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get folders from localStorage (fallback)
 */
function getFoldersFromLocalStorage() {
    try {
        const projects = JSON.parse(localStorage.getItem('manga-studio-projects') || '[]');

        // Group by folder
        const folderMap = new Map();

        projects.forEach(project => {
            const folderName = project.folderName || '_default';

            if (!folderMap.has(folderName)) {
                folderMap.set(folderName, {
                    name: folderName,
                    projects: [],
                    projectCount: 0
                });
            }

            folderMap.get(folderName).projects.push(project);
        });

        const folders = Array.from(folderMap.values());
        folders.forEach(folder => {
            folder.projectCount = folder.projects.length;
            folder.projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        });

        // Sort folders
        folders.sort((a, b) => {
            if (a.name === '_default') return -1;
            if (b.name === '_default') return 1;
            return a.name.localeCompare(b.name);
        });

        return folders;
    } catch (error) {
        console.error('[ProjectService] Error getting folders from localStorage:', error);
        return [];
    }
}

/**
 * localStorage fallback for web development
 */
function saveToLocalStorage(name, projectData) {
    try {
        const projects = JSON.parse(localStorage.getItem('manga-studio-projects') || '[]');

        // Update existing or add new
        const existingIndex = projects.findIndex(p => p.id === name || p.name === name);

        const project = {
            id: name,
            name: name,
            canvasJSON: projectData.canvasJSON,
            thumbnail: projectData.thumbnail,
            textManagerLines: projectData.textManagerLines,
            canvasWidth: projectData.canvasWidth,
            canvasHeight: projectData.canvasHeight,
            createdAt: existingIndex >= 0 ? projects[existingIndex].createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        if (existingIndex >= 0) {
            projects[existingIndex] = project;
        } else {
            projects.unshift(project);
        }

        // Keep only last 20 projects
        localStorage.setItem('manga-studio-projects', JSON.stringify(projects.slice(0, 20)));
        console.log(`[ProjectService] ✅ Saved to localStorage: ${name}`);

        useEditorStore.getState().setFileName(name);
        useEditorStore.getState().setIsModified(false);

        return { success: true, id: name };
    } catch (error) {
        console.error('[ProjectService] localStorage save error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get list of all folders with their projects
 * @returns {Promise<Array>}
 */
export async function getFolders() {
    try {
        if (window.electronAPI?.getFolders) {
            const result = await window.electronAPI.getFolders();
            return result.folders || [];
        } else {
            // Fallback: organize localStorage projects into folders
            return getFoldersFromLocalStorage();
        }
    } catch (error) {
        console.error('[ProjectService] Error getting folders:', error);
        return [];
    }
}

/**
 * Create a new folder
 * @param {string} folderName - Name of the folder to create
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function createFolder(folderName) {
    try {
        if (window.electronAPI?.createFolder) {
            return await window.electronAPI.createFolder(folderName);
        } else {
            // localStorage fallback - just return success
            return { success: true, name: folderName };
        }
    } catch (error) {
        console.error('[ProjectService] Error creating folder:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get list of all saved projects (deprecated - use getFolders)
 * @returns {Promise<Array>}
 */
export async function getProjects() {
    try {
        // Map to new folder structure
        const folders = await getFolders();
        const allProjects = [];

        folders.forEach(folder => {
            if (folder.projects) {
                allProjects.push(...folder.projects);
            }
        });

        return allProjects;
    } catch (error) {
        console.error('[ProjectService] Error getting projects:', error);
        return [];
    }
}

/**
 * Load a project and restore canvas state
 * @param {string} projectPathOrId - File path (Electron) or project ID (localStorage)
 * @returns {Promise<{success: boolean, project?: Object, error?: string}>}
 */
export async function loadProject(projectPathOrId) {
    try {
        let projectData;

        if (window.electronAPI?.loadProject) {
            const result = await window.electronAPI.loadProject(projectPathOrId);
            if (!result.success) {
                return { success: false, error: result.error };
            }
            projectData = result.project;
        } else {
            // Fallback: find in localStorage
            const projects = JSON.parse(localStorage.getItem('manga-studio-projects') || '[]');
            projectData = projects.find(p => p.id === projectPathOrId || p.path === projectPathOrId);
        }

        if (!projectData) {
            return { success: false, error: 'Project not found' };
        }

        console.log(`[ProjectService] Loading project: ${projectData.name}`);

        return { success: true, project: projectData };
    } catch (error) {
        console.error('[ProjectService] Load error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Restore canvas state from project data - ROBUST VERSION
 * Uses manual object creation instead of loadFromJSON for reliability
 * @param {fabric.Canvas} canvas - The fabric canvas instance
 * @param {Object} projectData - The loaded project data
 * @returns {Promise<boolean>}
 */
export async function restoreCanvasFromProject(canvas, projectData) {
    if (!canvas) {
        console.error('[ProjectService] No canvas provided');
        return false;
    }

    if (!projectData) {
        console.error('[ProjectService] No project data provided');
        return false;
    }

    // Try multiple possible field names for canvas data
    const canvasDataField = projectData.canvasJSON || projectData.canvasData;

    if (!canvasDataField) {
        console.error('[ProjectService] No canvas data in project. Available keys:', Object.keys(projectData));
        return false;
    }

    try {
        // Parse canvas JSON if it's a string
        const canvasState = typeof canvasDataField === 'string'
            ? JSON.parse(canvasDataField)
            : canvasDataField;

        console.log('[ProjectService] Canvas state parsed:');
        console.log('  - Background:', canvasState.background);
        console.log('  - Objects count:', canvasState.objects?.length || 0);

        // CRITICAL: Clear existing layers before loading new project
        useEditorStore.setState({ layers: [], activeLayerId: null });
        console.log('[ProjectService] Cleared existing layers');

        // Store dimensions for later use
        const savedWidth = canvasState.canvasWidth || projectData.canvasWidth || 800;
        const savedHeight = canvasState.canvasHeight || projectData.canvasHeight || 600;
        console.log(`[ProjectService] Saved dimensions: ${savedWidth}x${savedHeight}`);

        // Set background
        if (canvasState.background) {
            canvas.backgroundColor = canvasState.background;
        }

        // Restore objects one by one
        const objects = canvasState.objects || [];
        console.log(`[ProjectService] Restoring ${objects.length} objects...`);

        let isFirstImage = true;

        for (let i = 0; i < objects.length; i++) {
            const objData = objects[i];
            const objType = objData.type?.toLowerCase() || '';
            console.log(`[ProjectService] Loading object ${i + 1}/${objects.length}: type=${objData.type} -> ${objType}`);

            try {
                if (objType === 'image') {
                    // Load image - first image will resize the canvas
                    await loadImageObject(canvas, objData, isFirstImage);
                    isFirstImage = false;
                } else if (objType === 'i-text' || objType === 'text' || objType === 'itext' || objType === 'textbox') {
                    // Load text object
                    loadTextObject(canvas, objData);
                } else if (objType === 'rect') {
                    loadRectObject(canvas, objData);
                } else if (objType === 'ellipse' || objType === 'circle') {
                    loadEllipseObject(canvas, objData);
                } else if (objType === 'path') {
                    loadPathObject(canvas, objData);
                } else {
                    console.log(`[ProjectService] Skipping unknown type: ${objData.type}`);
                }
            } catch (objError) {
                console.error(`[ProjectService] Error loading object ${i}:`, objError);
            }
        }

        canvas.renderAll();

        // Restore TextManager lines
        if (projectData.textManagerLines && Array.isArray(projectData.textManagerLines)) {
            console.log(`[ProjectService] Restoring ${projectData.textManagerLines.length} TextManager lines`);
            useEditorStore.getState().setTextManagerLines(projectData.textManagerLines);
        }

        // Update store
        if (projectData.name) {
            useEditorStore.getState().setFileName(projectData.name);
        }
        useEditorStore.getState().setIsModified(false);

        console.log(`[ProjectService] ✅ Canvas restored: ${canvas.getObjects().length} objects`);
        return true;

    } catch (error) {
        console.error('[ProjectService] Restore error:', error);
        return false;
    }
}

/**
 * Load image object using fabric.Image.fromURL (same as addImageToCanvas)
 */
async function loadImageObject(canvas, objData, isFirstImage = false) {
    if (!objData.src) {
        console.warn('[ProjectService] Image has no src');
        return null;
    }

    console.log(`[ProjectService] Loading image, src length: ${objData.src.length}`);

    try {
        const img = await fabric.Image.fromURL(objData.src);

        if (!img) {
            console.warn('[ProjectService] Failed to create image');
            return null;
        }

        // Get image dimensions
        const imgWidth = img.width;
        const imgHeight = img.height;
        console.log('[ProjectService] Image loaded:', imgWidth, 'x', imgHeight);

        // Set canvas size if this is the first/main image
        if (isFirstImage) {
            canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
            canvas.setWidth(imgWidth);
            canvas.setHeight(imgHeight);
            console.log('[ProjectService] Canvas resized to:', imgWidth, 'x', imgHeight);
        }

        // Check if this is a background image or an overlay (Add Up)
        // Priority: 1. Explicit isBackgroundImage value, 2. isFirstImage for undefined (backward compatibility)
        let isBackground;
        if (objData.isBackgroundImage === true) {
            isBackground = true;
        } else if (objData.isBackgroundImage === false) {
            isBackground = false;
        } else {
            // For old projects without isBackgroundImage, use isFirstImage
            isBackground = isFirstImage;
        }

        console.log(`[ProjectService] Image isBackgroundImage raw: ${objData.isBackgroundImage}, isFirstImage: ${isFirstImage}, isBackground resolved: ${isBackground}`);

        // Apply saved properties
        img.set({
            left: objData.left || 0,
            top: objData.top || 0,
            scaleX: objData.scaleX || 1,
            scaleY: objData.scaleY || 1,
            angle: objData.angle || 0,
            opacity: objData.opacity !== undefined ? objData.opacity : 1,
            visible: objData.visible !== undefined ? objData.visible : true,
            // Background images are non-selectable, Add Up images are selectable
            selectable: !isBackground,
            evented: !isBackground,
            hasControls: !isBackground,
            hasBorders: !isBackground,
            lockMovementX: isBackground,
            lockMovementY: isBackground,
            originX: 'left',
            originY: 'top',
            isBackgroundImage: isBackground,  // Preserve the flag
            layerId: objData.layerId || Date.now()
        });

        canvas.add(img);
        canvas.renderAll();

        // Layer creation is handled by Canvas.jsx object:added event
        // No need to call createLayerFromObject here

        console.log(`[ProjectService] ✅ Image added to canvas (isBackground: ${isBackground})`);
        return img;

    } catch (err) {
        console.error('[ProjectService] Image load error:', err);
        return null;
    }
}

/**
 * Load text object
 */
function loadTextObject(canvas, objData) {
    const text = new fabric.IText(objData.text || '', {
        left: objData.left || 0,
        top: objData.top || 0,
        fontSize: objData.fontSize || 24,
        fontFamily: objData.fontFamily || 'Arial',
        fill: objData.fill || '#000000',
        stroke: objData.stroke || null,
        strokeWidth: objData.strokeWidth || 0,
        textAlign: objData.textAlign || 'left',
        fontWeight: objData.fontWeight || 'normal',
        fontStyle: objData.fontStyle || 'normal',
        underline: objData.underline || false,
        linethrough: objData.linethrough || false,
        angle: objData.angle || 0,
        scaleX: objData.scaleX || 1,
        scaleY: objData.scaleY || 1,
        opacity: objData.opacity !== undefined ? objData.opacity : 1,
        visible: objData.visible !== undefined ? objData.visible : true,
        selectable: true,
        evented: true,
        layerId: objData.layerId || Date.now()
    });

    canvas.add(text);

    // Layer creation is handled by Canvas.jsx object:added event

    console.log(`[ProjectService] ✅ Text loaded: "${objData.text?.substring(0, 20)}..."`);
    return text;
}

/**
 * Load rectangle object
 */
function loadRectObject(canvas, objData) {
    const rect = new fabric.Rect({
        left: objData.left || 0,
        top: objData.top || 0,
        width: objData.width || 100,
        height: objData.height || 100,
        fill: objData.fill || 'transparent',
        stroke: objData.stroke || '#ffffff',
        strokeWidth: objData.strokeWidth || 2,
        angle: objData.angle || 0,
        scaleX: objData.scaleX || 1,
        scaleY: objData.scaleY || 1,
        opacity: objData.opacity !== undefined ? objData.opacity : 1,
        visible: objData.visible !== undefined ? objData.visible : true,
        rx: objData.rx || 0,
        ry: objData.ry || 0,
        selectable: true,
        evented: true,
        layerId: objData.layerId || Date.now()
    });

    canvas.add(rect);

    // Layer creation is handled by Canvas.jsx object:added event

    console.log('[ProjectService] ✅ Rect loaded');
    return rect;
}

/**
 * Load ellipse object
 */
function loadEllipseObject(canvas, objData) {
    const ellipse = new fabric.Ellipse({
        left: objData.left || 0,
        top: objData.top || 0,
        rx: objData.rx || 50,
        ry: objData.ry || 50,
        fill: objData.fill || 'transparent',
        stroke: objData.stroke || '#ffffff',
        strokeWidth: objData.strokeWidth || 2,
        angle: objData.angle || 0,
        scaleX: objData.scaleX || 1,
        scaleY: objData.scaleY || 1,
        opacity: objData.opacity !== undefined ? objData.opacity : 1,
        visible: objData.visible !== undefined ? objData.visible : true,
        selectable: true,
        evented: true,
        layerId: objData.layerId || Date.now()
    });

    canvas.add(ellipse);

    // Layer creation is handled by Canvas.jsx object:added event

    console.log('[ProjectService] ✅ Ellipse loaded');
    return ellipse;
}

/**
 * Load path object (drawings)
 */
function loadPathObject(canvas, objData) {
    try {
        const path = new fabric.Path(objData.path, {
            left: objData.left || 0,
            top: objData.top || 0,
            fill: objData.fill || null,
            stroke: objData.stroke || '#ffffff',
            strokeWidth: objData.strokeWidth || 2,
            strokeLineCap: objData.strokeLineCap || 'round',
            strokeLineJoin: objData.strokeLineJoin || 'round',
            angle: objData.angle || 0,
            scaleX: objData.scaleX || 1,
            scaleY: objData.scaleY || 1,
            opacity: objData.opacity !== undefined ? objData.opacity : 1,
            visible: objData.visible !== undefined ? objData.visible : true,
            selectable: true,
            evented: true,
            layerId: objData.layerId || Date.now()
        });

        canvas.add(path);

        // Layer creation is handled by Canvas.jsx object:added event

        console.log('[ProjectService] ✅ Path loaded');
        return path;
    } catch (e) {
        console.error('[ProjectService] Path load error:', e);
        return null;
    }
}

/**
 * Delete a project
 * @param {string} projectPathOrId - Path or ID
 * @returns {Promise<boolean>}
 */
export async function deleteProject(projectPathOrId) {
    try {
        if (window.electronAPI?.deleteProject) {
            const result = await window.electronAPI.deleteProject(projectPathOrId);
            return result.success;
        } else {
            // Fallback: remove from localStorage
            const projects = JSON.parse(localStorage.getItem('manga-studio-projects') || '[]');
            const filtered = projects.filter(p => p.id !== projectPathOrId && p.path !== projectPathOrId);
            localStorage.setItem('manga-studio-projects', JSON.stringify(filtered));
            return true;
        }
    } catch (error) {
        console.error('[ProjectService] Delete error:', error);
        return false;
    }
}

/**
 * Format date for display
 */
export function formatProjectDate(isoString) {
    if (!isoString) return 'Unknown date';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}
