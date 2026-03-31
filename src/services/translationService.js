/**
 * Manga Studio - Translation Service
 * Communicates with Python backend for OCR and translation
 */

const API_BASE_URL = 'http://localhost:8765';

/**
 * Check if backend is running
 * @returns {Promise<boolean>}
 */
export async function checkBackendHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        const data = await response.json();
        return data.status === 'ok';
    } catch (error) {
        console.error('Backend not available:', error);
        return false;
    }
}

/**
 * Convert canvas to base64 image
 * @param {fabric.Canvas} canvas 
 * @returns {string}
 */
export function canvasToBase64(canvas) {
    return canvas.toDataURL({
        format: 'png',
        quality: 1
    });
}

/**
 * Extract text from image using OCR
 * @param {string} imageBase64 - Base64 encoded image
 * @returns {Promise<Array>}
 */
export async function extractText(imageBase64) {
    try {
        const response = await fetch(`${API_BASE_URL}/extract-text`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image: imageBase64 }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.texts || [];
    } catch (error) {
        console.error('Error extracting text:', error);
        throw error;
    }
}

/**
 * Translate array of texts
 * @param {string[]} texts - Array of texts to translate
 * @param {string} sourceLang - Source language code (default: 'ja')
 * @param {string} targetLang - Target language code (default: 'ar')
 * @returns {Promise<string[]>}
 */
export async function translateTexts(texts, sourceLang = 'ja', targetLang = 'ar') {
    try {
        const response = await fetch(`${API_BASE_URL}/translate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                texts,
                source_lang: sourceLang,
                target_lang: targetLang,
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.translations || [];
    } catch (error) {
        console.error('Error translating:', error);
        throw error;
    }
}

/**
 * Auto-translate: OCR Detection + Translation
 * @param {string} imageBase64 - Base64 encoded image
 * @param {string} sourceLang - Source language (japan, korean, ch, en)
 * @param {string} targetLang - Target language (en, ar, es, fr, de)
 * @param {string} engine - OCR engine (paddleocr, easyocr)
 * @returns {Promise<Object>} Translation result with bubbles
 */
export async function autoTranslate(imageBase64, sourceLang = 'japan', targetLang = 'en', engine = 'paddleocr') {
    try {
        const response = await fetch('http://localhost:5000/api/auto-translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image: imageBase64,
                source_lang: sourceLang,
                target_lang: targetLang,
                engine: engine
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Translation failed');
        }

        console.log(`[AutoTranslate] ${data.count} bubbles: ${sourceLang} → ${targetLang}`);

        return data;
    } catch (error) {
        console.error('Error in auto-translate:', error);
        return {
            success: false,
            error: error.message,
            bubbles: []
        };
    }
}

// Language options
export const LANGUAGES = {
    ar: 'العربيه',
    en: 'English',
    fr: 'Français',
    es: 'Español',
    de: 'Deutsch',
    ko: '한국어',
    zh: '中文',
};

export default {
    checkBackendHealth,
    canvasToBase64,
    extractText,
    translateTexts,
    autoTranslate,
    LANGUAGES,
};
