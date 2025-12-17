```javascript
import { useFBO } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import simVert from '../shaders/simulationVert.glsl'
import simFrag from '../shaders/simulationFrag.glsl'
import { detectGesture } from '../utils/gestureDetection'
import { generateSphere, generateHeart, generateCube, generateDoubleHelix } from '../utils/shapeGenerators'

export const useGPGPU = (size, handDataRef) => {
  const { gl } = useThree()
  
  const scene = useMemo(() => new THREE.Scene(), [])
  const camera = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), [])
  
  // M1 Optimization: Use HalfFloatType
  const options = {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.HalfFloatType, 
    stencilBuffer: false,
    depthBuffer: false,
  }

  const fbo1 = useFBO(size, size, options)
  const fbo2 = useFBO(size, size, options)
  const targets = useRef({ current: fbo1, previous: fbo2 })

  // Pre-calculate target shapes (useMemo for performance)
  const targetShapes = useMemo(() => {
    const particleCount = size * size
    return {
      SPHERE: generateSphere(particleCount, 2),
      HEART: generateHeart(particleCount, 0.15),
      CUBE: generateCube(particleCount, 3),
      DOUBLE_HELIX: generateDoubleHelix(particleCount, 1.5, 6)
    }
  }, [size])

  // Simulation Material
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uCurrentPosition: { value: null },
        uMouse: { value: new THREE.Vector3(0, 0, 0) },
        uShapeFactor: { value: 0 },
        uResolution: { value: new THREE.Vector2(size, size) },
        uInit: { value: 1 }
      },
      vertexShader: simVert,
      fragmentShader: simFrag
    })
  }, [size])

  const mesh = useMemo(() => {
    return new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
  }, [material])

  useMemo(() => scene.add(mesh), [scene, mesh])

  // State tracking
  const currentGesture = useRef("IDLE")
  const targetGestureShape = useRef(null)

  useFrame((state) => {
    const { current, previous } = targets.current
    
    // Update Uniforms
    material.uniforms.uTime.value = state.clock.elapsedTime
    material.uniforms.uCurrentPosition.value = previous.texture
    
    // === GESTURE DETECTION SYSTEM ===
    if (handDataRef && handDataRef.current) {
      const { hands, rawLandmarks } = handDataRef.current
      
      // Use primary hand for gravity well if available
      if (hands.length > 0) {
        material.uniforms.uMouse.value.set(
          hands[0].x,
          hands[0].y,
          hands[0].z || 0
        )
      }
      
      // Detect gesture from raw landmarks
      const detectedGesture = detectGesture(rawLandmarks)
      
      // Log gesture changes
      if (detectedGesture !== currentGesture.current) {
        console.log("🦈 GESTURE CHANGE:", currentGesture.current, "→", detectedGesture)
        currentGesture.current = detectedGesture
      }
      
      // Map gesture to target shape
      let targetShape = 0.0
      switch (detectedGesture) {
        case "THUMBS_UP":
          targetShape = 1.0 // Will morph to SPHERE in shader
          targetGestureShape.current = "SPHERE"
          break
        case "PEACE":
          targetShape = 1.0 // Will morph to HEART in shader
          targetGestureShape.current = "HEART"
          break
        case "TWO_HAND_CLASP":
          targetShape = 1.0 // Will morph to CUBE in shader
          targetGestureShape.current = "CUBE"
          break
        default:
          targetShape = 0.0 // IDLE - noise flow
          targetGestureShape.current = null
      }
      
      // Smooth lerp to target
      material.uniforms.uShapeFactor.value += (targetShape - material.uniforms.uShapeFactor.value) * 0.1
    }

    // Render to 'current'
    gl.setRenderTarget(current)
    gl.render(scene, camera)
    gl.setRenderTarget(null)
    
    // Turn off init after first frame
    if (material.uniforms.uInit.value > 0) {
      material.uniforms.uInit.value = 0
    }
    
    // Swap buffers
    targets.current.current = previous
    targets.current.previous = current
  })
  
  return targets.current.previous.texture
}
```
