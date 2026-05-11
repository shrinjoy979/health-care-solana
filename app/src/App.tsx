import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useHealthProgram, SPECIALIZATIONS, type Specialization } from "./hooks/useHealthProgram";
import LandingPage from "./components/LandingPage";
import Dashboard from "./components/Dashboard";
import PractitionerDashboard from "./components/PractitionerDashboard";
import RoleSelect from "./components/RoleSelect";
import "./App.css";

type Role = "patient" | "practitioner";

const G = {
  bg: "#0a0f0d", surface: "#0f1f18",
  border: "rgba(29,158,117,0.15)",
  green: "#1D9E75",
  text: "#e8f0eb", muted: "#8aab9a",
  red: "#D4537E", blue: "#378ADD",
};

function FullPageSpinner() {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100vh", background: G.bg,
    }}>
      <div style={{
        width: 32, height: 32,
        border: "2px solid rgba(29,158,117,0.2)",
        borderTop: "2px solid #1D9E75",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function PatientRegister({
  onBack, registerPatient, loading, error,
}: {
  onBack: () => void;
  registerPatient: (name: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function handle() {
    if (!name.trim()) return;
    setBusy(true);
    try { await registerPatient(name.trim()); }
    catch (e: any) { console.error(e); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: G.bg, fontFamily: "'Outfit', sans-serif" }}>
      <div style={{ background: G.surface, border: `0.5px solid ${G.border}`, borderRadius: 16, padding: "40px 48px", width: 420, textAlign: "center" }}>
        <div style={{ width: 48, height: 48, background: G.green, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: G.bg, margin: "0 auto 24px" }}>◈</div>
        <h2 style={{ color: G.text, fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Register as Patient</h2>
        <p style={{ color: G.muted, fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>Your name is hashed on-chain for privacy. You'll receive 500 $HEALTH tokens to start.</p>
        <input
          placeholder="Your name" value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handle()}
          style={{ width: "100%", background: G.bg, border: "0.5px solid rgba(29,158,117,0.3)", borderRadius: 8, padding: "12px 16px", color: G.text, fontFamily: "'Outfit', sans-serif", fontSize: 14, outline: "none", marginBottom: 16, boxSizing: "border-box" }}
        />
        {error && <div style={{ color: G.red, fontSize: 12, marginBottom: 12 }}>{error}</div>}
        <button
          onClick={handle} disabled={busy || loading || !name.trim()}
          style={{ width: "100%", background: (busy || loading) ? "rgba(29,158,117,0.4)" : G.green, color: G.bg, border: "none", borderRadius: 8, padding: "13px", fontFamily: "'Outfit', sans-serif", fontWeight: 500, fontSize: 14, cursor: (busy || loading) ? "wait" : "pointer", marginBottom: 14 }}
        >
          {busy ? "Registering on-chain…" : "Register & get 500 $HEALTH →"}
        </button>
        <button onClick={onBack} style={{ background: "none", border: "none", color: G.muted, fontSize: 13, cursor: "pointer", fontFamily: "'Outfit', sans-serif" }}>← Back</button>
      </div>
    </div>
  );
}

function PractitionerRegister({
  onBack, registerPractitioner, loading, error,
}: {
  onBack: () => void;
  registerPractitioner: (name: string, spec: Specialization) => Promise<void>;
  loading: boolean;
  error: string | null;
}) {
  const [name, setName] = useState("");
  const [spec, setSpec] = useState<Specialization>("PrimaryCare");
  const [busy, setBusy] = useState(false);

  async function handle() {
    if (!name.trim()) return;
    setBusy(true);
    try { await registerPractitioner(name.trim(), spec); }
    catch (e: any) { console.error(e); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: G.bg, fontFamily: "'Outfit', sans-serif" }}>
      <div style={{ background: G.surface, border: "0.5px solid rgba(55,138,221,0.25)", borderRadius: 16, padding: "40px 48px", width: 420, textAlign: "center" }}>
        <div style={{ width: 48, height: 48, background: G.blue, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: "#fff", margin: "0 auto 24px" }}>⬡</div>
        <h2 style={{ color: G.text, fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Register as Practitioner</h2>
        <p style={{ color: G.muted, fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>Your name is hashed on-chain. You'll receive 500 $HEALTH tokens and build your on-chain reputation.</p>
        <input
          placeholder="Your name" value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handle()}
          style={{ width: "100%", background: G.bg, border: "0.5px solid rgba(55,138,221,0.3)", borderRadius: 8, padding: "12px 16px", color: G.text, fontFamily: "'Outfit', sans-serif", fontSize: 14, outline: "none", marginBottom: 12, boxSizing: "border-box" }}
        />
        <select
          value={spec} onChange={e => setSpec(e.target.value as Specialization)}
          style={{ width: "100%", background: G.bg, border: "0.5px solid rgba(55,138,221,0.3)", borderRadius: 8, padding: "12px 16px", color: G.text, fontFamily: "'Outfit', sans-serif", fontSize: 14, outline: "none", marginBottom: 16, boxSizing: "border-box", cursor: "pointer" }}
        >
          {SPECIALIZATIONS.map(s => (
            <option key={s} value={s}>{s.replace(/([A-Z])/g, " $1").trim()}</option>
          ))}
        </select>
        {error && <div style={{ color: G.red, fontSize: 12, marginBottom: 12 }}>{error}</div>}
        <button
          onClick={handle} disabled={busy || loading || !name.trim()}
          style={{ width: "100%", background: (busy || loading) ? "rgba(55,138,221,0.4)" : G.blue, color: "#fff", border: "none", borderRadius: 8, padding: "13px", fontFamily: "'Outfit', sans-serif", fontWeight: 500, fontSize: 14, cursor: (busy || loading) ? "wait" : "pointer", marginBottom: 14 }}
        >
          {busy ? "Registering on-chain…" : "Register & get 500 $HEALTH →"}
        </button>
        <button onClick={onBack} style={{ background: "none", border: "none", color: G.muted, fontSize: 13, cursor: "pointer", fontFamily: "'Outfit', sans-serif" }}>← Back</button>
      </div>
    </div>
  );
}

// ── Root ────────────────────────────────────────────────────────────────────
export default function App() {
  const { connected } = useWallet();
  const { userRole, registerPatient, registerPractitioner, loading, error } = useHealthProgram();

  // Which role the unregistered user picked in RoleSelect
  const [pendingRole, setPendingRole] = useState<Role | null>(null);

  // 1. Not connected → landing page
  if (!connected) return <LandingPage />;

  // 2. Profiles still fetching (userRole === null) → spinner
  if (userRole === null) return <FullPageSpinner />;

  // 3. Already registered → correct dashboard immediately
  if (userRole === "patient")      return <Dashboard />;
  if (userRole === "practitioner") return <PractitionerDashboard />;
  if (userRole === "both")         return <Dashboard />; // default; add role-switcher later

  // 4. Not registered → two-step flow: pick role → fill form
  if (!pendingRole) {
    return <RoleSelect onSelect={(role: Role) => setPendingRole(role)} />;
  }

  if (pendingRole === "patient") {
    return (
      <PatientRegister
        onBack={() => setPendingRole(null)}
        registerPatient={registerPatient}
        loading={loading}
        error={error}
      />
    );
  }

  return (
    <PractitionerRegister
      onBack={() => setPendingRole(null)}
      registerPractitioner={registerPractitioner}
      loading={loading}
      error={error}
    />
  );
}