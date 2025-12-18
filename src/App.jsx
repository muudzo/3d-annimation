import React, { useEffect, useRef, useState, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stats } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

// --- 1. CONFIGURATION ---
const CONFIG = {
  particleCount: 20000,
  lerpSpeed: 0.08,
  noiseStrength: 0.15,
  colorTransitionSpeed: 0.05,
}

const COLORS = {
  IDLE: new THREE.Color(0x00ffff),      // Cyan
  THUMBS_UP: new THREE.Color(0x00ffff), // Cyan
  PEACE: new THREE.Color(0xff1744),     // Pink/Red
  CLASP: new THREE.Color(0x00e676),     // Green
}

// --- 2. UTILS & MATH ---
const generateGlowTexture = () => {
  const canvas = document.createElement('canvas')
  canvas.width = 64; canvas.height = 64
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
  gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)')
  gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.4)')
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 64, 64)
  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

const getSpherePoint = (i, count) => {
  const phi = Math.acos(-1 + (2 * i) / count)
  const theta = Math.sqrt(count * Math.PI) * phi
  return {
    x: 4 * Math.cos(theta) * Math.sin(phi),
    y: 4 * Math.sin(theta) * Math.sin(phi),
    z: 4 * Math.cos(phi)
  }
}

const getHeartPoint = (i, count) => {
  const t = (i / count) * Math.PI * 2
  const x = 16 * Math.pow(Math.sin(t), 3)
  const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
  return { x: x * 0.15, y: y * 0.15, z: Math.sin(t * 5) * 1.5 }
}

const getHelixPoint = (i, count) => {
  const t = i * 0.05
  const strandOffset = i % 2 === 0 ? 0 : Math.PI
  return {
    x: Math.cos(t + strandOffset) * 2.5,
    y: (i / count - 0.5) * 15,
    z: Math.sin(t + strandOffset) * 2.5
  }
}

const noise3D = (x, y, z) => Math.sin(x * 0.5) * Math.cos(y * 0.5) * Math.sin(z * 0.5)

// --- 3. PARTICLES COMPONENT ---
const CPUParticles = ({ handDataRef }) => {
  const { viewport } = useThree()
  const count = CONFIG.particleCount
  const meshRef = useRef()
  const materialRef = useRef()
  const currentGestureRef = useRef("IDLE")
  const currentColorRef = useRef(COLORS.IDLE.clone())

  const glowTexture = useMemo(() => generateGlowTexture(), [])

  const particles = useMemo(() => {
    const temp = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      temp[i3] = (Math.random() - 0.5) * 20
      temp[i3 + 1] = (Math.random() - 0.5) * 20
      temp[i3 + 2] = (Math.random() - 0.5) * 20
    }
    return temp
  }, [count])

  useFrame((state) => {
    if (!meshRef.current) return

    // Hand Data
    const handData = handDataRef.current || { hands: [] }
    const hands = handData.hands || []
    const rawLandmarks = handData.rawLandmarks || []
    const time = state.clock.getElapsedTime()

    // --- DETECTION LOGIC ---
    let detectedGesture = "IDLE"
    let gestureCenter = { x: 0, y: 0, z: 0 }

    // Double Hand Clasp
    if (rawLandmarks.length === 2) {
      const h1 = rawLandmarks[0][9]
      const h2 = rawLandmarks[1][9]
      const dist = Math.hypot(h1.x - h2.x, h1.y - h2.y)
      if (dist < 0.25) { // 25% of screen width
        detectedGesture = "CLASP"
        gestureCenter.x = ((1 - (h1.x + h2.x) / 2) - 0.5) * viewport.width
        gestureCenter.y = -((h1.y + h2.y) / 2 - 0.5) * viewport.height
      }
    }

    // Single Hand Logic
    if (detectedGesture === "IDLE" && rawLandmarks.length > 0) {
      const hand = rawLandmarks[0]
      const thumbTip = hand[4].y
      const indexTip = hand[8].y
      const middleTip = hand[12].y
      const ringTip = hand[16].y

      // Center based on middle knuckle
      gestureCenter.x = ((1 - hand[9].x) - 0.5) * viewport.width
      gestureCenter.y = -(hand[9].y - 0.5) * viewport.height

      const isThumbUp = thumbTip < indexTip && thumbTip < middleTip
      const indexUp = indexTip < hand[6].y
      const middleUp = middleTip < hand[10].y
      const ringDown = ringTip > hand[14].y

      if (isThumbUp && !indexUp) detectedGesture = "THUMBS_UP"
      else if (indexUp && middleUp && ringDown) detectedGesture = "PEACE"
    }

    if (detectedGesture !== currentGestureRef.current) {
      console.log("🎨 GESTURE:", detectedGesture)
      currentGestureRef.current = detectedGesture
    }

    // Color transition
    const targetColor = COLORS[detectedGesture] || COLORS.IDLE
    currentColorRef.current.lerp(targetColor, CONFIG.colorTransitionSpeed)
    if (materialRef.current) materialRef.current.color.copy(currentColorRef.current)

    // --- ANIMATION LOOP ---
    const pos = meshRef.current.geometry.attributes.position.array
    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      let tx = 0, ty = 0, tz = 0

      if (detectedGesture === "CLASP") {
        const p = getHelixPoint(i, count)
        const rotSpeed = time * 2
        const rx = p.x * Math.cos(rotSpeed) - p.z * Math.sin(rotSpeed)
        const rz = p.x * Math.sin(rotSpeed) + p.z * Math.cos(rotSpeed)
        tx = rx + gestureCenter.x; ty = p.y + gestureCenter.y; tz = rz
      } else if (detectedGesture === "THUMBS_UP") {
        const p = getSpherePoint(i, count)
        const pulse = 1 + Math.sin(time * 2 + i * 0.01) * 0.1
        tx = p.x * pulse + gestureCenter.x
        ty = p.y * pulse + gestureCenter.y
        tz = p.z * pulse
      } else if (detectedGesture === "PEACE") {
        const p = getHeartPoint(i, count)
        tx = p.x + gestureCenter.x
        ty = p.y + gestureCenter.y
        tz = p.z
      } else {
        // Idle Noise
        const cx = pos[i3]; const cy = pos[i3 + 1]; const cz = pos[i3 + 2]
        const nx = noise3D(cx * 0.1 + time * 0.3, cy * 0.1, cz * 0.1)
        const ny = noise3D(cx * 0.1, cy * 0.1 + time * 0.3, cz * 0.1)
        const nz = noise3D(cx * 0.1, cy * 0.1, cz * 0.1 + time * 0.3)
        tx = cx + nx * CONFIG.noiseStrength
        ty = cy + ny * CONFIG.noiseStrength
        tz = cz + nz * CONFIG.noiseStrength
        if (Math.hypot(cx, cy, cz) > 20) { tx *= 0.98; ty *= 0.98; tz *= 0.98 }
      }

      pos[i3] += (tx - pos[i3]) * CONFIG.lerpSpeed
      pos[i3 + 1] += (ty - pos[i3 + 1]) * CONFIG.lerpSpeed
      pos[i3 + 2] += (tz - pos[i3 + 2]) * CONFIG.lerpSpeed
    }
    meshRef.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={particles} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        ref={materialRef}
        size={0.15}
        color={COLORS.IDLE}
        map={glowTexture}
        transparent opacity={0.9}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}

