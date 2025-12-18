import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { ParticleSystem } from './systems/ParticleSystem'
import { useHandTracking } from './hooks/useHandTracking'

export default function App() {
  const mountRef = useRef(null)
  const { handDataRef, debugText, videoRef } = useHandTracking()
  const [isReady, setIsReady] = useState(false)

  // Three.js State Refs
  const sceneRef = useRef(null)
  const rendererRef = useRef(null)
  const cameraRef = useRef(null)
  const particleSystemRef = useRef(null)
  const frameIdRef = useRef(null)

  useEffect(() => {
    // 1. Setup Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#000000')
    sceneRef.current = scene

    // 2. Setup Camera
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.z = 120
    cameraRef.current = camera

    // 3. Setup Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: "high-performance"
    })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mountRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // 4. Initialize Particles
    const ps = new ParticleSystem(scene)
    particleSystemRef.current = ps

    // 5. Handle Resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
      // Update shader uniforms if needed
    }
    window.addEventListener('resize', handleResize)

    // 6. Animation Loop
    const clock = new THREE.Clock()

    const animate = () => {
      const time = clock.getElapsedTime()

      // Get Input State from Hand Tracking
      // Mapping internal hand data to simplified input state for particles
      const handData = handDataRef.current
      const inputState = {
        active: false,
        x: 0,
        y: 0,
        gesture: 'IDLE',
        mouseHover: false
      }

      if (handData && handData.hands.length > 0) {
        const hand = handData.hands[0]
        inputState.active = true
        inputState.x = hand.x; // Already -1 to 1 from hook? We need to verify hook output
        inputState.y = hand.y;

        // Simple Gesture Mapping based on landmarks or explicit gesture detection
        // For now, let's look at the "System" logic later, but pass data
        // We might need to detect gestures here or inside the hook

        // If 5 fingers open -> Repel (Pass 'OPEN')
        // If Pinch -> Attract (Pass 'PINCH')

        // Use distance as proxy for now if hook doesn't give gesture string
        if (handData.distance < 0.1) inputState.gesture = 'PINCH';
        else inputState.gesture = 'OPEN';
      }

      // Update Particles
      ps.update(time, inputState)

      // Shape Switching Logic (Stub - dependent on hook detection)
      // For testing, let's cycle shapes every 5 seconds if no input
      // const cycle = Math.floor(time / 5) % 5;
      // const shapes = ['SPHERE', 'HEART', 'FLOWER', 'SATURN', 'FIREWORKS'];
      // if (!inputState.active) ps.setShape(shapes[cycle]);

      // Render
      renderer.render(scene, camera)
      frameIdRef.current = requestAnimationFrame(animate)
    }

    animate()
    setIsReady(true)

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(frameIdRef.current)
      ps.dispose()
      mountRef.current.removeChild(renderer.domElement)
      renderer.dispose()
    }
  }, []) // Run once on mount

  // Shape Triggers (to be connected to gestures)
  useEffect(() => {
    if (!particleSystemRef.current) return;
    // Listen to detailed gesture changes via hook or context
    // For now, we rely on the loop or a separate effect if checking handDataRef
  }, [])

  return (
    <>
      <div
        ref={mountRef}
        style={{ width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0, zIndex: 1 }}
      />

      {/* UI Overlay */}
      <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10, color: '#00ffff', fontFamily: 'monospace' }}>
        <div>SYSTEM STATUS: {isReady ? 'ONLINE' : 'BOOTING'}</div>
        <div>DEBUG: {debugText}</div>
      </div>
    </>
  )
}
