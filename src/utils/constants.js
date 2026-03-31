export const CANVAS = {
    // Default dimensions (portrait for manga)
    DEFAULT_WIDTH: 600,
    DEFAULT_HEIGHT: 900,

    // Background color
    BACKGROUND_COLOR: '#2a2a2a',

    // Zoom limits
    ZOOM_MIN: 10,
    ZOOM_MAX: 1000,
    ZOOM_STEP: 10,
    ZOOM_DEFAULT: 100,

    // Grid
    GRID_SIZE: 20,
    GRID_COLOR: '#3a3a3a',
};

// ===========================================
// TOOLS CONFIGURATION
// ===========================================
export const TOOLS = {
    SELECT: 'select',
    MOVE: 'move',
    BRUSH: 'brush',
    ERASER: 'eraser',
    TEXT: 'text',
    RECTANGLE: 'rectangle',
    ELLIPSE: 'ellipse',
    EYEDROPPER: 'eyedropper',
    CROP: 'crop',
    HEALING: 'healing',
    CLONE: 'clone',
    COLOR_REPLACE: 'color_replace',
    MAGIC_MASK: 'magic_mask',
    REGION_DETECT: 'region_detect',
    QUICK_ERASE: 'quick_erase',
    BUBBLE: 'bubble',
};

// Tool keyboard codes (language-independent)
export const TOOL_KEYCODES = {
    KeyV: TOOLS.SELECT,
    KeyH: TOOLS.MOVE,
    KeyB: TOOLS.BRUSH,
    KeyE: TOOLS.ERASER,
    KeyT: TOOLS.TEXT,
    KeyU: TOOLS.RECTANGLE,
    KeyO: TOOLS.ELLIPSE,
    KeyI: TOOLS.EYEDROPPER,
    KeyC: TOOLS.CROP,
    KeyJ: TOOLS.HEALING,
    KeyS: TOOLS.CLONE,
    KeyM: TOOLS.MAGIC_MASK,
    KeyR: TOOLS.REGION_DETECT,
    KeyQ: TOOLS.QUICK_ERASE,
    KeyG: TOOLS.BUBBLE,
};

// ===========================================
// BRUSH CONFIGURATION
// ===========================================
export const BRUSH = {
    SIZE_MIN: 1,
    SIZE_MAX: 200,
    SIZE_DEFAULT: 10,
    SIZE_STEP: 5,

    COLOR_DEFAULT: '#ffffff',

    OPACITY_MIN: 0,
    OPACITY_MAX: 100,
    OPACITY_DEFAULT: 100,
};

// ===========================================
// ERASER CONFIGURATION
// ===========================================
export const ERASER = {
    SIZE_MIN: 1,
    SIZE_MAX: 200,
    SIZE_DEFAULT: 20,
};

// ===========================================
// HEALING TOOL CONFIGURATION
// ===========================================
export const HEALING = {
    SIZE_MIN: 5,
    SIZE_MAX: 150,
    SIZE_DEFAULT: 25,
    HARDNESS_DEFAULT: 50,
    SAMPLE_RADIUS: 3, // Pixels to sample around
};

// ===========================================
// CLONE TOOL CONFIGURATION
// ===========================================
export const CLONE = {
    SIZE_MIN: 5,
    SIZE_MAX: 150,
    SIZE_DEFAULT: 25,
    HARDNESS_DEFAULT: 100,
};

// ===========================================
// MAGIC MASK TOOL CONFIGURATION
// ===========================================
export const MAGIC_MASK = {
    MIN_SELECTION: 20,  // Minimum selection size (px)
    PROCESSING_TIMEOUT: 30000,  // 30 seconds max
    PREVIEW_OPACITY: 0.3,  // Selection preview opacity
};

// ===========================================
// TEXT CONFIGURATION
// ===========================================
export const TEXT = {
    FONT_SIZE_MIN: 1,
    FONT_SIZE_MAX: 200,
    FONT_SIZE_DEFAULT: 24,

    FONT_FAMILY_DEFAULT: 'Arial',

    // Fallback fonts only - system fonts detected dynamically via queryLocalFonts API
    FONTS: [
        'Arial',
        'Times New Roman',
        'Courier New',
    ],

    ALIGN_OPTIONS: ['left', 'center', 'right'],
};

// ===========================================
// SHAPES CONFIGURATION
// ===========================================
export const SHAPES = {
    STROKE_WIDTH_DEFAULT: 2,
    STROKE_WIDTH_MIN: 1,
    STROKE_WIDTH_MAX: 50,

    FILL_DEFAULT: 'transparent',
    STROKE_DEFAULT: '#ffffff',

    MIN_SIZE: 5, // Minimum size to keep shape
};

// ===========================================
// HISTORY CONFIGURATION
// ===========================================
export const HISTORY = {
    MAX_STATES: 50,
};

// ===========================================
// FILE CONFIGURATION
// ===========================================
export const FILE = {
    SUPPORTED_FORMATS: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
    EXPORT_FORMATS: ['png', 'jpg'],

    DEFAULT_EXPORT_NAME: 'manga-edit',
    DEFAULT_EXPORT_FORMAT: 'png',

    // MIME types
    MIME_TYPES: {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        webp: 'image/webp',
        gif: 'image/gif',
    },
};

// ===========================================
// UI CONFIGURATION
// ===========================================
export const UI = {
    // Sidebar widths
    TOOLBAR_WIDTH: 52,
    SIDE_PANEL_WIDTH: 280,

    // Title bar height
    TITLE_BAR_HEIGHT: 36,

    // Status bar height
    STATUS_BAR_HEIGHT: 24,

    // Panel min heights
    PROPERTIES_PANEL_MIN_HEIGHT: 150,
    LAYERS_PANEL_MIN_HEIGHT: 200,
};

// ===========================================
// CURSORS
// ===========================================
export const CURSORS = {
    DEFAULT: 'default',
    MOVE: 'move',
    GRAB: 'grab',
    GRABBING: 'grabbing',
    CROSSHAIR: 'crosshair',
    TEXT: 'text',
    POINTER: 'pointer',
};

// ===========================================
// COLORS (Theme)
// ===========================================
export const COLORS = {
    // Background
    BG_PRIMARY: '#0d0d14',
    BG_SECONDARY: '#14141f',
    BG_TERTIARY: '#1a1a2e',
    BG_HOVER: '#252540',
    BG_ACTIVE: '#2d2d4a',

    // Accent
    ACCENT_PRIMARY: '#e94560',
    ACCENT_SECONDARY: '#533483',

    // Text
    TEXT_PRIMARY: '#f0f0f0',
    TEXT_SECONDARY: '#a0a0b0',
    TEXT_MUTED: '#606070',

    // Borders
    BORDER_COLOR: '#2a2a40',
    BORDER_LIGHT: '#3a3a55',

    // Status
    SUCCESS: '#4ade80',
    WARNING: '#fbbf24',
    ERROR: '#ef4444',
};
