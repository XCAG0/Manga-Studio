/**
 * Text Detection Modal - App Consistent Design
 * Supports language, engine, image selection, and cleanup mode selection
 */

import React, { useEffect, useState } from 'react';
import {
    Globe,
    Cpu,
    X,
    Settings,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    ChevronUp,
    Image,
    Layers,
    Square,
    Wand2,
} from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import MagicCleanerSettings from '../MagicCleanerSettings/MagicCleanerSettings';
import { cloneMagicCleanerDefaults } from '../../utils/magicCleanerOptions';
import { DEFAULT_TEXT_EDIT_MODE, TEXT_EDIT_MODES } from '../../utils/textEditModes';
import './LanguageSelectModal.css';

const languages = [
    { code: 'korean', name: 'Korean', native: '한국어', type: 'Korean' },
    { code: 'japan', name: 'Japanese', native: '日本語', type: 'Japanese' },
    { code: 'ch', name: 'Chinese', native: '中文', type: 'Chinese' },
    { code: 'en', name: 'English', native: 'English', type: 'English' },
];

const engines = [
    { code: 'paddleocr', name: 'PaddleOCR', desc: 'More accurate', badge: '★' },
    { code: 'easyocr', name: 'EasyOCR', desc: 'Faster', badge: '' },
];

const editTypes = [
    {
        code: TEXT_EDIT_MODES.WHITE_BB,
        name: 'Clean As White BB',
        desc: 'For white BB only',
        icon: Square,
    },
    {
        code: TEXT_EDIT_MODES.MAGIC_CLEANER,
        name: 'Magic Cleaner',
        desc: 'For complex BB',
        icon: Wand2,
    },
];

