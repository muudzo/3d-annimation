import React, { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// --- CONFIGURATION ---
const CONFIG = {
    particleCount: 50000, // Increased from 3000 for visual impact
    lerpSpeed: 0.1,
    repulsionRadius: 3,
};

// --- GEOMETRY MATH ---
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
    return { x: x * 0.15, y: y * 0.15, z: (Math.random() - 0.5) * 2 };
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

// --- MAIN COMPONENT ---
export const CPUParticles = ({ handDataRef }) => {
    const { viewport } = useThree();
    const count = CONFIG.particleCount;
    const meshRef = useRef();

    // Initialize Particles (Random Scatter)
    const particles = useMemo(() => {
        const temp = new Float32Array(count * 3);
        for (let i = 0; i < count * 3; i++) temp[i] = (Math.random() - 0.5) * 20;
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
                // Map to world coords (mirrored)
                gestureCenter.x = ((1 - (h1.x + h2.x) / 2) - 0.5) * viewport.width;
                gestureCenter.y = -((h1.y + h2.y) / 2 - 0.5) * viewport.height;
                console.log("🦈 CPU GESTURE: CLASP (DNA Helix)");
            }
        }

        // Single Hand Gestures
        if (detectedGesture === "IDLE" && hands.length > 0) {
            const hand = hands[0];
            const thumbTip = hand[4];
            const indexTip = hand[8];
            const middleTip = hand[12];
            const ringTip = hand[16];

            // Map center (mirrored)
            gestureCenter.x = ((1 - hand[9].x) - 0.5) * viewport.width;
            gestureCenter.y = -(hand[9].y - 0.5) * viewport.height;

            // Heuristics
            const isThumbUp = thumbTip.y < indexTip.y && thumbTip.y < middleTip.y;
            const indexUp = indexTip.y < hand[6].y;
            const middleUp = middleTip.y < hand[10].y;
            const ringDown = ringTip.y > hand[14].y;

            if (isThumbUp && !indexUp) {
                detectedGesture = "THUMBS_UP";
                console.log("🦈 CPU GESTURE: THUMBS_UP (Sphere)");
            } else if (indexUp && middleUp && ringDown) {
                detectedGesture = "PEACE";
                console.log("🦈 CPU GESTURE: PEACE (Heart)");
            }
        }

        // --- ANIMATE PARTICLES ---
        const positions = meshRef.current.geometry.attributes.position.array;

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            let tx = 0, ty = 0, tz = 0;

            if (detectedGesture === "CLASP") {
                // SPINNING HELIX
                const p = getHelixPoint(i, count);
                const rotSpeed = time * 3;
                const rotX = p.x * Math.cos(rotSpeed) - p.z * Math.sin(rotSpeed);
                const rotZ = p.x * Math.sin(rotSpeed) + p.z * Math.cos(rotSpeed);

                tx = rotX + gestureCenter.x;
                ty = p.y + gestureCenter.y;
                tz = rotZ;
            }
            else if (detectedGesture === "THUMBS_UP") {
                // SPHERE
                const p = getSpherePoint(i, count);
                tx = p.x + gestureCenter.x;
                ty = p.y + gestureCenter.y;
                tz = p.z;
            }
            else if (detectedGesture === "PEACE") {
                // HEART
                const p = getHeartPoint(i, count);
                tx = p.x + gestureCenter.x;
                ty = p.y + gestureCenter.y;
                tz = p.z;
            }
            else {
                // IDLE: FLOW FIELD NOISE
                const cx = positions[i3];
                const cy = positions[i3 + 1];
                tx = cx + Math.sin(cy * 0.5 + time) * 0.05;
                ty = cy + Math.cos(cx * 0.5 + time) * 0.05;
                tz = positions[i3 + 2];

                // Pull back to center if drifting
                if (Math.abs(cx) > 15) tx *= 0.99;
                if (Math.abs(cy) > 15) ty *= 0.99;
            }

            // LERP
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
                size={0.08}
                color="#00ffff"
                transparent
                opacity={0.8}
                blending={THREE.AdditiveBlending}
            />
        </points>
    );
};
