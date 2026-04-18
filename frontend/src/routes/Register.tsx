import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { Banner, Field } from "../components/UI";

const CITIES = ["Lahore", "Karachi", "Islamabad", "Faisalabad", "Rawalpindi", "Multan"];
const CATEGORIES = ["rider", "driver", "designer", "domestic", "delivery", "other"];

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({
    email: "", password: "", name: "", role: "worker",
    city: "Lahore", category: "rider",
  });
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null); setLoading(true);
    try {
      await register(form);
      nav("/");
    } catch (e: any) {
      setErr(e.message);
    } finally { setLoading(false); }
  };

  const update = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-100">
      <form onSubmit={submit} className="w-full max-w-md card p-8 space-y-4">
        <div>
          <h2 className="text-2xl font-bold">Create an account</h2>
          <p className="text-sm text-slate-500 mt-1">Or <Link to="/login" className="text-brand-600 hover:underline">sign in</Link> with an existing account.</p>
        </div>
        {err && <Banner tone="bad">{err}</Banner>}
        <Field label="Name">
          <input className="input" value={form.name} onChange={update("name")} required />
        </Field>
        <Field label="Email">
          <input type="email" className="input" value={form.email} onChange={update("email")} required />
        </Field>
        <Field label="Password">
          <input type="password" className="input" value={form.password} onChange={update("password")} required />
        </Field>
        <Field label="I am a">
          <select className="input" value={form.role} onChange={update("role")}>
            <option value="worker">Gig worker</option>
            <option value="verifier">Verifier</option>
            <option value="advocate">Advocate / analyst</option>
          </select>
        </Field>
        {form.role === "worker" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="City">
              <select className="input" value={form.city} onChange={update("city")}>
                {CITIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Category">
              <select className="input" value={form.category} onChange={update("category")}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
          </div>
        )}
        <button className="btn-primary w-full justify-center" disabled={loading}>
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>
    </div>
  );
}
