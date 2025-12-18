import { useRef, useEffect, useState } from 'react'
import { Hands } from '@mediapipe/hands'
import { Camera } from '@mediapipe/camera_utils'

export const useHandTracking = () => {
    // Store state in ref to avoid re-renders (loop reads this directly)
    const handDataRef = useRef({
        hands: [],
        distance: 999,
        isHandshake: false
    })

    const videoRef = useRef(null)
    const initRef = useRef(false) // Guard against React Strict Mode double-init
    const cameraRef = useRef(null)
    const [debugText, setDebugText] = useState('Initializing...')

    useEffect(() => {
        // CRITICAL: Prevent double initialization in React 18+ Strict Mode
        if (initRef.current) return
        initRef.current = true

        console.log("🦈 SHARK LOG: Initializing MediaPipe Hands...")
        const bar = document.getElementById('bar')
        const preloader = document.getElementById('preloader')
        if (bar) bar.style.width = '20%'

        const hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
            },
        })

        hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 0, // 0 = LITE (Fastest loading/inference). Crucial for M1 perf.
            minDetectionConfidence: 0.6,
            minTrackingConfidence: 0.6,
        })

        hands.onResults((results) => {
            // First result = loaded. Fade out preloader.
            const bar = document.getElementById('bar')
            const preloader = document.getElementById('preloader')
            if (bar && bar.style.width !== '100%') {
                bar.style.width = '100%'
                setTimeout(() => {
                    if (preloader) preloader.style.opacity = '0'
                    setTimeout(() => { if (preloader) preloader.style.display = 'none' }, 500)
                }, 500)
            }

            if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                console.log("🦈 HANDS FOUND:", results.multiHandLandmarks.length)
                setDebugText(`Hands: ${results.multiHandLandmarks.length}`)

                // Store RAW landmarks for gesture detection
                const rawLandmarks = results.multiHandLandmarks

                // Process landmarks for particle interaction
                const processedHands = results.multiHandLandmarks.map(landmarks => {
                    const p = landmarks[9] // Middle finger knuckle

                    // Coordinate Normalization with Mirroring
                    // MediaPipe: x (0..1 left->right), y (0..1 top->bottom)
                    // Three.js: x (-1..1 left->right), y (1..-1 top->bottom)
                    // Mirror mode: invert X so it feels natural
                    return {
                        x: (1.0 - p.x) * 2.0 - 1.0,
                        y: (1.0 - p.y) * 2.0 - 1.0,
                        z: 0
                    }
                })

                let distance = 999
                let isHandshake = false

                if (processedHands.length === 2) {
                    const h1 = processedHands[0]
                    const h2 = processedHands[1]
                    distance = Math.sqrt(
                        Math.pow(h1.x - h2.x, 2) +
                        Math.pow(h1.y - h2.y, 2)
                    )

                    // Heuristic: d < 0.15
                    if (distance < 0.15) {
                        isHandshake = true
                        console.log("🦈 HANDSHAKE DETECTED! Distance:", distance.toFixed(3))
                    }
                }

                handDataRef.current = {
                    hands: processedHands,
                    rawLandmarks: rawLandmarks, // NEW: Raw data for gesture detection
                    distance,
                    isHandshake
                }
            } else {
                handDataRef.current = {
                    hands: [],
                    rawLandmarks: [],
                    distance: 999,
                    isHandshake: false
                }
                setDebugText('No hands detected')
            }
        })

        // Setup camera
        const setupCamera = async () => {
            const bar = document.getElementById('bar')
            if (bar) bar.style.width = '40%'
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 640, height: 480, frameRate: 60 } // Higher FR, lower complexity
                })
                if (bar) bar.style.width = '60%'

                const video = document.createElement('video')
                video.srcObject = stream
                video.playsInline = true
                await video.play()
                videoRef.current = video

                console.log("🦈 SHARK LOG: Starting Camera...")

                const camera = new Camera(video, {
                    onFrame: async () => {
                        if (video && video.videoWidth > 0) {
                            await hands.send({ image: video })
                        }
                    },
                    width: 640,
                    height: 480,
                })

                cameraRef.current = camera

                await camera.start()
                if (bar) bar.style.width = '80%'
                console.log("🦈 SHARK LOG: Camera Started Successfully")
            } catch (err) {
                console.error("🦈 CRITICAL FAILURE: Camera refused to start", err)
                setDebugText(`Camera Error: ${err.message}`)
            }
        }

        setupCamera()

        return () => {
            console.log("🦈 SHARK LOG: Cleaning up...")
            if (cameraRef.current) {
                cameraRef.current.stop()
            }
            if (videoRef.current && videoRef.current.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(track => track.stop())
            }
            hands.close()
        }
    }, [])

    return { handDataRef, debugText, videoRef }
}
