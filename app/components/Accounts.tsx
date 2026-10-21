"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Accounts({ accounts }: { accounts: { email: string | null; connected: boolean; primary: boolean }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function remove(email: string) {
    if (!confirm(`Remove ${email} from Pulse? You can add it back any time.`)) return;
    setBusy(email);
    await fetch("/api/google/remove", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="accounts">
      <div className="subhead">Google accounts</div>
      <ul className="acct-list">
        {accounts.map((a, i) => (
          <li key={a.email ?? i}>
            <span className={`src ${a.connected ? "ok" : "reconnect"}`}>
              <i />
              {a.email ?? (a.primary ? "Primary account" : "Account")}
            </span>
            <span className="muted small">{a.primary ? "Fitbit · Calendar · Gmail" : "Calendar · Gmail"}</span>
            {!a.connected && (
              <a className="small" href={a.primary ? "/api/google/start" : "/api/google/start?mode=add"}>reconnect</a>
            )}
            {!a.primary && a.email && (
              <button className="link small muted" onClick={() => remove(a.email!)} disabled={busy === a.email}>
                remove
              </button>
            )}
          </li>
        ))}
      </ul>
      <a className="pill-btn" href="/api/google/start?mode=add">+ Add another Google account</a>
    </div>
  );
}
