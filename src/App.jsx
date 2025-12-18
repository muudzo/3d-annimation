import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { ParticleSystem } from './systems/ParticleSystem'
import { useHandTracking } from './hooks/useHandTracking'
import { SystemState } from './types/SystemState'

export default function App() {
  const mountRef = useRef(null)
  const { handDataRef, debugText, videoRef, systemState, error, detectedGesture } = useHandTracking()

  // Three.js Refs
  const sceneRef = useRef(null)
  const rendererRef = useRef(null)
  const cameraRef = useRef(null)
  const particleSystemRef = useRef(null)
  const frameIdRef = useRef(null)

  // Initialization Effect
  useEffect(() => {
    // GATING: Only initialize renderer if not already done.
    if (!mountRef.current || rendererRef.current) return;

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
    }
    window.addEventListener('resize', handleResize)

    // Cleanup on unmount
    return () => {
      window.removeEventListener('resize', handleResize)
      if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current)
      ps.dispose()
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement)
      }
      renderer.dispose()
      rendererRef.current = null
    }
  }, [])

  // Shape Change Effect (Reactive to detectedGesture)
  useEffect(() => {
    if (particleSystemRef.current && detectedGesture) {
      console.log("Morphing to:", detectedGesture);
      particleSystemRef.current.setShape(detectedGesture);
    }
  }, [detectedGesture]);

  // Render Loop Effect (Reactive to systemState)
  useEffect(() => {
    // GATING: Only start loop if system is READY or partially ready (we render during init for effect?)
    // Actually, let's render always BUT particles update needs caution.
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !particleSystemRef.current) return;

    const clock = new THREE.Clock()

    const animate = () => {
      const time = clock.getElapsedTime()

      // Input Mapping
      const handData = handDataRef.current
      const inputState = {
        active: false,
        x: 0,
        y: 0,
        gesture: detectedGesture, // Pass explicitly
        mouseHover: false
      }

      if (handData && handData.hands.length > 0) {
        const hand = handData.hands[0]
        inputState.active = true
        inputState.x = hand.x;
        inputState.y = hand.y;

        // Override gesture for Physics (Pinched vs Open) if needed,
        // but 'detectedGesture' controls the SHAPE.
        // Interaction physics (pinch) is separate.
        // Let's calculate pinch logic here or use a helper
        // Pinch check (Thumb + Index distance)
        // We can check landmarks manually if distance logic isn't perfect
        // But for now, let's trust the Morphing.
      }

      // Update Particles
      particleSystemRef.current.update(time, inputState)

      // Render
      rendererRef.current.render(sceneRef.current, cameraRef.current)
      frameIdRef.current = requestAnimationFrame(animate)
    }

    const start = () => {
      if (!frameIdRef.current) animate();
    }

    start();

    return () => {
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
        frameIdRef.current = null;
      }
    }
  }, [systemState, detectedGesture]) // Re-bind loop if gesture logic changes (though refs handle it mostly)

  // Remove preloader from index.html if it exists (legacy cleanup)
  useEffect(() => {
    const preloader = document.getElementById('preloader');
    if (preloader) preloader.style.display = 'none';
  }, []);

  return (
    <>
      <div
        ref={mountRef}
        style={{ width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0, zIndex: 1 }}
      />

      {/* REACT CONTROLLED OVERLAY */}
      {(systemState !== SystemState.READY) && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'black', color: '#00ffff', display: 'flex', flexDirection: 'column',
          justifyContent: 'center', alignItems: 'center', zIndex: 9999,
          fontFamily: 'monospace', letterSpacing: '2px'
        }}>
          {systemState === SystemState.ERROR ? (
            <>
              <div style={{ color: '#ff3333', fontSize: '24px', marginBottom: '20px' }}>SYSTEM FAILURE</div>
              <div style={{ color: '#ff3333', maxWidth: '600px', textAlign: 'center' }}>{error}</div>
              <button onClick={() => window.location.reload()} style={{
                marginTop: '30px', background: 'transparent', border: '1px solid #ff3333',
                color: '#ff3333', padding: '10px 20px', cursor: 'pointer', fontFamily: 'monospace'
              }}>REBOOT SYSTEM</button>
            </>
          ) : (
            <>
              <div className="glitch">{systemState}...</div>
              <div style={{ marginTop: '20px', fontSize: '12px', opacity: 0.7 }}>{debugText}</div>
              {/* Optional: Add a CSS loader here if desired */}
            </>
          )}
        </div>
      )}

      {/* HUD if READY */}
      {systemState === SystemState.READY && (
        <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10, color: '#00ffff', fontFamily: 'monospace' }}>
          <div>SYSTEM STATUS: ONLINE</div>
          <div>DEBUG: {debugText}</div>
        </div>
      )}
    </>
  )
}
