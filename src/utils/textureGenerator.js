import * as THREE from 'three'

/**
 * Generate a soft glow texture for particles
 * Creates a radial gradient from white center to transparent edges
 */
export const generateGlowTexture = () => {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64

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
