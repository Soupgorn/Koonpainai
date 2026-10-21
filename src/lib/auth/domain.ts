import { z } from "zod";
export const KMITL_ISSUER = "https://sso.kmitl.ac.th/realms/kmitl";
export const KMITL_DISCOVERY = `${KMITL_ISSUER}/.well-known/openid-configuration`;
export const EXPECTED_ENDPOINTS = {
  issuer: KMITL_ISSUER,
  authorization_endpoint: `${KMITL_ISSUER}/protocol/openid-connect/auth`,
  token_endpoint: `${KMITL_ISSUER}/protocol/openid-connect/token`,
  userinfo_endpoint: `${KMITL_ISSUER}/protocol/openid-connect/userinfo`,
  end_session_endpoint: `${KMITL_ISSUER}/protocol/openid-connect/logout`,
  jwks_uri: `${KMITL_ISSUER}/protocol/openid-connect/certs`,
} as const;
export const POLICY_VERSION = "2026-10-22-student-v3";
export const SESSION_SECONDS = 8 * 60 * 60;
export const profileInput = z.object({
  nickname: z.string().trim().min(1, "Enter your nickname.").max(40),
  thaiName: z.string().trim().max(60),
  department: z.string().trim().min(1, "Enter your programme.").max(80),
});
export const accessStatus = z.enum(["pending", "approved", "suspended"]);
export type AccessStatus = z.infer<typeof accessStatus>;
export type ProfileInput = z.infer<typeof profileInput>;
export interface Member {
  id: string;
  issuer: string;
  subject: string;
  displayName: string;
  email: string | null;
  nickname: string;
  thaiName: string;
  department: string;
  profileCompletedAt: Date | null;
  policyVersion: string | null;
  policyAcceptedAt: Date | null;
  status: AccessStatus;
  role: "member" | "admin";
  createdAt: Date;
  updatedAt: Date;
}
export type Identity = {
  issuer: string;
  subject: string;
  displayName: string;
  email: string | null;
};
export type Gate = "profile" | "policy" | "pending" | "suspended" | "allowed";
export function memberGate(member: Member): Gate {
  if (member.status === "suspended") return "suspended";
  if (!member.profileCompletedAt) return "profile";
  if (member.policyVersion !== POLICY_VERSION || !member.policyAcceptedAt)
    return "policy";
  return member.status === "approved" ? "allowed" : "pending";
}
export interface MemberRepository {
  login(
    identity: Identity,
    sessionId: string,
    expiresAt: Date,
  ): Promise<Member>;
  activeSession(sessionId: string): Promise<Member | null>;
  revokeSession(sessionId: string): Promise<void>;
  find(id: string): Promise<Member | null>;
  saveProfile(id: string, input: ProfileInput): Promise<void>;
  acknowledgePolicy(id: string, version: string): Promise<void>;
  list(): Promise<Member[]>;
  setStatus(actorId: string, id: string, status: AccessStatus): Promise<void>;
}
