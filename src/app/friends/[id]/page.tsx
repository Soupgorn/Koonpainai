import { notFound } from "next/navigation";
import { FriendProfile } from "@/components/friend-profile";
import { getFriend } from "@/lib/friends-repository";
import { isUiPreviewEnabled } from "@/lib/preview";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const friend = await getFriend((await params).id);
  return {
    title: friend ? `${friend.nickname}’s timetable` : "Friend not found",
  };
}
export default async function FriendPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const friend = await getFriend((await params).id);
  if (!friend) notFound();
  return <FriendProfile friend={friend} sample={isUiPreviewEnabled()} />;
}
