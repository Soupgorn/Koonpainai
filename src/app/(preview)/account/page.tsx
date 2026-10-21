import type { Metadata } from "next";
import { AccountSettings } from "@/components/account-screens";
import { MemberAccount } from "@/components/member-account";
import { isUiPreviewEnabled } from "@/lib/preview";
import { requireMember } from "@/lib/auth/access";
import { memberView } from "@/lib/auth/member-view";
export const metadata: Metadata = { title: "Settings" };
export default async function Page() {
  return isUiPreviewEnabled() ? (
    <AccountSettings />
  ) : (
    <MemberAccount member={memberView(await requireMember())} />
  );
}
