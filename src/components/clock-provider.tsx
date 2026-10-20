"use client";
import { createContext, useContext, useEffect, useState } from "react";
const ClockContext = createContext<{
  now: Date | null;
  preview: boolean;
  setPreview: (value: boolean) => void;
}>({ now: null, preview: false, setPreview: () => {} });
export function ClockProvider({ children }: { children: React.ReactNode }) {
  const [live, setLive] = useState<Date | null>(null);
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    const tick = () => setLive(new Date());
    tick();
    const id = setInterval(tick, 15_000);
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, []);
  const now = preview ? new Date("2026-10-20T10:30:00+07:00") : live;
  return (
    <ClockContext.Provider value={{ now, preview, setPreview }}>
      {children}
    </ClockContext.Provider>
  );
}
export function useClock() {
  return useContext(ClockContext);
}
