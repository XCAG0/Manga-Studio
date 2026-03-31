/**
 * Bubble Shape Generators
 * SVG path generators for different manga speech bubble types
 * Supports tail direction: 'bottom', 'top', 'left', 'right'
 */

/**
 * Generate normal oval bubble with tail
 */
export function generateOvalBubble(options = {}) {
    const {
        width = 200,
        height = 100,
        tailPosition = 0.5,  // 0-1 position on edge
        tailLength = 30,
        tailDirection = 'bottom'
    } = options;

    const rx = width / 2;
    const ry = height / 2;
    const tailBaseWidth = 20;

    let path = '';

    if (tailDirection === 'bottom') {
        const tailStartX = (tailPosition * width) - (tailBaseWidth / 2);
        const tailEndX = tailStartX + tailBaseWidth;
        const tailTipX = (tailStartX + tailEndX) / 2;
        const tailTipY = height + tailLength;

        path = `
            M ${rx} 0
            C ${width} 0 ${width} ${height} ${rx} ${height}
            L ${tailEndX} ${height}
            L ${tailTipX} ${tailTipY}
            L ${tailStartX} ${height}
            C 0 ${height} 0 0 ${rx} 0
            Z
        `;
        return { path: path.replace(/\s+/g, ' ').trim(), width, height: height + tailLength };

    } else if (tailDirection === 'top') {
        const tailStartX = (tailPosition * width) - (tailBaseWidth / 2);
        const tailEndX = tailStartX + tailBaseWidth;
        const tailTipX = (tailStartX + tailEndX) / 2;
        const tailTipY = -tailLength;

        path = `
            M ${rx} 0
            L ${tailStartX} 0
            L ${tailTipX} ${tailTipY}
            L ${tailEndX} 0
            C ${width} 0 ${width} ${height} ${rx} ${height}
            C 0 ${height} 0 0 ${rx} 0
            Z
        `;
        return { path: path.replace(/\s+/g, ' ').trim(), width, height: height + tailLength, offsetY: tailLength };

    } else if (tailDirection === 'left') {
        const tailStartY = (tailPosition * height) - (tailBaseWidth / 2);
        const tailEndY = tailStartY + tailBaseWidth;
        const tailTipY = (tailStartY + tailEndY) / 2;
        const tailTipX = -tailLength;

        path = `
            M ${rx} 0
            C ${width} 0 ${width} ${height} ${rx} ${height}
            C 0 ${height} 0 ${tailEndY} 0 ${tailEndY}
            L ${tailTipX} ${tailTipY}
            L 0 ${tailStartY}
            C 0 0 0 0 ${rx} 0
            Z
        `;
        return { path: path.replace(/\s+/g, ' ').trim(), width: width + tailLength, height, offsetX: tailLength };

    } else if (tailDirection === 'right') {
        const tailStartY = (tailPosition * height) - (tailBaseWidth / 2);
        const tailEndY = tailStartY + tailBaseWidth;
        const tailTipY = (tailStartY + tailEndY) / 2;
        const tailTipX = width + tailLength;

        path = `
            M ${rx} 0
            C ${width} 0 ${width} ${tailStartY} ${width} ${tailStartY}
            L ${tailTipX} ${tailTipY}
            L ${width} ${tailEndY}
            C ${width} ${height} 0 ${height} ${rx} ${height}
            C 0 ${height} 0 0 ${rx} 0
            Z
        `;
        return { path: path.replace(/\s+/g, ' ').trim(), width: width + tailLength, height };
    }

    // Default bottom
    return { path: '', width, height };
}

/**
 * Generate spiky/shouting bubble
 */
export function generateSpikeyBubble(options = {}) {
    const {
        width = 200,
        height = 100,
        spikes = 12,
        spikeDepth = 15
    } = options;

    const cx = width / 2;
    const cy = height / 2;
    const rx = (width / 2) - spikeDepth;
    const ry = (height / 2) - spikeDepth;

    let path = '';
    const points = [];

    for (let i = 0; i < spikes * 2; i++) {
        const angle = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
        const isSpike = i % 2 === 0;
        const radius = isSpike ? 1 : 0.7;

        const x = cx + (rx + spikeDepth * radius) * Math.cos(angle);
        const y = cy + (ry + spikeDepth * radius) * Math.sin(angle);

        points.push({ x, y });
    }

    path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
        path += ` L ${points[i].x} ${points[i].y}`;
    }
    path += ' Z';

    return { path, width, height, points };
}

