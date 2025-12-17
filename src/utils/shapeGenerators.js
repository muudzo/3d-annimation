/**
 * Parametric Shape Generators
 * Pre-calculate target positions for particle morphing
 */

/**
 * Generate Sphere positions using spherical coordinates
 * @param {number} count - Number of particles
 * @param {number} radius - Sphere radius
 */
export const generateSphere = (count, radius = 2) => {
    const positions = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
        const i3 = i * 3

        // Fibonacci sphere distribution for even coverage
        const phi = Math.acos(1 - 2 * (i + 0.5) / count)
        const theta = Math.PI * (1 + Math.sqrt(5)) * i

        positions[i3] = radius * Math.sin(phi) * Math.cos(theta)
        positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
        positions[i3 + 2] = radius * Math.cos(phi)
    }

    return positions
}

/**
 * Generate 3D Heart shape using parametric equations
 * Formula: x = 16sin³(t), y = 13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t)
 * @param {number} count - Number of particles
 * @param {number} scale - Heart scale factor
 */
export const generateHeart = (count, scale = 0.15) => {
    const positions = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
        const i3 = i * 3

        // Distribute particles across the heart surface
        const t = (i / count) * Math.PI * 2
        const layer = Math.floor(i / (count / 10)) // Create depth layers

        // Parametric heart equations
        const x = 16 * Math.pow(Math.sin(t), 3)
        const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)

        // Add depth variation for 3D effect
        const z = Math.sin(t * 3) * 5 + (layer - 5) * 2

        positions[i3] = x * scale
        positions[i3 + 1] = y * scale
        positions[i3 + 2] = z * scale
    }

    return positions
}

/**
 * Generate Cube positions
 * @param {number} count - Number of particles
 * @param {number} size - Cube size
 */
export const generateCube = (count, size = 3) => {
    const positions = new Float32Array(count * 3)
    const half = size / 2

    for (let i = 0; i < count; i++) {
        const i3 = i * 3

        // Distribute particles on cube faces
        const face = i % 6
        const u = Math.random()
        const v = Math.random()

        switch (face) {
            case 0: // Front
                positions[i3] = (u - 0.5) * size
                positions[i3 + 1] = (v - 0.5) * size
                positions[i3 + 2] = half
                break
            case 1: // Back
                positions[i3] = (u - 0.5) * size
                positions[i3 + 1] = (v - 0.5) * size
                positions[i3 + 2] = -half
                break
            case 2: // Top
                positions[i3] = (u - 0.5) * size
                positions[i3 + 1] = half
                positions[i3 + 2] = (v - 0.5) * size
                break
            case 3: // Bottom
                positions[i3] = (u - 0.5) * size
                positions[i3 + 1] = -half
                positions[i3 + 2] = (v - 0.5) * size
                break
            case 4: // Right
                positions[i3] = half
                positions[i3 + 1] = (u - 0.5) * size
                positions[i3 + 2] = (v - 0.5) * size
                break
            case 5: // Left
                positions[i3] = -half
                positions[i3 + 1] = (u - 0.5) * size
                positions[i3 + 2] = (v - 0.5) * size
                break
        }
    }

    return positions
}

/**
 * Generate Double Helix (DNA-like structure)
 * @param {number} count - Number of particles
 * @param {number} radius - Helix radius
 * @param {number} height - Helix height
 */
export const generateDoubleHelix = (count, radius = 1.5, height = 6) => {
    const positions = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
        const i3 = i * 3
        const t = (i / count) * Math.PI * 8 // Multiple turns
        const strand = i % 2 // Two strands

        const angle = t + (strand * Math.PI) // Offset second strand by 180°
        const y = (i / count) * height - height / 2

        positions[i3] = radius * Math.cos(angle)
        positions[i3 + 1] = y
        positions[i3 + 2] = radius * Math.sin(angle)
    }

    return positions
}
