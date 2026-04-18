import { Link } from "react-router-dom";

const PERSONAS = [
  {
    tag: "For gig workers",
    tone: "from-emerald-500 to-teal-600",
    title: "Log every shift. Prove every rupee.",
    points: [
      "One earnings record across Careem, Bykea, Foodpanda, Upwork & more",
      "Weekly trend, effective hourly rate, commission tracker",
      "Compare yourself to the anonymised city-wide median",
      "Generate a printable, bank-ready income certificate in one click",
    ],
  },
  {
    tag: "For verifiers",
    tone: "from-indigo-500 to-blue-600",
    title: "Review screenshots. Protect the record.",
    points: [
      "Queue of shifts awaiting human verification",
      "Side-by-side: worker's numbers vs. the uploaded platform screenshot",
      "Verify, flag discrepancies, or mark unverifiable — with notes",
    ],
  },
  {
    tag: "For advocates",
    tone: "from-fuchsia-500 to-purple-600",
    title: "See what no single worker can see.",
    points: [
      "Commission-rate trends per platform, week over week",
      "Vulnerability flag: workers whose income dropped >20% month over month",
      "Cluster similar grievances, escalate systemic issues",
      "Privacy-preserving aggregates (k-anonymity floor)",
    ],
  },
];

const HOW = [
  { n: "1", title: "Log", body: "Workers log shifts (or bulk-import a CSV) and optionally attach a platform screenshot." },
  { n: "2", title: "Verify", body: "Verifiers review the screenshot against the numbers and stamp each shift verified, flagged, or unverifiable." },
  { n: "3", title: "Understand", body: "Workers see trends and anomalies. Advocates see systemic patterns. Landlords & banks get a portable certificate." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* ---------------- header ---------------- */}
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-emerald-600 flex items-center justify-center text-white font-bold shadow-sm">F</div>
            <div className="font-bold text-lg tracking-tight">Fair<span className="text-brand-500">Gig</span></div>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-600">
            <a href="#who" className="hover:text-slate-900">Who it's for</a>
            <a href="#how" className="hover:text-slate-900">How it works</a>
            <a href="#stack" className="hover:text-slate-900">Stack</a>
            <Link to="/verify" className="hover:text-slate-900">Verify a certificate</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/login" className="btn-ghost text-sm hidden sm:inline-flex">Sign in</Link>
            <Link to="/register" className="btn-primary text-sm">Get started</Link>
          </div>
        </div>
      </header>

      {/* ---------------- hero ---------------- */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-50 via-white to-emerald-50" />
        <div className="absolute top-40 -left-20 -z-10 w-[480px] h-[480px] bg-brand-200/40 rounded-full blur-3xl" />
        <div className="absolute top-60 right-0 -z-10 w-[420px] h-[420px] bg-purple-200/40 rounded-full blur-3xl" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-16 sm:pb-28">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse"></span>
              SOFTEC 2026 · Web Dev Competition
            </div>
            <h1 className="mt-6 text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.05]">
              Earnings you can prove.<br/>
              <span className="bg-gradient-to-r from-brand-500 to-emerald-600 bg-clip-text text-transparent">Platforms you can hold to account.</span>
            </h1>
            <p className="mt-6 text-lg text-slate-600 max-w-2xl">
              A unified record of gig work for riders, drivers, designers, and
              domestic workers in Pakistan — with real verification, transparency on
              deductions, and a collective voice that surfaces patterns no single
              worker could ever see alone.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/login" className="btn-primary px-5 py-3 text-base">Try the demo</Link>
              <Link to="/register" className="btn-secondary px-5 py-3 text-base">Create an account</Link>
              <Link to="/verify" className="btn-ghost px-5 py-3 text-base">Verify a certificate →</Link>
            </div>
            <div className="mt-5 text-xs text-slate-500">
              Demo accounts ready (password <code>password123</code>):{" "}
              <code>rider.ahmed@fairgig.pk</code>, <code>verifier@fairgig.pk</code>, <code>advocate@fairgig.pk</code>
            </div>
          </div>

          {/* stats strip */}
          <div className="mt-12 sm:mt-16 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { k: "4,000+", v: "shifts logged" },
              { k: "52",     v: "workers across 4 cities" },
              { k: "18",     v: "vulnerable-income flags" },
              { k: "3",      v: "privacy-safe cohort floor" },
            ].map((s) => (
              <div key={s.v} className="rounded-xl border border-slate-200 bg-white/70 backdrop-blur p-4 sm:p-5 shadow-sm">
                <div className="text-2xl sm:text-3xl font-bold">{s.k}</div>
                <div className="text-xs sm:text-sm text-slate-500 mt-1">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- personas ---------------- */}
      <section id="who" className="py-16 sm:py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl">
            <div className="text-xs uppercase tracking-widest text-brand-600 font-semibold">Built for three personas</div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mt-2">Workers log. Verifiers confirm. Advocates act.</h2>
            <p className="mt-3 text-slate-600">Each persona gets their own interface and only sees the data they're meant to see — but the shared record underneath is what makes the whole system honest.</p>
          </div>
          <div className="mt-10 grid md:grid-cols-3 gap-5">
            {PERSONAS.map((p) => (
              <div key={p.tag} className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm flex flex-col">
                <div className={`inline-flex self-start items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white bg-gradient-to-r ${p.tone}`}>
                  {p.tag}
                </div>
                <h3 className="mt-4 text-xl font-bold tracking-tight">{p.title}</h3>
                <ul className="mt-4 space-y-2 text-sm text-slate-600">
                  {p.points.map((pt) => (
                    <li key={pt} className="flex items-start gap-2">
                      <span className="mt-1 w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0" />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- how it works ---------------- */}
      <section id="how" className="py-16 sm:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-xs uppercase tracking-widest text-brand-600 font-semibold">How it works</div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mt-2 max-w-xl">Three steps from messy reality to a verifiable record.</h2>
          <div className="mt-10 grid md:grid-cols-3 gap-6">
            {HOW.map((s) => (
              <div key={s.n} className="relative rounded-xl border border-slate-200 p-6 bg-gradient-to-br from-white to-slate-50">
                <div className="absolute -top-4 left-6 w-10 h-10 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center shadow-lg">{s.n}</div>
                <h3 className="text-xl font-bold mt-4">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- verify CTA ---------------- */}
      <section className="py-12 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white p-8 sm:p-10 shadow-xl flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="flex-1">
              <div className="text-xs uppercase tracking-widest text-emerald-400 font-semibold">For landlords &amp; banks</div>
              <h3 className="mt-2 text-2xl sm:text-3xl font-bold">Verify a FairGig certificate in seconds.</h3>
              <p className="mt-2 text-slate-300 text-sm">Every certificate embeds a tamper-evident HMAC stamp. Paste it on the verify page and confirm the totals are real.</p>
            </div>
            <Link to="/verify" className="btn-primary px-5 py-3 text-base whitespace-nowrap">Open /verify →</Link>
          </div>
        </div>
      </section>

      {/* ---------------- stack ---------------- */}
      <section id="stack" className="py-16 sm:py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-xs uppercase tracking-widest text-brand-600 font-semibold">Under the hood</div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mt-2 max-w-2xl">Six services, clean REST boundaries, judge-ready.</h2>
          <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { name: "auth",        stack: "FastAPI",          desc: "JWT login, roles, refresh" },
              { name: "earnings",    stack: "FastAPI",          desc: "Shift CRUD · CSV import · screenshots" },
              { name: "anomaly",     stack: "FastAPI (stateless)", desc: "Commission spikes + income drops + hourly outliers" },
              { name: "grievance",   stack: "Node.js + Express", desc: "Complaint CRUD · clustering · escalation" },
              { name: "analytics",   stack: "FastAPI",          desc: "Aggregates with k-anonymity floor" },
              { name: "certificate", stack: "Node.js",          desc: "Printable HTML · HMAC-stamped" },
            ].map((s) => (
              <div key={s.name} className="rounded-xl bg-white border border-slate-200 p-5">
                <div className="flex items-center justify-between">
                  <div className="font-bold">{s.name}</div>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{s.stack}</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-sm text-slate-500">
            Full REST contract in{" "}
            <a href="https://github.com/uzairkbrr/FairGig/blob/main/docs/API.md" className="text-brand-600 hover:underline" target="_blank" rel="noreferrer">
              docs/API.md
            </a>
            . The <code>/detect</code> endpoint on the anomaly service is stateless and requires no auth — judges can call it directly with a crafted payload.
          </div>
        </div>
      </section>

      {/* ---------------- final CTA ---------------- */}
      <section className="py-16 sm:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight">Ready to see it in action?</h2>
          <p className="mt-4 text-slate-600 max-w-xl mx-auto">Log in as a worker to see the dashboard. Log in as an advocate to see the systemic panel. Then <Link to="/verify" className="text-brand-600 hover:underline">verify a certificate</Link>.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/login" className="btn-primary px-6 py-3 text-base">Try the demo</Link>
            <Link to="/register" className="btn-secondary px-6 py-3 text-base">Create an account</Link>
          </div>
        </div>
      </section>

      {/* ---------------- footer ---------------- */}
      <footer className="border-t border-slate-200 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>FairGig · SOFTEC 2026 submission ·{" "}
            <a href="https://github.com/uzairkbrr/FairGig" target="_blank" rel="noreferrer" className="hover:text-slate-800">GitHub →</a>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/verify" className="hover:text-slate-800">Verify a certificate</Link>
            <Link to="/login" className="hover:text-slate-800">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