/**
 * Generate cloud/thought bubble
 */
export function generateCloudBubble(options = {}) {
    const {
        width = 200,
        height = 100,
        bumps = 8,
        tailDirection = 'bottom'
    } = options;

    const cx = width / 2;
    const cy = height / 2;
    const rx = width / 2 - 10;
    const ry = height / 2 - 10;
    const bumpSize = 20;

    let path = '';
    const points = [];

    for (let i = 0; i < bumps; i++) {
        const angle = (i / bumps) * Math.PI * 2;
        const x = cx + rx * Math.cos(angle);
        const y = cy + ry * Math.sin(angle);
        points.push({ x, y });
    }

    path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length; i++) {
        const current = points[i];
        const next = points[(i + 1) % points.length];
        const midX = (current.x + next.x) / 2;
        const midY = (current.y + next.y) / 2;

        const bumpAngle = Math.atan2(midY - cy, midX - cx);
        const bumpX = midX + bumpSize * Math.cos(bumpAngle);
        const bumpY = midY + bumpSize * Math.sin(bumpAngle);

        path += ` Q ${bumpX} ${bumpY} ${next.x} ${next.y}`;
    }
    path += ' Z';

    // Calculate thinking bubbles based on direction
    let thinkingBubbles = [];
    if (tailDirection === 'bottom') {
        thinkingBubbles = [
            { x: cx, y: height + 15, r: 8 },
            { x: cx - 10, y: height + 30, r: 5 },
            { x: cx - 15, y: height + 40, r: 3 }
        ];
    } else if (tailDirection === 'left') {
        thinkingBubbles = [
            { x: -15, y: cy, r: 8 },
            { x: -30, y: cy + 10, r: 5 },
            { x: -40, y: cy + 15, r: 3 }
        ];
    } else if (tailDirection === 'right') {
        thinkingBubbles = [
            { x: width + 15, y: cy, r: 8 },
            { x: width + 30, y: cy + 10, r: 5 },
            { x: width + 40, y: cy + 15, r: 3 }
        ];
    } else if (tailDirection === 'top') {
        thinkingBubbles = [
            { x: cx, y: -15, r: 8 },
            { x: cx + 10, y: -30, r: 5 },
            { x: cx + 15, y: -40, r: 3 }
        ];
    }

    return { path, width, height: height + 50, thinkingBubbles };
}

/**
 * Generate rectangle/narration bubble
 */
