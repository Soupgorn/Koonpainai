"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { DemoNotice } from "./admin-dashboard";
type Access = "Pending" | "Approved" | "Suspended";
const initial: { id: string; name: string; thai: string; status: Access }[] = [
  { id: "1", name: "June", thai: "จูน", status: "Pending" },
  { id: "2", name: "Mild", thai: "มายด์", status: "Approved" },
  { id: "3", name: "Bean", thai: "บีน", status: "Approved" },
];
export function AccessManagement() {
  const [people, setPeople] = useState(initial);
  const [notice, setNotice] = useState("");
  return (
    <main id="main" className="main-container">
      <Link className="back-link" href="/">
        <ArrowLeft size={16} />
        Friends
      </Link>
      <div className="page-heading">
        <div>
          <h1>Access management</h1>
          <p>Review access to shared timetables.</p>
        </div>
      </div>
      <DemoNotice />
      <nav className="admin-subnav" aria-label="Administration">
        <Link href="/admin">Timetables</Link>
        <Link href="/admin/access" aria-current="page">
          Access management
        </Link>
      </nav>
      <p className="access-warning">
        <Info size={17} />
        <span>
          Sample accounts. Status changes here grant no real access.
        </span>
      </p>
      <section aria-label="Account access" className="access-list">
        {people.map((person, index) => (
          <div key={person.id} className="access-row">
            <span className={`avatar avatar-${index}`}>{person.name[0]}</span>
            <div>
              <strong>
                {person.name} <span lang="th">{person.thai}</span>
              </strong>
              <p>{person.status} · Preview account</p>
            </div>
            <label>
              <span className="sr-only">Access status for {person.name}</span>
              <select
                value={person.status}
                onChange={(e) => {
                  const status = e.target.value as Access;
                  setPeople(
                    people.map((p) =>
                      p.id === person.id ? { ...p, status } : p,
                    ),
                  );
                  setNotice(
                    `${person.name}: ${status.toLowerCase()} in this preview only. No real access changed.`,
                  );
                }}
              >
                {["Pending", "Approved", "Suspended"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          </div>
        ))}
      </section>
      <p role="status" className="form-notice">
        {notice}
      </p>
    </main>
  );
}
