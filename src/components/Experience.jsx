```javascript
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stats } from '@react-three/drei'
import { CPUParticles } from './CPUParticles'
import { DebugOverlay } from './DebugOverlay'
import { useHandTracking } from '../hooks/useHandTracking'

// M1 Optimization Note:
// dpr={1} is hardcoded to prevent Retina rendering (2x) which quadruples pixel count.
// This is essential for a fanless MacBook Air running 500k+ particles.
export const Experience = () => {
  const { handDataRef, debugText, videoRef } = useHandTracking()

  return (
    <>
      {/* Debug video preview - visible to confirm camera is working */}
      {videoRef.current && (
        <video
          ref={(el) => {
            if (el && videoRef.current && el !== videoRef.current) {
              el.srcObject = videoRef.current.srcObject
              el.play()
            }
          }}
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            width: '200px',
            height: '150px',
            zIndex: 9999,
            opacity: 0.8,
            visibility: 'visible',
            transform: 'scaleX(-1)', // Mirror for natural feel
            border: '2px solid #00ff00',
            borderRadius: '5px'
          }}
          playsInline
          muted
        />
      )}
      
      <DebugOverlay handDataRef={handDataRef} />
      
      <Canvas
        dpr={1} 
        camera={{ position: [0, 0, 10], fov: 60 }}
        gl={{ 
            antialias: false, 
            powerPreference: "high-performance",
            alpha: false 
        }}
      >
        <color attach="background" args={['#050505']} />
        
        <CPUParticles handDataRef={handDataRef} />
        
        <OrbitControls makeDefault />
        <Stats />
      </Canvas>
    </>
  )
}
```
