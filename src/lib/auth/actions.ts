"use server";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { signIn, signOut } from "@/auth";
import { getMemberRepository } from "@/db";
import { requireAdmin, requireMember } from "./access";
import { readAuthSettings } from "./settings";
import { accessStatus, POLICY_VERSION, profileInput } from "./domain";
export async function signInWithKmitl() {
  if (!readAuthSettings()) redirect("/login?error=Configuration");
  try {
    await signIn("keycloak", { redirectTo: "/" });
  } catch (error) {
    if (error instanceof AuthError) redirect("/login?error=SignInFailed");
    throw error;
  }
}
export async function localSignOut() {
  revalidatePath("/", "layout");
  await signOut({ redirectTo: "/login?signedOut=local" });
}
export type FormState = { error: string; success?: string };
export async function saveMemberProfile(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const member = await requireMember();
  const parsed = profileInput.safeParse(
    Object.fromEntries(
      ["nickname", "thaiName", "department"].map((k) => [k, form.get(k) ?? ""]),
    ),
  );
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await getMemberRepository().saveProfile(member.id, parsed.data);
  } catch {
    return { error: "Your profile could not be saved. Try again." };
  }
  revalidatePath("/", "layout");
  if (form.get("onboarding") === "true") redirect("/onboarding/policy");
  return { error: "", success: "Your profile has been saved." };
}
export async function acknowledgeSharingPolicy(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const member = await requireMember();
  if (!member.profileCompletedAt) redirect("/onboarding");
  if (
    form.get("acknowledged") !== "on" ||
    form.get("version") !== POLICY_VERSION
  )
    return {
      error:
        "Read and acknowledge the current sharing policy before continuing.",
    };
  try {
    await getMemberRepository().acknowledgePolicy(member.id, POLICY_VERSION);
  } catch {
    return { error: "Your acknowledgement could not be saved. Try again." };
  }
  revalidatePath("/", "layout");
  redirect("/pending-approval");
}
export async function changeMemberAccess(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const actor = await requireAdmin(),
    id = form.get("memberId"),
    status = accessStatus.safeParse(form.get("status"));
  if (
    typeof id !== "string" ||
    !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(id) ||
    !status.success
  )
    return { error: "Choose a valid account and status." };
  try {
    await getMemberRepository().setStatus(actor.id, id, status.data);
  } catch {
    return {
      error:
        "Access could not be changed. You cannot change your own access here.",
    };
  }
  revalidatePath("/admin/access");
  return { error: "", success: "Account access updated." };
}
