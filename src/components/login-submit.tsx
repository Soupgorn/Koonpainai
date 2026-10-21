"use client";
import { useFormStatus } from "react-dom";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { Button } from "./ui/button";

export function LoginSubmit({ configured }: { configured: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      className="auth-submit"
      type="submit"
      disabled={!configured || pending}
      aria-busy={pending}
      lang="en"
    >
      <span aria-live="polite">
        {pending ? "Connecting to KMITL…" : "Continue with KMITL SSO"}
      </span>
      {pending ? (
        <LoaderCircle className="auth-spinner" size={18} aria-hidden="true" />
      ) : (
        <ArrowRight size={18} aria-hidden="true" />
      )}
    </Button>
  );
}
