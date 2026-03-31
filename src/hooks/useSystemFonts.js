/**
 * System Fonts Detection Hook
 * Uses queryLocalFonts API to detect all installed fonts
 */

import { useState, useEffect } from 'react';
import { TEXT } from '../utils/constants';

export function useSystemFonts() {
    const [fonts, setFonts] = useState(TEXT.FONTS);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function loadSystemFonts() {
            try {
                // Check if queryLocalFonts API is available
                if ('queryLocalFonts' in window) {
                    // Request permission and get fonts
                    const availableFonts = await window.queryLocalFonts();

                    // Extract unique font family names
                    const fontFamilies = new Set();
                    availableFonts.forEach(font => {
                        fontFamilies.add(font.family);
                    });

                    // Sort alphabetically
                    const sortedFonts = Array.from(fontFamilies).sort((a, b) =>
                        a.localeCompare(b, 'ar', { sensitivity: 'base' })
                    );

                    console.log(`[SystemFonts] تم اكتشاف ${sortedFonts.length} خط`);
                    setFonts(sortedFonts);
                } else {
                    console.log('[SystemFonts] queryLocalFonts غير مدعوم - استخدام القائمه الافتراضيه');
                    setError('queryLocalFonts API not supported');
                }
            } catch (err) {
                console.error('[SystemFonts] خطا:', err);
                setError(err.message);
                // Keep using fallback fonts
            } finally {
                setIsLoading(false);
            }
        }

        loadSystemFonts();
    }, []);

    return { fonts, isLoading, error };
}

export default useSystemFonts;
