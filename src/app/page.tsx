import type { Metadata } from "next";
import { FriendsDirectory } from "@/components/friends-directory";
import { getFriends } from "@/lib/friends-repository";
import { isUiPreviewEnabled } from "@/lib/preview";
import { currentMember } from "@/lib/auth/access";
export const metadata: Metadata = { title: { absolute: "Friends | Koonpinai" } };
export const dynamic = "force-dynamic";
export default async function HomePage() {
  return (
    <FriendsDirectory
      friends={await getFriends()}
      showPersonal={isUiPreviewEnabled() || Boolean(await currentMember())}
    />
  );
}
