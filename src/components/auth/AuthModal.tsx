"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface AuthModalProps {
  onClose: () => void;
}

type Step = "email" | "sent";

export function AuthModal({ onClose }: AuthModalProps) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setStep("sent");
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sign in"
        className="fixed z-40 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                   w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6"
      >
        {step === "email" ? (
          <>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Sign in</h2>
            <p className="text-sm text-gray-500 mb-5">
              We&apos;ll send a magic link to your email — no password needed.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email"
                required
                autoFocus
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm
                           focus:outline-none focus:ring-2 focus:ring-green-500"
              />

              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-3 rounded-xl bg-green-500 text-white font-medium text-sm
                           disabled:opacity-50 disabled:cursor-not-allowed
                           hover:bg-green-600 transition-colors"
              >
                {loading ? "Sending…" : "Send magic link"}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="text-center space-y-3">
              <div className="text-4xl">✉️</div>
              <h2 className="text-lg font-semibold text-gray-900">Check your email</h2>
              <p className="text-sm text-gray-500">
                We sent a link to <span className="font-medium text-gray-700">{email}</span>.
                Click it to sign in.
              </p>
              <button
                onClick={onClose}
                className="text-sm text-gray-400 hover:text-gray-600 pt-2"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
