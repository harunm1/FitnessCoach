"use client";

import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import styles from "./account.module.css";

type Theme = "light" | "dark";
const storageKey = "fitnesscoach.accountTheme";
const changeEvent = "fitnesscoach:account-theme";
let memoryTheme: Theme | undefined;

function currentTheme(): Theme {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* A blocked storage API must not prevent changing the theme. */
  }
  return (
    memoryTheme ??
    (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
  );
}

function subscribe(onChange: () => void) {
  const media = matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  window.addEventListener("storage", onChange);
  window.addEventListener(changeEvent, onChange);
  return () => {
    media.removeEventListener("change", onChange);
    window.removeEventListener("storage", onChange);
    window.removeEventListener(changeEvent, onChange);
  };
}

const ThemeContext = createContext<{
  theme: Theme | null;
  toggle: () => void;
} | null>(null);
const serverTheme = () => null;

// Theme styling is scoped to the account subtree; the shared site stays untouched.
export function AccountTheme({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  const theme = useSyncExternalStore<Theme | null>(
    subscribe,
    currentTheme,
    serverTheme,
  );
  function toggle() {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    memoryTheme = next;
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      /* Keep the in-memory preference. */
    }
    window.dispatchEvent(new Event(changeEvent));
  }
  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      <main
        className={[styles.themeRoot, className].join(" ")}
        data-theme={theme ?? "system"}
      >
        {children}
      </main>
    </ThemeContext.Provider>
  );
}

export function ThemeToggle() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("ThemeToggle must be inside AccountTheme.");
  const dark = context.theme === "dark";
  const label = dark ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button
      type="button"
      className={styles.themeToggle}
      onClick={context.toggle}
      aria-label={label}
      title={label}
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        {dark ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
          </>
        ) : (
          <path d="M20.5 14a8.5 8.5 0 0 1-10.5-10.5A8.5 8.5 0 1 0 20.5 14Z" />
        )}
      </svg>
      <span className={styles.themeLabel}>{dark ? "Light" : "Dark"}</span>
    </button>
  );
}
