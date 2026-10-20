"use client";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main id="main" className="main-container">
      <div className="empty-state page-empty">
        <h1>The timetable couldn’t load.</h1>
        <p>Try loading this page again.</p>
        <Button onClick={reset}>
          <RefreshCw size={16} />
          Try again
        </Button>
      </div>
    </main>
  );
}
