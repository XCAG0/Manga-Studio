import React, { useState, useEffect } from 'react';
import TitleBar from './components/TitleBar/TitleBar';
import Toolbar from './components/Toolbar/Toolbar';
import LayersPanel from './components/LayersPanel/LayersPanel';
import TextManager from './components/TextManager/TextManager';
import PropertiesPanel from './components/PropertiesPanel/PropertiesPanel';
import Canvas from './components/Canvas/Canvas';
import StatusBar from './components/StatusBar/StatusBar';
import HomePage from './components/HomePage/HomePage';
import ResizablePanel from './components/ResizablePanel/ResizablePanel';
import BubbleCreator from './components/BubbleCreator/BubbleCreator';
import { useEditorStore } from './store/editorStore';
import { performStartupVerification } from './services/updateService';
import './styles/App.css';

// Discord invite link
const DISCORD_LINK = 'https://discord.gg/UrR7yPUR5f';

function isNetworkVerificationError(message = '') {
    const normalized = String(message).toLowerCase();
    return (
        normalized.includes('internet') ||
        normalized.includes('network') ||
        normalized.includes('failed to fetch') ||
        normalized.includes('fetcherror') ||
        normalized.includes('err_network') ||
        normalized.includes('err_internet_disconnected') ||
        normalized.includes('timeout')
    );
}

