import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import * as Comlink from "comlink";

let handLandmarker = null;

const api = {
    /**
     * Initialize the MediaPipe HandLandmarker
     */
    async init() {
        try {
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
            );
            handLandmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                    delegate: "CPU" // Use CPU to keep GPU free for rendering 500k particles
                },
                runningMode: "VIDEO",
                numHands: 2
            });
            console.log("MediaPipe HandLandmarker initialized in Worker");
            return true;
        } catch (error) {
            console.error("Failed to init MediaPipe:", error);
            return false;
        }
    },

    /**
     * Detect hands in the provided ImageBitmap
     * @param {ImageBitmap} imageBitmap 
     * @param {number} timestamp 
     */
    detect(imageBitmap, timestamp) {
        if (!handLandmarker) {
            imageBitmap.close();
            return null;
        }

        try {
            const result = handLandmarker.detectForVideo(imageBitmap, timestamp);
            imageBitmap.close(); // Important: release memory
            return result;
        } catch (e) {
            imageBitmap.close();
            console.error("Detection failed:", e);
            return null;
        }
    }
};

Comlink.expose(api);
