import type { Metadata } from "next";
import { BrandLogo } from "@/components/brand";
import { LoginSubmit } from "@/components/login-submit";
import { signInWithKmitl } from "@/lib/auth/actions";
import { readAuthSettings } from "@/lib/auth/settings";
import "./login.css";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; signedOut?: string }>;
}) {
  const query = await searchParams;
  const configured = !!readAuthSettings();
  const errorMessage = query.error === "AccessDenied"
    ? "Sign-in was not allowed. Please try again or contact support."
    : query.error === "Configuration" || query.error === "SignInFailed"
      ? "Unable to sign in right now. Please try again later."
      : "Sign-in could not be completed. Please try again.";
  return (
    <main id="main" className="auth-page">
      <section className="auth-card" aria-labelledby="login-heading" lang="th">
        <div className="auth-brand"><BrandLogo /></div>
        <h1 id="login-heading">เวลาว่างตรงกัน<br />เจอกันง่ายขึ้น</h1>
        <p className="auth-description">
          เช็กตารางเรียน หาเวลาว่างของเพื่อน<br />
          แล้วนัดเจอกันได้ง่ายกว่าเดิม
        </p>
        <form action={signInWithKmitl}>
          <LoginSubmit configured={configured} />
        </form>
        {query.error ? (
          <p className="auth-feedback" role="alert" lang="en">
            {errorMessage}
          </p>
        ) : !configured ? (
          <p className="auth-feedback" role="status">
            เข้าสู่ระบบยังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง
          </p>
        ) : null}
      </section>
    </main>
  );
}
