import { useEffect, useRef, useState } from 'react'

export const DebugOverlay = ({ handDataRef }) => {
    const [status, setStatus] = useState('Initializing...')
    const canvasRef = useRef(null)

    useEffect(() => {
        const interval = setInterval(() => {
            if (!handDataRef.current) return

            const { hands, distance, isHandshake } = handDataRef.current

            if (hands.length === 0) {
                setStatus('No hands detected')
            } else if (hands.length === 1) {
                setStatus('1 hand detected')
            } else {
                setStatus(`2 hands detected | Distance: ${distance.toFixed(3)} | Handshake: ${isHandshake}`)
            }

            // Draw debug dots on canvas
            const canvas = canvasRef.current
            if (!canvas) return

            const ctx = canvas.getContext('2d')
            ctx.clearRect(0, 0, canvas.width, canvas.height)

            // Draw hand positions
            hands.forEach((hand, idx) => {
                // Convert normalized coords to canvas coords
                const x = ((hand.x + 1) / 2) * canvas.width
                const y = ((1 - hand.y) / 2) * canvas.height

                ctx.fillStyle = idx === 0 ? '#00ff00' : '#ff00ff'
                ctx.beginPath()
                ctx.arc(x, y, 10, 0, Math.PI * 2)
                ctx.fill()

                ctx.fillStyle = 'white'
                ctx.font = '12px monospace'
                ctx.fillText(`Hand ${idx + 1}`, x + 15, y)
            })
        }, 100)

        return () => clearInterval(interval)
    }, [handDataRef])

    return (
        <>
            <div style={{
                position: 'absolute',
                top: 10,
                right: 10,
                background: 'rgba(0,0,0,0.8)',
                color: '#00ff00',
                padding: '15px',
                fontFamily: 'monospace',
                fontSize: '14px',
                zIndex: 1000,
                borderRadius: '5px',
                border: '1px solid #00ff00'
            }}>
                <div><strong>STATUS:</strong> {status}</div>
                <div style={{ marginTop: '10px', fontSize: '12px', color: '#888' }}>
                    Bring 2 hands together to morph
                </div>
            </div>

            <canvas
                ref={canvasRef}
                width={window.innerWidth}
                height={window.innerHeight}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    pointerEvents: 'none',
                    zIndex: 999
                }}
            />
        </>
    )
}
