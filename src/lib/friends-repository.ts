import "server-only";
import { friends } from "./data";
import type { Friend } from "./types";

// Keep a future private GitHub/API adapter on this server-only boundary.
export async function getFriends(): Promise<Friend[]> {
  return friends;
}
export async function getFriend(id: string): Promise<Friend | undefined> {
  return friends.find((friend) => friend.id === id);
}
