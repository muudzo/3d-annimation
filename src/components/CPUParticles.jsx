import React, { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { generateGlowTexture } from '../utils/textureGenerator';

// --- CONFIGURATION ---
const CONFIG = {
    particleCount: 50000,
    lerpSpeed: 0.08, // Slightly slower for smoother transitions
    noiseStrength: 0.15, // Drift intensity in IDLE
    colorTransitionSpeed: 0.05,
};

// Color palettes for each gesture state
const COLORS = {
    IDLE: new THREE.Color(0x00ffff),      // Cyan - Data Stream
    THUMBS_UP: new THREE.Color(0x00ffff), // Cyan - Sphere
    PEACE: new THREE.Color(0xff1744),     // Deep Red/Pink - Heart (Biometric)
    CLASP: new THREE.Color(0x00e676),     // Emerald Green - DNA (Genetic)
};

// --- GEOMETRY GENERATORS ---
const getSpherePoint = (i, count) => {
    const phi = Math.acos(-1 + (2 * i) / count);
    const theta = Math.sqrt(count * Math.PI) * phi;
    return {
        x: 4 * Math.cos(theta) * Math.sin(phi),
        y: 4 * Math.sin(theta) * Math.sin(phi),
        z: 4 * Math.cos(phi)
    };
};

const getHeartPoint = (i, count) => {
    const t = (i / count) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    return {
        x: x * 0.15,
        y: y * 0.15,
        z: Math.sin(t * 5) * 1.5 // More structured depth
    };
};

const getHelixPoint = (i, count) => {
    const t = i * 0.05;
    const strandOffset = i % 2 === 0 ? 0 : Math.PI;
    return {
        x: Math.cos(t + strandOffset) * 2.5,
        y: (i / count - 0.5) * 15,
        z: Math.sin(t + strandOffset) * 2.5
    };
};

// Simple 3D noise function for organic movement
const noise3D = (x, y, z) => {
    return Math.sin(x * 0.5) * Math.cos(y * 0.5) * Math.sin(z * 0.5);
};

// --- MAIN COMPONENT ---
export const CPUParticles = ({ handDataRef }) => {
    const { viewport } = useThree();
    const count = CONFIG.particleCount;
    const meshRef = useRef();
    const materialRef = useRef();

    // Track current gesture for color transitions
    const currentGestureRef = useRef("IDLE");
    const currentColorRef = useRef(COLORS.IDLE.clone());

    // Generate glow texture
    const glowTexture = useMemo(() => generateGlowTexture(), []);

    // Initialize Particles with slight variation
    const particles = useMemo(() => {
        const temp = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            // Start in a sphere-ish distribution
            const phi = Math.acos(-1 + (2 * i) / count);
            const theta = Math.sqrt(count * Math.PI) * phi;
            const r = 8 + Math.random() * 4;

            temp[i3] = r * Math.cos(theta) * Math.sin(phi);
            temp[i3 + 1] = r * Math.sin(theta) * Math.sin(phi);
            temp[i3 + 2] = r * Math.cos(phi);
        }
        return temp;
    }, [count]);

    useFrame((state) => {
        if (!meshRef.current) return;

        const handData = handDataRef?.current || {};
        const hands = handData.rawLandmarks || [];
        const time = state.clock.getElapsedTime();

        // --- GESTURE DETECTION ---
        let detectedGesture = "IDLE";
        let gestureCenter = { x: 0, y: 0, z: 0 };

        // Two-Hand Clasp Check
        if (hands.length === 2) {
            const h1 = hands[0][9];
            const h2 = hands[1][9];

            const dist = Math.sqrt(Math.pow(h1.x - h2.x, 2) + Math.pow(h1.y - h2.y, 2));

            if (dist < 0.25) {
                detectedGesture = "CLASP";
                gestureCenter.x = ((1 - (h1.x + h2.x) / 2) - 0.5) * viewport.width;
                gestureCenter.y = -((h1.y + h2.y) / 2 - 0.5) * viewport.height;
            }
        }

        // Single Hand Gestures
        if (detectedGesture === "IDLE" && hands.length > 0) {
            const hand = hands[0];
            const thumbTip = hand[4];
            const indexTip = hand[8];
            const middleTip = hand[12];
            const ringTip = hand[16];

            gestureCenter.x = ((1 - hand[9].x) - 0.5) * viewport.width;
            gestureCenter.y = -(hand[9].y - 0.5) * viewport.height;

            const isThumbUp = thumbTip.y < indexTip.y && thumbTip.y < middleTip.y;
            const indexUp = indexTip.y < hand[6].y;
            const middleUp = middleTip.y < hand[10].y;
            const ringDown = ringTip.y > hand[14].y;

            if (isThumbUp && !indexUp) {
                detectedGesture = "THUMBS_UP";
            } else if (indexUp && middleUp && ringDown) {
                detectedGesture = "PEACE";
            }
        }

        // Update gesture tracking
        if (detectedGesture !== currentGestureRef.current) {
            console.log("🎨 VISUAL GESTURE:", detectedGesture);
            currentGestureRef.current = detectedGesture;
        }

        // --- COLOR TRANSITION ---
        const targetColor = COLORS[detectedGesture] || COLORS.IDLE;
        currentColorRef.current.lerp(targetColor, CONFIG.colorTransitionSpeed);

        if (materialRef.current) {
            materialRef.current.color.copy(currentColorRef.current);
        }

        // --- PARTICLE ANIMATION ---
        const positions = meshRef.current.geometry.attributes.position.array;

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            let tx = 0, ty = 0, tz = 0;

            if (detectedGesture === "CLASP") {
                // SPINNING DNA HELIX
                const p = getHelixPoint(i, count);
                const rotSpeed = time * 2;
                const rotX = p.x * Math.cos(rotSpeed) - p.z * Math.sin(rotSpeed);
                const rotZ = p.x * Math.sin(rotSpeed) + p.z * Math.cos(rotSpeed);

                tx = rotX + gestureCenter.x;
                ty = p.y + gestureCenter.y;
                tz = rotZ;
            }
            else if (detectedGesture === "THUMBS_UP") {
                // SPHERE with subtle pulsing
                const p = getSpherePoint(i, count);
                const pulse = 1 + Math.sin(time * 2 + i * 0.01) * 0.1;
                tx = p.x * pulse + gestureCenter.x;
                ty = p.y * pulse + gestureCenter.y;
                tz = p.z * pulse;
            }
            else if (detectedGesture === "PEACE") {
                // HEART with gentle rotation
                const p = getHeartPoint(i, count);
                const rotSpeed = time * 0.5;
                const rotX = p.x * Math.cos(rotSpeed) - p.z * Math.sin(rotSpeed);
                const rotZ = p.x * Math.sin(rotSpeed) + p.z * Math.cos(rotSpeed);

                tx = rotX + gestureCenter.x;
                ty = p.y + gestureCenter.y;
                tz = rotZ;
            }
            else {
                // IDLE: ALIVE NOISE DRIFT
                const cx = positions[i3];
                const cy = positions[i3 + 1];
                const cz = positions[i3 + 2];

                // 3D Perlin-like noise for organic movement
                const noiseX = noise3D(cx * 0.1 + time * 0.3, cy * 0.1, cz * 0.1);
                const noiseY = noise3D(cx * 0.1, cy * 0.1 + time * 0.3, cz * 0.1);
                const noiseZ = noise3D(cx * 0.1, cy * 0.1, cz * 0.1 + time * 0.3);

                tx = cx + noiseX * CONFIG.noiseStrength;
                ty = cy + noiseY * CONFIG.noiseStrength;
                tz = cz + noiseZ * CONFIG.noiseStrength;

                // Gentle pull back to origin if drifting too far
                const distFromCenter = Math.sqrt(cx * cx + cy * cy + cz * cz);
                if (distFromCenter > 20) {
                    tx *= 0.98;
                    ty *= 0.98;
                    tz *= 0.98;
                }
            }

            // SMOOTH LERP
            positions[i3] += (tx - positions[i3]) * CONFIG.lerpSpeed;
            positions[i3 + 1] += (ty - positions[i3 + 1]) * CONFIG.lerpSpeed;
            positions[i3 + 2] += (tz - positions[i3 + 2]) * CONFIG.lerpSpeed;
        }

        meshRef.current.geometry.attributes.position.needsUpdate = true;
    });

    return (
        <points ref={meshRef}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    count={particles.length / 3}
                    array={particles}
                    itemSize={3}
                />
            </bufferGeometry>
            <pointsMaterial
                ref={materialRef}
                size={0.12}
                color={COLORS.IDLE}
                map={glowTexture}
                transparent
                opacity={0.9}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                sizeAttenuation={true}
                vertexColors={false}
            />
        </points>
    );
};
