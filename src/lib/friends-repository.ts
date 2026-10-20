import "server-only";
import { friends } from "./data";
import type { Friend } from "./types";
import { requireSharedAccess } from "./auth/access";

// Keep a future private GitHub/API adapter on this server-only boundary.
export async function getFriends(): Promise<Friend[]> {
  await requireSharedAccess();
  return friends;
}
export async function getFriend(id: string): Promise<Friend | undefined> {
  await requireSharedAccess();
  return friends.find((friend) => friend.id === id);
}
