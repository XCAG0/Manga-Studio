export const SUPABASE_CONFIG = {
    url: import.meta.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY
};

export const APP_VERSION = '1.0.0';

/**
 * Update check configuration
 */
export const UPDATE_CONFIG = {
    checkOnStartup: false, 
    checkInterval: 3600000, 
    retryAttempts: 3,
    retryDelay: 5000, 
    timeout: 10000 
};
