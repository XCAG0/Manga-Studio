/**
 * Manga Studio - Home Page
 * Design matching reference: Left sidebar + Main content + Right sidebar
 */

import React, { useState, useEffect } from 'react';
import {
    Home,
    FolderOpen,
    PlusCircle,
    BookOpen,
    Users,
    ChevronDown,
    Image,
    User,
    Trash2,
    Search,
    Youtube,
    Brain,
    Globe,
    Brush,
    Sparkles,
    Layers,
    FileText,
    Settings,
    ZoomIn,
    Eraser,
    Save
} from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { getProjects, getFolders, loadProject, deleteProject, formatProjectDate } from '../../services/projectService';
import CommunityPage from './CommunityPage';
import logoImage from '../../images/logo.png';
import './HomePage.css';

// Comprehensive Tools Guide - CONCISE DESCRIPTIONS
const TOOLS_GUIDE = [
    {
        id: 1,
        title: 'AI Text Detection',
        description: 'Automatically detect and extract text from manga panels using advanced OCR. Supports PaddleOCR and EasyOCR engines with multi-language detection.'
    },
    {
        id: 2,
        title: 'Auto Translate',
        description: 'Translate detected text automatically with professional translation APIs. Supports Arabic, English, Japanese, Chinese, and RTL languages.'
    },
    {
        id: 3,
        title: 'Brush & Drawing Tools',
        description: 'Professional brush with pressure sensitivity, customizable size (1-100px), opacity control, and smooth anti-aliased strokes.'
    },
    {
        id: 4,
        title: 'Clone & Healing Tools',
        description: 'Seamlessly remove text and unwanted elements. Clone tool copies pixels, Healing tool intelligently blends content with surroundings.'
    },
    {
        id: 5,
        title: 'Layers System',
        description: 'Non-destructive editing with unlimited layers. Show/hide, lock, adjust opacity, and reorder layers easily in the layers panel.'
    },
    {
        id: 6,
        title: 'Text Manager',
        description: 'Manage all translations in one place. Quick-edit capabilities, bulk operations, search/filter, and export functionality.'
    },
    {
        id: 7,
        title: 'Properties Panel',
        description: 'Fine-tune selected elements with comprehensive property controls. Adjust position, dimensions, colors, fonts, and effects in real-time.'
    },
    {
        id: 8,
        title: 'Pan & Zoom Tools',
        description: 'Navigate large manga pages easily. Pan with Space key, zoom up to 400%, smooth scrolling, and keyboard shortcuts for quick levels.'
    },
    {
        id: 9,
        title: 'Eraser Tool',
        description: 'Precisely remove content on active layer. Adjustable sizes, opacity control, smooth anti-aliased edges, and full undo/redo support.'
    },
    {
        id: 10,
        title: 'Save & Export',
        description: 'Save as .msp projects with full layer data, or export as PNG for publishing. Auto-save, version history, and thumbnail previews.'
    }
];

// Navigation items
const NAV_ITEMS = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'create', icon: PlusCircle, label: 'Create New' },
    { id: 'learn', icon: BookOpen, label: 'Learn' },
    { id: 'community', icon: Users, label: 'Community' },
];

