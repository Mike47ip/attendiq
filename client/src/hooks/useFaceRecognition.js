// client/src/hooks/useFaceRecognition.js

import { useRef, useCallback } from "react";
import * as faceapi from "face-api.js";

const MODELS_URL = "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js/weights";

// Module-level cache — shared across ALL component instances
// Models load ONCE per browser session, never again
let modelsLoaded = false;
let modelsLoadingPromise = null;

export function useFaceRecognition(videoRef) {
  const streamRef = useRef(null);

  const loadModels = useCallback(async () => {
    // Already loaded — return immediately, no wait
    if (modelsLoaded) return;

    // Already loading elsewhere — wait for that same promise
    if (modelsLoadingPromise) {
      await modelsLoadingPromise;
      return;
    }

    // First load — kick it off and cache the promise
    modelsLoadingPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
    ]).then(() => {
      modelsLoaded = true;
      modelsLoadingPromise = null;
    }).catch(err => {
      modelsLoadingPromise = null; // allow retry on failure
      throw new Error("Failed to load face recognition models. Check your connection.");
    });

    await modelsLoadingPromise;
  }, []);

  const startCamera = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: 320, height: 240 },
      audio: false,
    }).catch(err => {
      const msg =
        err.name === "NotAllowedError" ? "Camera permission denied. Please allow camera access."
        : err.name === "NotFoundError" ? "No camera found on this device."
        : "Failed to start camera.";
      throw new Error(msg);
    });
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }
  }, [videoRef]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const captureDescriptor = useCallback(async () => {
    if (!videoRef.current) throw new Error("Camera not ready");
    if (!modelsLoaded) throw new Error("Models not loaded yet");

    const detection = await faceapi
      .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) throw new Error("No face detected. Make sure your face is clearly visible.");

    return Array.from(detection.descriptor);
  }, [videoRef]);

  return { loadModels, startCamera, stopCamera, captureDescriptor };
}