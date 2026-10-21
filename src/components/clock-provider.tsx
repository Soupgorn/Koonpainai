"use client";
import { createContext, useContext, useEffect, useState } from "react";
const ClockContext = createContext<{
  now: Date | null;
}>({ now: null });
export function ClockProvider({ children }: { children: React.ReactNode }) {
  const [live, setLive] = useState<Date | null>(null);
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
  return (
    <ClockContext.Provider value={{ now: live }}>
      {children}
    </ClockContext.Provider>
  );
}
export function useClock() {
  return useContext(ClockContext);
}
