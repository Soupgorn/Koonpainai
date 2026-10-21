import "server-only";
import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { getMemberRepository } from "@/db";
import { isFictionalPreview, readAuthSettings } from "./settings";
import { memberGate } from "./domain";
export const currentMember = cache(async () => {
  if (!readAuthSettings()) return null;
  const session = await auth();
  if (!session?.user.id) return null;
  try {
    return await getMemberRepository().find(session.user.id);
  } catch {
    throw new Error("Account service is temporarily unavailable.");
  }
});
export async function requireMember() {
  const member = await currentMember();
  if (!member) redirect("/login");
  return member;
}
export async function requireSharedMember() {
  const member = await requireMember();
  switch (memberGate(member)) {
    case "profile":
      redirect("/onboarding");
    case "policy":
      redirect("/onboarding/policy");
    case "pending":
    case "suspended":
      redirect("/pending-approval");
  }
  return member;
}
export async function requireSharedAccess() {
  if (!isFictionalPreview()) await requireSharedMember();
}
export async function requireTimetableMember() {
  const member = await requireMember();
  const gate = memberGate(member);
  if (gate === "suspended") redirect("/pending-approval");
  if (gate === "profile") redirect("/onboarding");
  if (gate === "policy") redirect("/onboarding/policy");
  return member; // Pending students may prepare their own, still-private schedule.
}
export async function requireAdmin() {
  const member = await requireSharedMember();
  if (member.role !== "admin") notFound();
  return member;
}
