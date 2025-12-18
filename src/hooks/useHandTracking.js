import { useRef, useEffect, useState } from 'react'
import { SystemState } from '../types/SystemState'

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

                // 1. Verify CDN Globals
                if (!window.Hands || !window.Camera) {
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
                            distance: results.multiHandLandmarks.length === 2 ?
                                Math.sqrt(Math.pow(results.multiHandLandmarks[0][9].x - results.multiHandLandmarks[1][9].x, 2) + Math.pow(results.multiHandLandmarks[0][9].y - results.multiHandLandmarks[1][9].y, 2)) : 999,
                            isHandshake: false
                        };
                        setDebugText(`ACTIVE: ${results.multiHandLandmarks.length} HANDS`);
                    } else {
                        // On first result, if we are not ready, we *could* mark ready, 
                        // but we wait for camera start success below.
                        if (handDataRef.current.hands.length > 0) setDebugText('Scanning...');
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

    return { handDataRef, debugText, videoRef, systemState, error }
}
