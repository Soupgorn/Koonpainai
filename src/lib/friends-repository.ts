import "server-only";
import { friends } from "./data";
import type { Friend } from "./types";
import { requireSharedAccess } from "./auth/access";
import { isUiPreviewEnabled } from "./preview";

// Keep a future private GitHub/API adapter on this server-only boundary.
export async function getFriends(): Promise<Friend[]> {
  await requireSharedAccess();
  return isUiPreviewEnabled() ? friends : [];
}
export async function getFriend(id: string): Promise<Friend | undefined> {
  return (await getFriends()).find((friend) => friend.id === id);
}
