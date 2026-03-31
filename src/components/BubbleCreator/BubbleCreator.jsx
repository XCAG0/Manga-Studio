/**
 * Bubble Creator Component
 * Panel for creating manga speech bubbles with various styles
 * Includes save/load system for custom shapes
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    MessageSquare,
    MessageCircle,
    Cloud,
    Square,
    Zap,
    Volume2,
    RotateCcw,
    ArrowDown,
    ArrowUp,
    ArrowLeft,
    ArrowRight,
    Save,
    Trash2,
    GripVertical,
    Paintbrush
} from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { bubbleGenerators } from './bubbleShapes';
import BubbleWorkspace from '../BubbleWorkspace/BubbleWorkspace';
import './BubbleCreator.css';

// ============================================
// BUBBLE PRESETS LIBRARY - 50+ Professional Shapes
// Organized by category for manga/manhwa/webtoon
// ============================================
const BUBBLE_PRESETS = [
    // ========== BASIC SHAPES (8) ==========
    {
        id: 'oval', category: 'Basic', label: 'Oval',
        preview: 'M 25 3 C 45 3 47 27 25 27 C 3 27 5 3 25 3 Z'
    },
    {
        id: 'circle', category: 'Basic', label: 'Circle',
        preview: 'M 25 5 A 18 13 0 1 1 24.9 5 Z'
    },
    {
        id: 'wide-oval', category: 'Basic', label: 'Wide Oval',
        preview: 'M 25 6 C 48 6 48 26 25 26 C 2 26 2 6 25 6 Z'
    },
    {
        id: 'tall-oval', category: 'Basic', label: 'Tall Oval',
        preview: 'M 25 2 C 38 2 38 30 25 30 C 12 30 12 2 25 2 Z'
    },
    {
        id: 'rectangle', category: 'Basic', label: 'Rectangle',
        preview: 'M 3 5 L 47 5 L 47 27 L 3 27 Z'
    },
    {
        id: 'rounded-rect', category: 'Basic', label: 'Rounded Rect',
        preview: 'M 8 5 Q 3 5 3 10 L 3 22 Q 3 27 8 27 L 42 27 Q 47 27 47 22 L 47 10 Q 47 5 42 5 Z'
    },
    {
        id: 'pill', category: 'Basic', label: 'Pill',
        preview: 'M 12 6 C 3 6 3 26 12 26 L 38 26 C 47 26 47 6 38 6 Z'
    },
    {
        id: 'square', category: 'Basic', label: 'Square',
        preview: 'M 10 5 L 40 5 L 40 27 L 10 27 Z'
    },

    // ========== SPEECH WITH TAIL (10) ==========
    {
        id: 'speech-bottom', category: 'Speech', label: 'Tail Bottom',
        preview: 'M 25 2 C 46 2 46 20 25 20 L 30 20 L 25 30 L 20 20 C 4 20 4 2 25 2 Z'
    },
    {
        id: 'speech-bottom-left', category: 'Speech', label: 'Tail Bottom Left',
        preview: 'M 25 2 C 46 2 46 20 25 20 L 18 20 L 8 30 L 14 20 C 4 20 4 2 25 2 Z'
    },
    {
        id: 'speech-bottom-right', category: 'Speech', label: 'Tail Bottom Right',
        preview: 'M 25 2 C 46 2 46 20 36 20 L 42 30 L 32 20 L 25 20 C 4 20 4 2 25 2 Z'
    },
    {
        id: 'speech-top', category: 'Speech', label: 'Tail Top',
        preview: 'M 25 30 C 46 30 46 12 25 12 L 30 12 L 25 2 L 20 12 C 4 12 4 30 25 30 Z'
    },
    {
        id: 'speech-left', category: 'Speech', label: 'Tail Left',
        preview: 'M 8 16 L 0 20 L 8 24 C 8 30 42 30 42 16 C 42 2 8 2 8 16 Z'
    },
    {
        id: 'speech-right', category: 'Speech', label: 'Tail Right',
        preview: 'M 42 16 L 50 20 L 42 24 C 42 30 8 30 8 16 C 8 2 42 2 42 16 Z'
    },
    {
        id: 'speech-curved', category: 'Speech', label: 'Curved Tail',
        preview: 'M 25 2 C 46 2 46 18 25 18 Q 30 18 32 22 Q 28 28 22 28 Q 26 24 20 18 C 4 18 4 2 25 2 Z'
    },
    {
        id: 'speech-angular', category: 'Speech', label: 'Angular Tail',
        preview: 'M 25 2 C 46 2 46 18 25 18 L 30 18 L 32 24 L 22 30 L 24 22 L 20 18 C 4 18 4 2 25 2 Z'
    },
    {
        id: 'speech-rect', category: 'Speech', label: 'Rect with Tail',
        preview: 'M 5 5 L 45 5 L 45 22 L 30 22 L 25 30 L 20 22 L 5 22 Z'
    },
    {
        id: 'speech-double', category: 'Speech', label: 'Double Bubble',
        preview: 'M 20 2 C 36 2 36 14 20 14 C 4 14 4 2 20 2 Z M 30 16 C 42 16 42 28 30 28 C 18 28 18 16 30 16 Z'
    },

    // ========== THOUGHT BUBBLES (7) ==========
    {
        id: 'cloud', category: 'Thought', label: 'Cloud',
        preview: 'M 12 12 Q 6 6 14 5 Q 22 2 30 6 Q 38 3 44 10 Q 50 16 44 22 Q 48 28 38 28 Q 30 32 22 28 Q 14 32 8 26 Q 2 22 6 16 Q 2 10 12 12 Z'
    },
    {
        id: 'cloud-simple', category: 'Thought', label: 'Simple Cloud',
        preview: 'M 10 18 Q 4 18 4 12 Q 4 6 12 6 Q 16 2 24 4 Q 32 2 38 6 Q 46 6 46 14 Q 46 22 38 22 Q 34 28 24 26 Q 14 28 10 22 Q 4 22 10 18 Z'
    },
    {
        id: 'thought-trail', category: 'Thought', label: 'With Trail',
        preview: 'M 18 4 Q 8 4 8 12 Q 8 20 18 20 Q 18 24 26 24 Q 34 24 34 18 Q 34 12 26 12 Q 28 8 22 6 Q 18 4 18 4 Z M 10 24 A 3 3 0 1 1 9.9 24 Z M 6 28 A 2 2 0 1 1 5.9 28 Z'
    },
    {
        id: 'fluffy', category: 'Thought', label: 'Fluffy',
        preview: 'M 25 4 Q 35 2 40 8 Q 48 8 48 16 Q 50 24 42 26 Q 40 32 30 30 Q 22 34 14 28 Q 6 28 4 20 Q 0 14 8 10 Q 10 4 20 4 Q 22 2 25 4 Z'
    },
    {
        id: 'dreamy', category: 'Thought', label: 'Dreamy',
        preview: 'M 15 10 Q 8 4 18 4 Q 28 2 35 8 Q 44 6 46 14 Q 50 22 40 24 Q 36 30 26 28 Q 16 32 10 24 Q 2 20 8 14 Q 6 8 15 10 Z'
    },
    {
        id: 'bubble-chain', category: 'Thought', label: 'Bubble Chain',
        preview: 'M 30 4 Q 44 4 44 14 Q 44 24 30 24 Q 16 24 16 14 Q 16 4 30 4 Z M 12 22 A 4 4 0 1 1 11.9 22 Z M 6 26 A 3 3 0 1 1 5.9 26 Z M 3 30 A 2 2 0 1 1 2.9 30 Z'
    },
    {
        id: 'memory', category: 'Thought', label: 'Memory',
        preview: 'M 25 6 Q 42 6 42 16 Q 42 26 25 26 Q 8 26 8 16 Q 8 6 25 6 Z', dashed: true
    },

    // ========== SHOUTING/EMOTION (10) ==========  
    {
        id: 'shout-8', category: 'Shout', label: 'Shout 8-Point',
        preview: 'M 25 0 L 30 10 L 42 4 L 38 16 L 50 20 L 38 24 L 42 36 L 30 30 L 25 40 L 20 30 L 8 36 L 12 24 L 0 20 L 12 16 L 8 4 L 20 10 Z'
    },
    {
        id: 'shout-12', category: 'Shout', label: 'Shout 12-Point',
        preview: 'M 25 0 L 28 8 L 36 2 L 36 12 L 46 10 L 42 18 L 50 22 L 42 26 L 46 34 L 36 32 L 36 42 L 28 36 L 25 44 L 22 36 L 14 42 L 14 32 L 4 34 L 8 26 L 0 22 L 8 18 L 4 10 L 14 12 L 14 2 L 22 8 Z'
    },
    {
        id: 'shout-soft', category: 'Shout', label: 'Soft Shout',
        preview: 'M 25 2 Q 30 8 38 4 Q 36 12 46 14 Q 40 18 48 24 Q 38 24 42 32 Q 32 28 25 36 Q 18 28 8 32 Q 12 24 2 24 Q 10 18 4 14 Q 14 12 12 4 Q 20 8 25 2 Z'
    },
    {
        id: 'explosion', category: 'Shout', label: 'Explosion',
        preview: 'M 25 0 L 27 14 L 40 4 L 34 16 L 50 16 L 36 22 L 48 32 L 34 28 L 38 44 L 27 32 L 25 48 L 23 32 L 12 44 L 16 28 L 2 32 L 14 22 L 0 16 L 16 16 L 10 4 L 23 14 Z'
    },
    {
        id: 'scream', category: 'Shout', label: 'Scream',
        preview: 'M 25 0 L 32 12 L 48 8 L 40 20 L 50 32 L 36 28 L 25 44 L 14 28 L 0 32 L 10 20 L 2 8 L 18 12 Z'
    },
    {
        id: 'angry', category: 'Shout', label: 'Angry',
        preview: 'M 25 4 L 30 12 L 42 6 L 38 18 L 48 24 L 38 28 L 42 40 L 30 34 L 25 44 L 20 34 L 8 40 L 12 28 L 2 24 L 12 18 L 8 6 L 20 12 Z'
    },
    {
        id: 'rage', category: 'Shout', label: 'Rage',
        preview: 'M 25 0 L 28 10 L 35 2 L 34 12 L 44 8 L 40 16 L 50 18 L 42 22 L 50 28 L 40 28 L 44 38 L 34 32 L 35 44 L 28 36 L 25 48 L 22 36 L 15 44 L 16 32 L 6 38 L 10 28 L 0 28 L 8 22 L 0 18 L 10 16 L 6 8 L 16 12 L 15 2 L 22 10 Z'
    },
    {
        id: 'wavy', category: 'Shout', label: 'Wavy Fear',
        preview: 'M 4 16 Q 8 8 16 14 Q 22 6 28 14 Q 34 6 40 14 Q 46 8 48 16 Q 46 24 40 18 Q 34 26 28 18 Q 22 26 16 18 Q 8 24 4 16 Z'
    },
    {
        id: 'terror', category: 'Shout', label: 'Terror',
        preview: 'M 6 16 Q 10 4 18 12 Q 25 0 32 12 Q 40 4 44 16 Q 48 28 32 22 Q 25 32 18 22 Q 4 28 6 16 Z', dashed: true
    },
    {
        id: 'weak', category: 'Shout', label: 'Weak/Dying',
        preview: 'M 8 16 Q 14 6 22 12 Q 28 4 34 12 Q 42 6 44 16 Q 42 26 34 20 Q 28 28 22 20 Q 14 26 8 16 Z', dashed: true
    },

    // ========== SPECIAL BUBBLES (8) ==========
    {
        id: 'broadcast', category: 'Special', label: 'Broadcast/Radio',
        preview: 'M 6 6 L 44 6 L 44 26 L 30 26 L 28 30 L 32 30 L 28 34 L 20 26 L 6 26 Z'
    },
    {
        id: 'electronic', category: 'Special', label: 'Electronic',
        preview: 'M 4 4 L 46 4 L 46 28 L 4 28 Z M 8 8 L 8 24 L 42 24 L 42 8 Z'
    },
    {
        id: 'robot', category: 'Special', label: 'Robot Voice',
        preview: 'M 8 6 L 42 6 L 46 10 L 46 22 L 42 26 L 8 26 L 4 22 L 4 10 Z'
    },
    {
        id: 'telepathy', category: 'Special', label: 'Telepathy',
        preview: 'M 25 4 C 42 4 42 28 25 28 C 8 28 8 4 25 4 Z M 25 8 C 38 8 38 24 25 24 C 12 24 12 8 25 8 Z'
    },
    {
        id: 'sinister', category: 'Special', label: 'Sinister',
        preview: 'M 25 4 C 44 4 44 28 25 28 C 6 28 6 4 25 4 Z', fill: 'dark'
    },
    {
        id: 'narration', category: 'Special', label: 'Narration Box',
        preview: 'M 4 6 L 46 6 L 46 26 L 4 26 Z'
    },
    {
        id: 'caption', category: 'Special', label: 'Caption',
        preview: 'M 2 8 L 48 8 L 48 24 L 2 24 Z'
    },
    {
        id: 'flashback', category: 'Special', label: 'Flashback',
        preview: 'M 6 6 L 44 6 L 44 26 L 6 26 Z', dashed: true
    },

    // ========== DECORATIVE (7) ==========
    {
        id: 'star-burst', category: 'Decorative', label: 'Star Burst',
        preview: 'M 25 0 L 29 12 L 42 8 L 35 18 L 48 24 L 35 28 L 42 40 L 29 32 L 25 48 L 21 32 L 8 40 L 15 28 L 2 24 L 15 18 L 8 8 L 21 12 Z'
    },
    {
        id: 'flash', category: 'Decorative', label: 'Lightning',
        preview: 'M 20 0 L 38 0 L 30 14 L 46 14 L 14 44 L 22 24 L 6 24 Z'
    },
    {
        id: 'heart', category: 'Decorative', label: 'Heart',
        preview: 'M 25 10 C 25 4 32 2 36 6 C 44 12 25 30 25 30 C 25 30 6 12 14 6 C 18 2 25 4 25 10 Z'
    },
    {
        id: 'diamond', category: 'Decorative', label: 'Diamond',
        preview: 'M 25 2 L 46 16 L 25 30 L 4 16 Z'
    },
    {
        id: 'hexagon', category: 'Decorative', label: 'Hexagon',
        preview: 'M 25 2 L 44 10 L 44 24 L 25 32 L 6 24 L 6 10 Z'
    },
    {
        id: 'banner', category: 'Decorative', label: 'Banner',
        preview: 'M 0 10 L 8 10 L 8 4 L 42 4 L 42 10 L 50 10 L 42 16 L 42 28 L 8 28 L 8 16 L 0 16 Z'
    },
    {
        id: 'scroll', category: 'Decorative', label: 'Scroll',
        preview: 'M 8 8 Q 4 8 4 12 L 4 22 Q 4 26 8 26 L 42 26 Q 46 26 46 22 L 46 12 Q 46 8 42 8 L 8 8 M 6 6 A 4 4 0 0 1 6 14 M 44 6 A 4 4 0 0 0 44 14'
    },

    // ========== WHISPER/SOFT (5) ==========
    {
        id: 'whisper', category: 'Whisper', label: 'Whisper Oval',
        preview: 'M 25 4 C 44 4 44 28 25 28 C 6 28 6 4 25 4 Z', dashed: true
    },
    {
        id: 'whisper-rect', category: 'Whisper', label: 'Whisper Box',
        preview: 'M 6 6 L 44 6 L 44 26 L 6 26 Z', dashed: true
    },
    {
        id: 'fading', category: 'Whisper', label: 'Fading',
        preview: 'M 25 6 Q 44 6 44 16 Q 44 26 25 26 Q 6 26 6 16 Q 6 6 25 6 Z', dashed: true
    },
    {
        id: 'quiet', category: 'Whisper', label: 'Quiet',
        preview: 'M 12 8 C 4 8 4 24 12 24 L 38 24 C 46 24 46 8 38 8 Z', dashed: true
    },
    {
        id: 'mutter', category: 'Whisper', label: 'Mutter',
        preview: 'M 25 6 C 40 6 40 26 25 26 C 10 26 10 6 25 6 Z', dashed: true
    },

    // ========== ICICLE/COLD (3) ==========
    {
        id: 'icicle', category: 'Cold', label: 'Icicle',
        preview: 'M 25 4 C 44 4 44 20 40 20 L 42 28 L 36 20 L 38 26 L 32 20 L 34 24 L 28 20 L 30 26 L 24 20 L 26 28 L 20 20 L 22 24 L 16 20 L 18 26 L 12 20 L 14 28 L 10 20 C 6 20 6 4 25 4 Z'
    },
    {
        id: 'frost', category: 'Cold', label: 'Frost',
        preview: 'M 8 16 Q 8 6 25 6 Q 42 6 42 16 Q 42 22 38 22 L 40 28 L 34 22 L 36 26 L 30 22 L 32 28 L 25 22 L 28 26 L 22 22 L 24 28 L 18 22 L 20 26 L 14 22 L 16 28 L 12 22 Q 8 22 8 16 Z'
    },
    {
        id: 'cold-shoulder', category: 'Cold', label: 'Cold Shoulder',
        preview: 'M 25 4 C 42 4 42 18 42 18 L 44 24 L 38 18 L 40 22 L 34 18 L 36 22 L 30 18 C 30 18 30 28 25 28 C 20 28 20 18 20 18 L 14 22 L 16 18 L 10 22 L 12 18 L 6 24 L 8 18 C 8 18 8 4 25 4 Z'
    },

    // ========== MANHWA STYLE - Solo Leveling / Nano Machine (12) ==========
    // System Windows & Game UI
    {
        id: 'sl-system', category: 'Manhwa', label: 'System Window',
        preview: 'M 4 4 L 46 4 L 46 8 L 4 8 L 4 4 Z M 4 8 L 46 8 L 46 28 L 4 28 Z'
    },
    {
        id: 'sl-quest', category: 'Manhwa', label: 'Quest Box',
        preview: 'M 6 4 L 44 4 L 46 6 L 46 26 L 44 28 L 6 28 L 4 26 L 4 6 Z M 8 8 L 42 8'
    },
    {
        id: 'sl-skill', category: 'Manhwa', label: 'Skill Window',
        preview: 'M 4 2 L 46 2 L 48 4 L 48 30 L 46 32 L 4 32 L 2 30 L 2 4 Z M 4 6 L 46 6 M 4 10 L 46 10'
    },
    {
        id: 'sl-alert', category: 'Manhwa', label: 'Alert/Warning',
        preview: 'M 25 2 L 48 28 L 2 28 Z M 25 10 L 25 20 M 25 24 L 25 26'
    },
    {
        id: 'sl-notification', category: 'Manhwa', label: 'Notification',
        preview: 'M 8 6 L 42 6 L 44 8 L 44 24 L 42 26 L 8 26 L 6 24 L 6 8 Z'
    },
    {
        id: 'sl-stat', category: 'Manhwa', label: 'Stat Box',
        preview: 'M 4 4 L 46 4 L 46 28 L 4 28 Z M 4 10 L 46 10 M 4 16 L 46 16 M 4 22 L 46 22'
    },
    // Dark/Power Speech
    {
        id: 'sl-power', category: 'Manhwa', label: 'Power Speech',
        preview: 'M 25 0 L 30 8 L 42 4 L 38 14 L 50 16 L 40 20 L 48 28 L 36 26 L 38 36 L 28 30 L 25 40 L 22 30 L 12 36 L 14 26 L 2 28 L 10 20 L 0 16 L 12 14 L 8 4 L 20 8 Z', fill: 'dark'
    },
    {
        id: 'sl-shadow', category: 'Manhwa', label: 'Shadow Speech',
        preview: 'M 25 4 C 44 4 44 28 25 28 C 6 28 6 4 25 4 Z M 27 6 C 46 6 46 30 27 30 C 8 30 8 6 27 6 Z'
    },
    // Nano Machine Style
    {
        id: 'nm-tech', category: 'Manhwa', label: 'Tech Interface',
        preview: 'M 8 4 L 42 4 L 46 8 L 46 24 L 42 28 L 8 28 L 4 24 L 4 8 Z M 8 4 L 10 6 M 42 4 L 40 6 M 8 28 L 10 26 M 42 28 L 40 26'
    },
    {
        id: 'nm-scan', category: 'Manhwa', label: 'Scan Window',
        preview: 'M 6 6 L 44 6 L 44 26 L 6 26 Z M 10 6 L 10 10 M 40 6 L 40 10 M 10 26 L 10 22 M 40 26 L 40 22'
    },
    {
        id: 'nm-data', category: 'Manhwa', label: 'Data Display',
        preview: 'M 4 4 L 46 4 L 46 28 L 4 28 Z M 8 8 L 20 8 M 8 14 L 30 14 M 8 20 L 25 20'
    },
    {
        id: 'nm-command', category: 'Manhwa', label: 'Command Box',
        preview: 'M 2 8 L 48 8 L 48 24 L 2 24 Z M 6 8 L 6 4 L 10 4 M 44 8 L 44 4 L 40 4 M 6 24 L 6 28 L 10 28 M 44 24 L 44 28 L 40 28'
    },

    // ========== WEBTOON MODERN (8) ==========
    {
        id: 'wt-clean', category: 'Webtoon', label: 'Clean Oval',
        preview: 'M 25 4 C 44 4 44 28 25 28 C 6 28 6 4 25 4 Z'
    },
    {
        id: 'wt-soft-rect', category: 'Webtoon', label: 'Soft Rectangle',
        preview: 'M 10 6 Q 4 6 4 12 L 4 20 Q 4 26 10 26 L 40 26 Q 46 26 46 20 L 46 12 Q 46 6 40 6 Z'
    },
    {
        id: 'wt-modern', category: 'Webtoon', label: 'Modern Speech',
        preview: 'M 25 4 C 44 4 44 22 25 22 L 32 22 Q 30 30 22 28 L 20 22 C 6 22 6 4 25 4 Z'
    },
    {
        id: 'wt-minimal', category: 'Webtoon', label: 'Minimal Box',
        preview: 'M 6 8 L 44 8 L 44 24 L 6 24 Z'
    },
    {
        id: 'wt-double', category: 'Webtoon', label: 'Double Line',
        preview: 'M 8 8 L 42 8 L 42 24 L 8 24 Z M 6 6 L 44 6 L 44 26 L 6 26 Z'
    },
    {
        id: 'wt-round-tail', category: 'Webtoon', label: 'Round Tail',
        preview: 'M 25 4 C 42 4 44 20 25 20 Q 32 20 32 26 Q 28 30 22 26 Q 22 20 25 20 C 6 20 8 4 25 4 Z'
    },
    {
        id: 'wt-corner', category: 'Webtoon', label: 'Corner Accent',
        preview: 'M 10 4 L 44 4 L 46 6 L 46 24 L 44 26 L 10 26 L 4 20 L 4 10 Z'
    },
    {
        id: 'wt-tag', category: 'Webtoon', label: 'Tag Style',
        preview: 'M 10 8 L 40 8 L 46 16 L 40 24 L 10 24 L 4 16 Z'
    },

    // ========== KOREAN STYLE (6) ==========
    {
        id: 'kr-horizontal', category: 'Korean', label: 'Wide Horizontal',
        preview: 'M 2 10 C 2 4 48 4 48 10 L 48 22 C 48 28 2 28 2 22 Z'
    },
    {
        id: 'kr-emotional', category: 'Korean', label: 'Emotional Wobble',
        preview: 'M 8 14 Q 4 8 12 6 Q 20 2 28 6 Q 36 2 42 8 Q 48 14 42 22 Q 36 28 28 26 Q 20 30 12 26 Q 4 22 8 14 Z'
    },
    {
        id: 'kr-soft-cloud', category: 'Korean', label: 'Soft Cloud',
        preview: 'M 12 14 Q 6 10 12 6 Q 18 2 26 4 Q 34 2 40 8 Q 48 12 44 20 Q 48 26 38 28 Q 28 32 18 28 Q 8 28 6 22 Q 2 16 12 14 Z'
    },
    {
        id: 'kr-inner-thought', category: 'Korean', label: 'Inner Thought',
        preview: 'M 25 6 C 40 6 42 26 25 26 C 10 26 8 6 25 6 Z', dashed: true
    },
    {
        id: 'kr-emphasis', category: 'Korean', label: 'Emphasis Box',
        preview: 'M 4 4 L 46 4 L 46 28 L 4 28 Z M 8 8 L 42 8 L 42 24 L 8 24 Z'
    },
    {
        id: 'kr-action', category: 'Korean', label: 'Action Burst',
        preview: 'M 25 2 L 30 10 L 44 6 L 38 16 L 48 22 L 38 26 L 44 36 L 30 30 L 25 40 L 20 30 L 6 36 L 12 26 L 2 22 L 12 16 L 6 6 L 20 10 Z'
    },
];

const TAIL_DIRECTIONS = [
    { id: 'bottom', icon: ArrowDown, label: 'Bottom' },
    { id: 'top', icon: ArrowUp, label: 'Top' },
    { id: 'left', icon: ArrowLeft, label: 'Left' },
    { id: 'right', icon: ArrowRight, label: 'Right' }
];

const STORAGE_KEY = 'manga-studio-saved-bubbles';

// Detect input type and parse accordingly
const parseCodeInput = (code) => {
    const trimmed = code.trim();
    const lower = trimmed.toLowerCase();

    // Full SVG
    if (lower.startsWith('<svg') || lower.startsWith('<?xml')) {
        return { type: 'svg', code: trimmed };
    }

    // Path element: <path d="..."/>
    if (lower.startsWith('<path')) {
        // Extract d attribute
        const dMatch = trimmed.match(/d\s*=\s*["']([^"']+)["']/i);
        if (dMatch) {
            return { type: 'path', code: dMatch[1].trim() };
        }
        // If no d found, return as-is
        return { type: 'path', code: trimmed };
    }

    // Raw path data (starts with M, m, or similar)
    return { type: 'path', code: trimmed };
};

// Check if input is full SVG
const isFullSVG = (code) => {
    return parseCodeInput(code).type === 'svg';
};

// Get clean path/svg code
const getCleanCode = (code) => {
    return parseCodeInput(code).code;
};

// Generate SVG thumbnail from any input format
const generateThumbnail = (code, size = 60) => {
    const parsed = parseCodeInput(code);
    let svgContent;

    if (parsed.type === 'svg') {
        // Full SVG - use as-is but ensure xmlns
        svgContent = parsed.code;
        if (!svgContent.includes('xmlns=')) {
            svgContent = svgContent.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
        }
    } else {
        // Path data - wrap in SVG with auto viewBox
        svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 180 140"><path d="${parsed.code}" fill="#ffffff" stroke="#000000" stroke-width="2"/></svg>`;
    }

    // Use encodeURIComponent for better compatibility
    return `data:image/svg+xml,${encodeURIComponent(svgContent)}`;
};

function BubbleCreator({ isVisible, onClose }) {
    const { canvas } = useEditorStore();

    const [activeTab, setActiveTab] = useState('presets'); // 'presets' | 'custom' | 'saved'
    const [selectedType, setSelectedType] = useState('normal');
    const [customSvgCode, setCustomSvgCode] = useState('');
    const [saveName, setSaveName] = useState('');
    const [savedBubbles, setSavedBubbles] = useState([]);
    const [isLoadedFromStorage, setIsLoadedFromStorage] = useState(false);
    const [showWorkspace, setShowWorkspace] = useState(false);
    const [pendingWorkspaceSvg, setPendingWorkspaceSvg] = useState(null);
    const [workspaceBubbleName, setWorkspaceBubbleName] = useState('');
    const [bubbleOptions, setBubbleOptions] = useState({
        width: 200,
        height: 100,
        fillColor: '#ffffff',
        strokeColor: '#000000',
        strokeWidth: 2,
        opacity: 100,
        tailDirection: 'bottom',
        tailPosition: 0.5
    });

    // Load saved bubbles from localStorage on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setSavedBubbles(parsed);
                    console.log('[BubbleCreator] Loaded', parsed.length, 'saved bubbles');
                }
            }
        } catch (error) {
            console.error('[BubbleCreator] Error loading saved bubbles:', error);
        }
        setIsLoadedFromStorage(true);
    }, []);

    // Save to localStorage whenever savedBubbles changes (only after initial load)
    useEffect(() => {
        if (!isLoadedFromStorage) return; // Don't save until we've loaded
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(savedBubbles));
            console.log('[BubbleCreator] Saved', savedBubbles.length, 'bubbles to storage');
        } catch (error) {
            console.error('[BubbleCreator] Error saving bubbles:', error);
        }
    }, [savedBubbles, isLoadedFromStorage]);

    const handleOptionChange = (key, value) => {
        setBubbleOptions(prev => ({ ...prev, [key]: value }));
    };

    const hexToRgba = (hex, alpha) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const createBubbleFromCode = async (inputCode, options = bubbleOptions) => {
        if (!canvas || !inputCode) return;

        try {
            const fabric = await import('fabric');
            const fillOpacity = (options.opacity || 100) / 100;
            const parsed = parseCodeInput(inputCode);

            if (parsed.type === 'svg') {
                // Full SVG - use loadSVGFromString
                fabric.loadSVGFromString(parsed.code).then(({ objects, options: svgOptions }) => {
                    if (objects && objects.length > 0) {
                        let svgObject;

                        if (objects.length === 1) {
                            svgObject = objects[0];
                        } else {
                            // Group multiple objects
                            svgObject = new fabric.Group(objects);
                        }

                        svgObject.set({
                            left: 150,
                            top: 150,
                            name: `bubble-svg-${Date.now()}`,
                            selectable: true,
                            evented: true
                        });

                        canvas.add(svgObject);
                        canvas.setActiveObject(svgObject);
                        canvas.renderAll();
                        console.log('[BubbleCreator] Created bubble from full SVG');
                    }
                });
            } else {
                // Path data (auto-extracted from <path> element if needed)
                const bubblePath = new fabric.Path(parsed.code, {
                    left: 150,
                    top: 150,
                    fill: hexToRgba(options.fillColor || '#ffffff', fillOpacity),
                    stroke: options.strokeColor || '#000000',
                    strokeWidth: options.strokeWidth || 2,
                    name: `bubble-path-${Date.now()}`,
                    selectable: true,
                    evented: true
                });

                canvas.add(bubblePath);
                canvas.setActiveObject(bubblePath);
                canvas.renderAll();
                console.log('[BubbleCreator] Created bubble from path');
            }
        } catch (error) {
            console.error('[BubbleCreator] Error:', error);
        }
    };

    const createBubble = async () => {
        if (!canvas) return;

        try {
            const generator = bubbleGenerators[selectedType];
            if (!generator) return;

            const bubbleData = generator({
                width: bubbleOptions.width,
                height: bubbleOptions.height,
                tailPosition: bubbleOptions.tailPosition,
                tailDirection: bubbleOptions.tailDirection
            });

            const { Path, Circle: FabricCircle, Group } = await import('fabric');
            const fillOpacity = bubbleOptions.opacity / 100;

            const bubblePath = new Path(bubbleData.path, {
                left: 150,
                top: 150,
                fill: hexToRgba(bubbleOptions.fillColor, fillOpacity),
                stroke: bubbleOptions.strokeColor,
                strokeWidth: bubbleOptions.strokeWidth,
                strokeDashArray: bubbleData.strokeDashArray || null,
                name: `bubble-${selectedType}-${Date.now()}`,
                selectable: true,
                evented: true
            });

            if (selectedType === 'thought' && bubbleData.thinkingBubbles) {
                const objects = [bubblePath];
                bubbleData.thinkingBubbles.forEach(tb => {
                    const circle = new FabricCircle({
                        left: tb.x - tb.r + 150,
                        top: tb.y - tb.r + 150,
                        radius: tb.r,
                        fill: hexToRgba(bubbleOptions.fillColor, fillOpacity),
                        stroke: bubbleOptions.strokeColor,
                        strokeWidth: bubbleOptions.strokeWidth
                    });
                    objects.push(circle);
                });
                const group = new Group(objects, {
                    left: 150, top: 150, selectable: true,
                    name: `bubble-thought-group-${Date.now()}`
                });
                canvas.add(group);
            } else {
                canvas.add(bubblePath);
            }

            canvas.renderAll();
        } catch (error) {
            console.error('[BubbleCreator] Error:', error);
        }
    };

    const createCustomBubble = async () => {
        if (!customSvgCode.trim()) return;
        await createBubbleFromCode(customSvgCode.trim());
    };

    const saveCustomBubble = () => {
        if (!customSvgCode.trim() || !saveName.trim()) {
            console.warn('[BubbleCreator] Need both name and code to save');
            return;
        }

        const code = customSvgCode.trim();
        const isSvg = isFullSVG(code);

        const newBubble = {
            id: Date.now(),
            name: saveName.trim(),
            path: code,
            thumbnail: generateThumbnail(code),
            isFullSVG: isSvg,
            // Only save color options for path (not full SVG which has its own colors)
            options: isSvg ? {} : { ...bubbleOptions }
        };

        setSavedBubbles(prev => [...prev, newBubble]);
        setSaveName('');
        console.log('[BubbleCreator] Saved bubble:', newBubble.name, 'isFullSVG:', isSvg);
    };

    const deleteSavedBubble = (id) => {
        setSavedBubbles(prev => prev.filter(b => b.id !== id));
    };

    const useSavedBubble = async (bubble) => {
        // For full SVG, use default options (colors are in SVG itself)
        const opts = bubble.isFullSVG ? bubbleOptions : { ...bubbleOptions, ...bubble.options };
        await createBubbleFromCode(bubble.path, opts);
    };

    const resetOptions = () => {
        setBubbleOptions({
            width: 200, height: 100,
            fillColor: '#ffffff', strokeColor: '#000000',
            strokeWidth: 2, opacity: 100,
            tailDirection: 'bottom', tailPosition: 0.5
        });
    };

    if (!isVisible) return null;

    return (
        <div className="bubble-creator panel">
            <div className="panel-header">
                <MessageSquare size={16} />
                <span>Bubble Creator</span>
                <button className="panel-close" onClick={onClose}>×</button>
            </div>

            <div className="bubble-creator-content">
                {/* Workspace Studio Button */}
                <button
                    className="workspace-open-btn"
                    onClick={() => setShowWorkspace(true)}
                >
                    <Paintbrush size={14} />
                    Open Studio
                </button>

                {/* Tab Selector */}
                <div className="bubble-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'presets' ? 'active' : ''}`}
                        onClick={() => setActiveTab('presets')}
                    >
                        Presets
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'custom' ? 'active' : ''}`}
                        onClick={() => setActiveTab('custom')}
                    >
                        Custom
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'saved' ? 'active' : ''}`}
                        onClick={() => setActiveTab('saved')}
                    >
                        Saved ({savedBubbles.length})
                    </button>
                </div>

                {activeTab === 'presets' && (
                    <div className="presets-section">
                        <div className="presets-list">
                            {BUBBLE_PRESETS.map(preset => (
                                <div
                                    key={preset.id}
                                    className={`preset-item ${selectedType === preset.id ? 'active' : ''}`}
                                    onClick={() => {
                                        setSelectedType(preset.id);
                                        // Create bubble with this preset
                                        createBubbleFromCode(preset.preview, bubbleOptions);
                                    }}
                                    title={`${preset.category} - ${preset.label}`}
                                >
                                    <svg viewBox="0 0 50 32" className="preset-preview">
                                        <path
                                            d={preset.preview}
                                            fill="#ffffff"
                                            stroke="#333333"
                                            strokeWidth="1.5"
                                            strokeDasharray={preset.dashed ? '3,2' : 'none'}
                                        />
                                    </svg>
                                    <div className="preset-info">
                                        <span className="preset-name">{preset.label}</span>
                                        <span className="preset-category">{preset.category}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="bubble-options compact">
                            <div className="option-row">
                                <div className="option-group">
                                    <label>Fill</label>
                                    <input type="color" value={bubbleOptions.fillColor}
                                        onChange={(e) => handleOptionChange('fillColor', e.target.value)} />
                                </div>
                                <div className="option-group">
                                    <label>Border</label>
                                    <input type="color" value={bubbleOptions.strokeColor}
                                        onChange={(e) => handleOptionChange('strokeColor', e.target.value)} />
                                </div>
                                <div className="option-group">
                                    <label>Width</label>
                                    <input type="number" value={bubbleOptions.strokeWidth}
                                        onChange={(e) => handleOptionChange('strokeWidth', parseInt(e.target.value) || 2)}
                                        min="1" max="10" className="small-input" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'custom' && (
                    <>
                        <div className="custom-svg-section">
                            <div className="option-group">
                                <label>SVG Path Code</label>
                                <textarea
                                    className="svg-code-input"
                                    placeholder="M 0 0 L 100 0 L 100 50 L 60 50 L 50 70 L 40 50 L 0 50 Z"
                                    value={customSvgCode}
                                    onChange={(e) => setCustomSvgCode(e.target.value)}
                                    rows={4}
                                />
                            </div>

                            <div className="option-row">
                                <div className="option-group">
                                    <label>Fill</label>
                                    <input type="color" value={bubbleOptions.fillColor}
                                        onChange={(e) => handleOptionChange('fillColor', e.target.value)} />
                                </div>
                                <div className="option-group">
                                    <label>Border</label>
                                    <input type="color" value={bubbleOptions.strokeColor}
                                        onChange={(e) => handleOptionChange('strokeColor', e.target.value)} />
                                </div>
                            </div>

                            <div className="option-group">
                                <label>Opacity: {bubbleOptions.opacity}%</label>
                                <input type="range" min="0" max="100" value={bubbleOptions.opacity}
                                    onChange={(e) => handleOptionChange('opacity', parseInt(e.target.value))} />
                            </div>

                            {/* Save Section */}
                            <div className="save-section">
                                <div className="option-group">
                                    <label>Save As</label>
                                    <div className="save-input-row">
                                        <input
                                            type="text"
                                            className="save-name-input"
                                            placeholder="Bubble name..."
                                            value={saveName}
                                            onChange={(e) => setSaveName(e.target.value)}
                                        />
                                        <button className="btn-save" onClick={saveCustomBubble} title="Save">
                                            <Save size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bubble-actions">
                            <button className="btn-create" onClick={createCustomBubble}>
                                <MessageSquare size={14} /> Create Custom
                            </button>
                        </div>
                    </>
                )}

                {activeTab === 'saved' && (
                    <div className="saved-bubbles-section">
                        {savedBubbles.length === 0 ? (
                            <div className="empty-saved">
                                <p>No saved bubbles yet.</p>
                                <p className="hint">Go to Custom tab and save your shapes!</p>
                            </div>
                        ) : (
                            <div className="saved-bubbles-list">
                                {savedBubbles.map(bubble => (
                                    <div
                                        key={bubble.id}
                                        className="saved-bubble-item"
                                        onClick={() => useSavedBubble(bubble)}
                                        title="Click to add to canvas"
                                    >
                                        <img
                                            src={bubble.thumbnail}
                                            alt={bubble.name}
                                            className="bubble-thumbnail"
                                            draggable="false"
                                        />
                                        <span className="bubble-name">{bubble.name}</span>
                                        <button
                                            className="btn-delete"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteSavedBubble(bubble.id);
                                            }}
                                            title="Delete"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Bubble Workspace Modal */}
            <BubbleWorkspace
                isOpen={showWorkspace}
                onClose={() => {
                    setShowWorkspace(false);
                    setPendingWorkspaceSvg(null);
                    setWorkspaceBubbleName('');
                }}
                onSave={(svg) => {
                    // Generate auto name with timestamp
                    const autoName = `Bubble ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
                    const newBubble = {
                        id: Date.now(),
                        name: autoName,
                        path: svg,
                        thumbnail: generateThumbnail(svg),
                        isFullSVG: true,
                        options: {}
                    };
                    setSavedBubbles(prev => [...prev, newBubble]);
                    setShowWorkspace(false);
                    setActiveTab('saved');
                    console.log('[BubbleCreator] Saved from workspace:', autoName);
                }}
            />
        </div>
    );
}

export default BubbleCreator;
