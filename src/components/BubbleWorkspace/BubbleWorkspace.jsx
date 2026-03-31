/**
 * Bubble Workshop - Professional Manga/Manhwa Speech Bubble Creator
 * 
 * Features:
 * - Multiple bubble types (Normal, Shouting, Thought, Whisper, Wavy, Narration, Explosion)
 * - Advanced fill system (Solid, Linear Gradient, Radial Gradient)
 * - Professional border styles (Solid, Dashed, Fuzzy, Spiky, Wavy)
 * - Effects (Shadow, Glow)
 * - Tail system with multiple directions and styles
 * - Corner decorations
 * - Preset library
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    X,
    RotateCcw,
    Save,
    MousePointer2,
    Square,
    Circle,
    Star,
    PenTool,
    Trash2,
    Copy,
    FlipHorizontal,
    FlipVertical,
    Minus,
    Plus,
    ChevronDown,
    ChevronRight,
    Palette,
    MessageCircle,
    Zap,
    Cloud,
    Volume2,
    MessageSquare,
    AlertCircle,
    Waves,
    Droplet,
    ArrowUp,
    ArrowDown,
    ArrowLeft,
    ArrowRight,
    CornerLeftDown,
    CornerRightDown,
    CornerLeftUp,
    CornerRightUp,
    Undo2,
    Redo2,
    Download
} from 'lucide-react';
import './BubbleWorkspace.css';

// ============================================
// BUBBLE TYPE DEFINITIONS
// ============================================
const BUBBLE_TYPES = [
    { id: 'normal', label: 'Normal', icon: MessageCircle, description: 'Standard speech bubble' },
    { id: 'shouting', label: 'Shouting', icon: Zap, description: 'Jagged edges for loud speech' },
    { id: 'thought', label: 'Thought', icon: Cloud, description: 'Cloud-like for thoughts' },
    { id: 'whisper', label: 'Whisper', icon: MessageSquare, description: 'Dashed border for quiet speech' },
    { id: 'wavy', label: 'Wavy', icon: Waves, description: 'Undulating for fear/weakness' },
    { id: 'narration', label: 'Narration', icon: Square, description: 'Rectangle for narrator' },
    { id: 'explosion', label: 'Explosion', icon: Volume2, description: 'Starburst for sounds' },
];

// ============================================
// FILL TYPES
// ============================================
const FILL_TYPES = [
    { id: 'solid', label: 'Solid Color' },
    { id: 'linear', label: 'Linear Gradient' },
    { id: 'radial', label: 'Radial Gradient' },
    { id: 'none', label: 'No Fill' },
];

// ============================================
// BORDER STYLES
// ============================================
const BORDER_STYLES = [
    { id: 'solid', label: 'Solid', preview: '───────' },
    { id: 'dashed', label: 'Dashed', preview: '- - - - -' },
    { id: 'dotted', label: 'Dotted', preview: '· · · · · ·' },
    { id: 'double', label: 'Double', preview: '═══════' },
];

// ============================================
// TAIL DIRECTIONS
// ============================================
const TAIL_DIRECTIONS = [
    { id: 'none', label: 'None', icon: X },
    { id: 'bottom', label: 'Bottom', icon: ArrowDown },
    { id: 'top', label: 'Top', icon: ArrowUp },
    { id: 'left', label: 'Left', icon: ArrowLeft },
    { id: 'right', label: 'Right', icon: ArrowRight },
    { id: 'bottom-left', label: 'Bottom Left', icon: CornerLeftDown },
    { id: 'bottom-right', label: 'Bottom Right', icon: CornerRightDown },
    { id: 'top-left', label: 'Top Left', icon: CornerLeftUp },
    { id: 'top-right', label: 'Top Right', icon: CornerRightUp },
];

// ============================================
// TAIL STYLES
// ============================================
const TAIL_STYLES = [
    { id: 'pointed', label: 'Pointed' },
    { id: 'curved', label: 'Curved' },
    { id: 'angular', label: 'Angular' },
    { id: 'thought', label: 'Thought Bubbles' },
];

// ============================================
// SVG BUBBLE GENERATORS
// ============================================
const BubbleGenerators = {
    // Normal oval bubble
    normal: (width, height, options = {}) => {
        const { tailDirection = 'none', tailPosition = 0.5, tailLength = 30, tailWidth = 20 } = options;
        const rx = width / 2;
        const ry = height / 2;
        const cx = rx;
        const cy = ry;

        let path = `M ${cx} 0 `;
        path += `C ${width} 0, ${width} ${height}, ${cx} ${height} `;

        // Add tail if needed
        if (tailDirection === 'bottom') {
            const tailX = width * tailPosition;
            path = `M ${cx} 0 `;
            path += `C ${width} 0, ${width} ${height}, ${tailX + tailWidth / 2} ${height} `;
            path += `L ${tailX} ${height + tailLength} `;
            path += `L ${tailX - tailWidth / 2} ${height} `;
            path += `C 0 ${height}, 0 0, ${cx} 0 Z`;
        } else if (tailDirection === 'top') {
            const tailX = width * tailPosition;
            path = `M ${tailX - tailWidth / 2} 0 `;
            path += `L ${tailX} ${-tailLength} `;
            path += `L ${tailX + tailWidth / 2} 0 `;
            path += `C ${width} 0, ${width} ${height}, ${cx} ${height} `;
            path += `C 0 ${height}, 0 0, ${tailX - tailWidth / 2} 0 Z`;
        } else if (tailDirection === 'left') {
            const tailY = height * tailPosition;
            path = `M ${cx} 0 `;
            path += `C ${width} 0, ${width} ${height}, ${cx} ${height} `;
            path += `C 0 ${height}, 0 ${tailY + tailWidth / 2}, 0 ${tailY + tailWidth / 2} `;
            path += `L ${-tailLength} ${tailY} `;
            path += `L 0 ${tailY - tailWidth / 2} `;
            path += `C 0 0, 0 0, ${cx} 0 Z`;
        } else if (tailDirection === 'right') {
            const tailY = height * tailPosition;
            path = `M ${cx} 0 `;
            path += `C ${width} 0, ${width} ${tailY - tailWidth / 2}, ${width} ${tailY - tailWidth / 2} `;
            path += `L ${width + tailLength} ${tailY} `;
            path += `L ${width} ${tailY + tailWidth / 2} `;
            path += `C ${width} ${height}, 0 ${height}, ${cx} ${height} `;
            path += `C 0 ${height}, 0 0, ${cx} 0 Z`;
        } else {
            path += `C 0 ${height}, 0 0, ${cx} 0 Z`;
        }

        return {
            path, width: tailDirection === 'left' ? width + tailLength : (tailDirection === 'right' ? width + tailLength : width),
            height: tailDirection === 'top' ? height + tailLength : (tailDirection === 'bottom' ? height + tailLength : height)
        };
    },

    // Shouting/Jagged bubble
    shouting: (width, height, options = {}) => {
        const { spikes = 12, spikeDepth = 15 } = options;
        const cx = width / 2;
        const cy = height / 2;
        const rx = (width / 2) - spikeDepth;
        const ry = (height / 2) - spikeDepth;

        let path = '';
        const points = [];

        for (let i = 0; i < spikes * 2; i++) {
            const angle = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
            const isSpike = i % 2 === 0;
            const r = isSpike ?
                { x: rx + spikeDepth + Math.random() * 5, y: ry + spikeDepth + Math.random() * 5 } :
                { x: rx - 5, y: ry - 5 };
            points.push({
                x: cx + r.x * Math.cos(angle),
                y: cy + r.y * Math.sin(angle)
            });
        }

        path = `M ${points[0].x} ${points[0].y} `;
        for (let i = 1; i < points.length; i++) {
            path += `L ${points[i].x} ${points[i].y} `;
        }
        path += 'Z';

        return { path, width, height };
    },

    // Thought bubble (cloud-like)
    thought: (width, height, options = {}) => {
        const { bumps = 8, tailDirection = 'bottom' } = options;
        const cx = width / 2;
        const cy = height / 2;
        const rx = width / 2 - 15;
        const ry = height / 2 - 15;

        let path = '';
        const points = [];

        for (let i = 0; i < bumps; i++) {
            const angle = (i / bumps) * Math.PI * 2;
            points.push({
                x: cx + rx * Math.cos(angle),
                y: cy + ry * Math.sin(angle)
            });
        }

        path = `M ${points[0].x} ${points[0].y} `;
        for (let i = 0; i < points.length; i++) {
            const curr = points[i];
            const next = points[(i + 1) % points.length];
            const midX = (curr.x + next.x) / 2;
            const midY = (curr.y + next.y) / 2;
            const bumpAngle = Math.atan2(midY - cy, midX - cx);
            const bumpSize = 18 + Math.random() * 8;
            const bumpX = midX + bumpSize * Math.cos(bumpAngle);
            const bumpY = midY + bumpSize * Math.sin(bumpAngle);
            path += `Q ${bumpX} ${bumpY} ${next.x} ${next.y} `;
        }
        path += 'Z';

        // Add thought trail circles
        let thoughtBubbles = [];
        if (tailDirection !== 'none') {
            const startX = tailDirection.includes('left') ? 30 : (tailDirection.includes('right') ? width - 30 : cx);
            const startY = tailDirection.includes('top') ? 10 : height - 10;
            const dirX = tailDirection.includes('left') ? -1 : (tailDirection.includes('right') ? 1 : 0);
            const dirY = tailDirection.includes('top') ? -1 : 1;

            thoughtBubbles = [
                { x: startX + dirX * 10, y: startY + dirY * 15, r: 8 },
                { x: startX + dirX * 25, y: startY + dirY * 30, r: 6 },
                { x: startX + dirX * 35, y: startY + dirY * 45, r: 4 },
            ];
        }

        return { path, width, height: height + 50, thoughtBubbles };
    },
    // Whisper bubble (dashed outline - handled via stroke-dasharray - add xcago - to dev tools - from f12 - )
    whisper: (width, height, options = {}) => {
        return BubbleGenerators.normal(width, height, options);
    },

    // Wavy bubble
    wavy: (width, height, options = {}) => {
        const { waves = 12, waveDepth = 8 } = options;
        const cx = width / 2;
        const cy = height / 2;
        const rx = width / 2 - waveDepth;
        const ry = height / 2 - waveDepth;

        let path = '';
        const points = [];
        const totalPoints = waves * 4;

        for (let i = 0; i < totalPoints; i++) {
            const angle = (i / totalPoints) * Math.PI * 2 - Math.PI / 2;
            const waveOffset = Math.sin(i * 0.8) * waveDepth;
            points.push({
                x: cx + (rx + waveOffset) * Math.cos(angle),
                y: cy + (ry + waveOffset) * Math.sin(angle)
            });
        }

        path = `M ${points[0].x} ${points[0].y} `;
        for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const cpX = (prev.x + curr.x) / 2;
            const cpY = (prev.y + curr.y) / 2;
            path += `Q ${prev.x} ${prev.y} ${cpX} ${cpY} `;
        }
        path += 'Z';

        return { path, width, height };
    },

    // Narration box
    narration: (width, height, options = {}) => {
        const { cornerRadius = 0 } = options;
        const r = Math.min(cornerRadius, width / 4, height / 4);

        let path;
        if (r > 0) {
            path = `M ${r} 0 L ${width - r} 0 Q ${width} 0 ${width} ${r} `;
            path += `L ${width} ${height - r} Q ${width} ${height} ${width - r} ${height} `;
            path += `L ${r} ${height} Q 0 ${height} 0 ${height - r} `;
            path += `L 0 ${r} Q 0 0 ${r} 0 Z`;
        } else {
            path = `M 0 0 L ${width} 0 L ${width} ${height} L 0 ${height} Z`;
        }

        return { path, width, height };
    },

    // Explosion/Starburst
    explosion: (width, height, options = {}) => {
        const { points: numPoints = 12, innerRadius = 0.5 } = options;
        const cx = width / 2;
        const cy = height / 2;
        const outerRx = width / 2 - 5;
        const outerRy = height / 2 - 5;
        const innerRx = outerRx * innerRadius;
        const innerRy = outerRy * innerRadius;

        let path = '';
        const allPoints = [];

        for (let i = 0; i < numPoints * 2; i++) {
            const angle = (i / (numPoints * 2)) * Math.PI * 2 - Math.PI / 2;
            const isOuter = i % 2 === 0;
            const rx = isOuter ? outerRx + (Math.random() - 0.5) * 10 : innerRx;
            const ry = isOuter ? outerRy + (Math.random() - 0.5) * 10 : innerRy;
            allPoints.push({
                x: cx + rx * Math.cos(angle),
                y: cy + ry * Math.sin(angle)
            });
        }

        path = `M ${allPoints[0].x} ${allPoints[0].y} `;
        for (let i = 1; i < allPoints.length; i++) {
            path += `L ${allPoints[i].x} ${allPoints[i].y} `;
        }
        path += 'Z';

        return { path, width, height };
    },
};

// ============================================
// GRADIENT HELPERS
// ============================================
const generateGradientCSS = (type, stops, angle = 90) => {
    const colorStops = stops.map(s => `${s.color} ${s.offset * 100}%`).join(', ');
    if (type === 'linear') {
        return `linear-gradient(${angle}deg, ${colorStops})`;
    } else if (type === 'radial') {
        return `radial-gradient(circle, ${colorStops})`;
    }
    return stops[0]?.color || '#ffffff';
};

const generateSVGGradient = (id, type, stops, angle = 90) => {
    if (type === 'linear') {
        const rad = (angle * Math.PI) / 180;
        const x2 = 50 + 50 * Math.cos(rad);
        const y2 = 50 + 50 * Math.sin(rad);
        return `
            <linearGradient id="${id}" x1="0%" y1="50%" x2="${x2}%" y2="${y2}%">
                ${stops.map(s => `<stop offset="${s.offset * 100}%" stop-color="${s.color}" />`).join('')}
            </linearGradient>
        `;
    } else if (type === 'radial') {
        return `
            <radialGradient id="${id}" cx="50%" cy="50%" r="50%">
                ${stops.map(s => `<stop offset="${s.offset * 100}%" stop-color="${s.color}" />`).join('')}
            </radialGradient>
        `;
    }
    return '';
};

// ============================================
// MAIN COMPONENT
// ============================================
function BubbleWorkspace({ isOpen, onClose, onSave }) {
    // Bubble configuration
    const [bubbleType, setBubbleType] = useState('normal');
    const [bubbleWidth, setBubbleWidth] = useState(280);
    const [bubbleHeight, setBubbleHeight] = useState(120);

    // Fill settings
    const [fillType, setFillType] = useState('solid');
    const [fillColor, setFillColor] = useState('#ffffff');
    const [gradientStops, setGradientStops] = useState([
        { offset: 0, color: '#ffffff' },
        { offset: 1, color: '#e0e0e0' }
    ]);
    const [gradientAngle, setGradientAngle] = useState(180);

    // Stroke settings
    const [strokeColor, setStrokeColor] = useState('#000000');
    const [strokeWidth, setStrokeWidth] = useState(3);
    const [strokeStyle, setStrokeStyle] = useState('solid');

    // Tail settings
    const [tailDirection, setTailDirection] = useState('bottom');
    const [tailStyle, setTailStyle] = useState('pointed');
    const [tailLength, setTailLength] = useState(35);
    const [tailPosition, setTailPosition] = useState(0.5);

    // Effects
    const [shadowEnabled, setShadowEnabled] = useState(false);
    const [shadowX, setShadowX] = useState(4);
    const [shadowY, setShadowY] = useState(4);
    const [shadowBlur, setShadowBlur] = useState(8);
    const [shadowColor, setShadowColor] = useState('#00000040');

    const [glowEnabled, setGlowEnabled] = useState(false);
    const [glowColor, setGlowColor] = useState('#ffff00');
    const [glowBlur, setGlowBlur] = useState(10);

    // Additional options
    const [cornerRadius, setCornerRadius] = useState(10);
    const [spikeCount, setSpikeCount] = useState(12);
    const [opacity, setOpacity] = useState(100);

    // UI state
    const [expandedSections, setExpandedSections] = useState({
        type: true,
        size: true,
        fill: true,
        stroke: true,
        tail: false,
        effects: false,
    });

    const svgRef = useRef(null);

    // Toggle section expansion
    const toggleSection = (section) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    // Generate current bubble
    const generateBubble = useCallback(() => {
        const generator = BubbleGenerators[bubbleType];
        if (!generator) return null;

        const options = {
            tailDirection: bubbleType === 'thought' ? tailDirection : (bubbleType !== 'narration' && bubbleType !== 'explosion' ? tailDirection : 'none'),
            tailPosition,
            tailLength,
            tailWidth: 25,
            cornerRadius,
            spikes: spikeCount,
            spikeDepth: 18,
            bumps: 10,
            waves: 16,
            waveDepth: 6,
            points: spikeCount,
            innerRadius: 0.4,
        };

        return generator(bubbleWidth, bubbleHeight, options);
    }, [bubbleType, bubbleWidth, bubbleHeight, tailDirection, tailPosition, tailLength, cornerRadius, spikeCount]);

    // Get stroke dash array
    const getStrokeDashArray = () => {
        switch (strokeStyle) {
            case 'dashed': return '12,6';
            case 'dotted': return '4,4';
            case 'double': return 'none';
            default: return 'none';
        }
    };

    // Get fill value for SVG
    const getFillValue = () => {
        if (fillType === 'none') return 'transparent';
        if (fillType === 'solid') return fillColor;
        return `url(#bubbleGradient)`;
    };

    // Generate filter ID
    const getFilterId = () => {
        if (shadowEnabled || glowEnabled) return 'url(#bubbleEffects)';
        return 'none';
    };

    // Export SVG
    const handleSave = () => {
        const bubble = generateBubble();
        if (!bubble) return;

        const gradientDef = (fillType === 'linear' || fillType === 'radial')
            ? generateSVGGradient('bubbleGradient', fillType, gradientStops, gradientAngle)
            : '';

        let filterDef = '';
        if (shadowEnabled || glowEnabled) {
            filterDef = `<filter id="bubbleEffects" x="-50%" y="-50%" width="200%" height="200%">`;
            if (shadowEnabled) {
                filterDef += `
                    <feDropShadow dx="${shadowX}" dy="${shadowY}" stdDeviation="${shadowBlur / 2}" flood-color="${shadowColor}" />
                `;
            }
            if (glowEnabled) {
                filterDef += `
                    <feGaussianBlur in="SourceAlpha" stdDeviation="${glowBlur / 2}" result="blur"/>
                    <feFlood flood-color="${glowColor}" result="color"/>
                    <feComposite in="color" in2="blur" operator="in" result="glow"/>
                    <feMerge>
                        <feMergeNode in="glow"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                `;
            }
            filterDef += `</filter>`;
        }

        const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${bubble.width + 20} ${bubble.height + 20}" width="${bubble.width + 20}" height="${bubble.height + 20}">
    <defs>
        ${gradientDef}
        ${filterDef}
    </defs>
    <g transform="translate(10, 10)">
        <path 
            d="${bubble.path}" 
            fill="${getFillValue()}" 
            stroke="${strokeColor}" 
            stroke-width="${strokeWidth}"
            stroke-dasharray="${getStrokeDashArray()}"
            opacity="${opacity / 100}"
            ${(shadowEnabled || glowEnabled) ? 'filter="url(#bubbleEffects)"' : ''}
        />
        ${bubble.thoughtBubbles ? bubble.thoughtBubbles.map((tb, i) =>
            `<circle cx="${tb.x}" cy="${tb.y}" r="${tb.r}" fill="${getFillValue()}" stroke="${strokeColor}" stroke-width="${strokeWidth * 0.7}"/>`
        ).join('') : ''}
    </g>
</svg>`.trim();

        onSave?.(svgContent);
    };

    // Render bubble preview
    const renderPreview = () => {
        const bubble = generateBubble();
        if (!bubble) return null;

        const viewBoxWidth = bubble.width + 40;
        const viewBoxHeight = bubble.height + 40;
        const gradientId = 'previewGradient';

        return (
            <svg
                ref={svgRef}
                viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
                className="bubble-preview-svg"
            >
                <defs>
                    {fillType === 'linear' && (
                        <linearGradient
                            id={gradientId}
                            x1="0%" y1="0%"
                            x2={`${50 + 50 * Math.cos(gradientAngle * Math.PI / 180)}%`}
                            y2={`${50 + 50 * Math.sin(gradientAngle * Math.PI / 180)}%`}
                        >
                            {gradientStops.map((stop, i) => (
                                <stop key={i} offset={`${stop.offset * 100}%`} stopColor={stop.color} />
                            ))}
                        </linearGradient>
                    )}
                    {fillType === 'radial' && (
                        <radialGradient id={gradientId} cx="50%" cy="50%" r="50%">
                            {gradientStops.map((stop, i) => (
                                <stop key={i} offset={`${stop.offset * 100}%`} stopColor={stop.color} />
                            ))}
                        </radialGradient>
                    )}
                    {(shadowEnabled || glowEnabled) && (
                        <filter id="previewEffects" x="-50%" y="-50%" width="200%" height="200%">
                            {shadowEnabled && (
                                <feDropShadow
                                    dx={shadowX}
                                    dy={shadowY}
                                    stdDeviation={shadowBlur / 2}
                                    floodColor={shadowColor}
                                />
                            )}
                        </filter>
                    )}
                </defs>

                <g transform={`translate(20, 20)`} style={{ opacity: opacity / 100 }}>
                    {/* Glow layer */}
                    {glowEnabled && (
                        <path
                            d={bubble.path}
                            fill="none"
                            stroke={glowColor}
                            strokeWidth={strokeWidth + glowBlur}
                            style={{ filter: `blur(${glowBlur / 2}px)` }}
                        />
                    )}

                    {/* Main bubble */}
                    <path
                        d={bubble.path}
                        fill={fillType === 'none' ? 'transparent' : (fillType === 'solid' ? fillColor : `url(#${gradientId})`)}
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        strokeDasharray={getStrokeDashArray()}
                        filter={shadowEnabled ? 'url(#previewEffects)' : 'none'}
                    />

                    {/* Thought bubbles */}
                    {bubble.thoughtBubbles?.map((tb, i) => (
                        <circle
                            key={i}
                            cx={tb.x}
                            cy={tb.y}
                            r={tb.r}
                            fill={fillType === 'none' ? 'transparent' : (fillType === 'solid' ? fillColor : `url(#${gradientId})`)}
                            stroke={strokeColor}
                            strokeWidth={strokeWidth * 0.7}
                        />
                    ))}

                    {/* Double stroke effect */}
                    {strokeStyle === 'double' && (
                        <path
                            d={bubble.path}
                            fill="none"
                            stroke={strokeColor}
                            strokeWidth={strokeWidth * 0.4}
                            transform={`translate(${strokeWidth * 0.8}, ${strokeWidth * 0.8}) scale(${(bubbleWidth - strokeWidth * 2) / bubbleWidth}, ${(bubbleHeight - strokeWidth * 2) / bubbleHeight})`}
                        />
                    )}
                </g>
            </svg>
        );
    };

    // Update gradient stop
    const updateGradientStop = (index, field, value) => {
        setGradientStops(prev => prev.map((stop, i) =>
            i === index ? { ...stop, [field]: value } : stop
        ));
    };

    // Add gradient stop
    const addGradientStop = () => {
        if (gradientStops.length >= 5) return;
        const lastOffset = gradientStops[gradientStops.length - 1]?.offset || 0;
        setGradientStops(prev => [...prev, { offset: Math.min(1, lastOffset + 0.25), color: '#808080' }]);
    };

    // Remove gradient stop
    const removeGradientStop = (index) => {
        if (gradientStops.length <= 2) return;
        setGradientStops(prev => prev.filter((_, i) => i !== index));
    };

    if (!isOpen) return null;

    return (
        <div className="bubble-workshop-overlay">
            <div className="bubble-workshop-modal">
                {/* Header */}
                <div className="workshop-header">
                    <div className="workshop-title">
                        <Palette size={20} />
                        <span>Bubble Workshop</span>
                    </div>
                    <div className="workshop-actions">
                        <button className="workshop-btn" onClick={onClose} title="Close">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="workshop-body">
                    {/* Left Panel - Tools & Settings */}
                    <div className="workshop-panel workshop-left">
                        {/* Bubble Type */}
                        <div className="panel-section">
                            <div className="section-header" onClick={() => toggleSection('type')}>
                                {expandedSections.type ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                <span>Bubble Type</span>
                            </div>
                            {expandedSections.type && (
                                <div className="bubble-type-grid">
                                    {BUBBLE_TYPES.map(type => (
                                        <button
                                            key={type.id}
                                            className={`type-btn ${bubbleType === type.id ? 'active' : ''}`}
                                            onClick={() => setBubbleType(type.id)}
                                            title={type.description}
                                        >
                                            <type.icon size={18} />
                                            <span>{type.label}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Size */}
                        <div className="panel-section">
                            <div className="section-header" onClick={() => toggleSection('size')}>
                                {expandedSections.size ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                <span>Size</span>
                            </div>
                            {expandedSections.size && (
                                <div className="section-content">
                                    <div className="slider-row">
                                        <label>Width: {bubbleWidth}px</label>
                                        <input
                                            type="range"
                                            min="100"
                                            max="500"
                                            value={bubbleWidth}
                                            onChange={(e) => setBubbleWidth(parseInt(e.target.value))}
                                        />
                                    </div>
                                    <div className="slider-row">
                                        <label>Height: {bubbleHeight}px</label>
                                        <input
                                            type="range"
                                            min="50"
                                            max="300"
                                            value={bubbleHeight}
                                            onChange={(e) => setBubbleHeight(parseInt(e.target.value))}
                                        />
                                    </div>
                                    {bubbleType === 'narration' && (
                                        <div className="slider-row">
                                            <label>Corner Radius: {cornerRadius}px</label>
                                            <input
                                                type="range"
                                                min="0"
                                                max="50"
                                                value={cornerRadius}
                                                onChange={(e) => setCornerRadius(parseInt(e.target.value))}
                                            />
                                        </div>
                                    )}
                                    {(bubbleType === 'shouting' || bubbleType === 'explosion') && (
                                        <div className="slider-row">
                                            <label>Spikes: {spikeCount}</label>
                                            <input
                                                type="range"
                                                min="6"
                                                max="20"
                                                value={spikeCount}
                                                onChange={(e) => setSpikeCount(parseInt(e.target.value))}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Tail */}
                        {bubbleType !== 'narration' && bubbleType !== 'explosion' && (
                            <div className="panel-section">
                                <div className="section-header" onClick={() => toggleSection('tail')}>
                                    {expandedSections.tail ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    <span>Tail</span>
                                </div>
                                {expandedSections.tail && (
                                    <div className="section-content">
                                        <div className="tail-direction-grid">
                                            {TAIL_DIRECTIONS.slice(0, 5).map(dir => (
                                                <button
                                                    key={dir.id}
                                                    className={`tail-btn ${tailDirection === dir.id ? 'active' : ''}`}
                                                    onClick={() => setTailDirection(dir.id)}
                                                    title={dir.label}
                                                >
                                                    <dir.icon size={16} />
                                                </button>
                                            ))}
                                        </div>
                                        {tailDirection !== 'none' && (
                                            <>
                                                <div className="slider-row">
                                                    <label>Length: {tailLength}px</label>
                                                    <input
                                                        type="range"
                                                        min="15"
                                                        max="80"
                                                        value={tailLength}
                                                        onChange={(e) => setTailLength(parseInt(e.target.value))}
                                                    />
                                                </div>
                                                <div className="slider-row">
                                                    <label>Position: {Math.round(tailPosition * 100)}%</label>
                                                    <input
                                                        type="range"
                                                        min="0.2"
                                                        max="0.8"
                                                        step="0.05"
                                                        value={tailPosition}
                                                        onChange={(e) => setTailPosition(parseFloat(e.target.value))}
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Center - Preview */}
                    <div className="workshop-preview">
                        <div className="preview-container">
                            {renderPreview()}
                        </div>
                        <div className="preview-info">
                            <span>{bubbleWidth} x {bubbleHeight}px</span>
                        </div>
                    </div>

                    {/* Right Panel - Style */}
                    <div className="workshop-panel workshop-right">
                        {/* Fill */}
                        <div className="panel-section">
                            <div className="section-header" onClick={() => toggleSection('fill')}>
                                {expandedSections.fill ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                <span>Fill</span>
                            </div>
                            {expandedSections.fill && (
                                <div className="section-content">
                                    <select
                                        className="style-select"
                                        value={fillType}
                                        onChange={(e) => setFillType(e.target.value)}
                                    >
                                        {FILL_TYPES.map(type => (
                                            <option key={type.id} value={type.id}>{type.label}</option>
                                        ))}
                                    </select>

                                    {fillType === 'solid' && (
                                        <div className="color-row">
                                            <input
                                                type="color"
                                                value={fillColor}
                                                onChange={(e) => setFillColor(e.target.value)}
                                            />
                                            <span>Color</span>
                                        </div>
                                    )}

                                    {(fillType === 'linear' || fillType === 'radial') && (
                                        <div className="gradient-editor">
                                            {fillType === 'linear' && (
                                                <div className="slider-row">
                                                    <label>Angle: {gradientAngle}°</label>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="360"
                                                        value={gradientAngle}
                                                        onChange={(e) => setGradientAngle(parseInt(e.target.value))}
                                                    />
                                                </div>
                                            )}
                                            <div className="gradient-preview" style={{ background: generateGradientCSS(fillType, gradientStops, gradientAngle) }} />
                                            <div className="gradient-stops">
                                                {gradientStops.map((stop, index) => (
                                                    <div key={index} className="gradient-stop-row">
                                                        <input
                                                            type="color"
                                                            value={stop.color}
                                                            onChange={(e) => updateGradientStop(index, 'color', e.target.value)}
                                                        />
                                                        <input
                                                            type="range"
                                                            min="0"
                                                            max="1"
                                                            step="0.05"
                                                            value={stop.offset}
                                                            onChange={(e) => updateGradientStop(index, 'offset', parseFloat(e.target.value))}
                                                        />
                                                        <span>{Math.round(stop.offset * 100)}%</span>
                                                        {gradientStops.length > 2 && (
                                                            <button className="remove-stop" onClick={() => removeGradientStop(index)}>
                                                                <X size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                                {gradientStops.length < 5 && (
                                                    <button className="add-stop-btn" onClick={addGradientStop}>
                                                        <Plus size={12} /> Add Stop
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Stroke */}
                        <div className="panel-section">
                            <div className="section-header" onClick={() => toggleSection('stroke')}>
                                {expandedSections.stroke ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                <span>Stroke</span>
                            </div>
                            {expandedSections.stroke && (
                                <div className="section-content">
                                    <div className="color-row">
                                        <input
                                            type="color"
                                            value={strokeColor}
                                            onChange={(e) => setStrokeColor(e.target.value)}
                                        />
                                        <span>Color</span>
                                    </div>
                                    <div className="slider-row">
                                        <label>Width: {strokeWidth}px</label>
                                        <input
                                            type="range"
                                            min="1"
                                            max="10"
                                            value={strokeWidth}
                                            onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
                                        />
                                    </div>
                                    <div className="border-styles">
                                        {BORDER_STYLES.map(style => (
                                            <button
                                                key={style.id}
                                                className={`border-style-btn ${strokeStyle === style.id ? 'active' : ''}`}
                                                onClick={() => setStrokeStyle(style.id)}
                                            >
                                                <span className="style-preview">{style.preview}</span>
                                                <span>{style.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Effects */}
                        <div className="panel-section">
                            <div className="section-header" onClick={() => toggleSection('effects')}>
                                {expandedSections.effects ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                <span>Effects</span>
                            </div>
                            {expandedSections.effects && (
                                <div className="section-content">
                                    {/* Shadow */}
                                    <label className="checkbox-row">
                                        <input
                                            type="checkbox"
                                            checked={shadowEnabled}
                                            onChange={(e) => setShadowEnabled(e.target.checked)}
                                        />
                                        <span>Drop Shadow</span>
                                    </label>
                                    {shadowEnabled && (
                                        <div className="effect-controls">
                                            <div className="slider-row compact">
                                                <label>X: {shadowX}</label>
                                                <input
                                                    type="range"
                                                    min="-20"
                                                    max="20"
                                                    value={shadowX}
                                                    onChange={(e) => setShadowX(parseInt(e.target.value))}
                                                />
                                            </div>
                                            <div className="slider-row compact">
                                                <label>Y: {shadowY}</label>
                                                <input
                                                    type="range"
                                                    min="-20"
                                                    max="20"
                                                    value={shadowY}
                                                    onChange={(e) => setShadowY(parseInt(e.target.value))}
                                                />
                                            </div>
                                            <div className="slider-row compact">
                                                <label>Blur: {shadowBlur}</label>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="30"
                                                    value={shadowBlur}
                                                    onChange={(e) => setShadowBlur(parseInt(e.target.value))}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Glow */}
                                    <label className="checkbox-row">
                                        <input
                                            type="checkbox"
                                            checked={glowEnabled}
                                            onChange={(e) => setGlowEnabled(e.target.checked)}
                                        />
                                        <span>Outer Glow</span>
                                    </label>
                                    {glowEnabled && (
                                        <div className="effect-controls">
                                            <div className="color-row compact">
                                                <input
                                                    type="color"
                                                    value={glowColor}
                                                    onChange={(e) => setGlowColor(e.target.value)}
                                                />
                                                <span>Color</span>
                                            </div>
                                            <div className="slider-row compact">
                                                <label>Size: {glowBlur}</label>
                                                <input
                                                    type="range"
                                                    min="2"
                                                    max="30"
                                                    value={glowBlur}
                                                    onChange={(e) => setGlowBlur(parseInt(e.target.value))}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Opacity */}
                                    <div className="slider-row">
                                        <label>Opacity: {opacity}%</label>
                                        <input
                                            type="range"
                                            min="10"
                                            max="100"
                                            value={opacity}
                                            onChange={(e) => setOpacity(parseInt(e.target.value))}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="workshop-footer">
                    <button className="footer-btn secondary" onClick={onClose}>
                        Cancel
                    </button>
                    <button className="footer-btn primary" onClick={handleSave}>
                        <Save size={16} />
                        Save to Library
                    </button>
                </div>
            </div>
        </div>
    );
}

export default BubbleWorkspace;
