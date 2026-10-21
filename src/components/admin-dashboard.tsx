import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import type { Friend } from "@/lib/types";
import { Avatar } from "./shared";


import { Button } from "./ui/button";
export function DemoNotice() {
  return (
    <div className="demo-notice">
      <ShieldCheck size={17} />
      <p>
        <strong>Interface preview</strong>
        <span>
          Access changes stay in memory and do not change real accounts.
        </span>
      </p>
    </div>
  );
}
export function AdminDashboard({
  initialFriends,
  sample = false,
}: {
  initialFriends: Friend[];
  sample?: boolean;
}) {
  return (
    <main id="main" className="main-container admin-page">
      <Link className="back-link" href="/">
        <ArrowLeft size={15} />
        Friends dashboard
      </Link>
      <div className="admin-heading">
        <div>
          <h1>A little behind the scenes.</h1>
          <p>Account approvals. Students manage their own classes.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/access">
            <ShieldCheck size={16} />
            Manage account access
          </Link>
        </Button>
      </div>
      <nav className="admin-subnav" aria-label="Administration">
        <Link href="/admin" aria-current="page">
          Timetables
        </Link>
        <Link href="/admin/access">Access management</Link>
      </nav>
      {sample && (
        <p className="preview-notice">
          Fictional members for interface preview. No real account data is changed.
        </p>
      )}

      <section aria-label="Approved member timetables">
        <div className="section-heading">
          <div>
            <h2>Approved members</h2>
            <p>
              Timetables appear only when access and sharing are authorized.
            </p>
          </div>
        </div>
        <div className="access-list">
          {initialFriends.map((friend) => (
            <Link
              key={friend.id}
              href={`/friends/${friend.id}`}
              className="access-row"
            >
              <Avatar friend={friend} />
              <div>
                <strong>
                  {friend.nickname} <span lang="th">{friend.thaiName}</span>
                </strong>
                <p>{friend.department}</p>
              </div>
              <span>{friend.published ? `${friend.sessions.length} classes` : "No timetable yet"}</span>
            </Link>
          ))}
          {!initialFriends.length && (
            <div className="empty-state">
              <h3>No approved members yet.</h3>
              <p>Use access management to review account requests.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
