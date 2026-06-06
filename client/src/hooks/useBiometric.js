// client/src/hooks/useBiometric.js

import { useState, useCallback } from "react";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";

/**
 * useBiometric
 * Handles WebAuthn registration and authentication.
 * Talks to your Node.js backend for challenges and verification.
 */
export function useBiometric({ apiBase = "/api" } = {}) {
  const [state, setState] = useState({
    status: "idle",       // idle | registering | authenticating | success | error
    error: null,
    isSupported: typeof window !== "undefined" && !!window.PublicKeyCredential,
    isPlatformSupported: false,
  });

  // Check if platform authenticator is available (Face ID, Touch ID, Windows Hello)
  useState(() => {
    if (window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable) {
      window.PublicKeyCredential
        .isUserVerifyingPlatformAuthenticatorAvailable()
        .then((available) => {
          setState((prev) => ({ ...prev, isPlatformSupported: available }));
        })
        .catch(() => {});
    }
  });

  /**
   * register
   * Called once per device per user — enrolls the device biometric.
   * @param {string} userId
   * @param {string} userName
   */
  const register = useCallback(
    async (userId, userName) => {
      setState({ status: "registering", error: null, isSupported: state.isSupported, isPlatformSupported: state.isPlatformSupported });

      try {
        // Step 1: Get registration options from server
        const optionsRes = await fetch(`${apiBase}/auth/register/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ userId, userName }),
        });

        if (!optionsRes.ok) {
          const err = await optionsRes.json();
          throw new Error(err.message || "Failed to get registration options");
        }

        const options = await optionsRes.json();

        // Step 2: Trigger the device biometric prompt
        // This one call opens Face ID / fingerprint / Windows Hello
        const credential = await startRegistration(options);

        // Step 3: Send the credential to the server to store
        const verifyRes = await fetch(`${apiBase}/auth/register/finish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ userId, credential }),
        });

        if (!verifyRes.ok) {
          const err = await verifyRes.json();
          throw new Error(err.message || "Registration verification failed");
        }

        setState((prev) => ({ ...prev, status: "success", error: null }));
        return true;
      } catch (err) {
        // NotAllowedError = user cancelled the prompt
        const message =
          err.name === "NotAllowedError"
            ? "Biometric prompt was cancelled."
            : err.message || "Registration failed.";

        setState((prev) => ({ ...prev, status: "error", error: message }));
        throw new Error(message);
      }
    },
    [apiBase, state.isSupported, state.isPlatformSupported]
  );

  /**
   * authenticate
   * Called on every clock-in — verifies the user's biometric.
   * @param {string} userId
   * @param {string} gpsToken - token issued after GPS passed
   */
  const authenticate = useCallback(
    async (userId, gpsToken) => {
      setState((prev) => ({ ...prev, status: "authenticating", error: null }));

      try {
        // Step 1: Get authentication challenge from server
        // Server only issues this if gpsToken is valid
        const optionsRes = await fetch(`${apiBase}/auth/login/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ userId, gpsToken }),
        });

        if (!optionsRes.ok) {
          const err = await optionsRes.json();
          throw new Error(err.message || "Failed to get auth challenge");
        }

        const options = await optionsRes.json();

        // Step 2: Trigger device biometric
        // Device signs the challenge — Face ID / fingerprint / PIN
        const assertion = await startAuthentication(options);

        // Step 3: Send signed assertion to server for verification
        const verifyRes = await fetch(`${apiBase}/auth/login/finish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ userId, assertion, gpsToken }),
        });

        if (!verifyRes.ok) {
          const err = await verifyRes.json();
          throw new Error(err.message || "Biometric verification failed");
        }

        const result = await verifyRes.json();
        setState((prev) => ({ ...prev, status: "success", error: null }));
        return result; // { verified: true, sessionToken: "..." }
      } catch (err) {
        const message =
          err.name === "NotAllowedError"
            ? "Biometric prompt was cancelled."
            : err.message || "Authentication failed.";

        setState((prev) => ({ ...prev, status: "error", error: message }));
        throw new Error(message);
      }
    },
    [apiBase]
  );

  const reset = useCallback(() => {
    setState((prev) => ({ ...prev, status: "idle", error: null }));
  }, []);

  return {
    ...state,
    register,
    authenticate,
    reset,
  };
}