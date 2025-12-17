import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stats } from '@react-three/drei'
import { Particles } from './Particles'
import { useHandTracking } from '../hooks/useHandTracking'

// M1 Optimization Note:
// dpr={1} is hardcoded to prevent Retina rendering (2x) which quadruples pixel count.
// This is essential for a fanless MacBook Air running 500k+ particles.
export const Experience = () => {
    const handPosRef = useHandTracking()

    return (
        <>
            <Canvas
                dpr={1}
                camera={{ position: [0, 0, 5], fov: 60 }}
                gl={{
                    antialias: false,
                    powerPreference: "high-performance",
                    alpha: false
                }}
            >
                <color attach="background" args={['#050505']} />

                <Particles handPosRef={handPosRef} />

                <OrbitControls makeDefault />
                <Stats />
            </Canvas>
        </>
    )
}
