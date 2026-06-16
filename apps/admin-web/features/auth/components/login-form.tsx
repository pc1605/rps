"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/store";

export function LoginForm() {
  const router = useRouter();
  const { error, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    const ok = await login(email, password);
    setSubmitting(false);
    if (ok) router.replace("/dashboard");
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl">
      <p className="font-mono text-xs tracking-widest text-amber-500 mb-3">
        ◆ AMBIKA ENTERPRISE · RIDDHI
      </p>
      <h1 className="text-3xl font-extrabold text-zinc-50 mb-1">
        RPS <span className="text-amber-500">Admin</span>
      </h1>
      <p className="text-sm text-zinc-400 mb-8">
        Riddhi Production System — sign in to your dashboard.
      </p>

      <label className="block font-mono text-xs uppercase tracking-wider text-zinc-500 mb-2">
        Email
      </label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="owner@ambika.local"
        className="w-full mb-4 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-zinc-100 outline-none focus:border-amber-500"
      />

      <label className="block font-mono text-xs uppercase tracking-wider text-zinc-500 mb-2">
        Password
      </label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        placeholder="••••••••"
        className="w-full mb-6 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-zinc-100 outline-none focus:border-amber-500"
      />

      {error && (
        <p className="mb-4 rounded-lg bg-red-950 border border-red-900 px-4 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting || !email || !password}
        className="w-full rounded-lg bg-amber-500 py-3 font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-40"
      >
        {submitting ? "Signing in…" : "Sign in →"}
      </button>
    </div>
  );
}
