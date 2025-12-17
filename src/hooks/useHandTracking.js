import { useRef, useEffect } from 'react'
import * as Comlink from 'comlink'

export const useHandTracking = () => {
    const handPosRef = useRef({ x: 0, y: 0, z: 0 })
    const videoRef = useRef(null)

    useEffect(() => {
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
                    video: { width: 640, height: 480, frameRate: 30 } // Keep input low res for speed
                })

                const video = document.createElement('video')
                video.srcObject = stream
                video.play()
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
                // Create ImageBitmap (low overhead transfer)
                const bitmap = await createImageBitmap(video)

                // Detect in worker
                // Note: 'detect' is async because Comlink
                // We shouldn't await strictly if we want to run at 60fps? 
                // Logic: if we await, we are bound by detection speed.
                // MediaPipe on CPU might take 10-30ms.
                // It's okay to await for simplicity.
                const result = await api.detect(Comlink.transfer(bitmap, [bitmap]), performance.now())

                if (result && result.landmarks && result.landmarks.length > 0) {
                    const landmarks = result.landmarks[0]
                    const hand = landmarks[9] // Middle finger knuckle
                    const thumb = landmarks[4]
                    const index = landmarks[8]

                    // Calculate Pinch Distance (Euclidean)
                    const pinchDist = Math.sqrt(
                        Math.pow(thumb.x - index.x, 2) +
                        Math.pow(thumb.y - index.y, 2)
                    )
                    const isPinching = pinchDist < 0.05 // Threshold

                    // normalized 0..1
                    // Invert simple logic or map to -1..1
                    // Screen: y is down. 3D: y is up.
                    handPosRef.current = {
                        x: (hand.x - 0.5) * 2.0, // -1 to 1
                        y: -(hand.y - 0.5) * 2.0, // 1 to -1
                        z: 0,
                        isPinching: isPinching
                    }
                }
            }

            // Request next frame
            // We can throttle detection to 30fps while rendering at 60fps
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

    return handPosRef
}
