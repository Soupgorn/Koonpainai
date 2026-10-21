import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PendingApproval } from "@/components/account-screens";
import { MemberPending } from "@/components/member-account";
import { isUiPreviewEnabled } from "@/lib/preview";
import { requireMember } from "@/lib/auth/access";
import { memberView } from "@/lib/auth/member-view";
import { memberGate } from "@/lib/auth/domain";
export const metadata: Metadata = { title: "Account access" };
export default async function Page() {
  if (isUiPreviewEnabled()) return <PendingApproval />;
  const member = await requireMember(),
    gate = memberGate(member);
  if (gate === "profile") redirect("/onboarding");
  if (gate === "policy") redirect("/onboarding/policy");
  if (gate === "allowed") redirect("/");
  return <MemberPending member={memberView(member)} />;
}