export function generateRectBubble(options = {}) {
    const {
        width = 200,
        height = 80,
        borderRadius = 8,
        hasTail = true,
        tailPosition = 0.5,
        tailLength = 20,
        tailDirection = 'bottom'
    } = options;

    let path;
    const r = borderRadius;

    if (!hasTail) {
        path = `
            M ${r} 0
            L ${width - r} 0
            Q ${width} 0 ${width} ${r}
            L ${width} ${height - r}
            Q ${width} ${height} ${width - r} ${height}
            L ${r} ${height}
            Q 0 ${height} 0 ${height - r}
            L 0 ${r}
            Q 0 0 ${r} 0
            Z
        `.replace(/\s+/g, ' ').trim();
        return { path, width, height };
    }

    if (tailDirection === 'bottom') {
        const tailBaseWidth = 15;
        const tailStartX = (tailPosition * width) - (tailBaseWidth / 2);
        const tailEndX = tailStartX + tailBaseWidth;
        const tailTipX = (tailStartX + tailEndX) / 2;
        const tailTipY = height + tailLength;

        path = `
            M ${r} 0 L ${width - r} 0
            Q ${width} 0 ${width} ${r}
            L ${width} ${height - r}
            Q ${width} ${height} ${width - r} ${height}
            L ${tailEndX} ${height}
            L ${tailTipX} ${tailTipY}
            L ${tailStartX} ${height}
            L ${r} ${height}
            Q 0 ${height} 0 ${height - r}
            L 0 ${r} Q 0 0 ${r} 0 Z
        `.replace(/\s+/g, ' ').trim();
        return { path, width, height: height + tailLength };

    } else if (tailDirection === 'left') {
        const tailBaseWidth = 15;
        const tailStartY = (tailPosition * height) - (tailBaseWidth / 2);
        const tailEndY = tailStartY + tailBaseWidth;
        const tailTipY = (tailStartY + tailEndY) / 2;
        const tailTipX = -tailLength;

        path = `
            M ${r} 0 L ${width - r} 0
            Q ${width} 0 ${width} ${r}
            L ${width} ${height - r}
            Q ${width} ${height} ${width - r} ${height}
            L ${r} ${height}
            Q 0 ${height} 0 ${height - r}
            L 0 ${tailEndY}
            L ${tailTipX} ${tailTipY}
            L 0 ${tailStartY}
            L 0 ${r} Q 0 0 ${r} 0 Z
        `.replace(/\s+/g, ' ').trim();
        return { path, width: width + tailLength, height, offsetX: tailLength };

    } else if (tailDirection === 'right') {
        const tailBaseWidth = 15;
        const tailStartY = (tailPosition * height) - (tailBaseWidth / 2);
        const tailEndY = tailStartY + tailBaseWidth;
        const tailTipY = (tailStartY + tailEndY) / 2;
        const tailTipX = width + tailLength;

        path = `
            M ${r} 0 L ${width - r} 0
            Q ${width} 0 ${width} ${r}
            L ${width} ${tailStartY}
            L ${tailTipX} ${tailTipY}
            L ${width} ${tailEndY}
            L ${width} ${height - r}
            Q ${width} ${height} ${width - r} ${height}
            L ${r} ${height}
            Q 0 ${height} 0 ${height - r}
            L 0 ${r} Q 0 0 ${r} 0 Z
        `.replace(/\s+/g, ' ').trim();
        return { path, width: width + tailLength, height };

    } else if (tailDirection === 'top') {
        const tailBaseWidth = 15;
        const tailStartX = (tailPosition * width) - (tailBaseWidth / 2);
        const tailEndX = tailStartX + tailBaseWidth;
        const tailTipX = (tailStartX + tailEndX) / 2;
        const tailTipY = -tailLength;

        path = `
            M ${r} 0
            L ${tailStartX} 0
            L ${tailTipX} ${tailTipY}
            L ${tailEndX} 0
            L ${width - r} 0
            Q ${width} 0 ${width} ${r}
            L ${width} ${height - r}
            Q ${width} ${height} ${width - r} ${height}
            L ${r} ${height}
            Q 0 ${height} 0 ${height - r}
            L 0 ${r} Q 0 0 ${r} 0 Z
        `.replace(/\s+/g, ' ').trim();
        return { path, width, height: height + tailLength, offsetY: tailLength };
    }

    return { path: '', width, height };
}

/**
 * Generate explosion/impact bubble
 */
export function generateExplosionBubble(options = {}) {
    const {
        width = 200,
        height = 150,
        points: numPoints = 16,
        irregularity = 0.3
    } = options;

    const cx = width / 2;
    const cy = height / 2;
    const outerRadius = Math.min(width, height) / 2 - 5;
    const innerRadius = outerRadius * 0.5;

    let path = '';
    const pts = [];

    for (let i = 0; i < numPoints * 2; i++) {
        const angle = (i / (numPoints * 2)) * Math.PI * 2 - Math.PI / 2;
        const isOuter = i % 2 === 0;

        const randomFactor = 1 + (Math.random() - 0.5) * irregularity;
        const radius = isOuter ? outerRadius * randomFactor : innerRadius * randomFactor;

        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);

        pts.push({ x, y });
    }

    path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
        path += ` L ${pts[i].x} ${pts[i].y}`;
    }
    path += ' Z';

    return { path, width, height };
}

/**
 * Generate whisper bubble (dashed oval)
 */
export function generateWhisperBubble(options = {}) {
    const {
        width = 180,
        height = 80,
        tailPosition = 0.5,
        tailLength = 25,
        tailDirection = 'bottom'
    } = options;

    return {
        ...generateOvalBubble({ width, height, tailPosition, tailLength, tailDirection }),
        strokeDashArray: [8, 4]
    };
}

// Export all generators
export const bubbleGenerators = {
    normal: generateOvalBubble,
    shouting: generateSpikeyBubble,
    thought: generateCloudBubble,
    narration: generateRectBubble,
    explosion: generateExplosionBubble,
    whisper: generateWhisperBubble
};

export default bubbleGenerators;
