import * as THREE from 'three';
import vertexShader from '../shaders/particlesVert.glsl';
import fragmentShader from '../shaders/particlesFrag.glsl';

// --- SHAPE GENERATORS ---
const SHAPES = {
    SPHERE: (count) => {
        const data = new Float32Array(count * 3);
        const radius = 60; // Base size
        for (let i = 0; i < count; i++) {
            const phi = Math.acos(-1 + (2 * i) / count);
            const theta = Math.sqrt(count * Math.PI) * phi;
            data[i * 3] = radius * Math.cos(theta) * Math.sin(phi);
            data[i * 3 + 1] = radius * Math.sin(theta) * Math.sin(phi);
            data[i * 3 + 2] = radius * Math.cos(phi);
        }
        return data;
    },
    HEART: (count) => {
        const data = new Float32Array(count * 3);
        const scale = 3.5;
        for (let i = 0; i < count; i++) {
            const t = (i / count) * Math.PI * 2 * 100; // Multiply to wrap around multiple times
            // Parametric heart
            const x = 16 * Math.pow(Math.sin(t), 3);
            const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
            const z = (Math.random() - 0.5) * 10; // Slight depth

            data[i * 3] = x * scale;
            data[i * 3 + 1] = y * scale;
            data[i * 3 + 2] = z;
        }
        return data;
    },
    FLOWER: (count) => {
        const data = new Float32Array(count * 3);
        const scale = 30;
        for (let i = 0; i < count; i++) {
            const u = Math.random() * Math.PI * 2;
            const v = Math.random() * Math.PI;
            // Rose curve-ish
            const r = Math.sin(5 * u) * scale;

            data[i * 3] = r * Math.cos(u) * Math.sin(v) * 2; // Spread out
            data[i * 3 + 1] = r * Math.sin(u) * Math.sin(v) * 2;
            data[i * 3 + 2] = (Math.random() - 0.5) * 50;
        }
        return data;
    },
    SATURN: (count) => {
        const data = new Float32Array(count * 3);
        // 70% Sphere, 30% Ring
        const sphereCount = Math.floor(count * 0.7);
        const ringCount = count - sphereCount;

        // Sphere part
        const sphereRad = 40;
        for (let i = 0; i < sphereCount; i++) {
            const phi = Math.acos(-1 + (2 * i) / sphereCount);
            const theta = Math.sqrt(sphereCount * Math.PI) * phi;
            data[i * 3] = sphereRad * Math.cos(theta) * Math.sin(phi);
            data[i * 3 + 1] = sphereRad * Math.sin(theta) * Math.sin(phi);
            data[i * 3 + 2] = sphereRad * Math.cos(phi);
        }

        // Ring part
        const ringMin = 60;
        const ringMax = 90;
        for (let i = 0; i < ringCount; i++) {
            const idx = sphereCount + i;
            const angle = Math.random() * Math.PI * 2;
            const r = ringMin + Math.random() * (ringMax - ringMin);

            data[idx * 3] = r * Math.cos(angle);
            data[idx * 3 + 1] = r * Math.sin(angle) * 0.1; // Flattened
            data[idx * 3 + 2] = (Math.random() - 0.5) * 2; // Thin layer

            // Tilt the ring
            const x = data[idx * 3];
            const y = data[idx * 3 + 1];
            // Rotate around X
            const tilt = Math.PI * 0.2;
            data[idx * 3 + 1] = y * Math.cos(tilt) - x * Math.sin(tilt); // Actually maybe Z axis tilt? 
            // Let's just keep it simple disc first
        }
        return data;
    },
    FIREWORKS: (count) => {
        const data = new Float32Array(count * 3);
        // Random huge sphere
        const maxDist = 200;
        for (let i = 0; i < count; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos((Math.random() * 2) - 1);
            const r = Math.random() * maxDist;

            data[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            data[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            data[i * 3 + 2] = r * Math.cos(phi);
        }
        return data;
    }
};

const COLORS = {
    DEFAULT: new THREE.Color('#00ffff'),
    HEART: new THREE.Color('#ff0055'),
    FLOWER: new THREE.Color('#ffcc00'),
    SATURN: new THREE.Color('#ffaa88'),
    FIREWORKS: new THREE.Color('#ffffff')
};

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.count = 15000;
        this.currentShape = 'SPHERE';
        this.targetPositions = SHAPES.SPHERE(this.count);
        this.originalPositions = new Float32Array(this.targetPositions); // For return to form
        this.positions = new Float32Array(this.targetPositions);

        // Geometry
        this.geometry = new THREE.BufferGeometry();
        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        this.geometry.setAttribute('aScale', new THREE.BufferAttribute(new Float32Array(this.count).fill(1.0), 1));

        // Colors
        const colors = new Float32Array(this.count * 3);
        const c = COLORS.DEFAULT;
        for (let i = 0; i < this.count; i++) {
            colors[i * 3] = c.r;
            colors[i * 3 + 1] = c.g;
            colors[i * 3 + 2] = c.b;
        }
        this.geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));

        // Material
        this.material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
                uSize: { value: 100.0 }
            },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.points = new THREE.Points(this.geometry, this.material);
        this.scene.add(this.points);

        this.currentColor = COLORS.DEFAULT.clone();
        this.targetColor = COLORS.DEFAULT.clone();
    }

    setShape(type) {
        if (SHAPES[type]) {
            this.currentShape = type;
            this.targetPositions = SHAPES[type](this.count);

            // Set Color Target
            if (type === 'HEART') this.targetColor = COLORS.HEART;
            else if (type === 'FLOWER') this.targetColor = COLORS.FLOWER;
            else if (type === 'SATURN') this.targetColor = COLORS.SATURN;
            else if (type === 'FIREWORKS') this.targetColor = COLORS.FIREWORKS;
            else this.targetColor = COLORS.DEFAULT;
        }
    }

    update(time, inputState) {
        this.material.uniforms.uTime.value = time;

        // Color Interpolation
        this.currentColor.lerp(this.targetColor, 0.05);
        const colorArray = this.geometry.attributes.aColor.array;

        // Physics / Morphing Loop
        const positions = this.geometry.attributes.position.array;

        // Input Forces (Normalized -1 to 1 => Scale to World Bounds approx 60-100)
        let interactX = 0, interactY = 0, active = false, repel = false;

        if (inputState && inputState.active) {
            active = true;
            interactX = inputState.x * 80; // Scale to scene
            interactY = inputState.y * 80;
            repel = inputState.gesture === 'OPEN' || inputState.mouseHover; // Logic depending on input manager
        }

        for (let i = 0; i < this.count; i++) {
            const i3 = i * 3;

            // 1. Lerp to Target Shape
            // Add some noise to the lerp for organic feel
            const speed = 0.03 + (Math.random() * 0.02);

            let tx = this.targetPositions[i3];
            let ty = this.targetPositions[i3 + 1];
            let tz = this.targetPositions[i3 + 2];

            // 2. Apply Interaction
            if (active) {
                const dx = positions[i3] - interactX;
                const dy = positions[i3 + 1] - interactY;
                const dz = positions[i3 + 2]; // Assume 2D interaction plane at Z=0 for simplicity
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

                if (dist < 40) {
                    const force = (40 - dist) / 40;
                    if (repel) {
                        // Push away
                        tx += dx * force * 5.0;
                        ty += dy * force * 5.0;
                        tz += dz * force * 5.0;
                    } else {
                        // Attract (Pinch) - Move TARGET towards center, not current pos (to avoid implosion sticking)
                        tx = interactX + (Math.random() - 0.5) * 10;
                        ty = interactY + (Math.random() - 0.5) * 10;
                        // tz remains similar
                    }
                }
            }

            // Standard Lerp
            positions[i3] += (tx - positions[i3]) * speed;
            positions[i3 + 1] += (ty - positions[i3 + 1]) * speed;
            positions[i3 + 2] += (tz - positions[i3 + 2]) * speed;

            // Update Colors (Gradient effect based on index/pos)
            colorArray[i3] = this.currentColor.r + Math.sin(time + i) * 0.1;
            colorArray[i3 + 1] = this.currentColor.g + Math.cos(time + i) * 0.1;
            colorArray[i3 + 2] = this.currentColor.b;
        }

        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.aColor.needsUpdate = true;
    }

    dispose() {
        this.geometry.dispose();
        this.material.dispose();
        this.scene.remove(this.points);
    }
}
