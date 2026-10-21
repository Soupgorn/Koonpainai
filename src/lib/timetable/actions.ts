"use server";
import { revalidatePath } from "next/cache";
import { requireMember } from "../auth/access";
import { getTimetableRepository } from "@/db";
import { timetableMessage, type TimetableResult } from "./model";

// No owner/member ID is accepted from the browser. Auth.js validates the JWT
// and its database revocation record before returning this authenticated actor.
export async function saveTimetableTerm(input: unknown): Promise<TimetableResult> {
  const actor = await requireMember();
  try {
    const snapshot = await getTimetableRepository().saveTerm(actor.id, input);
    revalidatePath("/", "layout");
    return { error: "", snapshot };
  } catch (e) { return { error: timetableMessage(e) }; }
}
export async function saveTimetableEntry(input: unknown): Promise<TimetableResult> {
  const actor = await requireMember();
  try {
    const snapshot = await getTimetableRepository().saveEntry(actor.id, input);
    revalidatePath("/", "layout");
    return { error: "", snapshot };
  } catch (e) { return { error: timetableMessage(e) }; }
}
export async function deleteTimetableEntry(input: unknown): Promise<TimetableResult> {
  const actor = await requireMember();
  try {
    const snapshot = await getTimetableRepository().deleteEntry(actor.id, input);
    revalidatePath("/", "layout");
    return { error: "", snapshot };
  } catch (e) { return { error: timetableMessage(e) }; }
}
