/**
 * useProjectManager Hook
 * Handles project save/load operations with Electron IPC
 */

import { useCallback } from 'react';
import { useEditorStore } from '../store/editorStore';

export function useProjectManager() {
    const { setCurrentPage } = useEditorStore();

    /**
     * Save current project to Documents/Manga Studio
     */
    const saveProject = useCallback(async (projectName) => {
        // Get canvas and textManagerLines from store state directly
        const canvas = useEditorStore.getState().canvas;
        const textManagerLines = useEditorStore.getState().textManagerLines;

        if (!canvas) {
            console.warn('No canvas to save');
            return null;
        }

        try {
            // Check if canvas has objects
            const objects = canvas.getObjects();
            console.log(`[SaveProject] Canvas has ${objects.length} objects`);

            if (objects.length === 0) {
                console.log('[SaveProject] No objects to save');
                return null;
            }

            // Get canvas state as JSON - include ALL properties for full restoration
            // Specifically include 'src' for images and all custom properties
            const canvasJSON = JSON.stringify(canvas.toJSON([
                'src', 'crossOrigin', 'selectable', 'evented', 'hasControls',
                'hasBorders', 'lockMovementX', 'lockMovementY', 'layerId',
                'isCloneSourceMarker', 'isCloneSourceIndicator', 'isCloneTargetPreview',
                'isHealingPreview'
            ]));

            console.log(`[SaveProject] Canvas JSON size: ${canvasJSON.length} bytes`);
            console.log(`[SaveProject] TextManager lines: ${textManagerLines.length}`);

            // Generate thumbnail (small preview image)
            const thumbnail = canvas.toDataURL({
                format: 'png',
                quality: 0.5,
                multiplier: 0.2 // 20% size for thumbnail
            });

            // Generate project name if not provided
            const name = projectName || `Project_${new Date().toLocaleString('en-US', {
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            }).replace(/[,:]/g, '-').replace(/\s/g, '_')}`;

            // Check if electronAPI is available
            if (window.electronAPI?.saveProject) {
                const result = await window.electronAPI.saveProject(name, canvasJSON, thumbnail, textManagerLines);
                if (result.success) {
                    console.log('Project saved:', result.path);
                    useEditorStore.getState().setFileName(name);
                    useEditorStore.getState().setIsModified(false);
                    return result;
                } else {
                    console.error('Failed to save project:', result.error);
                    return null;
                }
            } else {
                // Fallback: save to localStorage for web dev
                const projects = JSON.parse(localStorage.getItem('manga-studio-projects') || '[]');
                const project = {
                    id: name,
                    name: name,
                    canvasJSON,
                    thumbnail,
                    textManagerLines: textManagerLines || [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                projects.unshift(project);
                localStorage.setItem('manga-studio-projects', JSON.stringify(projects.slice(0, 20)));
                console.log('Project saved to localStorage');
                useEditorStore.getState().setFileName(name);
                useEditorStore.getState().setIsModified(false);
                return { success: true, id: name };
            }
        } catch (error) {
            console.error('Error saving project:', error);
            return null;
        }
    }, []);

    /**
     * Get list of all saved projects
     */
    const getProjects = useCallback(async () => {
        try {
            if (window.electronAPI?.getProjects) {
                const result = await window.electronAPI.getProjects();
                return result.projects || [];
            } else {
                // Fallback: get from localStorage
                const projects = JSON.parse(localStorage.getItem('manga-studio-projects') || '[]');
                return projects;
            }
        } catch (error) {
            console.error('Error getting projects:', error);
            return [];
        }
    }, []);

    /**
     * Load a project and open editor
     */
    const loadProject = useCallback(async (projectPath) => {
        try {
            let projectData;

            if (window.electronAPI?.loadProject) {
                const result = await window.electronAPI.loadProject(projectPath);
                if (!result.success) {
                    console.error('Failed to load project:', result.error);
                    return null;
                }
                projectData = result.project;
            } else {
                // Fallback: find in localStorage
                const projects = JSON.parse(localStorage.getItem('manga-studio-projects') || '[]');
                projectData = projects.find(p => p.id === projectPath || p.path === projectPath);
            }

            if (projectData) {
                // Store for Canvas to pick up
                window.pendingProjectData = projectData;
                setCurrentPage('editor');
                return projectData;
            }

            return null;
        } catch (error) {
            console.error('Error loading project:', error);
            return null;
        }
    }, [setCurrentPage]);

    /**
     * Delete a project
     */
    const deleteProject = useCallback(async (projectPath) => {
        try {
            if (window.electronAPI?.deleteProject) {
                const result = await window.electronAPI.deleteProject(projectPath);
                return result.success;
            } else {
                // Fallback: remove from localStorage
                const projects = JSON.parse(localStorage.getItem('manga-studio-projects') || '[]');
                const filtered = projects.filter(p => p.id !== projectPath && p.path !== projectPath);
                localStorage.setItem('manga-studio-projects', JSON.stringify(filtered));
                return true;
            }
        } catch (error) {
            console.error('Error deleting project:', error);
            return false;
        }
    }, []);

    return {
        saveProject,
        getProjects,
        loadProject,
        deleteProject
    };
}
