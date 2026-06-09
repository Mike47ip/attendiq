// client/src/components/FaceVerifier.jsx

import { useState, useRef, useEffect } from "react";

const BASE = import.meta.env.VITE_API_URL || "/api";
const MAX_ATTEMPTS = 3;

export default function FaceVerifier({ userId, onVerified, onCancel }) {
  const videoRef                    = useRef(null);
  const streamRef                   = useRef(null);
  const [step, setStep]             = useState("loading");
  const [attempts, setAttempts]     = useState(0);
  const [error, setError]           = useState(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setStep("ready");
        };
      }
    } catch (err) {
      const msg = err.name === "NotAllowedError"
        ? "Camera permission denied. Please allow camera access."
        : "Failed to start camera.";
      setError(msg);
      setStep("ready");
    }
  };

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const handleScan = async () => {
    if (attempts >= MAX_ATTEMPTS) { setStep("blocked"); return; }
    setStep("scanning");
    setError(null);

    try {
      const canvas = document.createElement("canvas");
      canvas.width  = videoRef.current.videoWidth  || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      canvas.getContext("2d").drawImage(videoRef.current, 0, 0);
      const imageBase64 = canvas.toDataURL("image/jpeg", 0.9);

      const res = await fetch(`${BASE}/auth/face/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, imageBase64 }),
      });

      const data = await res.json();

      if (!res.ok || !data.verified) {
        const next = attempts + 1;
        setAttempts(next);
        if (next >= MAX_ATTEMPTS) {
          stopCamera();
          setStep("blocked");
        } else {
          setError(`${data.message || "Face not recognised."} ${MAX_ATTEMPTS - next} attempt${MAX_ATTEMPTS - next === 1 ? "" : "s"} remaining.`);
          setStep("ready");
        }
        return;
      }

      stopCamera();
      setStep("done");
      setTimeout(() => onVerified(data.faceToken), 800);
    } catch (err) {
      const next = attempts + 1;
      setAttempts(next);
      if (next >= MAX_ATTEMPTS) {
        stopCamera();
        setStep("blocked");
      } else {
        setError(err.message || "Scan failed. Please try again.");
        setStep("ready");
      }
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-1">Step 1 of 2</p>
        <h2 className="text-lg font-bold text-white">Face Verification</h2>
        <p className="text-sm text-zinc-400 mt-1">Look at the camera to verify your identity.</p>
      </div>

      {(step === "loading" || step === "ready" || step === "scanning") && (
        <div className="flex flex-col gap-3">
          <div className="relative rounded-2xl overflow-hidden border border-zinc-700 bg-zinc-900">
            {step === "loading" && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 z-10">
                <div className="text-zinc-500 text-sm animate-pulse">Starting camera…</div>
              </div>
            )}
            <video ref={videoRef} autoPlay playsInline muted className="w-full"
              style={{ transform: "scaleX(-1)" }} />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="rounded-full border-2"
                style={{
                  width: 170, height: 210,
                  borderColor: step === "scanning" ? "#fbbf24" : "#6366f1",
                  borderStyle: step === "scanning" ? "solid" : "dashed",
                  boxShadow: step === "scanning" ? "0 0 20px #fbbf2444" : "0 0 16px #6366f144",
                  transition: "all 0.3s ease",
                }} />
            </div>
            {step === "scanning" && (
              <div className="absolute inset-0 bg-yellow-950/20 flex items-center justify-center">
                <div className="text-yellow-400 font-bold text-sm animate-pulse">Verifying with Azure AI…</div>
              </div>
            )}
          </div>

          {attempts > 0 && (
            <div className="flex gap-1.5 justify-center">
              {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
                <div key={i} className="w-2 h-2 rounded-full"
                  style={{ background: i < attempts ? "#ef4444" : "#3f3f46" }} />
              ))}
            </div>
          )}

          {error && (
            <div className="text-red-400 text-sm bg-red-950/30 border border-red-900/40 px-4 py-3 rounded-xl">{error}</div>
          )}

          <div className="text-center text-xs text-zinc-500">
            Centre your face • Look straight ahead • Good lighting helps
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="rounded-2xl border border-emerald-900/50 bg-emerald-950/30 p-8 text-center">
          <div className="text-3xl mb-2">✓</div>
          <div className="font-bold text-emerald-400">Identity confirmed!</div>
          <div className="text-zinc-500 text-xs mt-1">Proceeding to GPS check…</div>
        </div>
      )}

      {step === "blocked" && (
        <div className="rounded-2xl border border-red-900/50 bg-red-950/30 p-6 text-center">
          <div className="text-3xl mb-2">🚫</div>
          <div className="font-bold text-red-400 text-base">Too many failed attempts</div>
          <div className="text-zinc-500 text-sm mt-2">Please contact your admin.</div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {step === "ready" && (
          <button onClick={handleScan}
            className="w-full py-4 rounded-2xl font-bold text-sm text-white transition-all active:scale-95"
            style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)", boxShadow: "0 4px 20px #4f46e533" }}>
            Scan My Face
          </button>
        )}
        {step === "scanning" && (
          <button disabled
            className="w-full py-4 rounded-2xl font-bold text-sm text-white opacity-40 cursor-not-allowed"
            style={{ background: "rgba(79,70,229,0.4)" }}>
            Verifying…
          </button>
        )}
        {!["done", "blocked", "scanning"].includes(step) && (
          <button onClick={() => { stopCamera(); onCancel(); }}
            className="w-full py-3 rounded-2xl text-sm font-medium text-zinc-500 hover:text-zinc-300 transition-colors">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}