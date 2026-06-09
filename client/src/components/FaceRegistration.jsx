// client/src/components/FaceRegistration.jsx

import { useEffect, useState, useRef } from "react";
import { useFaceRecognition } from "../hooks/useFaceRecognition";

const BASE = import.meta.env.VITE_API_URL || "/api";

export default function FaceRegistration({ userId, userName, onComplete }) {
  const videoRef                      = useRef(null);
  const face                          = useFaceRecognition(videoRef);
  const [step, setStep]               = useState("loading"); // loading|intro|camera|capturing|done
  const [attempts, setAttempts]       = useState(0);
  const [error, setError]             = useState(null);

  useEffect(() => {
    (async () => {
      try {
        await face.loadModels();
        setStep("intro");
      } catch (err) {
        setError("Failed to load face models. Check your internet connection.");
        setStep("intro");
      }
    })();
  }, []);

  const handleStartCamera = async () => {
    setError(null);
    setStep("camera");
    try {
      await face.startCamera();
    } catch (err) {
      setError(err.message);
      setStep("intro");
    }
  };

  const handleCapture = async () => {
    setStep("capturing");
    setError(null);
    try {
      const descriptor = await face.captureDescriptor();
      const res = await fetch(`${BASE}/auth/face/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, descriptor }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to save face");
      }
      face.stopCamera();
      setStep("done");
      setTimeout(() => onComplete(), 1500);
    } catch (err) {
      setError(err.message);
      setAttempts(a => a + 1);
      setStep("camera");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col gap-6">

        {/* Header */}
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-2xl mx-auto mb-4">👤</div>
          <h1 className="text-2xl font-black tracking-tight">Face Setup</h1>
          <p className="text-zinc-500 text-sm mt-2">Hi {userName}! Set up your face ID once to clock in every day.</p>
        </div>

        {/* Loading */}
        {step === "loading" && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
            <div className="text-zinc-400 text-sm animate-pulse">Loading face recognition models…</div>
            <div className="mt-3 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full animate-pulse" style={{ width: "60%" }} />
            </div>
          </div>
        )}

        {/* Intro */}
        {step === "intro" && (
          <div className="flex flex-col gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-3">
              {[
                { icon: "📷", text: "We'll use your front camera" },
                { icon: "😊", text: "Look directly at the screen" },
                { icon: "💡", text: "Make sure you're in good light" },
                { icon: "🔒", text: "Your face data is stored securely" },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-3 text-sm text-zinc-300">
                  <span className="text-lg">{icon}</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
            {error && (
              <div className="text-red-400 text-sm bg-red-950/30 border border-red-900/40 px-4 py-3 rounded-xl">{error}</div>
            )}
            <button
              onClick={handleStartCamera}
              className="w-full py-4 rounded-2xl font-bold text-white text-sm transition-all"
              style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)", boxShadow: "0 4px 20px #4f46e533" }}
            >
              Start Camera
            </button>
          </div>
        )}

        {/* Camera */}
        {(step === "camera" || step === "capturing") && (
          <div className="flex flex-col gap-4">
            <div className="relative rounded-2xl overflow-hidden border border-zinc-700 bg-zinc-900">
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
                  className="rounded-full border-2 border-dashed"
                  style={{
                    width: 160, height: 200,
                    borderColor: step === "capturing" ? "#4ade80" : "#6366f1",
                    boxShadow: step === "capturing" ? "0 0 20px #4ade8044" : "0 0 20px #6366f144",
                  }}
                />
              </div>
              {step === "capturing" && (
                <div className="absolute inset-0 bg-indigo-950/40 flex items-center justify-center">
                  <div className="text-white font-bold text-sm animate-pulse">Capturing…</div>
                </div>
              )}
            </div>
            {error && (
              <div className="text-red-400 text-sm bg-red-950/30 border border-red-900/40 px-4 py-3 rounded-xl">{error}</div>
            )}
            <div className="text-center text-xs text-zinc-500">Centre your face in the oval • Look straight ahead</div>
            <button
              onClick={handleCapture}
              disabled={step === "capturing"}
              className="w-full py-4 rounded-2xl font-bold text-white text-sm disabled:opacity-40 transition-all"
              style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)", boxShadow: "0 4px 20px #4f46e533" }}
            >
              {step === "capturing" ? "Processing…" : attempts > 0 ? "Try Again" : "Capture My Face"}
            </button>
            <button
              onClick={() => { face.stopCamera(); setStep("intro"); setError(null); }}
              className="w-full py-3 rounded-2xl text-sm font-medium text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              ← Back
            </button>
          </div>
        )}

        {/* Done */}
        {step === "done" && (
          <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-2xl p-8 text-center">
            <div className="text-4xl mb-3">✓</div>
            <div className="font-bold text-emerald-400 text-lg">Face Registered!</div>
            <div className="text-zinc-500 text-sm mt-2">Taking you to your dashboard…</div>
          </div>
        )}
      </div>
    </div>
  );
}