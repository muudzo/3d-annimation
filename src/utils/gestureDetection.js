/**
 * Gesture Detection Engine
 * Counts extended fingers to trigger shape changes.
 */

const LANDMARKS = {
    WRIST: 0,
    THUMB_CMC: 1,
    THUMB_MCP: 2,
    THUMB_IP: 3,
    THUMB_TIP: 4,
    INDEX_MCP: 5,
    INDEX_TIP: 8,
    MIDDLE_MCP: 9,
    MIDDLE_TIP: 12,
    RING_MCP: 13,
    RING_TIP: 16,
    PINKY_MCP: 17,
    PINKY_TIP: 20
}

/**
 * Check if a finger is extended.
 * For 4 fingers: Tip distance to wrist > MCP distance to wrist.
 * For Thumb: Check if tip is away from palm plane (simplified check here).
 */
const isFingerExtended = (landmarks, fingerName) => {
    const wrist = landmarks[LANDMARKS.WRIST];

    if (fingerName === 'THUMB') {
        const tip = landmarks[LANDMARKS.THUMB_TIP];
        const ip = landmarks[LANDMARKS.THUMB_IP];
        const mcp = landmarks[LANDMARKS.THUMB_MCP];

        // Thumb extended if tip is further from MCP than IP is? 
        // Or simple Vector check. Let's use x-distance from pinky MCP as a proxy for "open" hand width
        // A safer heuristic for thumb is checking angle. 
        // Simple heuristic: distance from Tip to Pinky MCP > distance from IP to Pinky MCP
        const pinkyMCP = landmarks[LANDMARKS.PINKY_MCP];
        const tipDist = Math.hypot(tip.x - pinkyMCP.x, tip.y - pinkyMCP.y);
        const ipDist = Math.hypot(ip.x - pinkyMCP.x, ip.y - pinkyMCP.y);
        return tipDist > ipDist;
    }

    let tipIdx, mcpIdx;
    if (fingerName === 'INDEX') { tipIdx = LANDMARKS.INDEX_TIP; mcpIdx = LANDMARKS.INDEX_MCP; }
    if (fingerName === 'MIDDLE') { tipIdx = LANDMARKS.MIDDLE_TIP; mcpIdx = LANDMARKS.MIDDLE_MCP; }
    if (fingerName === 'RING') { tipIdx = LANDMARKS.RING_TIP; mcpIdx = LANDMARKS.RING_MCP; }
    if (fingerName === 'PINKY') { tipIdx = LANDMARKS.PINKY_TIP; mcpIdx = LANDMARKS.PINKY_MCP; }

    const tip = landmarks[tipIdx];
    const mcp = landmarks[mcpIdx];

    const tipDist = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
    const mcpDist = Math.hypot(mcp.x - wrist.x, mcp.y - wrist.y);

    // Tip must be significantly further than MCP
    return tipDist > mcpDist * 1.2;
}

export const detectGesture = (hands) => {
    if (!hands || hands.length === 0) return "SPHERE"; // Default

    const hand = hands[0]; // Primary hand

    let fingersUp = 0;
    if (isFingerExtended(hand, 'THUMB')) fingersUp++;
    if (isFingerExtended(hand, 'INDEX')) fingersUp++;
    if (isFingerExtended(hand, 'MIDDLE')) fingersUp++;
    if (isFingerExtended(hand, 'RING')) fingersUp++;
    if (isFingerExtended(hand, 'PINKY')) fingersUp++;

    // Mapping based on requirements
    // 2 Fingers -> Flower
    // 3 Fingers -> Saturn
    // 4 Fingers -> Heart
    // 5 Fingers -> Fireworks
    // Default -> Sphere

    switch (fingersUp) {
        case 2: return "FLOWER";
        case 3: return "SATURN";
        case 4: return "HEART";
        case 5: return "FIREWORKS";
        default: return "SPHERE";
    }
}
