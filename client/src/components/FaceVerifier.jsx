// client/src/components/FaceVerifier.jsx

import { useEffect, useState, useRef } from "react";
import { useFaceRecognition } from "../hooks/useFaceRecognition";

const BASE = import.meta.env.VITE_API_URL || "/api";
const MAX_ATTEMPTS = 3;

export default function FaceVerifier({ userId, onVerified, onCancel }) {
  const videoRef                      = useRef(null);
  const face                          = useFaceRecognition(videoRef);
  const [step, setStep]               = useState("loading"); // loading|ready|scanning|done|blocked
  const [attempts, setAttempts]       = useState(0);
  const [error, setError]             = useState(null);

  useEffect(() => {
    (async () => {
      try {
        await face.loadModels();
        await face.startCamera();
        setStep("ready");
      } catch (err) {
        setError(err.message);
        setStep("ready");
      }
    })();
    return () => face.stopCamera();
  }, []);

  const handleScan = async () => {
    if (attempts >= MAX_ATTEMPTS) { setStep("blocked"); return; }
    setStep("scanning");
    setError(null);
    try {
      const descriptor = await face.captureDescriptor();
      const res = await fetch(`${BASE}/auth/face/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, descriptor }),
      });
      const data = await res.json();
      if (!res.ok || !data.verified) {
        const next = attempts + 1;
        setAttempts(next);
        if (next >= MAX_ATTEMPTS) { face.stopCamera(); setStep("blocked"); }
        else { setError(`Face not recognised. ${MAX_ATTEMPTS - next} attempt${MAX_ATTEMPTS - next === 1 ? "" : "s"} remaining.`); setStep("ready"); }
        return;
      }
      face.stopCamera();
      setStep("done");
      setTimeout(() => onVerified(data.faceToken), 800);
    } catch (err) {
      const next = attempts + 1;
      setAttempts(next);
      if (next >= MAX_ATTEMPTS) { face.stopCamera(); setStep("blocked"); }
      else { setError(err.message || "Scan failed. Please try again."); setStep("ready"); }
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
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full"
              style={{ transform: "scaleX(-1)" }}
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className="rounded-full border-2"
                style={{
                  width: 150, height: 190,
                  borderColor: step === "scanning" ? "#fbbf24" : "#6366f1",
                  borderStyle: step === "scanning" ? "solid" : "dashed",
                  boxShadow: step === "scanning" ? "0 0 20px #fbbf2444" : "0 0 16px #6366f144",
                  transition: "all 0.3s ease",
                }}
              />
            </div>
            {step === "scanning" && (
              <div className="absolute inset-0 bg-yellow-950/20 flex items-center justify-center">
                <div className="text-yellow-400 font-bold text-sm animate-pulse">Scanning…</div>
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
            className="w-full py-4 rounded-2xl font-bold text-sm text-white transition-all"
            style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)", boxShadow: "0 4px 20px #4f46e533" }}>
            Scan My Face
          </button>
        )}
        {step === "scanning" && (
          <button disabled
            className="w-full py-4 rounded-2xl font-bold text-sm text-white opacity-40 cursor-not-allowed"
            style={{ background: "rgba(79,70,229,0.4)" }}>
            Scanning…
          </button>
        )}
        {!["done", "blocked", "scanning"].includes(step) && (
          <button onClick={() => { face.stopCamera(); onCancel(); }}
            className="w-full py-3 rounded-2xl text-sm font-medium text-zinc-500 hover:text-zinc-300 transition-colors">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}