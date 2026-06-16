"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/store";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading, logout, restore } = useAuth();

  useEffect(() => { restore(); }, [restore]);
  useEffect(() => { if (!loading && !user) router.replace("/login"); }, [loading, user, router]);

  if (loading || !user) {
    return (
      <main className="min-h-screen grid place-items-center bg-zinc-950">
        <p className="text-zinc-500 font-mono text-sm">LOADING…</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-800 px-8 py-4">
        <div>
          <p className="font-mono text-xs tracking-widest text-amber-500">RPS</p>
          <h1 className="text-lg font-bold">Riddhi Production System</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-semibold">{user.name}</p>
            <p className="font-mono text-xs uppercase text-zinc-500">{user.role}</p>
          </div>
          <button
            onClick={() => { logout(); router.replace("/login"); }}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-amber-500 hover:text-amber-500"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="p-8">{children}</main>
    </div>
  );
}
