import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import Layout from "./components/Layout";
import Landing from "./routes/Landing";
import Login from "./routes/Login";
import Register from "./routes/Register";
import Verify from "./routes/Verify";
import WorkerDashboard from "./routes/worker/Dashboard";
import LogShift from "./routes/worker/LogShift";
import MyShifts from "./routes/worker/Shifts";
import WorkerGrievance from "./routes/worker/Grievance";
import Certificate from "./routes/worker/Certificate";
import VerifierQueue from "./routes/verifier/Queue";
import AdvocateOverview from "./routes/advocate/Overview";
import AdvocateGrievances from "./routes/advocate/Grievances";
import AdvocateWorkers from "./routes/advocate/Workers";
import WorkerDetail from "./routes/advocate/WorkerDetail";

function Protected({ roles, children }: { roles?: string[]; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-10 text-center text-slate-400">loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function HomeRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-10 text-center text-slate-400">loading…</div>;
  if (!user) return <Landing />;
  if (user.role === "worker")   return <Navigate to="/dashboard" replace />;
  if (user.role === "verifier") return <Navigate to="/verifier" replace />;
  return <Navigate to="/advocate" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify" element={<Verify />} />
        <Route element={<Protected><Layout /></Protected>}>
          <Route path="/dashboard" element={<Protected roles={["worker"]}><WorkerDashboard /></Protected>} />
          <Route path="/log"       element={<Protected roles={["worker"]}><LogShift /></Protected>} />
          <Route path="/shifts"    element={<Protected roles={["worker"]}><MyShifts /></Protected>} />
          <Route path="/grievance" element={<Protected roles={["worker"]}><WorkerGrievance /></Protected>} />
          <Route path="/certificate" element={<Protected roles={["worker"]}><Certificate /></Protected>} />

          <Route path="/verifier"  element={<Protected roles={["verifier"]}><VerifierQueue /></Protected>} />

          <Route path="/advocate"             element={<Protected roles={["advocate"]}><AdvocateOverview /></Protected>} />
          <Route path="/advocate/grievances"  element={<Protected roles={["advocate"]}><AdvocateGrievances /></Protected>} />
          <Route path="/advocate/workers"     element={<Protected roles={["advocate"]}><AdvocateWorkers /></Protected>} />
          <Route path="/advocate/workers/:id" element={<Protected roles={["advocate"]}><WorkerDetail /></Protected>} />
        </Route>
        <Route path="*" element={<div className="p-10 text-center text-slate-400">404</div>} />
      </Routes>
    </AuthProvider>
  );
}
