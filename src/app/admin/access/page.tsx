import { AccessManagement } from "@/components/access-management";
import { MemberAccessForm } from "@/components/member-account";
import { isUiPreviewEnabled } from "@/lib/preview";
import { requireAdmin } from "@/lib/auth/access";
import { getMemberRepository } from "@/db";
export default async function Page() {
  if (isUiPreviewEnabled()) return <AccessManagement />;
  const actor = await requireAdmin(),
    members = await getMemberRepository().list();
  return (
    <main id="main" className="main-container">
      <div className="page-heading">
        <div>
          <h1>A familiar, trusted circle.</h1>
          <p>Review account access to shared timetables.</p>
        </div>
      </div>
      <section aria-label="Account access" className="access-list">
        {members.map((m) => (
          <MemberAccessForm
            key={m.id}
            member={{
              id: m.id,
              nickname: m.nickname,
              displayName: m.displayName,
              status: m.status,
              role: m.role,
            }}
            self={m.id === actor.id}
          />
        ))}
      </section>
    </main>
  );
}
