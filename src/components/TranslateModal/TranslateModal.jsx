/**
 * Auto Translate Modal
 * Modal for OCR + translation with configurable cleanup mode
 */

import React, { useEffect, useState } from 'react';
import {
    Globe,
    Type,
    Settings,
    Image,
    Layers,
    Cpu,
    X,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    ChevronUp,
    Square,
    Wand2,
} from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { useSystemFonts } from '../../hooks/useSystemFonts';
import MagicCleanerSettings from '../MagicCleanerSettings/MagicCleanerSettings';
import { cloneMagicCleanerDefaults } from '../../utils/magicCleanerOptions';
import { DEFAULT_TEXT_EDIT_MODE, TEXT_EDIT_MODES } from '../../utils/textEditModes';
import '../LanguageSelectModal/LanguageSelectModal.css';

const SOURCE_LANGUAGES = [
    { code: 'korean', name: 'Korean', native: '한국어' },
    { code: 'japan', name: 'Japanese', native: '日本語' },
    { code: 'ch', name: 'Chinese', native: '中文' },
    { code: 'en', name: 'English', native: 'English' },
];

const TARGET_LANGUAGES = [
    { code: 'en', name: 'English', native: 'English' },
    { code: 'ar', name: 'Arabic', native: 'العربية' },
    { code: 'es', name: 'Spanish', native: 'Español' },
    { code: 'fr', name: 'French', native: 'Français' },
    { code: 'de', name: 'German', native: 'Deutsch' },
    { code: 'ru', name: 'Russian', native: 'Русский' },
    { code: 'pt', name: 'Portuguese', native: 'Português' },
];

const ENGINES = [
    { code: 'paddleocr', name: 'PaddleOCR', desc: 'More accurate', badge: '★' },
    { code: 'easyocr', name: 'EasyOCR', desc: 'Faster', badge: '' },
];

const EDIT_TYPES = [
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

function TranslateModal({ isOpen, onTranslate, onClose }) {
    const [sourceLang, setSourceLang] = useState('japan');
    const [targetLang, setTargetLang] = useState('en');
    const [selectedFont, setSelectedFont] = useState('Arial');
    const [engine, setEngine] = useState('paddleocr');
    const [editMode, setEditMode] = useState(DEFAULT_TEXT_EDIT_MODE);
    const [magicCleanerSettings, setMagicCleanerSettings] = useState(cloneMagicCleanerDefaults());
    const [showMagicSettings, setShowMagicSettings] = useState(false);
    const [images, setImages] = useState([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [doForAll, setDoForAll] = useState(false);
    const [useBold, setUseBold] = useState(true);

    const { fonts, isLoading: fontsLoading } = useSystemFonts();

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
        setEditMode(DEFAULT_TEXT_EDIT_MODE);
        setMagicCleanerSettings(cloneMagicCleanerDefaults());
        setShowMagicSettings(false);
    }, [isOpen]);

    if (!isOpen) {
        return null;
    }

    const handleStart = () => {
        const selectedImages = doForAll ? images.map(img => img.id) : [currentImageIndex];

        onTranslate({
            sourceLang,
            targetLang,
            font: selectedFont,
            engine,
            images: selectedImages,
            useBold,
            editMode,
            magicCleanerSettings,
        });
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
                    <span>Auto Translate</span>
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
                            {SOURCE_LANGUAGES.map(lang => (
                                <button
                                    key={lang.code}
                                    className={`detect-lang-btn ${sourceLang === lang.code ? 'active' : ''}`}
                                    onClick={() => setSourceLang(lang.code)}
                                >
                                    <span className="lang-native">{lang.native}</span>
                                    <span className="lang-type">{lang.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="detect-section">
                        <label className="detect-label">
                            <Globe size={12} />
                            Translate To
                        </label>
                        <div className="detect-lang-grid">
                            {TARGET_LANGUAGES.map(lang => (
                                <button
                                    key={lang.code}
                                    className={`detect-lang-btn ${targetLang === lang.code ? 'active' : ''}`}
                                    onClick={() => setTargetLang(lang.code)}
                                >
                                    <span className="lang-native">{lang.native}</span>
                                    <span className="lang-type">{lang.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="detect-section">
                        <label className="detect-label">
                            <Type size={12} />
                            Font Family
                        </label>
                        <select
                            className="font-select"
                            value={selectedFont}
                            onChange={e => setSelectedFont(e.target.value)}
                            disabled={fontsLoading}
                        >
                            {fonts.map(font => (
                                <option key={font} value={font}>
                                    {font}
                                </option>
                            ))}
                        </select>
                        <div
                            className="font-preview"
                            style={{ fontFamily: selectedFont, fontWeight: useBold ? 'bold' : 'normal' }}
                        >
                            Preview: {targetLang === 'ar' ? 'مرحبا بك' : 'Hello World'}
                        </div>

                        <div className="detect-doforall" style={{ marginTop: '8px' }}>
                            <label className="doforall-label">
                                <input
                                    type="checkbox"
                                    checked={useBold}
                                    onChange={e => setUseBold(e.target.checked)}
                                />
                                <span
                                    style={{
                                        fontWeight: 'bold',
                                        fontSize: '16px',
                                        fontFamily: 'monospace',
                                        marginRight: '4px',
                                    }}
                                >
                                    B
                                </span>
                                <span>Use Bold Font</span>
                            </label>
                        </div>
                    </div>

                    <div className="detect-section">
                        <label className="detect-label">
                            <Settings size={12} />
                            Edit Type
                        </label>
                        <div className="detect-mode-row">
                            {EDIT_TYPES.map(option => {
                                const Icon = option.icon;
                                return (
                                    <button
                                        key={option.code}
                                        className={`detect-mode-btn ${editMode === option.code ? 'active' : ''}`}
                                        onClick={() => {
                                            setEditMode(option.code);
                                            if (option.code !== TEXT_EDIT_MODES.MAGIC_CLEANER) {
                                                setShowMagicSettings(false);
                                            }
                                        }}
                                    >
                                        <Icon size={14} />
                                        <div className="mode-info">
                                            <span className="mode-name">{option.name}</span>
                                            <span className="mode-speed">{option.desc}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {editMode === TEXT_EDIT_MODES.MAGIC_CLEANER && (
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

                    <div className="detect-section">
                        <label className="detect-label">
                            <Settings size={12} />
                            OCR Engine
                        </label>
                        <div className="detect-mode-row">
                            {ENGINES.map(eng => (
                                <button
                                    key={eng.code}
                                    className={`detect-mode-btn ${engine === eng.code ? 'active' : ''}`}
                                    onClick={() => setEngine(eng.code)}
                                >
                                    <Cpu size={14} />
                                    <div className="mode-info">
                                        <span className="mode-name">
                                            {eng.name}
                                            {eng.badge && <span className="engine-badge">{eng.badge}</span>}
                                        </span>
                                        <span className="mode-speed">{eng.desc}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="detect-modal-footer">
                    <button className="detect-btn cancel" onClick={onClose}>
                        Cancel
                    </button>
                    <button className="detect-btn primary" onClick={handleStart}>
                        {doForAll ? `Translate All (${images.length})` : 'Start Translation'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default TranslateModal;
