"use client";

import { ThemeProvider as NextThemeProvider, useTheme } from "next-themes";
import { Check, ChevronDown, Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="koonpinai-theme"
    >
      {children}
    </NextThemeProvider>
  );
}

const subscribe = () => () => {};
export function ThemeControl() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const dark = mounted && resolvedTheme === "dark";
  useEffect(() => {
    if (!open) return;
    function dismiss(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  return (
    <div
      className="theme-control"
      ref={container}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        className="theme-switch"
        disabled={!mounted}
        onClick={() => setTheme(dark ? "light" : "dark")}
        aria-label={dark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        title={dark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      >
        {dark ? <Sun size={19} /> : <Moon size={19} />}
      </button>
      <button
        className="theme-options-trigger"
        ref={trigger}
        aria-label="Theme preferences"
        aria-expanded={open}
        aria-controls="theme-preferences"
        onClick={() => setOpen(!open)}
      >
        <ChevronDown size={13} />
      </button>
      {open && (
        <fieldset id="theme-preferences" className="theme-menu">
          <legend>Appearance</legend>
          {(
            [
              ["light", "Light", Sun],
              ["dark", "Dark", Moon],
              ["system", "System", Monitor],
            ] as const
          ).map(([value, label, Icon]) => (
            <label key={value}>
              <input
                type="radio"
                name="theme"
                value={value}
                checked={theme === value}
                onChange={() => setTheme(value)}
              />
              <Icon size={16} />
              <span>{label}</span>
              {theme === value && <Check size={15} />}
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}