function HomePage() {
    const { setCurrentPage } = useEditorStore();
    const [recentProjects, setRecentProjects] = useState([]);
    const [activeNav, setActiveNav] = useState('home');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [showCommunity, setShowCommunity] = useState(false);

    // Load saved projects on mount
    useEffect(() => {
        const loadSavedProjects = async () => {
            setLoading(true);
            try {
                const projects = await getProjects();
                setRecentProjects(projects.map(p => ({
                    ...p,
                    date: formatProjectDate(p.updatedAt || p.createdAt)
                })));
            } catch (error) {
                console.error('Failed to load projects:', error);
            }
            setLoading(false);
        };

        loadSavedProjects();
    }, []);

    // Close handler is now in App.jsx (global)

    const handleStartProject = () => {
        window.pendingProjectData = null; // Clear any pending project
        setCurrentPage('editor');
    };

    const handleNavClick = (navId) => {
        setActiveNav(navId);

        // Handle external links
        if (navId === 'learn') {
            openExternalLink('https://mangastudio.space');
            return;
        }

        if (navId === 'community') {
            setShowCommunity(true);
            return;
        }

        if (navId === 'create') {
            handleStartProject();
        }
    };

    const openExternalLink = (url) => {
        if (window.electronAPI?.openExternal) {
            window.electronAPI.openExternal(url);
        } else {
            window.location.href = url;
        }
    };

    // Show Community Page
    if (showCommunity) {
        return <CommunityPage onBack={() => {
            setShowCommunity(false);
            setActiveNav('home');
        }} />;
    }

    const handleProjectClick = async (project) => {
        console.log('[HomePage] Loading project:', project.name);
        const result = await loadProject(project.path || project.id);
        if (result.success) {
            window.pendingProjectData = result.project;
            setCurrentPage('editor');
        } else {
            console.error('[HomePage] Failed to load project:', result.error);
        }
    };

    const handleDeleteProject = async (e, project) => {
        e.stopPropagation();
        if (confirm(`Delete "${project.name}"?`)) {
            const success = await deleteProject(project.path || project.id);
            if (success) {
                setRecentProjects(prev => prev.filter(p => p.id !== project.id));
            }
        }
    };

    return (
        <div className="home-container">
            {/* Left Sidebar */}
            <aside className="home-sidebar">
                <div className="sidebar-header">
                    <div className="app-logo">
                        <img src={logoImage} alt="Manga Studio" className="logo-icon" />
                        <span className="logo-text">Manga Studio</span>
                    </div>
                </div>

                <div className="user-profile">
                    <div className="user-avatar">
                        <User size={20} />
                    </div>
                    <div className="user-info">
                        <span className="user-name">USER</span>
                        <span className="user-role">Not Login</span>
                    </div>
                    <ChevronDown size={16} className="user-dropdown" />
                </div>

                <nav className="sidebar-nav">
                    {NAV_ITEMS.map((item) => (
                        <button
                            key={item.id}
                            className={`nav-item ${activeNav === item.id ? 'active' : ''}`}
                            onClick={() => handleNavClick(item.id)}
                        >
                            <item.icon size={18} />
                            <span>{item.label}</span>
                        </button>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    {/* YouTube Channel */}
                    <button
                        className="settings-btn"
                        onClick={() => openExternalLink('https://www.youtube.com/@xa9c')}
                    >
                        <Youtube size={18} />
                        <span>YouTube</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="home-main">
                <header className="main-header">
                    <h1 className="page-title">Home</h1>
                </header>

                {/* Welcome Banner */}
                <div className="welcome-banner">
                    <div className="welcome-content">
                        <h2>Welcome to Manga Studio!</h2>
                        <p>Welcome to lie your new pevips into desktop application!</p>
                        <button className="btn-start" onClick={handleStartProject}>
                            Start a New Project
                        </button>
                    </div>
                    <div className="welcome-illustration">
                        <div className="illustration-placeholder">
                            <svg width="180" height="140" viewBox="0 0 180 140">
                                {/* Person at desk illustration */}
                                <circle cx="100" cy="50" r="25" fill="#f5a623" />
                                <rect x="80" y="75" width="40" height="50" rx="5" fill="#f5a623" />
                                <rect x="40" y="100" width="100" height="30" rx="3" fill="#4a4a6a" />
                                <rect x="50" y="80" width="80" height="25" rx="3" fill="#3a3a5a" />
                                {/* Bubbles */}
                                <ellipse cx="150" cy="30" rx="25" ry="15" fill="#f5a623" opacity="0.8" />
                                <ellipse cx="140" cy="55" rx="20" ry="12" fill="#f5a623" opacity="0.6" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Recent Projects */}
                <section className="recent-section">
                    <h3 className="section-title">Recent Projects</h3>
                    {loading ? (
                        <p className="loading-text">Loading projects...</p>
                    ) : recentProjects.length === 0 ? (
                        <div className="empty-projects">
                            <Image size={48} />
                            <p>No saved projects yet</p>
                            <span>Start a new project to see it here</span>
                        </div>
                    ) : (
                        <div className="projects-grid">
                            {recentProjects.map((project) => (
                                <button
                                    key={project.id}
                                    className="project-card"
                                    onClick={() => handleProjectClick(project)}
                                >
                                    <div className="project-thumbnail">
                                        {project.thumbnail ? (
                                            <img src={project.thumbnail} alt={project.name} />
                                        ) : (
                                            <div className="thumbnail-placeholder">
                                                <Image size={32} />
                                            </div>
                                        )}
                                        <button
                                            className="delete-btn"
                                            onClick={(e) => handleDeleteProject(e, project)}
                                            title="Delete project"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    <div className="project-info">
                                        <span className="project-name">{project.name}</span>
                                        <span className="project-date">{project.date}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </section>
            </main>

            {/* Right Sidebar */}
            <aside className="home-right-sidebar">
                {/* Search */}
                <div className="search-box">
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder="Search tools..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Tools Guide */}
                <div className="sidebar-section">
                    <h3 className="section-title">Tools & Features Guide</h3>

                    <div className="tools-guide-list">
                        {TOOLS_GUIDE
                            .filter(tool =>
                                searchQuery === '' ||
                                tool.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                tool.description.toLowerCase().includes(searchQuery.toLowerCase())
                            )
                            .map(tool => (
                                <div key={tool.id} className="tool-guide-card">
                                    <h4 className="tool-title">{tool.title}</h4>
                                    <p className="tool-description">{tool.description}</p>
                                </div>
                            ))
                        }

                        {TOOLS_GUIDE.filter(tool =>
                            searchQuery === '' ||
                            tool.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            tool.description.toLowerCase().includes(searchQuery.toLowerCase())
                        ).length === 0 && (
                                <p style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: '2rem 0' }}>
                                    No tools found
                                </p>
                            )}
                    </div>
                </div>
            </aside>
        </div >
    );
}

export default HomePage;
