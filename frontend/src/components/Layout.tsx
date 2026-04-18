import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium transition ${
    isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
  }`;

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  const links =
    user?.role === "worker"   ? [
        { to: "/dashboard",   label: "Dashboard"    },
        { to: "/log",         label: "Log shift"    },
        { to: "/shifts",      label: "My shifts"    },
        { to: "/grievance",   label: "Grievance"    },
        { to: "/certificate", label: "Certificate"  },
      ] :
    user?.role === "verifier" ? [
        { to: "/verifier",    label: "Verify queue" },
      ] :
    user?.role === "advocate" ? [
        { to: "/advocate",             label: "Overview"  },
        { to: "/advocate/grievances",  label: "Grievances" },
        { to: "/advocate/workers",     label: "Workers"    },
      ] : [];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 bg-white/85 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-brand-500 flex items-center justify-center text-white font-bold">F</div>
            <div className="font-bold text-lg tracking-tight">Fair<span className="text-brand-500">Gig</span></div>
          </div>
          <nav className="flex items-center gap-1">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className={linkCls}>{l.label}</NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right leading-tight">
              <div className="text-sm font-medium">{user?.name}</div>
              <div className="text-xs text-slate-500 capitalize">{user?.role}{user?.city ? ` · ${user.city}` : ""}</div>
            </div>
            <button
              className="btn-ghost"
              onClick={() => { logout(); nav("/login"); }}
            >Sign out</button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto w-full p-6 flex-1">
        <Outlet />
      </main>
      <footer className="text-center text-xs text-slate-400 py-4">
        FairGig · SOFTEC 2026 submission · services: auth · earnings · anomaly · grievance · analytics · certificate
      </footer>
    </div>
  );
}
