import { useRef, useEffect, useState } from 'react'
import { SystemState } from '../types/SystemState'
import { detectGesture } from '../utils/gestureDetection'

/**
 * useHandTracking - Validated State Machine Edition
 * manages MediaPipe lifecycle and reports explicit state transitions.
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

    // Explicit State Machine
    const [systemState, setSystemState] = useState(SystemState.BOOTSTRAP)
    const [error, setError] = useState(null)
    const [debugText, setDebugText] = useState('SYSTEM BOOT...')

    // Gesture Smoothing
    const [detectedGesture, setDetectedGesture] = useState('SPHERE')
    const gestureBufferRef = useRef([])
    const GESTURE_CONFIDENCE_THRESHOLD = 15; // Frames

    useEffect(() => {
        if (initRef.current) return;
        initRef.current = true;

        const log = (msg) => {
            const time = new Date().toLocaleTimeString();
            console.log(`[HAND-TRACKING ${time}] ${msg}`);
            setDebugText(msg);
        };

        const transition = (newState) => {
            log(`Transition: ${systemState} -> ${newState}`);
            setSystemState(newState);
        };

        const fail = (msg, err) => {
            log(`CRITICAL FAILURE: ${msg}`);
            console.error(err);
            setError(`${msg}: ${err?.message || 'Unknown Error'}`);
            setSystemState(SystemState.ERROR);
        };

        // --- ASYNC INIT SEQUENCE ---
        const startSystem = async () => {
            try {
                transition(SystemState.LOADING_ASSETS);

                // 1. Verify/Poll for CDN Globals (timeout 3s)
                const waitForGlobals = () => new Promise((resolve, reject) => {
                    const check = () => {
                        if (window.Hands && window.Camera) return resolve();
                        if (performance.now() > 5000) return reject(new Error("Timeout waiting for MediaPipe globals."));
                        requestAnimationFrame(check);
                    };
                    check();
                });

                try {
                    await waitForGlobals();
                } catch (e) {
                    throw new Error("MediaPipe globals (Hands/Camera) not found. Check Internet/CDN.");
                }

                transition(SystemState.INITIALIZING_AI);

                // 2. Initialize Hands
                const hands = new window.Hands({
                    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
                });

                hands.setOptions({
                    maxNumHands: 2,
                    modelComplexity: 0,
                    minDetectionConfidence: 0.6,
                    minTrackingConfidence: 0.6,
                });

                hands.onResults((results) => {
                    // Update Refs
                    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                        handDataRef.current = {
                            hands: results.multiHandLandmarks.map(l => ({
                                x: (1.0 - l[9].x) * 2.0 - 1.0,
                                y: (1.0 - l[9].y) * 2.0 - 1.0,
                                z: 0
                            })),
                            rawLandmarks: results.multiHandLandmarks,
                            distance: 999
                        };

                        // --- GESTURE SMOOTHING ---
                        const instantaneousGesture = detectGesture(results.multiHandLandmarks);
                        gestureBufferRef.current.push(instantaneousGesture);

                        if (gestureBufferRef.current.length > GESTURE_CONFIDENCE_THRESHOLD) {
                            gestureBufferRef.current.shift();
                        }

                        // Check if buffer is uniform
                        if (gestureBufferRef.current.length === GESTURE_CONFIDENCE_THRESHOLD) {
                            const allMatch = gestureBufferRef.current.every(g => g === instantaneousGesture);
                            if (allMatch) {
                                setDetectedGesture(instantaneousGesture);
                            }
                        }

                        // Update Debug Text with Stable Gesture
                        // Note: Using a ref-based text would be cleaner to avoid re-renders,
                        // but setDebugText is used for UI overlay, so it's OK.
                        // We might want to debounce this as well.
                    } else {
                        handDataRef.current.hands = [];
                    }
                });

                // 3. Initialize Camera
                log("Requesting Camera Access...");
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 640, height: 480, frameRate: 60 }
                });

                const video = document.createElement('video');
                video.srcObject = stream;
                video.style.display = 'none';
                video.playsInline = true;
                await video.play();
                videoRef.current = video;

                const camera = new window.Camera(video, {
                    onFrame: async () => {
                        if (video && video.videoWidth > 0 && systemState !== SystemState.ERROR) {
                            await hands.send({ image: video });
                        }
                    },
                    width: 640, height: 480,
                });

                cameraRef.current = camera;

                log("Starting Camera Loop...");
                await camera.start();

                // If we get here, the camera loop has started.
                transition(SystemState.READY);

            } catch (err) {
                fail("Initialization Failed", err);
            }
        };

        // --- WATCHDOG (15s) ---
        const watchdog = setTimeout(() => {
            if (systemState !== SystemState.READY && systemState !== SystemState.ERROR) {
                fail("Watchdog Timeout", new Error("System took too long to initialize"));
            }
        }, 15000);

        startSystem();

        return () => {
            clearTimeout(watchdog);
            if (cameraRef.current) cameraRef.current.stop();
            if (videoRef.current && videoRef.current.srcObject) {
                const tracks = videoRef.current.srcObject.getTracks();
                tracks.forEach(t => t.stop());
            }
        };
    }, []); // Run once

    // Return detectedGesture for App Consumption
    return { handDataRef, debugText, videoRef, systemState, error, detectedGesture }
}
