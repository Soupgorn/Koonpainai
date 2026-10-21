import type { Metadata } from "next";
import { FriendsDirectory } from "@/components/friends-directory";
import { getFriends, getMyTimetable } from "@/lib/friends-repository";
import { isUiPreviewEnabled } from "@/lib/preview";
export const metadata: Metadata = { title: { absolute: "Friends | Koonpinai" } };
export const dynamic = "force-dynamic";
export default async function HomePage() {
  return (
    <FriendsDirectory
      friends={await getFriends()}
      personalFriend={await getMyTimetable()}
      sample={isUiPreviewEnabled()}
    />
  );
}
