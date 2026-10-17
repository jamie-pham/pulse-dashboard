import { redirect } from "next/navigation";
import { cfg } from "@/lib/config";
import { authMode, isAuthed } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  if (authMode() === "open" || (await isAuthed())) redirect("/");
  const { e } = await searchParams;
  return (
    <main className="wrap narrow login">
      <div className="login-mark">◉</div>
      <h1>{cfg.appName}</h1>
      <form action="/api/login" method="post" className="card">
        <label htmlFor="pw" className="muted small">Password</label>
        <input id="pw" name="password" type="password" autoComplete="current-password" autoFocus required />
        {e && <p className="err small">That&apos;s not it.</p>}
        <button type="submit" className="btn">Unlock</button>
      </form>
    </main>
  );
}
