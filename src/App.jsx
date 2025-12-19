import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { ParticleSystem } from './systems/ParticleSystem'
import { useHandTracking } from './hooks/useHandTracking'
import { SystemState } from './types/SystemState'
import { AudioSystem } from './systems/AudioSystem'

export default function App() {
  const mountRef = useRef(null)
  const { handDataRef, debugText, videoRef, systemState, error, detectedGesture } = useHandTracking()

  // Three.js Refs
  const sceneRef = useRef(null)
  const rendererRef = useRef(null)
  const cameraRef = useRef(null)
  const particleSystemRef = useRef(null)
  const audioSystemRef = useRef(null)
  const frameIdRef = useRef(null)

  const [audioStarted, setAudioStarted] = useState(false);

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

    // 5. Initialize Audio System (Lazy init)
    const audio = new AudioSystem();
    audioSystemRef.current = audio;

    // 6. Handle Resize
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
      if (particleSystemRef.current) particleSystemRef.current.dispose()
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement)
      }
      renderer.dispose()
      rendererRef.current = null
      // Close Audio Context if possible (not strictly necessary for page reload)
    }
  }, [])

  // Shape Change Effect (Reactive to detectedGesture)
  useEffect(() => {
    if (particleSystemRef.current && detectedGesture) {
      // console.log("Morphing to:", detectedGesture);
      particleSystemRef.current.setShape(detectedGesture);

      // Trigger audio SFX
      if (audioSystemRef.current && audioStarted) {
        audioSystemRef.current.triggerWhoosh();
      }
    }
  }, [detectedGesture, audioStarted]);

  // Render Loop Effect
  useEffect(() => {
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
        gesture: detectedGesture,
        mouseHover: false
      }

      // --- HAND LOGIC ---
      if (handData && handData.hands.length > 0) {
        const hand = handData.hands[0]
        inputState.active = true
        inputState.x = hand.x;
        inputState.y = hand.y;

        // Pinch Detection for Physics (Thumb Tip to Index Tip)
        // hand.rawLandmarks is available in handDataRef from hook
        const landmarks = handData.rawLandmarks[0]; // First hand
        if (landmarks) {
          const thumbTip = landmarks[4];
          const indexTip = landmarks[8];
          // Simple dist check
          const dist = Math.sqrt(Math.pow(thumbTip.x - indexTip.x, 2) + Math.pow(thumbTip.y - indexTip.y, 2));

          // Threshold 0.05 is roughly touching
          if (dist < 0.06) {
            // Pass a special flag or override gesture for physics? 
            // ParticleSystem checks 'gesture === OPEN' for repel. 
            // We need to clarify interaction.
            // Let's pass 'PINCH' as a separate prop if needed, or rely on OPEN logic.
            // Wait, ParticleSystem update() checks `inputState.gesture === 'OPEN'` for repel.
            // And default is attract (or pinch).
            // So if we are NOT OPEN, we attract if `active` is true.
            // But we only want to attract if PINCHING.
            // So let's add `inputState.isPinching`.
            inputState.isPinching = true;
          } else {
            inputState.isPinching = false;
          }

          // Check for OPEN hand (5 fingers) for Repel
          // detectedGesture has this info ("FIREWORKS" is 5 fingers?)
          // If gesture is FIREWORKS, repel?
          if (detectedGesture === 'FIREWORKS') {
            inputState.gesture = 'OPEN'; // Force logic in ParticleSystem
          }
        }
      }

      // Update Particles
      particleSystemRef.current.update(time, inputState)

      // Update Audio
      if (audioSystemRef.current && audioStarted) {
        // Modulate based on hand activity
        // If active, higher intensity. If pinching, maybe specific sound?
        const intensity = inputState.active ? 0.8 : 0.2;
        audioSystemRef.current.update(intensity, detectedGesture);
      }

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
  }, [systemState, detectedGesture, audioStarted])

  const handleStartAudio = async () => {
    if (audioSystemRef.current && !audioStarted) {
      await audioSystemRef.current.init();
      audioSystemRef.current.resume();
      setAudioStarted(true);
    }
  };

  // Remove preloader from index.html if it exists (legacy cleanup)
  useEffect(() => {
    const preloader = document.getElementById('preloader');
    if (preloader) preloader.style.display = 'none';
  }, []);

  return (
    <>
      <div
        ref={mountRef}
        onClick={handleStartAudio}
        style={{ width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0, zIndex: 1, cursor: 'pointer' }}
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
