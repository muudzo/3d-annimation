import { useFBO } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import simVert from '../shaders/simulationVert.glsl'
import simFrag from '../shaders/simulationFrag.glsl'

export const useGPGPU = (size, handPosRef) => {
    const { gl } = useThree()

    const scene = useMemo(() => new THREE.Scene(), [])
    // Orthographic camera for 1:1 pixel mapping
    const camera = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), [])

    // M1 Optimization: Use HalfFloatType to reduce memory bandwidth by 50%
    // This is critical for Unified Memory architectures when pushing 500k particles
    const options = {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        type: THREE.HalfFloatType,
        stencilBuffer: false,
        depthBuffer: false,
    }

    // Ping-pong buffers
    const fbo1 = useFBO(size, size, options)
    const fbo2 = useFBO(size, size, options)
    const targets = useRef({ current: fbo1, previous: fbo2 })

    // Simulation Material
    const material = useMemo(() => {
        return new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uCurrentPosition: { value: null },
                uMouse: { value: new THREE.Vector3(0, 0, 0) },
                uShapeFactor: { value: 0 }, // 0 = Noise, 1 = Target
                uResolution: { value: new THREE.Vector2(size, size) },
                uInit: { value: 1 } // Start with init
            },
            vertexShader: simVert,
            fragmentShader: simFrag
        })
    }, [size])

    // Fullscreen Quad
    const mesh = useMemo(() => {
        return new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
    }, [material])

    useMemo(() => scene.add(mesh), [scene, mesh])

    useFrame((state) => {
        const { current, previous } = targets.current

        // Update Uniforms
        material.uniforms.uTime.value = state.clock.elapsedTime
        material.uniforms.uCurrentPosition.value = previous.texture

        // Hand tracking update
        if (handPosRef && handPosRef.current) {
            // Assume handPosRef contains { x, y, z } in normalized coords
            material.uniforms.uMouse.value.set(
                handPosRef.current.x,
                handPosRef.current.y,
                handPosRef.current.z || 0
            )
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

    // Return the texture that will contain the NEXT state (which is now in 'previous' after swap? No)
    // Logic: 
    // 1. Render Source(prev) -> Dest(curr)
    // 2. Swap refs: curr becomes prev, prev becomes curr.
    // 3. Next frame uses the NEW prev (which was the old curr with fresh data).
    // So we should return the 'previous' texture as the READ texture for the particle system.
    // After swap, 'previous' holds the frame we just rendered.

    return targets.current.previous.texture
}
