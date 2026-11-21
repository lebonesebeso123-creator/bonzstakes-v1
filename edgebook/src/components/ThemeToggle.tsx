"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

export const THEME_KEY = "bonzstakes:theme";
type Theme = "light" | "dark";

const listeners = new Set<() => void>();
const current = (): Theme =>
  document.documentElement.dataset.theme === "light" ? "light" : "dark";

function apply(t: Theme) {
  const root = document.documentElement;
  root.classList.add("theme-switching");
  root.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t === "light" ? "#e3eef9" : "#0a1428");
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {
    /* private mode: still switches for this visit */
  }
  window.setTimeout(() => root.classList.remove("theme-switching"), 320);
  listeners.forEach((l) => l());
}

/** Day/night switch. The icon swap rotates; the colours glide across the whole app. */
export default function ThemeToggle() {
  const theme = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    current,
    () => "dark" as Theme
  );
  const next = theme === "light" ? "dark" : "light";
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => apply(next)}
      aria-label={next === "light" ? "Switch to day mode" : "Switch to night mode"}
      title={next === "light" ? "Day mode" : "Night mode"}
    >
      <Sun size={17} className="sun" aria-hidden />
      <Moon size={17} className="moon" aria-hidden />
    </button>
  );
}

/** Runs before first paint: saved choice, otherwise the device setting. */
export const themeScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}document.documentElement.dataset.theme=t;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",t==="light"?"#e3eef9":"#0a1428")}catch(e){}})();`;
