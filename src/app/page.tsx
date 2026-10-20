import { FriendsDirectory } from "@/components/friends-directory";
import { getFriends } from "@/lib/friends-repository";
export default async function HomePage() {
  return <FriendsDirectory friends={await getFriends()} />;
}
