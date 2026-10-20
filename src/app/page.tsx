import { FriendsDirectory } from "@/components/friends-directory";
import { getFriends } from "@/lib/friends-repository";
import { isUiPreviewEnabled } from "@/lib/preview";
export default async function HomePage() {
  return <FriendsDirectory friends={await getFriends()} showPersonal={isUiPreviewEnabled()} />;
}
