/**
 * Auto Translate Hook
 * Handles OCR + translation + cleanup mode selection
 */

import { useCallback } from 'react';
import * as fabric from 'fabric';
import { useEditorStore } from '../store/editorStore';
import { autoTranslate } from '../services/translationService';
import { applyBubbleEditToImage } from '../services/textRemovalService';
import { canvasToBase64ForDetection } from '../services/textDetectionService';
import { TEXT_EDIT_MODES } from '../utils/textEditModes';

export function useAutoTranslate() {
    const { canvas } = useEditorStore();

    const performAutoTranslate = useCallback(async (options) => {
        const {
            sourceLang,
            targetLang,
            font,
            engine,
            images: imageIndices,
            useBold = true,
            editMode = TEXT_EDIT_MODES.WHITE_BB,
            magicCleanerSettings = null,
        } = options;

        if (!canvas) {
            console.error('[AutoTranslate] No canvas');
            return { success: false, error: 'No canvas' };
        }

        let canvasModified = false;

        try {
            console.log(
                `[AutoTranslate] Starting: ${sourceLang} -> ${targetLang}, Font: ${font}, Bold: ${useBold}, Edit: ${editMode}`
            );

            for (const imageIndex of imageIndices) {
                console.log(`[AutoTranslate] Processing image ${imageIndex + 1}/${imageIndices.length}`);

                const result = canvasToBase64ForDetection(canvas, imageIndex);
                if (!result) {
                    console.warn(`[AutoTranslate] Failed to get image ${imageIndex}`);
                    continue;
                }

                const { image, imageInfo } = result;
                const translationResult = await autoTranslate(image, sourceLang, targetLang, engine);

                if (!translationResult.success) {
                    console.error('[AutoTranslate] Translation failed:', translationResult.error);
                    continue;
                }

                console.log(`[AutoTranslate] Got ${translationResult.count} bubbles`);

                if (editMode === TEXT_EDIT_MODES.MAGIC_CLEANER) {
                    await applyBubbleEditToImage(image, translationResult.bubbles, {
                        imageIndex,
                        editMode,
                        magicOptions: magicCleanerSettings,
                        saveHistory: false,
                    });
                } else {
                    whitenBubbles(canvas, translationResult.bubbles, imageInfo);
                }

                renderTranslatedText(
                    canvas,
                    translationResult.bubbles,
                    imageInfo,
                    font,
                    targetLang,
                    useBold
                );
                canvasModified = true;
            }

            if (canvasModified) {
                canvas.renderAll();
                useEditorStore.getState().saveState();
            }

            console.log('[AutoTranslate] Complete');
            return { success: true };
        } catch (error) {
            console.error('[AutoTranslate] Error:', error);
            return { success: false, error: error.message };
        }
    }, [canvas]);

    return { performAutoTranslate };
}

function whitenBubbles(canvas, bubbles, imageInfo) {
    bubbles.forEach(bubble => {
        const lineBoxes = bubble.lineBoxes || [];

        lineBoxes.forEach(lineBox => {
            const rect = new fabric.Rect({
                left: lineBox.x + imageInfo.left,
                top: lineBox.y + imageInfo.top,
                width: lineBox.width,
                height: lineBox.height,
                fill: 'white',
                selectable: false,
                evented: false,
                excludeFromExport: false,
            });

            canvas.add(rect);
        });

        if (lineBoxes.length === 0) {
            const rect = new fabric.Rect({
                left: bubble.left + imageInfo.left,
                top: bubble.top + imageInfo.top,
                width: bubble.rx * 2,
                height: bubble.ry * 2,
                fill: 'white',
                selectable: false,
                evented: false,
                excludeFromExport: false,
            });

            canvas.add(rect);
        }
    });

    console.log(`[AutoTranslate] Whitened ${bubbles.length} bubbles`);
}

function calculateOptimalFontSize(text, bubbleWidth, bubbleHeight, fontFamily, isRTL, useBold) {
    const paddingX = 30;
    const paddingY = 20;
    const maxWidth = bubbleWidth - paddingX;
    const maxHeight = bubbleHeight - paddingY;

    let minSize = 18;
    let maxSize = 80;
    let optimalSize = minSize;

    for (let i = 0; i < 8; i++) {
        const testSize = Math.floor((minSize + maxSize) / 2);
        const tempText = new fabric.Textbox(text, {
            fontSize: testSize,
            fontFamily,
            fontWeight: useBold ? 'bold' : 'normal',
            textAlign: 'center',
            width: maxWidth,
            direction: isRTL ? 'rtl' : 'ltr',
            splitByGrapheme: false,
        });

        if (tempText.height <= maxHeight) {
            optimalSize = testSize;
            minSize = testSize + 1;
        } else {
            maxSize = testSize - 1;
        }
    }

    return Math.max(18, Math.min(optimalSize, 70));
}

function renderTranslatedText(canvas, bubbles, imageInfo, fontFamily, targetLang, useBold = true) {
    const textObjects = [];

    bubbles.forEach((bubble, idx) => {
        const translatedText = bubble.translated_text || bubble.text;
        if (!translatedText) {
            return;
        }

        const centerX = bubble.cx + imageInfo.left;
        const centerY = bubble.cy + imageInfo.top;
        const bubbleWidth = bubble.rx * 2;
        const bubbleHeight = bubble.ry * 2;
        const isRTL = targetLang === 'ar';

        const optimalFontSize = calculateOptimalFontSize(
            translatedText,
            bubbleWidth,
            bubbleHeight,
            fontFamily,
            isRTL,
            useBold
        );

        const textbox = new fabric.Textbox(translatedText, {
            left: centerX,
            top: centerY,
            fontSize: optimalFontSize,
            fontFamily,
            fontWeight: useBold ? 'bold' : 'normal',
            fill: '#000000',
            stroke: useBold ? '#000000' : 'transparent',
            strokeWidth: useBold ? 0.5 : 0,
            originX: 'center',
            originY: 'center',
            textAlign: 'center',
            width: bubbleWidth - 30,
            splitByGrapheme: false,
            direction: isRTL ? 'rtl' : 'ltr',
            editable: true,
            selectable: true,
            lineHeight: 1.2,
            charSpacing: 0,
            name: `Translation ${idx + 1}`,
            customType: 'translated-text',
            bubbleId: bubble.id || idx,
            originalText: bubble.text,
            translatedText,
            sourceLang: bubble.sourceLang,
            targetLang,
        });

        textObjects.push(textbox);
    });

    textObjects.forEach(obj => canvas.add(obj));
    console.log(`[AutoTranslate] Rendered ${textObjects.length} translated texts`);
}

export default useAutoTranslate;
