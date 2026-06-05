// client/src/hooks/useGeolocation.js

import { useState, useEffect, useRef, useCallback } from "react";

const GPS_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0, // never use cached position
};

/**
 * useGeolocation
 * Live GPS hook using watchPosition for continuous updates.
 * Returns the latest coords, accuracy, status, and a one-shot capture fn.
 */
export function useGeolocation() {
  const [state, setState] = useState({
    status: "idle",       // idle | acquiring | tracking | error
    lat: null,
    lng: null,
    accuracy: null,       // metres — important for validation
    altitude: null,
    timestamp: null,
    error: null,
  });

  const watchIdRef = useRef(null);

  const onSuccess = useCallback((position) => {
    const { latitude, longitude, accuracy, altitude } = position.coords;
    setState({
      status: "tracking",
      lat: latitude,
      lng: longitude,
      accuracy: Math.round(accuracy),
      altitude: altitude ? Math.round(altitude) : null,
      timestamp: position.timestamp,
      error: null,
    });
  }, []);

  const onError = useCallback((err) => {
    const messages = {
      1: "Location permission denied. Please allow location access.",
      2: "Position unavailable. Check your GPS signal.",
      3: "GPS timed out. Try moving to an open area.",
    };
    setState((prev) => ({
      ...prev,
      status: "error",
      error: messages[err.code] || "Unknown GPS error.",
    }));
  }, []);

  // Start watching on mount
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: "Geolocation is not supported by your browser.",
      }));
      return;
    }

    setState((prev) => ({ ...prev, status: "acquiring" }));

    watchIdRef.current = navigator.geolocation.watchPosition(
      onSuccess,
      onError,
      GPS_OPTIONS
    );
  }, [onSuccess, onError]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setState((prev) => ({ ...prev, status: "idle" }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  /**
   * capturePosition
   * Returns a snapshot of the current position for submission.
   * Throws if not tracking or accuracy is too poor.
   */
  const capturePosition = useCallback(
    (maxAccuracy = 100) => {
      if (state.status !== "tracking") {
        throw new Error("GPS not ready. Please wait for a fix.");
      }
      if (state.accuracy > maxAccuracy) {
        throw new Error(
          `GPS accuracy too low (${state.accuracy}m). Need within ${maxAccuracy}m.`
        );
      }
      return {
        lat: state.lat,
        lng: state.lng,
        accuracy: state.accuracy,
        timestamp: state.timestamp,
      };
    },
    [state]
  );

  return {
    ...state,
    startTracking,
    stopTracking,
    capturePosition,
  };
}