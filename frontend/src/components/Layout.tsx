import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium transition ${
    isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
  }`;

const mobileLinkCls = ({ isActive }: { isActive: boolean }) =>
  `block px-4 py-3 rounded-lg text-base font-medium transition ${
    isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
  }`;

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);

  // Close mobile drawer whenever the route changes
  useEffect(() => { setOpen(false); }, [loc.pathname]);

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
      <header className="sticky top-0 z-20 bg-white/85 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3 sm:gap-6">
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 rounded-md bg-brand-500 flex items-center justify-center text-white font-bold">F</div>
            <div className="font-bold text-lg tracking-tight">Fair<span className="text-brand-500">Gig</span></div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className={linkCls}>{l.label}</NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {/* Desktop user info */}
            <div className="hidden lg:block text-right leading-tight">
              <div className="text-sm font-medium">{user?.name}</div>
              <div className="text-xs text-slate-500 capitalize">{user?.role}{user?.city ? ` · ${user.city}` : ""}</div>
            </div>
            <button
              className="btn-ghost hidden lg:inline-flex"
              onClick={() => { logout(); nav("/login"); }}
            >Sign out</button>

            {/* Mobile hamburger */}
            <button
              type="button"
              className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-md text-slate-700 hover:bg-slate-100"
              aria-label="Toggle menu"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {open && (
          <div className="lg:hidden border-t border-slate-200 bg-white">
            <div className="max-w-7xl mx-auto px-4 py-3">
              <div className="pb-3 mb-3 border-b border-slate-100">
                <div className="text-sm font-semibold">{user?.name}</div>
                <div className="text-xs text-slate-500 capitalize">{user?.role}{user?.city ? ` · ${user.city}` : ""}</div>
              </div>
              <nav className="space-y-1">
                {links.map((l) => (
                  <NavLink key={l.to} to={l.to} className={mobileLinkCls}>{l.label}</NavLink>
                ))}
              </nav>
              <button
                className="mt-3 w-full btn-secondary justify-center"
                onClick={() => { logout(); nav("/login"); }}
              >Sign out</button>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-5 sm:py-6 flex-1">
        <Outlet />
      </main>
      <footer className="text-center text-[11px] sm:text-xs text-slate-400 py-4 px-4">
        FairGig · SOFTEC 2026 submission · <span className="hidden sm:inline">services: auth · earnings · anomaly · grievance · analytics · certificate</span>
      </footer>
    </div>
  );
}
