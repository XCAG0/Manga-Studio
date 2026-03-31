/**
 * Text Detection Service
 * ======================
 * خدمه للتواصل مع باك إند كشف النصوص
 */

const TEXT_DETECTION_API = 'http://localhost:5000/api';

/**
 * فحص حاله السيرفر
 */
export async function checkTextDetectionHealth() {
    try {
        const response = await fetch(`${TEXT_DETECTION_API}/health`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            return { success: false, error: 'Server not responding' };
        }

        return await response.json();
    } catch (error) {
        console.error('[TextDetection] Health check failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * تهيئه الكاشف
 * @param {string} lang - اللغه (japan, korean, ch, en)
 */
export async function initializeDetector(lang = 'japan') {
    try {
        const response = await fetch(`${TEXT_DETECTION_API}/initialize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lang })
        });

        return await response.json();
    } catch (error) {
        console.error('[TextDetection] Initialization failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * كشف فقاعات النص في الصوره
 * @param {string} imageBase64 - الصوره بصيغه base64
 * @param {string} lang - كود اللغه (en, korean, japan, ch)
 * @param {string} engine - محرك OCR (paddleocr, easyocr)
 * @returns {Promise<Object>} نتائج الكشف
 */
export async function detectBubbles(imageBase64, lang = 'en', engine = 'paddleocr', options = {}) {
    try {
        const { includeText = true } = options;
        const response = await fetch(`${TEXT_DETECTION_API}/detect-bubbles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image: imageBase64,
                lang: lang,
                engine: engine,
                includeText
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Unknown error');
        }

        return result;
    } catch (error) {
        console.error('[BubbleDetection] Detection failed:', error);
        return {
            success: false,
            error: error.message,
            bubbles: []
        };
    }
}

/**
 * تحويل صوره الخلفيه إلى base64 مع معلومات الموقع والحجم
 * @param {fabric.Canvas} canvas - الـ Canvas
 * @param {number} imageIndex - Index of image to process (default: 0 = first image)
 * @returns {Object|null} { image: base64, imageInfo: {...} }
 */
export function canvasToBase64ForDetection(canvas, imageIndex = 0) {
    if (!canvas) return null;

    // Get all images
    const objects = canvas.getObjects();
    const images = objects.filter(obj => obj.type === 'image');

    if (images.length === 0) {
        console.warn('[TextDetection] No images found');
        return null;
    }

    // Get specific image by index
    const bgImage = images[imageIndex] || images[0];

    console.log(`[TextDetection] Processing image ${imageIndex + 1} of ${images.length}`);

    // الحصول على عنصر الصوره الاصلي
    const imgElement = bgImage._element || bgImage.getElement?.();

    if (!imgElement) {
        console.warn('[TextDetection] لم يتم العثور على عنصر الصوره');
        return null;
    }

    // ابعاد الصوره الاصليه
    const originalWidth = imgElement.naturalWidth || imgElement.width;
    const originalHeight = imgElement.naturalHeight || imgElement.height;

    // موقع وحجم الصوره على الـ Canvas
    const imageInfo = {
        left: bgImage.left || 0,
        top: bgImage.top || 0,
        scaleX: bgImage.scaleX || 1,
        scaleY: bgImage.scaleY || 1,
        originalWidth: originalWidth,
        originalHeight: originalHeight
    };

    // إنشاء canvas مؤقت بحجم الصوره الاصليه
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = originalWidth;
    tempCanvas.height = originalHeight;

    const ctx = tempCanvas.getContext('2d');
    ctx.drawImage(imgElement, 0, 0, originalWidth, originalHeight);

    console.log(`[TextDetection] تم تصدير الصوره: ${originalWidth}×${originalHeight}`);
    console.log(`[TextDetection] موقع الصوره: left=${imageInfo.left}, top=${imageInfo.top}`);
    console.log(`[TextDetection] scale: ${imageInfo.scaleX}×${imageInfo.scaleY}`);

    return {
        image: tempCanvas.toDataURL('image/png'),
        imageInfo: imageInfo
    };
}
