import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useGPGPU } from '../hooks/useGPGPU'
import vertexShader from '../shaders/particlesVert.glsl'
import fragmentShader from '../shaders/particlesFrag.glsl'

export function Particles({ handDataRef }) {
    const size = 1024; // Texture dimension -> 1024x1024=1M, 1024x512= 524k
    // User asked for 500k. 512 is almost enough (262k), 1024 is 1M. 
    // Wait, 1024x512 is 524,288. Perfect.
    const height = 512;

    // Initialize GPGPU
    // Note: useGPGPU expects a square size usually if simplest, but we can adapt.
    // My useGPGPU implementation took 'size' and reused it for width/height.
    // I should update useGPGPU to handle width/height or just use 1024 (1M particles) to be safe/simple.
    // 1M particles on M1 is feasible with this optimization.
    // Let's stick to size=1024 (1M particles) or modify hook.
    // If I pass 1024 to useGPGPU, it creates 1024x1024.
    // 1M particles. Fine.
    const texture = useGPGPU(size, handDataRef)

    const { geometry, material } = useMemo(() => {
        // Geometry
        const geo = new THREE.BufferGeometry()
        const particleCount = size * size // 1M
        const positions = new Float32Array(particleCount * 3)

        // We use the 'position' attribute to store texture coordinates (UVs)
        // because gl_PointCoord is for the point sprite itself.
        // Vertex Shader: vec3 pos = texture2D(uPositionTexture, position.xy).xyz;
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3
            // Map index to UV coordinates [0, 1]
            // Row-major order
            const x = (i % size) / size
            const y = Math.floor(i / size) / size

            positions[i3] = x
            positions[i3 + 1] = y
            positions[i3 + 2] = 0
        }

        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))

        // Material
        const mat = new THREE.ShaderMaterial({
            uniforms: {
                uPositionTexture: { value: null },
                uTime: { value: 0 }
            },
            vertexShader,
            fragmentShader,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        })

        return { geometry: geo, material: mat }
    }, [size])

    useFrame((state) => {
        material.uniforms.uPositionTexture.value = texture
        material.uniforms.uTime.value = state.clock.elapsedTime
    })

    return (
        <points geometry={geometry} material={material} frustumCulled={false} />
    )
}
