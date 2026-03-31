import React from 'react';
import { Youtube, MessageCircle, Home, FolderOpen, PlusCircle, BookOpen, Users, ChevronDown, Image, User, Search } from 'lucide-react';
import logoImage from '../../images/logo.png';
import './HomePage.css';

// Navigation items
const NAV_ITEMS = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'create', icon: PlusCircle, label: 'Create New' },
    { id: 'learn', icon: BookOpen, label: 'Learn' },
    { id: 'community', icon: Users, label: 'Community' },
];

// Tools Guide - IMPORTED from same source as HomePage
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

function CommunityPage({ onBack }) {
    const [searchQuery, setSearchQuery] = React.useState('');
    const openExternalLink = (url) => {
        if (window.electronAPI?.openExternal) {
            window.electronAPI.openExternal(url);
        } else {
            window.location.href = url;
        }
    };

    return (
        <div className="home-container">
            {/* Left Sidebar - EXACTLY like HomePage */}
            <aside className="home-sidebar">
                {/* Logo - ADDED */}
                <div className="sidebar-header">
                    <div className="app-logo">
                        <img src={logoImage} alt="Manga Studio" className="logo-icon" />
                        <span className="logo-text">Manga Studio</span>
                    </div>
                </div>

                {/* User Profile */}
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
                    {NAV_ITEMS.map((item) => {
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.id}
                                className={`nav-item ${item.active ? 'active' : ''}`}
                                onClick={() => item.id === 'community' ? null : onBack()}
                            >
                                <Icon size={18} />
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </nav>

                <div className="sidebar-footer">
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
                <div className="community-hero">
                    <h1>Join Our Community</h1>
                    <p>Connect with us and other manga editors</p>
                </div>

                <div className="community-cards-grid">
                    {/* YouTube Card */}
                    <div className="community-link-card">
                        <div className="card-icon-wrapper youtube-icon">
                            <Youtube size={36} />
                        </div>
                        <h3>YouTube Channel</h3>
                        <p>Watch tutorials, tips, and updates</p>
                        <button
                            className="card-action-btn youtube-action"
                            onClick={() => openExternalLink('https://www.youtube.com/@xa9c')}
                        >
                            Visit Channel
                        </button>
                    </div>

                    {/* Discord Card */}
                    <div className="community-link-card">
                        <div className="card-icon-wrapper discord-icon">
                            <MessageCircle size={36} />
                        </div>
                        <h3>Discord Server</h3>
                        <p>Chat with the community and get support</p>
                        <button
                            className="card-action-btn discord-action"
                            onClick={() => openExternalLink('https://discord.gg/9eRvV5WMsg')}
                        >
                            Join Server
                        </button>
                    </div>
                </div>
            </main>

            {/* Right Sidebar - SAME AS HomePage */}
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
        </div>
    );
}

export default CommunityPage;
