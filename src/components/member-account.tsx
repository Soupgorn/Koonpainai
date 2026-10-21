"use client";
import { useActionState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Clock3,
  Eye,
  Info,
  LockKeyhole,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  acknowledgeSharingPolicy,
  changeMemberAccess,
  localSignOut,
  saveMemberProfile,
} from "@/lib/auth/actions";
import { POLICY_VERSION } from "@/lib/auth/domain";
import { Button } from "./ui/button";
import { AppearanceSettings } from "./theme-provider";

export type MemberView = {
  id: string;
  nickname: string;
  thaiName: string;
  department: string;
  displayName: string;
  profileComplete: boolean;
  policyCurrent: boolean;
  status: "pending" | "approved" | "suspended";
  role: "member" | "admin";
};
function Progress({ member, step }: { member: MemberView; step: number }) {
  const completed = [
    member.profileComplete,
    member.policyCurrent,
    member.status === "approved",
  ];
  return (
    <div className="onboard-steps" aria-label={`Setup step ${step + 1} of 3`}>
      {["Your profile", "Sharing policy", "Access"].map((label, i) => (
        <span
          key={label}
          className={i === step ? "current" : completed[i] ? "complete" : ""}
        >
          <i>{i !== step && completed[i] ? <Check size={12} /> : i + 1}</i>
          {label}
        </span>
      ))}
    </div>
  );
}
export function MemberProfileForm({
  member,
  onboarding = false,
}: {
  member: MemberView;
  onboarding?: boolean;
}) {
  const [state, action, pending] = useActionState(saveMemberProfile, {
    error: "",
  });
  return (
    <form className="onboard-form" action={action}>
      {onboarding && <Progress member={member} step={0} />}
      {onboarding && (
        <>
          <h2>What should we call you?</h2>
          <p>Your nickname appears beside your timetable.</p>
        </>
      )}
      <input type="hidden" name="onboarding" value={String(onboarding)} />
      <label className="field">
        <span>Nickname</span>
        <input
          required
          name="nickname"
          maxLength={40}
          autoComplete="nickname"
          defaultValue={member.nickname}
        />
      </label>
      <label className="field">
        <span>
          Thai name <small>(optional)</small>
        </span>
        <input
          name="thaiName"
          lang="th"
          maxLength={60}
          defaultValue={member.thaiName}
        />
      </label>
      <label className="field">
        <span>Programme</span>
        <input
          required
          name="department"
          maxLength={80}
          defaultValue={member.department}
        />
      </label>
      <p className="help">
        Saved to your Koonpinai account. Your university identity cannot be
        changed here.
      </p>
      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="form-notice" role="status">
          {state.success}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending
          ? "Saving…"
          : onboarding
            ? "Continue to sharing policy"
            : "Save profile"}
        <ArrowRight size={17} />
      </Button>
    </form>
  );
}
export function MemberOnboarding({ member }: { member: MemberView }) {
  return (
    <main id="main" className="onboarding">
      <aside>
        <h1>
          Let’s put a name
          <br />
          to your timetable.
        </h1>
        <p>A familiar nickname makes it easier for people to find you.</p>
        <div className="onboard-preview">
          <span className="avatar avatar-large">
            {(member.nickname || member.displayName)[0]}
          </span>
          <div>
            <strong>
              {member.nickname || "Your nickname"}{" "}
              <span lang="th">{member.thaiName}</span>
            </strong>
            <span>{member.department || "Your programme"}</span>
          </div>
        </div>
        <div className="aside-reassurance">
          <ShieldCheck size={23} />
          <p>
            Create and maintain your own weekly timetable. Only approved members who acknowledge the current sharing policy can see shared schedules.
          </p>
        </div>
      </aside>
      <MemberProfileForm member={member} onboarding />
    </main>
  );
}
export function MemberPolicy({ member }: { member: MemberView }) {
  const [state, action, pending] = useActionState(acknowledgeSharingPolicy, {
    error: "",
  });
  return (
    <main id="main" className="onboard-single">
      <Progress member={member} step={1} />
      <h1>
        A shared timetable.
        <br />A little more clarity.
      </h1>
      <p>
        Read how timetable sharing works before continuing. Policy version{" "}
        {POLICY_VERSION}.
      </p>
      <div className="policy-list">
        <div>
          <Users size={23} />
          <div>
            <strong>Visible to approved users</strong>
            <p>
              Shared timetable details can include your nickname, programme,
              courses, times, and classroom information.
            </p>
          </div>
        </div>
        <div>
          <Eye size={23} />
          <div>
            <strong>Schedules, never live location</strong>
            <p>
              Availability is calculated from class times. It does not confirm
              attendance or show where you actually are.
            </p>
          </div>
        </div>
        <div>
          <ShieldCheck size={23} />
          <div>
            <strong>Your timetable, your changes</strong>
            <p>
              You add, edit and delete your own classes. Administrators manage account approval; they cannot edit your timetable through the application.
            </p>
          </div>
        </div>
        <div>
          <LockKeyhole size={23} />
          <div>
            <strong>Only the timetable details we need</strong>
            <p>
              Your profile, semester dates and class entries are stored in Koonpinai. Shared schedules are hidden if your account is pending or suspended, or your acknowledgement is out of date. Your university identity and email are not shown in the directory.
            </p>
          </div>
        </div>
      </div>
      <form action={action}>
        <input type="hidden" name="version" value={POLICY_VERSION} />
        <label className="policy-confirm">
          <input type="checkbox" name="acknowledged" required />
          <span>
            I have read and acknowledge this timetable-sharing policy.
          </span>
        </label>
        {state.error && (
          <p className="form-error" role="alert">
            {state.error}
          </p>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving acknowledgement…" : "Acknowledge and continue"}
          <ArrowRight size={17} />
        </Button>
      </form>
    </main>
  );
}
export function MemberPending({ member }: { member: MemberView }) {
  const suspended = member.status === "suspended";
  return (
    <main id="main" className="approval">
      <Progress member={member} step={2} />
      <Clock3 className="approval-symbol" size={38} />
      <h1>
        {suspended ? (
          "Your access is paused."
        ) : (
          <>
            A little pause
            <br />
            before you’re in.
          </>
        )}
      </h1>
      <p>
        {suspended
          ? "Shared timetables are unavailable for this account. Contact your administrator to review access."
          : "Your account is waiting for administrator approval. Shared timetables will become available after approval."}
      </p>
      <div className="approval-list">
        <div>
          {member.profileComplete ? <Check size={18} /> : <Info size={18} />}
          <span>
            {member.profileComplete
              ? "Profile completed"
              : "Profile incomplete"}
          </span>
        </div>
        <div>
          {member.policyCurrent ? <Check size={18} /> : <Info size={18} />}
          <span>
            {member.policyCurrent
              ? "Current sharing policy acknowledged"
              : "Sharing policy needs acknowledgement"}
          </span>
        </div>
        <div>
          <Clock3 size={18} />
          <span>{suspended ? "Access suspended" : "Approval pending"}</span>
        </div>
      </div>
      <Button asChild variant="outline">
        <Link href="/pending-approval">Check access again</Link>
      </Button>
      <Link className="quiet-link" href="/account">
        Account settings
      </Link>
      <LocalLogout />
    </main>
  );
}
export function LocalLogout() {
  return (
    <div className="approval-help">
      <form action={localSignOut}>
        <Button type="submit" variant="outline">
          Sign out of Koonpinai
        </Button>
      </form>
      <p>
        This ends your application session. Your KMITL SSO session may remain
        active.
      </p>
    </div>
  );
}
export function MemberAccount({ member }: { member: MemberView }) {
  return (
    <main id="main" className="main-container account-settings">
      <div className="page-heading">
        <div>
          <h1>Settings</h1>
        </div>
      </div>
      <section className="settings-section">
        <div>
          <h2>Your profile</h2>
          <p>Signed in with KMITL. Account access: {member.status}.</p>
        </div>
        <MemberProfileForm member={member} />
      </section>
      <section className="settings-section">
        <div>
          <h2>Appearance</h2>
          <p>Your preference is remembered on this device.</p>
        </div>
        <AppearanceSettings />
      </section>
      <section className="settings-section">
        <div>
          <h2>Your timetable</h2><p>You manage your own weekly classes.</p>
        </div>
        <div>
          <p>Only you can change your classes. Approved members with current acknowledgement can view your saved timetable.</p><Link className="button button-outline" href="/my-timetable">Manage my timetable</Link>
        </div>
      </section>
      <section className="settings-section">
        <div>
          <h2>Sharing & access</h2>
          <p>
            {member.policyCurrent
              ? "Current policy acknowledged."
              : "Please acknowledge the current sharing policy."}
          </p>
        </div>
        <div>
          <Link className="button button-outline" href="/onboarding/policy">
            Review sharing policy
          </Link>
          <LocalLogout />
        </div>
      </section>
    </main>
  );
}
export function MemberAccessForm({
  member,
  self,
}: {
  member: Pick<
    MemberView,
    "id" | "nickname" | "displayName" | "status" | "role"
  >;
  self: boolean;
}) {
  const [state, action, pending] = useActionState(changeMemberAccess, {
    error: "",
  });
  return (
    <form
      className="access-row member-access-row"
      action={action}
      aria-label={`Manage access for ${member.nickname || member.displayName}`}
    >
      <span className="avatar">
        {(member.nickname || member.displayName)[0]}
      </span>
      <div>
        <strong>{member.nickname || member.displayName}</strong>
        <p>
          {member.role} · {member.status}
        </p>
        {state.error && (
          <p role="alert" className="form-error">
            {state.error}
          </p>
        )}
        {state.success && (
          <p role="status" className="form-notice">
            {state.success}
          </p>
        )}
      </div>
      <input name="memberId" type="hidden" value={member.id} />
      <fieldset className="access-actions">
        <legend className="sr-only">Account access controls</legend>
        <label>
          <span className="sr-only">
            Access status for {member.nickname || member.displayName}
          </span>
          <select
            name="status"
            defaultValue={member.status}
            disabled={self || pending}
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>
        <Button type="submit" variant="outline" disabled={self || pending}>
          {pending ? "Saving…" : "Update access"}
        </Button>
      </fieldset>
    </form>
  );
}
