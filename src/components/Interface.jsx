import React, { useState, useEffect } from 'react';
import { SystemState } from '../types/SystemState';

export const Interface = ({ systemState, error, debugText, detectedGesture, onStart }) => {
    const [started, setStarted] = useState(false);
    const [showHelp, setShowHelp] = useState(false);

    // Auto-start if already started (persisted?) - Nah, let's force click for Audio context.

    const handleStart = () => {
        setStarted(true);
        onStart();
    };

    const toggleHelp = () => setShowHelp(!showHelp);

    // 1. LOADING / ERROR SCREEN
    if (systemState !== SystemState.READY) {
        return (
            <div style={styles.overlay}>
                {systemState === SystemState.ERROR ? (
                    <div style={styles.errorContainer}>
                        <h1 style={styles.errorTitle}>SYSTEM FAILURE</h1>
                        <p style={styles.errorMsg}>{error}</p>
                        <button onClick={() => window.location.reload()} style={styles.rebootBtn}>
                            REBOOT_SYSTEM
                        </button>
                    </div>
                ) : (
                    <div style={styles.loadingContainer}>
                        <div className="glitch" style={styles.loadingText}>{systemState}...</div>
                        <div style={styles.subText}>{debugText}</div>
                        <div style={styles.loader}></div>
                    </div>
                )}
            </div>
        );
    }

    // 2. LANDING SCREEN (Ready but not started)
    if (!started) {
        return (
            <div style={styles.overlay}>
                <h1 style={styles.title}>NEURAL_PARTICLES</h1>
                <p style={styles.subtitle}>GESTURE CONTROLLED INTERFACE</p>
                <button onClick={handleStart} style={styles.startBtn}>
                    INITIALIZE_LINK
                </button>
                <div style={styles.instructions}>
                    [ ENABLE CAMERA & AUDIO ACCESS ]
                </div>
            </div>
        );
    }

    // 3. HUD (Active)
    return (
        <div style={styles.hudContainer}>
            {/* Top Left: Status */}
            <div style={styles.statusPanel}>
                <div style={styles.statusLine}>
                    <span style={styles.label}>SYS:</span> <span style={styles.value}>ONLINE</span>
                </div>
                <div style={styles.statusLine}>
                    <span style={styles.label}>FPS:</span> <span style={styles.value}>60</span>
                </div>
                <div style={styles.statusLine}>
                    <span style={styles.label}>AI:</span> <span style={styles.value}>{debugText}</span>
                </div>
            </div>

            {/* Top Center: Gesture Feedback */}
            <div style={styles.gesturePanel}>
                <div style={styles.gestureLabel}>DETECTED PATTERN</div>
                <div style={styles.gestureValue}>{detectedGesture}</div>
            </div>

            {/* Bottom Right: Controls/Help */}
            <div style={styles.footer}>
                <button onClick={toggleHelp} style={styles.iconBtn}>
                    ? HELP
                </button>
            </div>

            {/* Help Overlay */}
            {showHelp && (
                <div style={styles.helpOverlay} onClick={toggleHelp}>
                    <div style={styles.helpContent}>
                        <h2>COMMAND_LIST</h2>
                        <ul>
                            <li><strong>0-1 Fingers:</strong> SPHERE (Idle)</li>
                            <li><strong>2 Fingers:</strong> FLOWER</li>
                            <li><strong>3 Fingers:</strong> SATURN</li>
                            <li><strong>4 Fingers:</strong> HEART</li>
                            <li><strong>5 Fingers:</strong> FIREWORKS / REPEL</li>
                            <li><strong>PINCH:</strong> ATTRACT PARTICLES</li>
                        </ul>
                        <div style={styles.closeHelp}>[ CLICK TO CLOSE ]</div>
                    </div>
                </div>
            )}
        </div>
    );
};

const styles = {
    overlay: {
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        background: 'rgba(0, 0, 0, 0.9)',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        zIndex: 1000,
        fontFamily: 'monospace',
        color: '#00ffff',
        userSelect: 'none'
    },
    errorContainer: { textAlign: 'center', color: '#ff3333' },
    errorTitle: { fontSize: '32px', marginBottom: '10px' },
    errorMsg: { maxWidth: '500px', marginBottom: '20px' },
    rebootBtn: {
        background: 'transparent', color: '#ff3333', border: '1px solid #ff3333',
        padding: '12px 24px', cursor: 'pointer', fontFamily: 'monospace', fontSize: '16px'
    },
    loadingContainer: { textAlign: 'center' },
    loadingText: { fontSize: '24px', letterSpacing: '4px', marginBottom: '10px' },
    subText: { fontSize: '12px', opacity: 0.7 },
    title: { fontSize: '48px', letterSpacing: '8px', marginBottom: '10px', textShadow: '0 0 10px #00ffff' },
    subtitle: { fontSize: '14px', letterSpacing: '4px', opacity: 0.8, marginBottom: '40px' },
    startBtn: {
        background: 'rgba(0, 255, 255, 0.1)', color: '#00ffff', border: '1px solid #00ffff',
        padding: '16px 48px', cursor: 'pointer', fontFamily: 'monospace', fontSize: '18px',
        letterSpacing: '2px', transition: 'all 0.3s',
        boxShadow: '0 0 15px rgba(0, 255, 255, 0.2)'
    },
    instructions: { marginTop: '20px', fontSize: '10px', opacity: 0.5 },

    hudContainer: {
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
        pointerEvents: 'none', // Let clicks pass through to Canvas for manual interact if needed
        padding: '20px',
        boxSizing: 'border-box',
        fontFamily: 'monospace', color: '#00ffff'
    },
    statusPanel: {
        position: 'absolute', top: '20px', left: '20px',
        textAlign: 'left'
    },
    statusLine: { marginBottom: '5px', fontSize: '12px', textShadow: '1px 1px 2px black' },
    label: { opacity: 0.7 },
    value: { fontWeight: 'bold' },

    gesturePanel: {
        position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)',
        textAlign: 'center',
        border: '1px solid rgba(0,255,255,0.3)',
        background: 'rgba(0,0,0,0.5)',
        padding: '10px 30px',
        borderRadius: '20px'
    },
    gestureLabel: { fontSize: '10px', opacity: 0.7, marginBottom: '5px' },
    gestureValue: { fontSize: '24px', fontWeight: 'bold', letterSpacing: '2px', color: '#fff' },

    footer: {
        position: 'absolute', bottom: '20px', right: '20px',
        pointerEvents: 'auto'
    },
    iconBtn: {
        background: 'rgba(0,0,0,0.8)', color: '#00ffff', border: '1px solid #00ffff',
        borderRadius: '50%', width: '40px', height: '40px',
        cursor: 'pointer', fontFamily: 'monospace', fontWeight: 'bold'
    },

    helpOverlay: {
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        background: 'rgba(0,0,0,0.85)',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        zIndex: 2000,
        pointerEvents: 'auto',
        cursor: 'pointer'
    },
    helpContent: {
        background: '#000', border: '1px solid #00ffff', padding: '40px',
        maxWidth: '500px', lineHeight: '1.6',
        boxShadow: '0 0 30px rgba(0, 255, 255, 0.2)'
    },
    closeHelp: { marginTop: '20px', fontSize: '12px', opacity: 0.7, textAlign: 'center' }

};
