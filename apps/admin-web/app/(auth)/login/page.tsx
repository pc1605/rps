"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LoginForm } from "@/features/auth/components/login-form";
import { useAuth } from "@/features/auth/store";

export default function LoginPage() {
  const router = useRouter();
  const { user, restore } = useAuth();

  useEffect(() => {
    restore();
  }, [restore]);
  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  return (
    <main className="min-h-screen grid place-items-center bg-zinc-950 p-6">
      <LoginForm />
    </main>
  );
}
