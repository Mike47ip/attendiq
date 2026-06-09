// client/src/hooks/useFaceRecognition.js

import { useRef, useCallback } from "react";
import * as faceapi from "face-api.js";

const MODELS_URL = "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js/weights";

// Module-level cache — models load ONCE per browser session
let modelsLoaded = false;
let modelsLoadingPromise = null;

export function useFaceRecognition(videoRef) {
  const streamRef = useRef(null);

  const loadModels = useCallback(async () => {
    if (modelsLoaded) return;
    if (modelsLoadingPromise) {
      await modelsLoadingPromise;
      return;
    }
    modelsLoadingPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
    ]).then(() => {
      modelsLoaded = true;
      modelsLoadingPromise = null;
    }).catch(err => {
      modelsLoadingPromise = null;
      throw new Error("Failed to load face recognition models. Check your connection.");
    });
    await modelsLoadingPromise;
  }, []);

  const startCamera = useCallback(async () => {
    // Stop any existing stream first
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

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
      // Clear previous source first
      videoRef.current.srcObject = null;
      // Small tick to let browser reset
      await new Promise(r => setTimeout(r, 50));
      videoRef.current.srcObject = stream;

      // Wait for video to be ready before playing
      await new Promise((resolve, reject) => {
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play()
            .then(resolve)
            .catch(err => {
              // Ignore AbortError — happens when component unmounts during load
              if (err.name === "AbortError") resolve();
              else reject(err);
            });
        };
      });
    }
  }, [videoRef]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [videoRef]);

  const captureDescriptor = useCallback(async () => {
    if (!videoRef.current) throw new Error("Camera not ready");
    if (!modelsLoaded) throw new Error("Models not loaded yet");

    // Wait for video to have actual dimensions
    if (videoRef.current.videoWidth === 0) {
      await new Promise(r => setTimeout(r, 500));
    }

    const detection = await faceapi
      .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({
        inputSize: 224,
        scoreThreshold: 0.3, // lower threshold = more lenient detection
      }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) throw new Error("No face detected. Centre your face and ensure good lighting.");

    return Array.from(detection.descriptor);
  }, [videoRef]);

  return { loadModels, startCamera, stopCamera, captureDescriptor };
}