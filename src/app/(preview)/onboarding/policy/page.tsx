import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SharingPolicy } from "@/components/account-screens";
import { MemberPolicy } from "@/components/member-account";
import { isUiPreviewEnabled } from "@/lib/preview";
import { requireMember } from "@/lib/auth/access";
import { memberView } from "@/lib/auth/member-view";
export const metadata: Metadata = { title: "Sharing policy" };
export default async function Page() {
  if (isUiPreviewEnabled()) return <SharingPolicy />;
  const member = await requireMember();
  if (!member.profileCompletedAt) redirect("/onboarding");
  return <MemberPolicy member={memberView(member)} />;
}
