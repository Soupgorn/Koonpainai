import { POLICY_VERSION, type Member } from "./domain";
/** Deliberately excludes issuer, subject, email and all token material from client props. */
export function memberView(member: Member) {
  return {
    id: member.id,
    nickname: member.nickname,
    thaiName: member.thaiName,
    department: member.department,
    displayName: member.displayName,
    profileComplete: !!member.profileCompletedAt,
    policyCurrent:
      member.policyVersion === POLICY_VERSION && !!member.policyAcceptedAt,
    status: member.status,
    role: member.role,
  };
}
