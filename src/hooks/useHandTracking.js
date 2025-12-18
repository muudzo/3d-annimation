import { useRef, useEffect, useState } from 'react'

/**
 * useHandTracking - Failsafe Resurrection Edition
 * Implements granular state detection, timeouts, and robust error handling.
 * NOW USING CDN GLOBALS (window.Hands, window.Camera)
 */
export const useHandTracking = () => {
    const handDataRef = useRef({
        hands: [],
        rawLandmarks: [],
        distance: 999,
        isHandshake: false
    })

    const videoRef = useRef(null)
    const initRef = useRef(false)
    const cameraRef = useRef(null)
    const [debugText, setDebugText] = useState('SYSTEM BOOT...')

    // Helper to update the DOM preloader and internal state
    const updateStatus = (text, progress, isError = false) => {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`🦈 SHARK LOG [${timestamp}]: ${text}`);
        setDebugText(text);

        const bar = document.getElementById('bar');
        const statusLabel = document.getElementById('status-text');
        const errorDisplay = document.getElementById('error-msg');
        const retryButton = document.getElementById('retry-btn');

        if (bar) bar.style.width = `${progress}%`;
        if (statusLabel) statusLabel.innerText = text;

        if (isError) {
            if (statusLabel) statusLabel.style.color = '#ff3333';
            if (bar) bar.style.background = '#ff3333';
            if (errorDisplay) {
                errorDisplay.innerText = text;
                errorDisplay.style.display = 'block';
            }
            if (retryButton) retryButton.style.display = 'block';
        }
    }

    useEffect(() => {
        if (initRef.current) return;
        initRef.current = true;

        updateStatus("SYS: INITIALIZING ENGINE", 10);

        // Verify CDN Loaded
        if (!window.Hands || !window.Camera) {
            updateStatus("SYS ERROR: AI MODULES NOT FOUND. CHECK INTERNET.", 100, true);
            return;
        }

        // --- TIMEOUT CIRCUIT BREAKER (10S) ---
        const timeoutId = setTimeout(() => {
            if (!cameraRef.current) {
                updateStatus("SYS ERROR: BOOT TIMEOUT - POSSIBLE NETWORK OR HARDWARE LOCK", 100, true);
            }
        }, 12000); // 12s for extra buffer on M1

        const hands = new window.Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });

        hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 0, // LITE for speed
            minDetectionConfidence: 0.6,
            minTrackingConfidence: 0.6,
        });

        hands.onResults((results) => {
            // First success frame -> Hide preloader
            const preloader = document.getElementById('preloader');
            if (preloader && preloader.style.opacity !== '0' && !preloader.getAttribute('data-error')) {
                updateStatus("SYS: CORE STABLE", 100);
                setTimeout(() => {
                    preloader.style.opacity = '0';
                    setTimeout(() => { preloader.style.display = 'none'; }, 500);
                }, 800);
            }

            if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                // Update internal refs for useFrame loop
                handDataRef.current = {
                    hands: results.multiHandLandmarks.map(l => ({
                        x: (1.0 - l[9].x) * 2.0 - 1.0,
                        y: (1.0 - l[9].y) * 2.0 - 1.0,
                        z: 0
                    })),
                    rawLandmarks: results.multiHandLandmarks,
                    distance: results.multiHandLandmarks.length === 2 ?
                        Math.sqrt(Math.pow(results.multiHandLandmarks[0][9].x - results.multiHandLandmarks[1][9].x, 2) + Math.pow(results.multiHandLandmarks[0][9].y - results.multiHandLandmarks[1][9].y, 2)) : 999,
                    isHandshake: false
                };
                setDebugText(`ACTIVE: ${results.multiHandLandmarks.length} HANDS`);
            } else {
                setDebugText('SCANNING AREA...');
                handDataRef.current.hands = [];
                handDataRef.current.rawLandmarks = [];
            }
        });

        const startSystem = async () => {
            try {
                updateStatus("SYS: REQUESTING CAMERA ACCESS", 30);
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 640, height: 480, frameRate: 60 }
                });

                updateStatus("SYS: INFUSING AI MODEL", 60);
                const video = document.createElement('video');
                video.srcObject = stream;
                video.style.display = 'none'; // Background stream
                video.playsInline = true;
                await video.play();
                videoRef.current = video;

                const camera = new window.Camera(video, {
                    onFrame: async () => {
                        if (video && video.videoWidth > 0) {
                            await hands.send({ image: video });
                        }
                    },
                    width: 640, height: 480,
                });

                cameraRef.current = camera;

                updateStatus("SYS: CONNECTING NEURAL PATHWAYS", 80);
                await camera.start();

                clearTimeout(timeoutId);
                console.log("🦈 SHARK LOG: BOOT SUCCESSFUL");
            } catch (err) {
                clearTimeout(timeoutId);
                const preloader = document.getElementById('preloader');
                if (preloader) preloader.setAttribute('data-error', 'true');

                let errMsg = "CORE CRITICAL: " + err.message;
                if (err.name === 'NotAllowedError') errMsg = "PERM DENIED: CAMERA ACCESS REJECTED";
                if (err.name === 'NotFoundError') errMsg = "HARDWARE MISSING: NO CAMERA DETECTED";
                if (err.name === 'NotReadableError') errMsg = "HARDWARE LOCKED: CAMERA IN USE BY ANOTHER APP";

                updateStatus(errMsg, 100, true);
            }
        };

        startSystem();

        return () => {
            clearTimeout(timeoutId);
            if (cameraRef.current) cameraRef.current.stop();
            if (videoRef.current && videoRef.current.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            }
            hands.close();
        };
    }, []);

    return { handDataRef, debugText, videoRef }
}
