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

        const hands = new Hands({
            locateFile: (file) => {
                // VITAL FIX: Fetch the WASM/TFLite files from a CDN, not your local server.
                // This fixes the "Silent 404" error where the model never loads.
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
            },
        })

        hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1, // 0 = Fastest, 1 = Balanced. Keep at 1 for accuracy.
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
        })

        hands.onResults((results) => {
            // DEBUG LOG: If this prints, the AI is working.
            if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                console.log("🦈 HANDS FOUND:", results.multiHandLandmarks.length)
                setDebugText(`Hands: ${results.multiHandLandmarks.length}`)

                // Process landmarks
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
                    distance,
                    isHandshake
                }
            } else {
                handDataRef.current = {
                    hands: [],
                    distance: 999,
                    isHandshake: false
                }
                setDebugText('No hands detected')
            }
        })

        // Setup camera
        const setupCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 640, height: 480, frameRate: 30 }
                })

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
