import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { Banner, Field } from "../components/UI";

const demo = [
  { email: "rider.ahmed@fairgig.pk",      label: "Worker (rider, Lahore)" },
  { email: "designer.sana@fairgig.pk",    label: "Worker (designer, Karachi)" },
  { email: "verifier@fairgig.pk",         label: "Verifier" },
  { email: "advocate@fairgig.pk",         label: "Advocate / analyst" },
];

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("rider.ahmed@fairgig.pk");
  const [password, setPassword] = useState("password123");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await login(email, password);
      nav("/");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-stretch">
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-brand-600 via-brand-500 to-emerald-600 text-white p-12 flex-col justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-white/20 flex items-center justify-center font-bold">F</div>
          <div className="font-bold text-xl">FairGig</div>
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight">Earnings you can prove.<br/>Platforms you can hold to account.</h1>
          <p className="mt-4 text-white/80 max-w-md">A unified record of gig work for riders, drivers, designers, and domestic workers in Pakistan — with real verification, transparency on deductions, and a collective voice.</p>
        </div>
        <div className="text-xs text-white/70 flex items-center gap-3">
          <span>SOFTEC 2026 Web Dev Competition submission</span>
          <span className="text-white/40">·</span>
          <Link to="/verify" className="underline hover:text-white">Verify a certificate</Link>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500">sign in</div>
            <h2 className="text-2xl font-bold mt-1">Welcome back</h2>
            <p className="text-sm text-slate-500 mt-1">Use one of the demo accounts below or <Link to="/register" className="text-brand-600 hover:underline">create a new one</Link>.</p>
          </div>
          {err && <Banner tone="bad">{err}</Banner>}
          <Field label="Email">
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Password">
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <button className="btn-primary w-full justify-center" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>

          <div className="pt-3 border-t border-slate-200">
            <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">demo accounts (password <code>password123</code>)</div>
            <div className="space-y-1">
              {demo.map((d) => (
                <button
                  type="button"
                  key={d.email}
                  className="w-full text-left text-sm px-3 py-2 rounded-md hover:bg-slate-100 border border-slate-100"
                  onClick={() => { setEmail(d.email); setPassword("password123"); }}
                >
                  <div className="font-medium">{d.label}</div>
                  <div className="text-xs text-slate-500">{d.email}</div>
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
