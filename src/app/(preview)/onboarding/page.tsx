import { Onboarding } from "@/components/account-screens";
import { MemberOnboarding } from "@/components/member-account";
import { isUiPreviewEnabled } from "@/lib/preview";
import { requireMember } from "@/lib/auth/access";
import { memberView } from "@/lib/auth/member-view";
export default async function Page() {
  return isUiPreviewEnabled() ? (
    <Onboarding />
  ) : (
    <MemberOnboarding member={memberView(await requireMember())} />
  );
}
