"use client";

import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { Moon, Sun, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/store";

export function Topbar() {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-6">
      <div className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
        Riddhi Production System
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 dark:-rotate-90 dark:scale-0 transition-all" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 dark:rotate-0 dark:scale-100 transition-all" />
        </Button>
        <div className="text-right">
          <div className="text-sm font-medium leading-none">{user?.name}</div>
          <div className="font-mono text-[10px] uppercase text-muted-foreground mt-0.5">
            {user?.role}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            logout();
            router.replace("/login");
          }}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
