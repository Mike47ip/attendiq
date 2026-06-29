// client/src/components/FaceRegistration.jsx

import { useState, useRef, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";

const BASE = import.meta.env.VITE_API_URL || "/api";

export default function FaceRegistration({ userId, userName, onComplete }) {
  const { logout } = useAuth();
  const videoRef                = useRef(null);
  const streamRef               = useRef(null);
  const [step, setStep]         = useState("intro"); // intro|camera|capturing|uploading|done
  const [error, setError]       = useState(null);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    setError(null);
    setStep("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => videoRef.current.play();
      }
    } catch (err) {
      const msg = err.name === "NotAllowedError"
        ? "Camera permission denied. Please allow camera access."
        : "Failed to start camera.";
      setError(msg);
      setStep("intro");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const captureAndUpload = async () => {
    setStep("capturing");
    setError(null);
    try {
      const canvas = document.createElement("canvas");
      canvas.width  = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext("2d").drawImage(videoRef.current, 0, 0);
      const imageBase64 = canvas.toDataURL("image/jpeg", 0.9);

      setStep("uploading");
      stopCamera();

      const res = await fetch(`${BASE}/auth/face/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, imageBase64 }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to register face");

      setStep("done");
      setTimeout(() => onComplete(), 1500);
    } catch (err) {
      setError(err.message);
      setAttempts(a => a + 1);
      setStep("camera");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => videoRef.current.play();
      }
    }
  };

  return (
    <div
      className="bg-zinc-950 text-white flex flex-col overflow-x-hidden"
      style={{ minHeight: "100dvh" }}
    >
      {/* Top bar with sign out */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md">
        <div className="max-w-sm mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">
              A
            </div>
            <span className="font-bold text-base tracking-tight">AttendIQ</span>
          </div>
          <button
            onClick={logout}
            className="text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-800 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="w-full max-w-sm flex flex-col gap-6">

          {/* Header */}
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-2xl mx-auto mb-4">
              👤
            </div>
            <h1 className="text-2xl font-black tracking-tight">Face Setup</h1>
            <p className="text-zinc-500 text-sm mt-2">
              Hi {userName}! Set up your face ID once to clock in every day.
            </p>
          </div>

          {/* Intro */}
          {step === "intro" && (
            <div className="flex flex-col gap-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-3">
                {[
                  { icon: "📷", text: "We'll use your front camera" },
                  { icon: "😊", text: "Look directly at the screen" },
                  { icon: "💡", text: "Make sure you're in good lighting" },
                  { icon: "🔒", text: "Verified by AWS Rekognition" },
                ].map(({ icon, text }) => (
                  <div key={text} className="flex items-center gap-3 text-sm text-zinc-300">
                    <span className="text-lg">{icon}</span>
                    <span>{text}</span>
                  </div>
                ))}
              </div>
              {error && (
                <div className="text-red-400 text-sm bg-red-950/30 border border-red-900/40 px-4 py-3 rounded-xl">
                  {error}
                </div>
              )}
              <button
                onClick={startCamera}
                className="w-full py-4 rounded-2xl font-bold text-white text-sm transition-all active:scale-95"
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
                  ref={videoRef} autoPlay playsInline muted
                  className="w-full" style={{ transform: "scaleX(-1)" }}
                />
                {/* Oval guide */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="rounded-full border-2 border-dashed"
                    style={{ width: 180, height: 220, borderColor: "#6366f1", boxShadow: "0 0 20px #6366f144" }} />
                </div>
                {step === "capturing" && (
                  <div className="absolute inset-0 bg-indigo-950/50 flex items-center justify-center">
                    <div className="text-white font-bold animate-pulse">Capturing…</div>
                  </div>
                )}
              </div>

              {error && (
                <div className="text-red-400 text-sm bg-red-950/30 border border-red-900/40 px-4 py-3 rounded-xl">
                  {error}
                </div>
              )}

              <div className="text-center text-xs text-zinc-500">
                Centre your face in the oval · Look straight ahead · Good lighting
              </div>

              <button
                onClick={captureAndUpload} disabled={step === "capturing"}
                className="w-full py-4 rounded-2xl font-bold text-white text-sm disabled:opacity-40 transition-all active:scale-95"
                style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)", boxShadow: "0 4px 20px #4f46e533" }}
              >
                {step === "capturing" ? "Processing…" : attempts > 0 ? "Try Again" : "Capture My Face"}
              </button>

              <button
                onClick={() => { stopCamera(); setStep("intro"); setError(null); }}
                className="w-full py-3 rounded-2xl text-sm font-medium text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                ← Back
              </button>
            </div>
          )}

          {/* Uploading */}
          {step === "uploading" && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center flex flex-col gap-3">
              <div className="text-3xl animate-pulse">🔄</div>
              <div className="text-zinc-300 text-sm font-semibold">Registering your face…</div>
              <div className="text-zinc-600 text-xs">This takes a few seconds</div>
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
    </div>
  );
}