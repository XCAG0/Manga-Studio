export const MAGIC_MASK_MODES = {
    HYBRID: 'hybrid',
    LINE_BOXES: 'line_boxes',
    BUBBLE_BBOX: 'bubble_bbox',
};

export const MAGIC_INPAINT_ENGINES = {
    AUTO: 'auto',
    LAMA: 'lama',
    OPENCV: 'opencv',
};

export const MAGIC_CLEANER_DEFAULTS = {
    padding: 10,
    maskMode: MAGIC_MASK_MODES.HYBRID,
    maskExpandX: 3,
    maskExpandY: 4,
    dilateKernel: 5,
    dilateIterations: 2,
    inpaintEngine: MAGIC_INPAINT_ENGINES.AUTO,
    opencvRadius: 3,
};

export function cloneMagicCleanerDefaults() {
    return { ...MAGIC_CLEANER_DEFAULTS };
}