// --- 4. MAIN APP COMPONENT ---
export default function App() {
  const handDataRef = useRef({ hands: [], rawLandmarks: [] })
  const videoRef = useRef(null)
  const [status, setStatus] = useState("INITIALIZING...")

  useEffect(() => {
    const initSystem = async () => {
      try {
        console.log("🚀 STARTING HAPPY PATH INIT...")

        // 1. Load Vision Tasks (Wait for it, no timeout)
        setStatus("LOADING AI MODEL...")
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        )

        // 2. Create Landmarker
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2
        })

        // 3. Get Camera
        setStatus("REQUESTING CAMERA...")
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 }
        })

        const video = document.createElement("video")
        video.srcObject = stream
        video.playsInline = true
        await video.play()
        videoRef.current = video

        // 4. Start Loop
        setStatus("READY")
        const renderLoop = () => {
          if (video.currentTime > 0) {
            const results = landmarker.detectForVideo(video, performance.now())
            if (results.landmarks) {
              handDataRef.current = {
                rawLandmarks: results.landmarks
              }
            }
          }
          requestAnimationFrame(renderLoop)
        }
        renderLoop()

      } catch (error) {
        console.error(error)
        setStatus("ERROR: " + error.message)
      }
    }
    initSystem()
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'black' }}>
      {status !== "READY" && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'black', color: '#00ffff', display: 'flex',
          justifyContent: 'center', alignItems: 'center', zIndex: 9999,
          fontFamily: 'monospace', letterSpacing: '2px'
        }}>
          {status}
        </div>
      )}

      {/* Debug View */}
      {status === "READY" && (
        <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 100, color: '#00ffff' }}>
          LIVE FEED ACTIVE
        </div>
      )}

      <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 15], fov: 60 }} gl={{ antialias: false }}>
        <color attach="background" args={['#000000']} />

        <CPUParticles handDataRef={handDataRef} />

        <EffectComposer>
          <Bloom intensity={1.5} luminanceThreshold={0.2} mipmapBlur />
        </EffectComposer>

        <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
        <Stats />
      </Canvas>
    </div>
  )
}
