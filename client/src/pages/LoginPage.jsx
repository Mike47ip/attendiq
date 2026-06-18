// client/src/pages/LoginPage.jsx

import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { loginUser } from "../api/auth";

function PunchClockIllustration() {
  return (
    <svg viewBox="0 0 400 400" className="w-full max-w-xs">
      <circle cx="200" cy="180" r="120" fill="#18181b" stroke="#3f3f46" strokeWidth="2" />
      <circle cx="200" cy="180" r="100" fill="#09090b" stroke="#27272a" strokeWidth="1.5" />

      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i * 30 * Math.PI) / 180;
        const x1 = 200 + 86 * Math.sin(angle);
        const y1 = 180 - 86 * Math.cos(angle);
        const x2 = 200 + 94 * Math.sin(angle);
        const y2 = 180 - 94 * Math.cos(angle);
        return (
          <line
            key={i}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="#52525b"
            strokeWidth={i % 3 === 0 ? 3 : 1.5}
            strokeLinecap="round"
          />
        );
      })}

      <line x1="200" y1="180" x2="200" y2="120" stroke="#a5b4fc" strokeWidth="5" strokeLinecap="round" />
      <line x1="200" y1="180" x2="245" y2="180" stroke="#818cf8" strokeWidth="4" strokeLinecap="round" />
      <circle cx="200" cy="180" r="7" fill="#6366f1" />

      <rect x="170" y="36" width="60" height="26" rx="8" fill="#27272a" stroke="#3f3f46" strokeWidth="1.5" />
      <circle cx="200" cy="49" r="5" fill="#52525b" />

      <rect x="120" y="312" width="160" height="64" rx="10" fill="#18181b" stroke="#3f3f46" strokeWidth="2" />
      <rect x="138" y="298" width="56" height="34" rx="4" fill="#27272a" stroke="#52525b" strokeWidth="1.5" />
      <line x1="146" y1="308" x2="186" y2="308" stroke="#71717a" strokeWidth="2" strokeLinecap="round" />
      <line x1="146" y1="316" x2="178" y2="316" stroke="#71717a" strokeWidth="2" strokeLinecap="round" />
      <circle cx="248" cy="344" r="14" fill="#4f46e5" />
      <path d="M242 344 L246 348 L254 338" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await loginUser({ email, password });
      login(result.user, result.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* Left panel — brand + illustration, hidden on small screens */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center bg-zinc-900/50 border-r border-zinc-800 px-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.08),transparent_60%)]" />
        <div className="relative flex flex-col items-center">
          <PunchClockIllustration />
          <h2 className="text-xl font-bold text-white mt-8 tracking-tight">Every minute, accounted for</h2>
          <p className="text-zinc-500 text-sm mt-2 text-center max-w-xs">
            Clock in, clock out, and let AttendIQ handle the rest.
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">

          {/* Logo (mobile + desktop) */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black text-xl mb-4">
              A
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">AttendIQ</h1>
            <p className="text-zinc-500 text-sm mt-1">Sign in to your account</p>
          </div>

          {/* Form */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-4">
            {error && (
              <div className="bg-red-950/50 border border-red-900/50 text-red-400 text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors pr-16"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200 transition-colors p-1 rounded-lg"
                  >
                    {showPass ? (
                      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                style={{
                  background: loading ? "rgba(79,70,229,0.5)" : "linear-gradient(135deg, #4f46e5, #7c3aed)",
                  boxShadow: !loading ? "0 4px 20px #4f46e533" : "none",
                }}
              >
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </form>
          </div>

          {/* Contact / no-account help */}
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 px-5 py-4">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Don't have an account?
            </p>
            <p className="text-zinc-500 text-xs mb-3">
              Reach out to your admin to get set up.
            </p>
            <div className="flex flex-col gap-2">
              <a
                href="mailto:pippingpole@gmail.com"
                className="flex items-center gap-2 text-sm text-zinc-300 hover:text-indigo-400 transition-colors group"
              >
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-zinc-500 group-hover:text-indigo-400 transition-colors">
                  <path d="M22 6l-10 7L2 6" />
                  <path d="M2 6h20v12H2z" />
                </svg>
                pippingpole@gmail.com
              </a>
              <a
                href="tel:0240040329"
                className="flex items-center gap-2 text-sm text-zinc-300 hover:text-indigo-400 transition-colors group"
              >
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-zinc-500 group-hover:text-indigo-400 transition-colors">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                0240 040 329
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}