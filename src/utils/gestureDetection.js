/**
 * Gesture Detection Engine
 * Pure mathematical heuristics - no ML models
 */

// MediaPipe Hand Landmark Indices
const LANDMARKS = {
    WRIST: 0,
    THUMB_TIP: 4,
    THUMB_IP: 3,
    INDEX_TIP: 8,
    INDEX_PIP: 6,
    MIDDLE_TIP: 12,
    MIDDLE_PIP: 10,
    RING_TIP: 16,
    RING_PIP: 14,
    PINKY_TIP: 20,
    PINKY_PIP: 18
}

/**
 * Check if a finger is extended (tip is further from wrist than PIP joint)
 */
const isFingerExtended = (landmarks, tipIdx, pipIdx) => {
    const wrist = landmarks[LANDMARKS.WRIST]
    const tip = landmarks[tipIdx]
    const pip = landmarks[pipIdx]

    const tipDist = Math.sqrt(
        Math.pow(tip.x - wrist.x, 2) +
        Math.pow(tip.y - wrist.y, 2)
    )
    const pipDist = Math.sqrt(
        Math.pow(pip.x - wrist.x, 2) +
        Math.pow(pip.y - wrist.y, 2)
    )

    return tipDist > pipDist * 1.1 // 10% threshold
}

/**
 * Check if thumb is pointing up (Y-axis check)
 */
const isThumbUp = (landmarks) => {
    const thumbTip = landmarks[LANDMARKS.THUMB_TIP]
    const thumbIp = landmarks[LANDMARKS.THUMB_IP]
    const indexTip = landmarks[LANDMARKS.INDEX_TIP]
    const middleTip = landmarks[LANDMARKS.MIDDLE_TIP]
    const ringTip = landmarks[LANDMARKS.RING_TIP]
    const pinkyTip = landmarks[LANDMARKS.PINKY_TIP]

    // Thumb should be higher (lower Y in screen coords) than other fingers
    const thumbIsHighest = (
        thumbTip.y < indexTip.y &&
        thumbTip.y < middleTip.y &&
        thumbTip.y < ringTip.y &&
        thumbTip.y < pinkyTip.y
    )

    // Thumb should be extended
    const thumbExtended = thumbTip.y < thumbIp.y - 0.05

    // Other fingers should be curled
    const indexCurled = !isFingerExtended(landmarks, LANDMARKS.INDEX_TIP, LANDMARKS.INDEX_PIP)
    const middleCurled = !isFingerExtended(landmarks, LANDMARKS.MIDDLE_TIP, LANDMARKS.MIDDLE_PIP)

    return thumbIsHighest && thumbExtended && indexCurled && middleCurled
}

/**
 * Check for Peace Sign (Index + Middle extended, Ring + Pinky curled)
 */
const isPeaceSign = (landmarks) => {
    const indexExtended = isFingerExtended(landmarks, LANDMARKS.INDEX_TIP, LANDMARKS.INDEX_PIP)
    const middleExtended = isFingerExtended(landmarks, LANDMARKS.MIDDLE_TIP, LANDMARKS.MIDDLE_PIP)
    const ringCurled = !isFingerExtended(landmarks, LANDMARKS.RING_TIP, LANDMARKS.RING_PIP)
    const pinkyCurled = !isFingerExtended(landmarks, LANDMARKS.PINKY_TIP, LANDMARKS.PINKY_PIP)

    return indexExtended && middleExtended && ringCurled && pinkyCurled
}

/**
 * Main gesture detection function
 * @param {Array} hands - Array of hand landmark arrays from MediaPipe
 * @returns {string} - Gesture state: "THUMBS_UP", "PEACE", "TWO_HAND_CLASP", "IDLE"
 */
export const detectGesture = (hands) => {
    if (!hands || hands.length === 0) return "IDLE"

    // Two-Hand Clasp Check (highest priority)
    if (hands.length === 2) {
        const hand1Centroid = hands[0][LANDMARKS.WRIST]
        const hand2Centroid = hands[1][LANDMARKS.WRIST]

        const distance = Math.sqrt(
            Math.pow(hand1Centroid.x - hand2Centroid.x, 2) +
            Math.pow(hand1Centroid.y - hand2Centroid.y, 2)
        )

        if (distance < 0.1) {
            return "TWO_HAND_CLASP"
        }
    }

    // Single hand gestures (use first hand)
    const primaryHand = hands[0]

    if (isThumbUp(primaryHand)) {
        return "THUMBS_UP"
    }

    if (isPeaceSign(primaryHand)) {
        return "PEACE"
    }

    return "IDLE"
}