function LanguageSelectModal({ isOpen, onSelect, onClose, actionMode = 'extract' }) {
    const [selectedLang, setSelectedLang] = useState('korean');
    const [selectedEngine, setSelectedEngine] = useState('paddleocr');
    const [selectedEditMode, setSelectedEditMode] = useState(DEFAULT_TEXT_EDIT_MODE);
    const [magicCleanerSettings, setMagicCleanerSettings] = useState(cloneMagicCleanerDefaults());
    const [showMagicSettings, setShowMagicSettings] = useState(false);
    const [images, setImages] = useState([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [doForAll, setDoForAll] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const canvas = useEditorStore.getState().canvas;
        if (!canvas) {
            return;
        }

        const canvasImages = canvas.getObjects().filter(obj => obj.type === 'image');
        const imageData = canvasImages.map((img, idx) => ({
            id: idx,
            name: `Image ${idx + 1}`,
            thumbnail: img.toDataURL({ format: 'png', quality: 0.3, multiplier: 0.1 }),
            width: img.width,
            height: img.height,
            top: img.top,
        }));

        setImages(imageData);
        setCurrentImageIndex(0);
        setDoForAll(imageData.length === 1);
        setSelectedEditMode(DEFAULT_TEXT_EDIT_MODE);
        setMagicCleanerSettings(cloneMagicCleanerDefaults());
        setShowMagicSettings(false);
    }, [isOpen]);

    if (!isOpen) {
        return null;
    }

    const handleStart = () => {
        const selectedImages = doForAll ? images.map(img => img.id) : [currentImageIndex];
        onSelect(
            selectedLang,
            'cpu',
            selectedEngine,
            selectedImages,
            selectedEditMode,
            magicCleanerSettings
        );
    };

    const nextImage = () => {
        setCurrentImageIndex(prev => (prev + 1) % images.length);
    };

    const prevImage = () => {
        setCurrentImageIndex(prev => (prev - 1 + images.length) % images.length);
    };

    const currentImage = images[currentImageIndex];

    return (
        <div className="detect-modal-overlay" onClick={onClose}>
            <div className="detect-modal detect-modal-wide" onClick={e => e.stopPropagation()}>
                <div className="detect-modal-header">
                    <span>{actionMode === 'whiten' ? 'Clean Bubbles' : 'Text Detection'}</span>
                    <button className="detect-close" onClick={onClose}>
                        <X size={14} />
                    </button>
                </div>

                <div className="detect-modal-body">
                    {images.length > 0 && (
                        <div className="detect-section">
                            <label className="detect-label">
                                <Image size={12} />
                                Target Image
                            </label>

                            <div className="detect-doforall">
                                <label className="doforall-label">
                                    <input
                                        type="checkbox"
                                        checked={doForAll}
                                        onChange={e => setDoForAll(e.target.checked)}
                                    />
                                    <Layers size={14} />
                                    <span>Do For All ({images.length} images)</span>
                                </label>
                            </div>

                            {!doForAll && images.length > 1 && (
                                <div className="image-carousel">
                                    <button className="carousel-btn" onClick={prevImage}>
                                        <ChevronLeft size={18} />
                                    </button>

                                    <div className="carousel-content">
                                        {currentImage && (
                                            <>
                                                <div className="carousel-thumbnail">
                                                    <img src={currentImage.thumbnail} alt={currentImage.name} />
                                                </div>
                                                <div className="carousel-info">
                                                    <span className="carousel-name">{currentImage.name}</span>
                                                    <span className="carousel-size">
                                                        {currentImage.width}×{currentImage.height}
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <button className="carousel-btn" onClick={nextImage}>
                                        <ChevronRight size={18} />
                                    </button>
                                </div>
                            )}

                            {!doForAll && images.length === 1 && currentImage && (
                                <div className="single-image-info">
                                    <div className="carousel-thumbnail">
                                        <img src={currentImage.thumbnail} alt={currentImage.name} />
                                    </div>
                                    <div className="carousel-info">
                                        <span className="carousel-name">{currentImage.name}</span>
                                        <span className="carousel-size">
                                            {currentImage.width}×{currentImage.height}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {!doForAll && images.length > 1 && (
                                <div className="carousel-dots">
                                    {images.map((_, idx) => (
                                        <button
                                            key={idx}
                                            className={`carousel-dot ${idx === currentImageIndex ? 'active' : ''}`}
                                            onClick={() => setCurrentImageIndex(idx)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="detect-section">
                        <label className="detect-label">
                            <Globe size={12} />
                            Source Language
                        </label>
                        <div className="detect-lang-grid">
                            {languages.map(lang => (
                                <button
                                    key={lang.code}
                                    className={`detect-lang-btn ${selectedLang === lang.code ? 'active' : ''}`}
                                    onClick={() => setSelectedLang(lang.code)}
                                >
                                    <span className="lang-native">{lang.native}</span>
                                    <span className="lang-type">{lang.type}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="detect-section">
                        <label className="detect-label">
                            <Settings size={12} />
                            OCR Engine
                        </label>
                        <div className="detect-mode-row">
                            {engines.map(engine => (
                                <button
                                    key={engine.code}
                                    className={`detect-mode-btn ${selectedEngine === engine.code ? 'active' : ''}`}
                                    onClick={() => setSelectedEngine(engine.code)}
                                >
                                    <Cpu size={14} />
                                    <div className="mode-info">
                                        <span className="mode-name">
                                            {engine.name}
                                            {engine.badge && <span className="engine-badge">{engine.badge}</span>}
                                        </span>
                                        <span className="mode-speed">{engine.desc}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {actionMode === 'whiten' && (
                        <>
                            <div className="detect-section">
                                <label className="detect-label">
                                    <Settings size={12} />
                                    Edit Type
                                </label>
                                <div className="detect-mode-row">
                                    {editTypes.map(editType => {
                                        const Icon = editType.icon;
                                        return (
                                            <button
                                                key={editType.code}
                                                className={`detect-mode-btn ${selectedEditMode === editType.code ? 'active' : ''}`}
                                                onClick={() => {
                                                    setSelectedEditMode(editType.code);
                                                    if (editType.code !== TEXT_EDIT_MODES.MAGIC_CLEANER) {
                                                        setShowMagicSettings(false);
                                                    }
                                                }}
                                            >
                                                <Icon size={14} />
                                                <div className="mode-info">
                                                    <span className="mode-name">{editType.name}</span>
                                                    <span className="mode-speed">{editType.desc}</span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {selectedEditMode === TEXT_EDIT_MODES.MAGIC_CLEANER && (
                                <>
                                    <div className="detect-section">
                                        <button
                                            type="button"
                                            className="magic-settings-toggle"
                                            onClick={() => setShowMagicSettings(prev => !prev)}
                                        >
                                            {showMagicSettings ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            <span>{showMagicSettings ? 'Hide Settings' : 'Show Settings'}</span>
                                        </button>
                                    </div>

                                    {showMagicSettings && (
                                        <MagicCleanerSettings
                                            value={magicCleanerSettings}
                                            onChange={setMagicCleanerSettings}
                                        />
                                    )}
                                </>
                            )}
                        </>
                    )}
                </div>

                <div className="detect-modal-footer">
                    <button className="detect-btn cancel" onClick={onClose}>
                        Cancel
                    </button>
                    <button className="detect-btn primary" onClick={handleStart}>
                        {doForAll
                            ? `${actionMode === 'whiten' ? 'Clean' : 'Process'} All (${images.length})`
                            : actionMode === 'whiten'
                                ? 'Start Cleaning'
                                : 'Start Detection'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default LanguageSelectModal;
