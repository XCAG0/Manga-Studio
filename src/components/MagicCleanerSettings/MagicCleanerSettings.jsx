import React from 'react';
import { RefreshCcw, SlidersHorizontal } from 'lucide-react';
import {
    cloneMagicCleanerDefaults,
    MAGIC_INPAINT_ENGINES,
    MAGIC_MASK_MODES,
} from '../../utils/magicCleanerOptions';

const MASK_MODE_OPTIONS = [
    {
        value: MAGIC_MASK_MODES.HYBRID,
        label: 'Hybrid Mask',
        description: 'Use line boxes first, then bubble area if needed',
    },
    {
        value: MAGIC_MASK_MODES.LINE_BOXES,
        label: 'Precise Lines',
        description: 'Protect bubble art and target text lines tightly',
    },
    {
        value: MAGIC_MASK_MODES.BUBBLE_BBOX,
        label: 'Full Bubble',
        description: 'Use the entire detected bubble box as the mask',
    },
];

const ENGINE_OPTIONS = [
    {
        value: MAGIC_INPAINT_ENGINES.AUTO,
        label: 'Auto',
        description: 'Prefer LaMa, fallback to OpenCV if needed',
    },
    {
        value: MAGIC_INPAINT_ENGINES.LAMA,
        label: 'LaMa',
        description: 'Best for complex colored or textured bubbles',
    },
    {
        value: MAGIC_INPAINT_ENGINES.OPENCV,
        label: 'OpenCV',
        description: 'Faster fallback for small and simple cleanup',
    },
];

const RANGE_FIELDS = [
    {
        key: 'padding',
        label: 'Context Padding',
        description: 'Extra outer area around the bubble sent to the cleaner',
        min: 1,
        max: 50,
        step: 1,
    },
    {
        key: 'maskExpandX',
        label: 'Mask Expand X',
        description: 'Horizontal growth around detected text lines',
        min: 0,
        max: 24,
        step: 1,
    },
    {
        key: 'maskExpandY',
        label: 'Mask Expand Y',
        description: 'Vertical growth around detected text lines',
        min: 0,
        max: 24,
        step: 1,
    },
    {
        key: 'dilateKernel',
        label: 'Mask Edge Width',
        description: 'Kernel size for smoothing and growing the mask',
        min: 1,
        max: 15,
        step: 2,
    },
    {
        key: 'dilateIterations',
        label: 'Mask Growth Passes',
        description: 'How many times the mask expands after creation',
        min: 0,
        max: 6,
        step: 1,
    },
    {
        key: 'opencvRadius',
        label: 'OpenCV Radius',
        description: 'Strength of the OpenCV inpaint fallback',
        min: 1,
        max: 12,
        step: 1,
    },
];

function clampFieldValue(key, value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return cloneMagicCleanerDefaults()[key];
    }

    switch (key) {
        case 'padding':
            return Math.max(1, Math.min(50, Math.round(numericValue)));
        case 'maskExpandX':
        case 'maskExpandY':
            return Math.max(0, Math.min(24, Math.round(numericValue)));
        case 'dilateKernel': {
            const clamped = Math.max(1, Math.min(15, Math.round(numericValue)));
            return clamped % 2 === 0 ? clamped + 1 : clamped;
        }
        case 'dilateIterations':
            return Math.max(0, Math.min(6, Math.round(numericValue)));
        case 'opencvRadius':
            return Math.max(1, Math.min(12, Math.round(numericValue)));
        default:
            return numericValue;
    }
}

function MagicCleanerSettings({ value, onChange }) {
    const settings = {
        ...cloneMagicCleanerDefaults(),
        ...(value || {}),
    };

    const updateField = (key, fieldValue) => {
        onChange({
            ...settings,
            [key]: clampFieldValue(key, fieldValue),
        });
    };

    const updateChoice = (key, choice) => {
        onChange({
            ...settings,
            [key]: choice,
        });
    };

    return (
        <div className="detect-section">
            <div className="magic-cleaner-header">
                <label className="detect-label" style={{ marginBottom: 0 }}>
                    <SlidersHorizontal size={12} />
                    Magic Cleaner Settings
                </label>
                <button
                    type="button"
                    className="magic-cleaner-reset"
                    onClick={() => onChange(cloneMagicCleanerDefaults())}
                >
                    <RefreshCcw size={12} />
                    Reset
                </button>
            </div>

            <p className="magic-cleaner-note">
                Tune the mask and cleanup behavior for difficult colored or detailed bubbles.
            </p>

            <div className="magic-cleaner-group">
                <div className="magic-cleaner-subtitle">Mask Source</div>
                <div className="magic-choice-grid">
                    {MASK_MODE_OPTIONS.map(option => (
                        <button
                            key={option.value}
                            type="button"
                            className={`magic-choice-btn ${settings.maskMode === option.value ? 'active' : ''}`}
                            onClick={() => updateChoice('maskMode', option.value)}
                        >
                            <span className="magic-choice-title">{option.label}</span>
                            <span className="magic-choice-desc">{option.description}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="magic-cleaner-group">
                <div className="magic-cleaner-subtitle">Inpaint Engine</div>
                <div className="magic-choice-grid">
                    {ENGINE_OPTIONS.map(option => (
                        <button
                            key={option.value}
                            type="button"
                            className={`magic-choice-btn ${settings.inpaintEngine === option.value ? 'active' : ''}`}
                            onClick={() => updateChoice('inpaintEngine', option.value)}
                        >
                            <span className="magic-choice-title">{option.label}</span>
                            <span className="magic-choice-desc">{option.description}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="magic-range-grid">
                {RANGE_FIELDS.map(field => (
                    <div key={field.key} className="magic-range-card">
                        <div className="magic-range-top">
                            <div>
                                <div className="magic-range-label">{field.label}</div>
                                <div className="magic-range-desc">{field.description}</div>
                            </div>
                            <input
                                className="magic-range-number"
                                type="number"
                                min={field.min}
                                max={field.max}
                                step={field.step}
                                value={settings[field.key]}
                                onChange={event => updateField(field.key, event.target.value)}
                            />
                        </div>
                        <input
                            className="magic-range-slider"
                            type="range"
                            min={field.min}
                            max={field.max}
                            step={field.step}
                            value={settings[field.key]}
                            onChange={event => updateField(field.key, event.target.value)}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}

export default MagicCleanerSettings;