function App() {
    const { currentPage, showProperties, showLayers, showTextManager, showBubbleCreator, setShowBubbleCreator } = useEditorStore();
    const [appState, setAppState] = useState('verifying'); // verifying, no_internet, blocked, loading_python, ready
    const [loadingMessage, setLoadingMessage] = useState('Verifying application...');
    const [errorMessage, setErrorMessage] = useState('');

    // GLOBAL close handler - handles Alt+F4 and X button for ALL app states
    useEffect(() => {
        if (!window.electronAPI?.onCloseRequested) return;

        const cleanup = window.electronAPI.onCloseRequested(() => {
            // If we're NOT in the editor, close immediately (no unsaved changes)
            // If we ARE in the editor, TitleBar will handle the save confirmation
            if (currentPage !== 'editor') {
                console.log('[App] Close requested - not in editor, closing immediately');
                window.electronAPI.confirmClose(true);
            }
            // If in editor, TitleBar's listener will handle it
        });

        return cleanup;
    }, [currentPage]);

    // Step 1: Verify app status (requires internet)
    useEffect(() => {
        const verifyApp = async () => {
            try {
                console.log('[App] Starting verification...');
                const result = await performStartupVerification();

                if (!result.success) {
                    console.error('[App] Verification failed:', result);

                    // Determine error type
                    if (result.step === 'status_check' || result.errors?.includes('Failed to verify app status')) {
                        setAppState(isNetworkVerificationError(result.message) ? 'no_internet' : 'blocked');
                        setErrorMessage(
                            result.message || 'Unable to verify application status. Internet connection is required.'
                        );
                    } else if (result.step === 'emergency_shutdown') {
                        setAppState('blocked');
                        setErrorMessage(result.message || 'Application is temporarily unavailable.');
                    } else if (result.step === 'maintenance') {
                        setAppState('blocked');
                        setErrorMessage(result.message || 'Scheduled maintenance in progress.');
                    } else if (result.step === 'inactive') {
                        setAppState('blocked');
                        setErrorMessage('Application is no longer active.');
                    } else if (result.step === 'unsupported_version') {
                        setAppState('blocked');
                        setErrorMessage('This version is no longer supported. Please update.');
                    } else if (result.step === 'mandatory_update') {
                        setAppState('blocked');
                        setErrorMessage('A required update is available. Please update to continue.');
                    } else {
                        setAppState('no_internet');
                        setErrorMessage(result.message || 'Unable to verify application.');
                    }
                    return;
                }

                console.log('[App] Verification successful, checking Python server...');
                setAppState('loading_python');
                setLoadingMessage('Initializing AI Engine...');

            } catch (error) {
                console.error('[App] Verification error:', error);
                setAppState(isNetworkVerificationError(error?.message) ? 'no_internet' : 'blocked');
                setErrorMessage(
                    error?.message || 'Unable to verify application status.'
                );
            }
        };

        verifyApp();
    }, []);

    // Step 2: Check Python server (only after verification passes)
    useEffect(() => {
        if (appState !== 'loading_python') return;

        let attempts = 0;
        const maxAttempts = 60;

        const checkPythonServer = async () => {
            try {
                const response = await fetch('http://localhost:5000/api/health', {
                    method: 'GET',
                    signal: AbortSignal.timeout(2000)
                });

                if (response.ok) {
                    setLoadingMessage('AI Engine Ready!');
                    setTimeout(() => setAppState('ready'), 500);
                    return true;
                }
            } catch (error) {
                // Server not ready yet
            }
            return false;
        };

        const pollServer = setInterval(async () => {
            attempts++;

            if (attempts <= 3) {
                setLoadingMessage('Starting AI Engine...');
            } else if (attempts <= 10) {
                setLoadingMessage('Loading AI Models...');
            } else if (attempts <= 30) {
                setLoadingMessage('Downloading AI Models... This may take a few minutes on first run.');
            } else {
                setLoadingMessage(`Still loading... (${Math.floor(attempts * 2 / 60)}m ${(attempts * 2) % 60}s)`);
            }

            const ready = await checkPythonServer();
            if (ready) {
                clearInterval(pollServer);
            } else if (attempts >= maxAttempts) {
                setLoadingMessage('AI Engine initialization timeout - continuing anyway');
                setTimeout(() => setAppState('ready'), 1000);
                clearInterval(pollServer);
            }
        }, 2000);

        return () => clearInterval(pollServer);
    }, [appState]);

    // No Internet / Blocked Screen
    if (appState === 'no_internet' || appState === 'blocked') {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                background: '#1a1a2e',
                padding: '2rem',
                textAlign: 'center'
            }}>
                {/* Icon */}
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" style={{ marginBottom: '1.5rem' }}>
                    {appState === 'no_internet' ? (
                        <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.58 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />
                    ) : (
                        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zM4.93 4.93l14.14 14.14" />
                    )}
                </svg>

                {/* Title */}
                <h2 style={{
                    color: '#fff',
                    fontSize: '1.25rem',
                    fontWeight: '500',
                    marginBottom: '0.75rem'
                }}>
                    {appState === 'no_internet' ? 'No Internet Connection' : 'Unavailable'}
                </h2>

                {/* Message */}
                <p style={{
                    color: 'rgba(255, 255, 255, 0.5)',
                    fontSize: '0.875rem',
                    maxWidth: '320px',
                    lineHeight: '1.5',
                    marginBottom: '2rem'
                }}>
                    {errorMessage}
                </p>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            padding: '10px 20px',
                            background: '#2d2d44',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '6px',
                            color: '#fff',
                            fontSize: '0.875rem',
                            cursor: 'pointer'
                        }}
                    >
                        Retry
                    </button>

                    <button
                        onClick={() => {
                            if (window.electronAPI?.openExternal) {
                                window.electronAPI.openExternal(DISCORD_LINK);
                            }
                        }}
                        style={{
                            padding: '10px 20px',
                            background: 'transparent',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '6px',
                            color: 'rgba(255,255,255,0.7)',
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                        </svg>
                        Discord
                    </button>
                </div>
            </div>
        );
    }

    // Loading Screen (Verifying or Python)
    if (appState === 'verifying' || appState === 'loading_python') {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                padding: '2rem'
            }}>
                <style>{`
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                    @keyframes pulse {
                        0%, 100% { opacity: 0.6; }
                        50% { opacity: 1; }
                    }
                `}</style>

                {/* Spinner */}
                <div style={{
                    width: '60px',
                    height: '60px',
                    border: '4px solid rgba(255, 255, 255, 0.1)',
                    borderTopColor: '#e94560',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                    marginBottom: '2.5rem'
                }}></div>

                {/* Loading Message */}
                <p style={{
                    margin: 0,
                    fontSize: '1rem',
                    fontWeight: '500',
                    color: 'rgba(255, 255, 255, 0.8)',
                    letterSpacing: '0.5px',
                    animation: 'pulse 2s ease-in-out infinite',
                    maxWidth: '450px',
                    textAlign: 'center',
                    lineHeight: '1.6'
                }}>{loadingMessage}</p>
            </div>
        );
    }

    // Show HomePage
    if (currentPage === 'home') {
        return <HomePage />;
    }

    // Show Editor
    return (
        <div className="app">
            <TitleBar />
            <div className="app-body">
                <Toolbar />
                <div className="main-workspace">
                    <Canvas />
                </div>
                <div className="side-panels">
                    {showProperties && (
                        <ResizablePanel defaultHeight={180} minHeight={100} maxHeight={400}>
                            <PropertiesPanel />
                        </ResizablePanel>
                    )}
                    {showLayers && (
                        <ResizablePanel defaultHeight={180} minHeight={100} maxHeight={350}>
                            <LayersPanel />
                        </ResizablePanel>
                    )}
                    {showTextManager && (
                        <ResizablePanel isLast={true} minHeight={120}>
                            <TextManager />
                        </ResizablePanel>
                    )}
                </div>
            </div>

            {/* Floating Panels */}
            <BubbleCreator
                isVisible={showBubbleCreator}
                onClose={() => setShowBubbleCreator(false)}
            />

            <StatusBar />
        </div>
    );
}

export default App;

