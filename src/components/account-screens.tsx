"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Eye,
  Info,
  LockKeyhole,
  Monitor,
  Moon,
  ShieldCheck,
  Sun,
  Users,
} from "lucide-react";
import { BrandMark } from "./site-header";
import { usePersonalPreview } from "./personal-preview-provider";
import { Button } from "./ui/button";
import { StatusBadge } from "./shared";

function PreviewNotice() {
  return (
    <p className="preview-notice">
      <Info size={16} />
      <span>
        <strong>Interface preview.</strong> No SSO session or account is
        created. Profile, approval, and timetable changes stay in memory and
        reset on reload.
      </span>
    </p>
  );
}
function Steps({ step }: { step: number }) {
  const { profileCompleted, policyAccepted } = usePersonalPreview();
  const completed = [profileCompleted, policyAccepted, false];
  return (
    <div className="onboard-steps" aria-label={`Setup step ${step + 1} of 3`}>
      {["Your profile", "Sharing policy", "Access"].map((label, index) => (
        <span
          key={label}
          className={
            index === step ? "current" : completed[index] ? "complete" : ""
          }
        >
          <i>
            {index !== step && completed[index] ? (
              <Check size={12} />
            ) : (
              index + 1
            )}
          </i>
          {label}
        </span>
      ))}
    </div>
  );
}
export function Login({ previewEnabled }: { previewEnabled: boolean }) {
  const [notice, setNotice] = useState(false);
  return (
    <main id="main" className="login">
      <section className="login-story">
        <h1>
          Same campus.
          <br />
          More time together.
        </h1>
        <p>
          Know who has a break, what’s on their timetable, and when your
          schedules line up.
        </p>
        <div className="login-demo" aria-label="Fictional timetable example">
          <div className="demo-head">
            <strong>A little window for lunch.</strong>
            <span>Example · Tuesday, 11:45</span>
          </div>
          <div className="demo-person">
            <span className="avatar">M</span>
            <div>
              <strong>
                Mild <span lang="th">มายด์</span>
              </strong>
              <span>Free until 13:00</span>
            </div>
            <StatusBadge kind="free" />
          </div>
          <div className="demo-person">
            <span className="avatar avatar-2">B</span>
            <div>
              <strong>
                Bean <span lang="th">บีน</span>
              </strong>
              <span>Class finishes at 12:00</span>
            </div>
            <span className="starts-soon">Free in 15m</span>
          </div>
          <div className="shared-time">
            <Clock3 size={20} />
            <span>
              A shared break<strong>12:00–13:00</strong>
            </span>
          </div>
        </div>
        <span className="story-note">
          From class schedules. Never live location.
        </span>
      </section>
      <section className="login-form">
        <div className="entry-symbol">
          <BrandMark />
        </div>
        <h2>
          Your people,
          <br />
          one timetable away.
        </h2>
        <p>
          University sign-in is coming. Explore the interface while we connect
          KMITL SSO.
        </p>
        <Button className="sso" onClick={() => setNotice(true)}>
          Continue with KMITL SSO
          <ArrowRight size={18} />
        </Button>
        <span className="sso-note">
          SSO is not connected · No account will be created
        </span>
        {notice && (
          <p className="form-notice" role="status">
            University sign-in is not available yet. Your credentials have not
            been requested.
          </p>
        )}
        <div className="login-privacy">
          <ShieldCheck size={22} />
          <p>
            The planned service shares your timetable with approved users after
            you review the sharing policy.
          </p>
        </div>
        {previewEnabled && (
          <>
            <Link className="quiet-link" href="/onboarding">
              Explore the interface preview
              <ArrowRight size={15} />
            </Link>
            <Link className="quiet-link" href="/onboarding/policy">
              How timetable sharing will work
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
export function Onboarding() {
  const { profile, setProfile, setProfileCompleted } = usePersonalPreview();
  const [draft, setDraft] = useState(profile);
  const router = useRouter();
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
            {draft.nickname[0]?.toUpperCase() || "?"}
          </span>
          <div>
            <strong>
              {draft.nickname || "Your nickname"}{" "}
              <span lang="th">{draft.thaiName}</span>
            </strong>
            <span>{draft.department || "Your programme"}</span>
          </div>
        </div>
        <div className="aside-reassurance">
          <ShieldCheck size={23} />
          <p>
            Your timetable will only be shared after you acknowledge the policy
            and access is approved.
          </p>
        </div>
      </aside>
      <form
        className="onboard-form"
        onSubmit={(e) => {
          e.preventDefault();
          setProfile({ ...draft, nickname: draft.nickname.trim() });
          setProfileCompleted(true);
          router.push("/onboarding/policy");
        }}
      >
        <Steps step={0} />
        <h2>What should we call you?</h2>
        <p>Your nickname appears beside your timetable.</p>
        <label className="field">
          <span>Nickname</span>
          <input
            required
            maxLength={40}
            autoComplete="nickname"
            value={draft.nickname}
            onChange={(e) => setDraft({ ...draft, nickname: e.target.value })}
            pattern=".*\S.*"
          />
        </label>
        <label className="field">
          <span>
            Thai name <small>(optional)</small>
          </span>
          <input
            lang="th"
            maxLength={60}
            value={draft.thaiName}
            onChange={(e) => setDraft({ ...draft, thaiName: e.target.value })}
          />
        </label>
        <label className="field">
          <span>Programme</span>
          <input
            required
            maxLength={80}
            value={draft.department}
            onChange={(e) => setDraft({ ...draft, department: e.target.value })}
          />
        </label>
        <p className="help">
          Use fictional details while exploring this preview.
        </p>
        <Button type="submit">
          Continue to sharing policy
          <ArrowRight size={17} />
        </Button>
        <PreviewNotice />
      </form>
    </main>
  );
}
export function SharingPolicy() {
  const { policyAccepted, setPolicyAccepted } = usePersonalPreview();
  const router = useRouter();
  return (
    <main id="main" className="onboard-single">
      <Steps step={1} />
      <h1>
        A shared timetable.
        <br />A little more clarity.
      </h1>
      <p>
        Before you continue, here’s what timetable sharing will mean in
        Koonpinai.
      </p>
      <div className="policy-list">
        <div>
          <Users size={23} />
          <div>
            <strong>Visible to approved users</strong>
            <p>
              Your nickname, programme, classes, and classroom details will be
              visible to other approved users.
            </p>
          </div>
        </div>
        <div>
          <CalendarDays size={23} />
          <div>
            <strong>Schedules, never live location</strong>
            <p>
              Availability comes from class times. It does not confirm
              attendance or show where you actually are.
            </p>
          </div>
        </div>
        <div>
          <Eye size={23} />
          <div>
            <strong>Review before sharing</strong>
            <p>
              You’ll check imported classes and semester dates before accepting
              a timetable. Changes are not published in this preview.
            </p>
          </div>
        </div>
        <div>
          <LockKeyhole size={23} />
          <div>
            <strong>Your PDF stays on your device</strong>
            <p>
              PDF reading and Thai/English text recognition happen in your
              browser. No original document is uploaded.
            </p>
          </div>
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          router.push("/pending-approval");
        }}
      >
        <label className="policy-confirm">
          <input
            type="checkbox"
            required
            checked={policyAccepted}
            onChange={(e) => setPolicyAccepted(e.target.checked)}
          />
          <span>
            I understand the proposed sharing policy and acknowledge it for this
            interface preview.
          </span>
        </label>
        <Button disabled={!policyAccepted} type="submit">
          Continue to access preview
          <ArrowRight size={17} />
        </Button>
      </form>
      <PreviewNotice />
    </main>
  );
}
export function PendingApproval() {
  const { profile, policyAccepted, profileCompleted } = usePersonalPreview();
  return (
    <main id="main" className="approval">
      <Steps step={2} />
      <Clock3 className="approval-symbol" size={38} />
      <h1>
        A little pause
        <br />
        before you’re in.
      </h1>
      <p>
        This is the pending approval screen for {profile.nickname}. In the
        connected service, approved students will be able to see one another’s
        timetables.
      </p>
      <div className="approval-list">
        <div>
          {profileCompleted ? <Check size={18} /> : <Info size={18} />}
          <span>
            {profileCompleted
              ? "Profile preview completed"
              : "Profile details are a fictional preview"}
          </span>
        </div>
        <div>
          {policyAccepted ? <Check size={18} /> : <Info size={18} />}
          <span>
            {policyAccepted
              ? "Sharing policy acknowledged in this preview"
              : "Sharing policy has not been acknowledged"}
          </span>
        </div>
        <div>
          <Clock3 size={18} />
          <span>Account approval is not connected</span>
        </div>
      </div>
      <div className="approval-help">
        <strong>No request has been submitted.</strong>
        <p>
          Real sign-in and administrator approval will be added with server-side
          authorization.
        </p>
      </div>
      <Button asChild>
        <Link href="/">
          Explore the fictional dashboard
          <ArrowRight size={17} />
        </Link>
      </Button>
      <Link className="quiet-link" href="/onboarding/policy">
        Review the sharing policy
      </Link>
      <PreviewNotice />
    </main>
  );
}
const subscribe = () => () => {};
export function AccountSettings() {
  const { profile, setProfile, policyAccepted } = usePersonalPreview();
  const [draft, setDraft] = useState(profile);
  const [notice, setNotice] = useState("");
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return (
    <main id="main" className="main-container account-settings">
      <div className="page-heading">
        <div>
          <h1>Your account.</h1>
          <p>A few details that make Koonpinai yours.</p>
        </div>
      </div>
      <PreviewNotice />
      <section className="settings-section">
        <div>
          <h2>Your profile</h2>
          <p>This preview uses fictional information.</p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setProfile({ ...draft, nickname: draft.nickname.trim() });
            setNotice(
              "Profile updated for this preview only. It resets on reload.",
            );
          }}
        >
          <label className="field">
            <span>Nickname</span>
            <input
              required
              pattern=".*\S.*"
              maxLength={40}
              value={draft.nickname}
              onChange={(e) => setDraft({ ...draft, nickname: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Thai name</span>
            <input
              lang="th"
              maxLength={60}
              value={draft.thaiName}
              onChange={(e) => setDraft({ ...draft, thaiName: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Programme</span>
            <input
              required
              maxLength={80}
              value={draft.department}
              onChange={(e) =>
                setDraft({ ...draft, department: e.target.value })
              }
            />
          </label>
          <Button className="settings-save" type="submit">
            Update preview profile
          </Button>
        </form>
      </section>
      <section className="settings-section">
        <div>
          <h2>Appearance</h2>
          <p>
            Your choice is remembered on this device. System follows your
            device’s appearance.
          </p>
        </div>
        <div
          className="appearance-options"
          role="group"
          aria-label="Appearance"
        >
          {(
            [
              ["light", "Light", Sun],
              ["dark", "Dark", Moon],
              ["system", "System", Monitor],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              disabled={!mounted}
              aria-pressed={mounted && theme === value}
              onClick={() => setTheme(value)}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </div>
      </section>
      <section className="settings-section">
        <div>
          <h2>Sharing & access</h2>
          <p>Real accounts and approval are coming.</p>
        </div>
        <div>
          <p>
            {policyAccepted
              ? "Policy acknowledged in this preview."
              : "Sharing policy not yet acknowledged in this preview."}
          </p>
          <Link className="button button-outline" href="/onboarding/policy">
            Review sharing policy
          </Link>
          <Link className="quiet-link" href="/pending-approval">
            View approval preview
          </Link>
        </div>
      </section>
      <p className="form-notice" role="status">
        {notice}
      </p>
    </main>
  );
}
