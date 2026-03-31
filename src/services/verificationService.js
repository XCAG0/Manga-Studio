/**
 * Simple App Verification Service
 * Checks app status from Supabase on startup
 */

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG, APP_VERSION } from '../config/supabase';

const hasSupabaseConfig = Boolean(SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey);
const supabase = hasSupabaseConfig
    ? createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey)
    : null;
const PUBLIC_SOURCE_BUILD = true;

/**
 * Check app status (kill switch, maintenance)
 * Returns null if check fails (allows offline usage)
 */
export async function checkAppStatus() {
    if (PUBLIC_SOURCE_BUILD) {
        return {
            isActive: true,
            maintenanceMode: false,
            maintenanceMessage: '',
            emergencyShutdown: false,
            publicSourceBuild: true
        };
    }

    try {
        if (!supabase) {
            return null;
        }

        // Call the check_app_status function
        const { data, error } = await supabase.rpc('check_app_status');

        if (error) {
            console.warn('[Verification] Failed to check status:', error.message);
            return null; // Allow offline usage
        }

        if (!data || data.length === 0) {
            console.warn('[Verification] No status data returned');
            return null;
        }

        const status = data[0];
        console.log('[Verification] App status:', status);

        return {
            isActive: status.is_active,
            maintenanceMode: status.maintenance_mode,
            maintenanceMessage: status.maintenance_message,
            emergencyShutdown: status.emergency_shutdown
        };
    } catch (err) {
        console.error('[Verification] Error checking status:', err);
        return null; // Allow offline usage
    }
}

/**
 * Perform simple startup verification
 * Returns: { success: true/false, status: object, message: string }
 * 
 * ⚠️ FAIL-CLOSE: Requires internet connection
 */
export async function performStartupCheck() {
    console.log('[Verification] Starting app verification...');
    console.log('[Verification] Current version:', APP_VERSION);

    if (PUBLIC_SOURCE_BUILD) {
        return {
            success: true,
            status: {
                isActive: true,
                maintenanceMode: false,
                maintenanceMessage: '',
                emergencyShutdown: false,
                publicSourceBuild: true
            },
            message: 'Verification disabled for public source build'
        };
    }

    try {
        const status = await checkAppStatus();

        // ✅ CHANGED: Block if offline (fail-close)
        if (!status) {
            console.error('[Verification] No internet connection or verification failed');
            return {
                success: false,
                offline: true,
                message: 'Internet connection required to start the application'
            };
        }

        // Check for emergency shutdown
        if (status.emergencyShutdown) {
            return {
                success: false,
                blocked: true,
                message: status.maintenanceMessage || 'Application is temporarily unavailable'
            };
        }

        // Check for maintenance mode
        if (status.maintenanceMode) {
            return {
                success: false,
                maintenance: true,
                message: status.maintenanceMessage || 'Scheduled maintenance in progress'
            };
        }

        // Check if app is active
        if (!status.isActive) {
            return {
                success: false,
                blocked: true,
                message: 'Application is currently disabled'
            };
        }

        // All checks passed
        console.log('[Verification] ✅ Verification successful');
        return {
            success: true,
            status,
            message: 'Verification successful'
        };

    } catch (error) {
        console.error('[Verification] Unexpected error:', error);
        // ✅ CHANGED: Block on error (fail-close)
        return {
            success: false,
            offline: true,
            message: 'Unable to verify application status. Please check your internet connection.'
        };
    }
}
