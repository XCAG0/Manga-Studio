/**
 * Project Name Modal
 * Modal for creating new projects with folder selection
 */

import React, { useState, useEffect } from 'react';
import { X, FolderPlus, Folder } from 'lucide-react';
import { createFolder, getFolders } from '../../services/projectService';
import './ProjectNameModal.css';

function ProjectNameModal({ isOpen, onClose, onSubmit }) {
    const [projectName, setProjectName] = useState('');
    const [selectedFolder, setSelectedFolder] = useState('_default');
    const [folders, setFolders] = useState([]);
    const [showNewFolderInput, setShowNewFolderInput] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Load folders on mount
    useEffect(() => {
        if (isOpen) {
            loadFolders();
            setProjectName('');
            setSelectedFolder('_default');
            setError('');
        }
    }, [isOpen]);

    const loadFolders = async () => {
        try {
            const folderList = await getFolders();
            setFolders(folderList);
        } catch (err) {
            console.error('Failed to load folders:', err);
        }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) {
            setError('Folder name cannot be empty');
            return;
        }

        if (folders.some(f => f.name === newFolderName)) {
            setError('Folder already exists');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const result = await createFolder(newFolderName);
            if (result.success) {
                await loadFolders();
                setSelectedFolder(newFolderName);
                setShowNewFolderInput(false);
                setNewFolderName('');
            } else {
                setError(result.error || 'Failed to create folder');
            }
        } catch (err) {
            setError('Failed to create folder');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!projectName.trim()) {
            setError('Project name cannot be empty');
            return;
        }

        onSubmit({
            projectName: projectName.trim(),
            folderName: selectedFolder
        });

        // Reset form
        setProjectName('');
        setSelectedFolder('_default');
        setError('');
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content project-name-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="modal-header">
                    <h2>Create New Project</h2>
                    <button className="btn-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="modal-body">
                    {/* Project Name */}
                    <div className="form-group">
                        <label htmlFor="projectName">Project Name</label>
                        <input
                            id="projectName"
                            type="text"
                            className="form-input"
                            placeholder="Enter project name..."
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                            autoFocus
                        />
                    </div>

                    {/* Folder Selection */}
                    <div className="form-group">
                        <label htmlFor="folder">Folder</label>
                        <select
                            id="folder"
                            className="form-select"
                            value={showNewFolderInput ? '__new__' : selectedFolder}
                            onChange={(e) => {
                                if (e.target.value === '__new__') {
                                    setShowNewFolderInput(true);
                                } else {
                                    setShowNewFolderInput(false);
                                    setSelectedFolder(e.target.value);
                                }
                            }}
                        >
                            {folders.map(folder => (
                                <option key={folder.name} value={folder.name}>
                                    {folder.name === '_default' ? 'Default' : folder.name} ({folder.projectCount} projects)
                                </option>
                            ))}
                            <option value="__new__">+ Create New Folder</option>
                        </select>
                    </div>

                    {/* New Folder Input */}
                    {showNewFolderInput && (
                        <div className="form-group new-folder-group">
                            <div className="input-with-button">
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="New folder name..."
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleCreateFolder();
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    className="btn-create-folder"
                                    onClick={handleCreateFolder}
                                    disabled={isLoading}
                                >
                                    <FolderPlus size={18} />
                                    {isLoading ? 'Creating...' : 'Create'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="error-message">
                            {error}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="modal-actions">
                        <button type="button" className="btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-primary" disabled={isLoading}>
                            <Folder size={18} />
                            Create Project
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default ProjectNameModal;
