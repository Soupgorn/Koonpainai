"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  FileUp,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import type { Friend } from "@/lib/types";
import { Avatar } from "./shared";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
export function DemoNotice() {
  return (
    <div className="demo-notice">
      <ShieldCheck size={17} />
      <p>
        <strong>Admin demo</strong>
        <span>
          Changes stay in this page’s memory and reset on reload. Nothing is
          published to the public directory.
        </span>
      </p>
      <span className="demo-tag">No backend connected</span>
    </div>
  );
}
export function AdminDashboard({
  initialFriends,
}: {
  initialFriends: Friend[];
}) {
  const [friends, setFriends] = useState(initialFriends);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Friend | "new" | null>(null);
  const [deleting, setDeleting] = useState<Friend | null>(null);
  const [nickname, setNickname] = useState("");
  const [thaiName, setThaiName] = useState("");
  const [notice, setNotice] = useState("");
  const shown = friends.filter((f) =>
    `${f.nickname} ${f.thaiName}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const openEdit = (f: Friend | "new") => {
    setEditing(f);
    setNickname(f === "new" ? "" : f.nickname);
    setThaiName(f === "new" ? "" : f.thaiName);
  };
  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!nickname.trim()) return;
    if (editing === "new") {
      const added: Friend = {
        ...initialFriends[0],
        id: `demo-${Date.now()}`,
        nickname: nickname.trim(),
        thaiName: thaiName.trim(),
        initials: nickname.trim()[0].toUpperCase(),
        sessions: [],
        published: false,
      };
      setFriends((v) => [...v, added]);
    } else if (editing)
      setFriends((v) =>
        v.map((f) =>
          f.id === editing.id
            ? {
                ...f,
                nickname: nickname.trim(),
                thaiName: thaiName.trim(),
                initials: nickname.trim()[0].toUpperCase(),
              }
            : f,
        ),
      );
    setNotice("Friend saved in this demo session.");
    setEditing(null);
  }
  return (
    <main id="main" className="main-container admin-page">
      <Link className="back-link" href="/">
        <ArrowLeft size={15} />
        Public directory
      </Link>
      <div className="admin-heading">
        <div>
          <h1>A little behind the scenes.</h1>
          <p>Keep your friends’ weeks in good shape.</p>
        </div>
        <Button asChild>
          <Link href="/admin/import">
            <FileUp size={16} />
            Import timetable
          </Link>
        </Button>
      </div>
      <DemoNotice />
      <section className="admin-overview" aria-label="Schedule overview">
        <div>
          <Users size={18} />
          <strong>{friends.length}</strong>
          <span>friends managed</span>
        </div>
        <div>
          <Check size={18} />
          <strong>{friends.filter((f) => f.published).length}</strong>
          <span>sample schedules</span>
        </div>
        <div>
          <Pencil size={17} />
          <strong>{friends.filter((f) => !f.published).length}</strong>
          <span>need a timetable</span>
        </div>
      </section>
      <section>
        <div className="section-heading">
          <div>
            <h2>Friends & timetables</h2>
            <p>{initialFriends[0].semester.name}</p>
          </div>
          <Button variant="outline" onClick={() => openEdit("new")}>
            <Plus size={15} />
            Add friend
          </Button>
        </div>
        <div className="admin-toolbar search-field">
          <Search size={17} />
          <Input
            placeholder="Search friends…"
            aria-label="Search managed friends"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Friend</th>
                <th scope="col">Timetable</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((f) => (
                <tr key={f.id}>
                  <td>
                    <div className="table-friend">
                      <Avatar friend={f} />
                      <span>
                        <strong>
                          {f.nickname}
                          <span lang="th">{f.thaiName}</span>
                        </strong>
                        <small>{f.department}</small>
                        <span className="mobile-schedule-status">
                          {f.published
                            ? `Sample schedule / ${f.sessions.length} classes`
                            : "Needs a timetable"}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td>
                    <span>
                      {f.sessions.length
                        ? `${f.sessions.length} weekly classes`
                        : "Not added yet"}
                    </span>
                    <small>
                      {f.sessions.length
                        ? f.semester.name
                        : "Import a PDF to get started"}
                    </small>
                  </td>
                  <td>
                    <span
                      className={`publish-badge ${f.published ? "is-published" : ""}`}
                    >
                      <i />
                      {f.published ? "Sample published" : "No schedule"}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      {initialFriends.some(
                        (initial) => initial.id === f.id,
                      ) && (
                        <Button asChild variant="ghost" size="icon">
                          <Link
                            aria-label={`View ${f.nickname}’s timetable`}
                            href={`/friends/${f.id}`}
                          >
                            <ArrowUpRight size={16} />
                          </Link>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${f.nickname}`}
                        onClick={() => openEdit(f)}
                      >
                        <Pencil size={15} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${f.nickname}`}
                        onClick={() => setDeleting(f)}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!shown.length && (
            <div className="empty-state">
              <Search size={28} />
              <h3>No matching friends.</h3>
              <Button variant="outline" onClick={() => setQuery("")}>
                Clear search
              </Button>
            </div>
          )}
        </div>
      </section>
      <p className="admin-session-notice" role="status">
        {notice}
      </p>
      <Dialog
        open={!!editing}
        onOpenChange={(v) => {
          if (!v) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogTitle className="dialog-title">
            {editing === "new" ? "Add a friend" : "Edit friend"}
          </DialogTitle>
          <DialogDescription className="dialog-description">
            This changes the admin demo only. Reloading restores the sample
            data.
          </DialogDescription>
          <form onSubmit={save} className="edit-form">
            <label>
              Nickname
              <Input
                value={nickname}
                maxLength={40}
                onChange={(e) => setNickname(e.target.value)}
                required
                autoFocus
              />
            </label>
            <label>
              Thai nickname <span className="muted">(optional)</span>
              <Input
                value={thaiName}
                maxLength={40}
                onChange={(e) => setThaiName(e.target.value)}
              />
            </label>
            <div className="dialog-actions">
              <DialogClose asChild>
                <Button variant="outline" type="button">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit">Save demo changes</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!deleting}
        onOpenChange={(v) => {
          if (!v) setDeleting(null);
        }}
      >
        <DialogContent>
          <DialogTitle className="dialog-title">
            Remove {deleting?.nickname}?
          </DialogTitle>
          <DialogDescription className="dialog-description">
            They’ll be removed from this admin demo until you reload. Their
            public sample timetable will stay available.
          </DialogDescription>
          <div className="dialog-actions">
            <DialogClose asChild>
              <Button variant="outline">Keep friend</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                setFriends((v) => v.filter((f) => f.id !== deleting?.id));
                setNotice("Friend removed from this demo session.");
                setDeleting(null);
              }}
            >
              Remove from demo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
