import "server-only";
import { cache } from "react";
import { friends } from "./data";
import type { Friend } from "./types";
import { requireSharedMember, requireTimetableMember } from "./auth/access";
import { isUiPreviewEnabled } from "./preview";
import { getMemberRepository, getTimetableRepository } from "@/db";
import { projectStudent } from "@/db/timetable-repository";
import { memberGate } from "./auth/domain";

function missingStorage(error: unknown): boolean {
  for (let e = error, n = 0; e && typeof e === "object" && n < 5; n++) {
    const value = e as { code?: string; cause?: unknown };
    if (value.code === "42P01") return true;
    e = value.cause;
  }
  return false;
}

// Authenticated database reads stay on this server boundary.
export const getFriends = cache(async (): Promise<Friend[]> => {
  if (isUiPreviewEnabled()) return friends;
  const viewer = await requireSharedMember();
  try {
    return await getTimetableRepository().listShared(viewer.id);
  } catch (error) {
    if (missingStorage(error)) return (await getMemberRepository().list())
      .filter(m => memberGate(m) === "allowed").map(m => projectStudent(m, null, false));
    throw new Error("The friends directory is temporarily unavailable.");
  }
});
export async function getFriend(id: string): Promise<Friend | undefined> {
  return (await getFriends()).find((friend) => friend.id === id);
}
export async function getMyTimetable(): Promise<Friend> {
  if (isUiPreviewEnabled())
    return {
      ...friends[0],
      id: "my-preview",
      nickname: "June",
      thaiName: "จูน",
      initials: "J",
    };
  const member = await requireTimetableMember();
  try { return projectStudent(member, await getTimetableRepository().getOwn(member.id)); }
  catch (error) {
    if (missingStorage(error)) return projectStudent(member, null, false);
    throw new Error("Your timetable is temporarily unavailable. Try again.");
  }
}
