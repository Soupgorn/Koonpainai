import { FriendsDirectory } from "@/components/friends-directory";
import { getFriends, getMyTimetable } from "@/lib/friends-repository";
import { isUiPreviewEnabled } from "@/lib/preview";
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
