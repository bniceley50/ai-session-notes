"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

const CYCLE = ["system", "light", "dark"] as const;

const ICONS: Record<string, typeof Sun> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

const LABELS: Record<string, string> = {
  system: "System theme",
  light: "Light theme",
  dark: "Dark theme",
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Avoid hydration mismatch — render nothing on the server
  if (!mounted) {
    return <div className="h-8 w-8" />;
  }

  const current = theme ?? "system";
  const idx = CYCLE.indexOf(current as (typeof CYCLE)[number]);
  const next = CYCLE[(idx + 1) % CYCLE.length];
  const Icon = ICONS[current] ?? Monitor;

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      title={LABELS[current]}
      aria-label={LABELS[current]}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

