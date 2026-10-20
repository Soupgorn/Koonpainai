import { Login } from "@/components/account-screens";
import { isUiPreviewEnabled } from "@/lib/preview";
import { readAuthSettings } from "@/lib/auth/settings";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; signedOut?: string }>;
}) {
  const query = await searchParams;
  const message =
    query.signedOut === "local"
      ? "You’re signed out of Koonpinai. Your KMITL SSO session may still be active."
      : query.error
        ? "Sign-in could not be completed. Try again, or ask your administrator to check the approved client and account storage."
        : "";
  return (
    <Login
      previewEnabled={isUiPreviewEnabled()}
      configured={!!readAuthSettings()}
      message={message}
    />
  );
}
