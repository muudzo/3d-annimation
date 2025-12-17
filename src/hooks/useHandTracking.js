import { useRef, useEffect } from 'react'
import * as Comlink from 'comlink'

export const useHandTracking = () => {
    // Store state in ref to avoid re-renders (loop reads this directly)
    // Structure: { 
    //   hands: [{x,y,z}, {x,y,z}], 
    //   distance: number, 
    //   isHandshake: boolean 
    // }
    const handDataRef = useRef({
        hands: [],
        distance: 999,
        isHandshake: false
    })

    const videoRef = useRef(null)
    const initRef = useRef(false) // Guard against React Strict Mode double-init

    useEffect(() => {
        // CRITICAL: Prevent double initialization in React 18+ Strict Mode
        if (initRef.current) return
        initRef.current = true
        // Initialize Worker
        const worker = new Worker(new URL('../workers/handTracking.worker.js', import.meta.url), {
            type: 'module'
        })
        const api = Comlink.wrap(worker)

        let isRunning = true
        let animationFrameId

        const setupCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    // Mirroring is usually handled by CSS for valid feedback, 
                    // but for tracking we process the raw feed.
                    // If the user *feels* it's mirrored, we must invert X in logic.
                    video: { width: 640, height: 480, frameRate: 30 }
                })

                const video = document.createElement('video')
                video.srcObject = stream
                video.play()
                // We don't attach video to DOM here, Experience component might do it or we assume headless tracking.
                videoRef.current = video

                await new Promise((resolve) => {
                    video.onloadedmetadata = () => resolve()
                })

                await api.init()

                loop()
            } catch (err) {
                console.error("Camera setup failed", err)
            }
        }

        const loop = async () => {
            if (!isRunning) return

            const video = videoRef.current
            if (video && video.readyState >= 2) {
                const bitmap = await createImageBitmap(video)

                // Detect asynchronously
                const result = await api.detect(Comlink.transfer(bitmap, [bitmap]), performance.now())

                if (result && result.landmarks) {
                    const hands = result.landmarks.map(landmarks => {
                        // Centroid: Approx by middle finger knuckle (index 9) or average of all
                        // Using Index 9 is stable enough.
                        const p = landmarks[9]

                        // Coordinate Normalization
                        // MediaPipe: x (0..1 left->right), y (0..1 top->bottom)
                        // Three.js: x (-1..1 left->right), y (1..-1 top->bottom)

                        // Mirroring Fix:
                        // If user moves Right hand to Right side of screen:
                        // Webcam sees it on Left (x < 0.5) if unmirrored.
                        // To act like a mirror, Left Image = Screen Left (-1).
                        // So MP x 0->1 maps to Three x -1->1 DIRECTLY if we want "Selfie/Mirror" mode?
                        // Wait. 
                        // Selfie Mode: I raise my Right hand. Mirror shows Right side hand raising.
                        // In webcam feed, my Right hand is on the LEFT side of the frame.
                        // So MP x = 0.2.
                        // If I want that to be on the Right side of Three.js (x > 0), I need to invert properly.
                        // x = (1 - p.x) * 2 - 1  => (0.8 * 2) - 1 = 0.6 (Right side). Correct.

                        // Y axis: MP y 0 (top) -> Three y 1 (top).
                        // y = (1 - p.y) * 2 - 1 => mp 0 -> 1. mp 1 -> -1. Correct.

                        return {
                            x: (1.0 - p.x) * 2.0 - 1.0,
                            y: (1.0 - p.y) * 2.0 - 1.0,
                            z: 0
                        }
                    })

                    let distance = 999
                    let isHandshake = false

                    if (hands.length === 2) {
                        const h1 = hands[0]
                        const h2 = hands[1]
                        distance = Math.sqrt(
                            Math.pow(h1.x - h2.x, 2) +
                            Math.pow(h1.y - h2.y, 2)
                        )

                        // Heuristic: d < 0.15
                        if (distance < 0.15) {
                            isHandshake = true
                        }
                    }

                    handDataRef.current = {
                        hands,
                        distance,
                        isHandshake
                    }
                }
            }

            animationFrameId = requestAnimationFrame(loop)
        }

        setupCamera()

        return () => {
            isRunning = false
            cancelAnimationFrame(animationFrameId)
            worker.terminate()
            if (videoRef.current && videoRef.current.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(track => track.stop())
            }
        }
    }, [])

    return handDataRef
}
