import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useHealthProgram } from "../hooks/useHealthProgram";
import { SPECIALIZATION_LABELS } from "../hooks/useHealthProgram";

// ─── Design tokens (same palette as patient dashboard) ────────────────────────
const G = {
  bg: "#0a0f0d", surface: "#0f1f18", card: "#111c16",
  border: "rgba(29,158,117,0.15)", borderHover: "rgba(29,158,117,0.35)",
  green: "#1D9E75", greenLight: "#5DCAA5", greenMuted: "#9FE1CB",
  text: "#e8f0eb", muted: "#8aab9a", faint: "#2d4a38",
  red: "#D4537E", amber: "#EF9F27", blue: "#378ADD",
  purple: "#9B6DFF",
};
const mono: React.CSSProperties = { fontFamily: "'DM Mono', monospace" };
const short = (pk: string) => `${pk.slice(0, 4)}…${pk.slice(-4)}`;

// ─── Sub-components

function MetricCard({ label, value, sub, color = G.greenLight }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div style={{ background: G.surface, border: `0.5px solid ${G.border}`, borderRadius: 12, padding: "20px 22px" }}>
      <div style={{ fontSize: 11, color: G.muted, letterSpacing: "0.06em", marginBottom: 10, textTransform: "uppercase", ...mono }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color, ...mono }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: G.muted, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function ReputationRing({ score }: { score: number }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 75 ? G.green : score >= 50 ? G.amber : G.red;

  return (
    <div style={{ position: "relative", width: 108, height: 108, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width="108" height="108" style={{ position: "absolute", top: 0, left: 0, transform: "rotate(-90deg)" }}>
        <circle cx="54" cy="54" r={r} fill="none" stroke={`${color}22`} strokeWidth="6" />
        <circle cx="54" cy="54" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round" style={{ transition: "stroke-dasharray 0.6s ease" }} />
      </svg>
      <div style={{ textAlign: "center", zIndex: 1 }}>
        <div style={{ ...mono, fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: 9, color: G.muted, marginTop: 2, letterSpacing: "0.05em" }}>REP</div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
      <div style={{ width: 32, height: 32, border: `2px solid ${G.faint}`, borderTop: `2px solid ${G.green}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function OutcomeBar({ positive, negative }: { positive: number; negative: number }) {
  const total = positive + negative || 1;
  const posW = (positive / total) * 100;
  const negW = (negative / total) * 100;
  return (
    <div>
      <div style={{ height: 6, borderRadius: 999, overflow: "hidden", display: "flex", gap: 2 }}>
        <div style={{ width: `${posW}%`, background: G.green, borderRadius: 999 }} />
        <div style={{ width: `${negW}%`, background: G.red, borderRadius: 999 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: G.faint, ...mono }}>
        <span style={{ color: G.green }}>✓ {positive} positive</span>
        <span style={{ color: G.red }}>✕ {negative} negative</span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DoctorDashboard() {
  const { publicKey, disconnect } = useWallet();
  const { practitionerProfile, activePots, protocolState, healthBalance, loading, error, refetch } = useHealthProgram();

  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const profile     = practitionerProfile;
  const myPots      = activePots.filter(p => p.practitioner.toBase58() === publicKey?.toBase58());
  const activeCases = myPots.filter(p => p.status === "active");
  const disputed    = myPots.filter(p => p.status === "disputed");
  const settled     = myPots.filter(p => p.status === "settled");

  const totalAtRisk = myPots.reduce((s, p) => s + p.practitionerStaked, 0);
  const winRate     = profile && (profile.positiveOutcomes + profile.negativeOutcomes) > 0
    ? Math.round((profile.positiveOutcomes / (profile.positiveOutcomes + profile.negativeOutcomes)) * 100)
    : 0;

  const specialLabel = profile?.specialization
    ? (SPECIALIZATION_LABELS as any)[profile.specialization] ?? profile.specialization
    : "—";

  return (
    <div style={{ display: "flex", height: "100vh", background: G.bg, color: G.text, fontFamily: "'Outfit', sans-serif", overflow: "hidden" }}>

      {/* ── Sidebar ── */}
      <aside style={{ width: sidebarOpen ? 220 : 64, background: G.surface, borderRight: `0.5px solid ${G.border}`, display: "flex", flexDirection: "column", transition: "width 0.25s ease", flexShrink: 0 }}>
        <div style={{ padding: "22px 18px", borderBottom: `0.5px solid ${G.border}`, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, background: G.blue, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0 }}>Rx</div>
          {sidebarOpen && <span style={{ ...mono, fontSize: 13, color: "#9FC8E1", letterSpacing: "0.04em" }}>Practitioner</span>}
        </div>

        <nav style={{ flex: 1, padding: "16px 10px" }}>
          {[
            { id: "overview",  icon: "◈", label: "Overview"   },
            { id: "cases",     icon: "⬡", label: "Cases"       },
            { id: "earnings",  icon: "◉", label: "Earnings"   },
            { id: "protocol",  icon: "✦", label: "Protocol"   },
            { id: "settings",  icon: "◧", label: "Settings"   },
          ].map(item => (
            <div key={item.id} onClick={() => setActiveTab(item.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 8, marginBottom: 4, cursor: "pointer", background: activeTab === item.id ? "rgba(55,138,221,0.12)" : "transparent", color: activeTab === item.id ? "#9FC8E1" : G.muted, transition: "all 0.2s", border: activeTab === item.id ? "0.5px solid rgba(55,138,221,0.2)" : "0.5px solid transparent" }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>{item.icon}</span>
              {sidebarOpen && <span style={{ fontSize: 13 }}>{item.label}</span>}
            </div>
          ))}
        </nav>

        <div style={{ padding: "16px 10px", borderTop: `0.5px solid ${G.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
            <div style={{ width: 28, height: 28, background: "rgba(55,138,221,0.15)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: "#9FC8E1", flexShrink: 0 }}>
              {publicKey ? publicKey.toBase58().slice(0, 2).toUpperCase() : "?"}
            </div>
            {sidebarOpen && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{publicKey ? short(publicKey.toBase58()) : "—"}</div>
                <div style={{ fontSize: 10, color: G.muted, ...mono }}>{healthBalance.toLocaleString()} $HEALTH</div>
              </div>
            )}
          </div>

          <div onClick={() => disconnect()} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 8, cursor: "pointer", color: G.red, border: "0.5px solid transparent", transition: "all 0.2s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(212,83,126,0.08)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(212,83,126,0.2)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.borderColor = "transparent"; }}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>⏻</span>
            {sidebarOpen && <span style={{ fontSize: 13 }}>Disconnect</span>}
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>

        {/* Topbar */}
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 32px", borderBottom: `0.5px solid ${G.border}`, background: G.surface, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: "none", border: "none", color: G.muted, cursor: "pointer", fontSize: 16, padding: 4 }}>☰</button>
            <div style={{ fontSize: 15, fontWeight: 500, textTransform: "capitalize" }}>{activeTab}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {disputed.length > 0 && (
              <div style={{ ...mono, fontSize: 11, color: G.red, background: "rgba(212,83,126,0.1)", padding: "4px 10px", borderRadius: 999, border: "0.5px solid rgba(212,83,126,0.25)" }}>
                ⚠ {disputed.length} dispute{disputed.length > 1 ? "s" : ""}
              </div>
            )}
            <div style={{ ...mono, fontSize: 12, color: "#9FC8E1", background: "rgba(55,138,221,0.1)", padding: "5px 12px", borderRadius: 999, border: "0.5px solid rgba(55,138,221,0.25)" }}>
              ◆ Devnet
            </div>
            <div style={{ width: 8, height: 8, background: "#9FC8E1", borderRadius: "50%" }} />
            <span style={{ fontSize: 12, color: G.muted }}>{publicKey ? short(publicKey.toBase58()) : "—"}</span>
            <button onClick={refetch} style={{ background: "none", border: `0.5px solid ${G.border}`, color: G.muted, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", ...mono }}>↻ refresh</button>
          </div>
        </header>

        {/* Content */}
        <div style={{ padding: "32px", flex: 1 }}>
          {loading && <Spinner />}
          {error && <div style={{ color: G.red, ...mono, fontSize: 13, marginBottom: 16 }}>⚠ {error}</div>}

          {/* ── OVERVIEW ── */}
          {!loading && activeTab === "overview" && (
            <>
              {/* Profile header card */}
              <div style={{ background: G.card, border: `0.5px solid ${G.border}`, borderRadius: 14, padding: "24px 28px", marginBottom: 20, display: "flex", alignItems: "center", gap: 32 }}>
                <ReputationRing score={profile?.reputationScore ?? 0} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                    <div style={{ fontSize: 18, fontWeight: 600 }}>
                      {publicKey ? short(publicKey.toBase58()) : "—"}
                    </div>
                    <div style={{ ...mono, fontSize: 11, padding: "3px 10px", borderRadius: 999, background: "rgba(55,138,221,0.1)", color: "#9FC8E1", border: "0.5px solid rgba(55,138,221,0.25)" }}>
                      {specialLabel}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: G.muted, marginBottom: 16 }}>
                    Registered {profile ? new Date(profile.registeredAt * 1000).toLocaleDateString() : "—"}
                  </div>
                  <OutcomeBar positive={profile?.positiveOutcomes ?? 0} negative={profile?.negativeOutcomes ?? 0} />
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ ...mono, fontSize: 28, fontWeight: 700, color: G.green }}>{winRate}%</div>
                  <div style={{ fontSize: 12, color: G.muted }}>win rate</div>
                </div>
              </div>

              {/* Metric grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
                <MetricCard label="$HEALTH balance"   value={healthBalance.toLocaleString()}               sub="wallet balance"           />
                <MetricCard label="Total earned"       value={profile?.totalEarned.toLocaleString() ?? "0"} sub="across all settled pots"  color={G.green}     />
                <MetricCard label="Total slashed"      value={profile?.totalSlashed.toLocaleString() ?? "0"} sub="lifetime slash amount"   color={G.red}       />
                <MetricCard label="Tokens at risk"     value={totalAtRisk.toLocaleString()}                 sub={`in ${activeCases.length} active case${activeCases.length !== 1 ? "s" : ""}`} color={G.amber} />
              </div>

              {/* Sessions + outcomes */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ background: G.card, border: `0.5px solid ${G.border}`, borderRadius: 14, padding: "22px 26px" }}>
                  <div style={{ fontSize: 11, color: G.muted, ...mono, letterSpacing: "0.06em", marginBottom: 18 }}>SESSION STATS</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
                    {[
                      { label: "Completed",  value: profile?.completedSessions ?? 0, color: G.text },
                      { label: "Active pots", value: profile?.activePots ?? 0,        color: G.blue },
                      { label: "Settled",    value: settled.length,                   color: G.green },
                    ].map((s, i) => (
                      <div key={i} style={{ textAlign: "center" }}>
                        <div style={{ ...mono, fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: 11, color: G.muted, marginTop: 4 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ background: G.card, border: `0.5px solid ${G.border}`, borderRadius: 14, padding: "22px 26px" }}>
                  <div style={{ fontSize: 11, color: G.muted, ...mono, letterSpacing: "0.06em", marginBottom: 18 }}>STAKE OVERVIEW</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
                    {[
                      { label: "Total staked ever", value: `${profile?.totalStaked.toLocaleString() ?? 0} $H`, color: G.blue },
                      { label: "Currently staked",  value: `${totalAtRisk.toLocaleString()} $H`,               color: G.amber },
                    ].map((s, i) => (
                      <div key={i}>
                        <div style={{ ...mono, fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: 11, color: G.muted, marginTop: 4 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── CASES ── */}
          {!loading && activeTab === "cases" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {myPots.length === 0 ? (
                <div style={{ background: G.card, border: `0.5px solid ${G.border}`, borderRadius: 14, padding: "48px", textAlign: "center" }}>
                  <div style={{ fontSize: 32, marginBottom: 16 }}>⬡</div>
                  <div style={{ fontSize: 15, color: G.muted }}>No patient cases yet</div>
                  <div style={{ fontSize: 13, color: G.faint, marginTop: 8 }}>Patients will open stake pots with your wallet address</div>
                </div>
              ) : myPots.map((pot, i) => {
                const delta    = pot.currentHealthScore - pot.baselineHealthScore;
                const improved = delta >= 0;
                const statusColor = {
                  active:   G.green,
                  disputed: G.red,
                  settled:  G.blue,
                  expired:  G.amber,
                }[pot.status] ?? G.muted;

                return (
                  <div key={i} style={{ background: G.card, border: `0.5px solid ${pot.status === "disputed" ? "rgba(212,83,126,0.4)" : G.border}`, borderRadius: 14, padding: "24px 28px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Patient {short(pot.patient.toBase58())}</div>
                        <div style={{ ...mono, fontSize: 11, color: G.faint }}>expires {new Date(pot.expiresAt * 1000).toLocaleDateString()}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        {pot.status === "disputed" && (
                          <div style={{ ...mono, fontSize: 11, padding: "4px 10px", borderRadius: 999, background: "rgba(212,83,126,0.1)", color: G.red, border: `0.5px solid ${G.red}40` }}>⚠ DISPUTE</div>
                        )}
                        <div style={{ ...mono, fontSize: 11, padding: "4px 12px", borderRadius: 999, background: `${statusColor}18`, color: statusColor, border: `0.5px solid ${statusColor}40`, textTransform: "uppercase" }}>{pot.status}</div>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 16, marginBottom: 16 }}>
                      <div>
                        <div style={{ fontSize: 10, color: G.muted, ...mono, marginBottom: 4 }}>POT TOTAL</div>
                        <div style={{ fontSize: 18, fontWeight: 700, ...mono }}>{pot.totalAmount}</div>
                        <div style={{ fontSize: 10, color: G.faint }}>$HEALTH</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: G.muted, ...mono, marginBottom: 4 }}>MY STAKE</div>
                        <div style={{ fontSize: 18, fontWeight: 700, ...mono, color: G.amber }}>{pot.practitionerStaked}</div>
                        <div style={{ fontSize: 10, color: G.faint }}>$HEALTH</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: G.muted, ...mono, marginBottom: 4 }}>PATIENT STAKE</div>
                        <div style={{ fontSize: 18, fontWeight: 700, ...mono }}>{pot.patientStaked}</div>
                        <div style={{ fontSize: 10, color: G.faint }}>$HEALTH</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: G.muted, ...mono, marginBottom: 4 }}>SESSIONS</div>
                        <div style={{ fontSize: 18, fontWeight: 700, ...mono }}>{pot.sessionCount}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: G.muted, ...mono, marginBottom: 4 }}>HEALTH Δ</div>
                        <div style={{ fontSize: 18, fontWeight: 700, ...mono, color: improved ? G.green : G.red }}>
                          {improved ? "+" : ""}{delta} pts
                        </div>
                      </div>
                    </div>

                    {/* Baseline → current health bar */}
                    <div style={{ position: "relative", height: 6, background: "rgba(29,158,117,0.08)", borderRadius: 999, overflow: "visible", marginBottom: 8 }}>
                      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pot.baselineHealthScore}%`, background: "rgba(29,158,117,0.2)", borderRadius: 999 }} />
                      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pot.currentHealthScore}%`, background: improved ? G.green : G.red, borderRadius: 999, transition: "width 0.5s ease" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: G.faint, ...mono }}>
                      <span>Baseline {pot.baselineHealthScore}</span>
                      <span>Current {pot.currentHealthScore}</span>
                    </div>

                    {/* Payout split bar */}
                    <div style={{ height: 4, borderRadius: 999, overflow: "hidden", display: "flex", marginTop: 14 }}>
                      <div style={{ width: `${pot.patientShareBps / 100}%`, background: G.green }} />
                      <div style={{ width: `${pot.practitionerShareBps / 100}%`, background: G.blue }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 10, color: G.faint, ...mono }}>
                      <span>Patient {(pot.patientShareBps / 100).toFixed(0)}%</span>
                      <span>You {(pot.practitionerShareBps / 100).toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── EARNINGS ── */}
          {!loading && activeTab === "earnings" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 6 }}>
                <MetricCard label="Lifetime earned"  value={`${profile?.totalEarned.toLocaleString() ?? 0} $H`}  color={G.green} />
                <MetricCard label="Lifetime slashed" value={`${profile?.totalSlashed.toLocaleString() ?? 0} $H`} color={G.red}   />
                <MetricCard label="Net P&L"           value={`${((profile?.totalEarned ?? 0) - (profile?.totalSlashed ?? 0)).toLocaleString()} $H`}
                  color={(profile?.totalEarned ?? 0) >= (profile?.totalSlashed ?? 0) ? G.green : G.red} />
              </div>

              {/* Outcome ledger per pot */}
              <div style={{ background: G.card, border: `0.5px solid ${G.border}`, borderRadius: 14, overflow: "hidden" }}>
                <div style={{ padding: "18px 24px", borderBottom: `0.5px solid ${G.border}` }}>
                  <span style={{ fontSize: 11, color: G.muted, ...mono, letterSpacing: "0.06em" }}>POT LEDGER</span>
                </div>
                {myPots.length === 0 ? (
                  <div style={{ padding: "32px 24px", textAlign: "center", color: G.faint, fontSize: 13 }}>No pots yet</div>
                ) : myPots.map((pot, i) => {
                  const delta    = pot.currentHealthScore - pot.baselineHealthScore;
                  const improved = delta >= 0;
                  const potEarning = improved
                    ? (pot.totalAmount * pot.practitionerShareBps / 10000).toFixed(0)
                    : "0";
                  const potSlash = !improved
                    ? pot.practitionerStaked.toFixed(0)
                    : "0";

                  return (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 24px", borderBottom: i < myPots.length - 1 ? `0.5px solid ${G.border}` : "none" }}>
                      <div>
                        <div style={{ fontSize: 13, color: G.text, marginBottom: 3 }}>Patient {short(pot.patient.toBase58())}</div>
                        <div style={{ fontSize: 11, color: G.faint, ...mono }}>{pot.sessionCount} sessions · {pot.status}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        {pot.status === "settled" ? (
                          <>
                            <div style={{ ...mono, fontSize: 15, fontWeight: 600, color: improved ? G.green : G.red }}>
                              {improved ? `+${potEarning}` : `-${potSlash}`} $H
                            </div>
                            <div style={{ fontSize: 10, color: G.faint }}>{improved ? "earned" : "slashed"}</div>
                          </>
                        ) : (
                          <div style={{ ...mono, fontSize: 13, color: G.amber }}>{pot.practitionerStaked} $H at stake</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── PROTOCOL ── */}
          {!loading && activeTab === "protocol" && protocolState && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
              {[
                { label: "Total patients",           value: protocolState.totalPatients.toLocaleString() },
                { label: "Total practitioners",      value: protocolState.totalPractitioners.toLocaleString() },
                { label: "Total pots opened",        value: protocolState.totalPots.toLocaleString() },
                { label: "Total $HEALTH slashed",    value: protocolState.totalSlashed.toLocaleString() },
                { label: "Total $HEALTH rewarded",   value: protocolState.totalRewarded.toLocaleString() },
                { label: "Health mint",              value: short(protocolState.healthMint.toBase58()) },
              ].map((s, i) => (
                <div key={i} style={{ background: G.card, border: `0.5px solid ${G.border}`, borderRadius: 12, padding: "20px 24px" }}>
                  <div style={{ fontSize: 11, color: G.muted, ...mono, letterSpacing: "0.06em", marginBottom: 10 }}>{s.label.toUpperCase()}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, ...mono, color: G.text }}>{s.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── SETTINGS ── */}
          {!loading && activeTab === "settings" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[
                { title: "Wallet", fields: [
                  { label: "Connected address", value: publicKey ? short(publicKey.toBase58()) : "—" },
                  { label: "Network",           value: "Devnet"                                       },
                ]},
                { title: "Practitioner profile", fields: [
                  { label: "Specialization",  value: specialLabel                                          },
                  { label: "Reputation score", value: String(profile?.reputationScore ?? 0)               },
                  { label: "Win rate",         value: `${winRate}%`                                        },
                ]},
                { title: "Token", fields: [
                  { label: "$HEALTH balance", value: `${healthBalance.toLocaleString()} $H`            },
                  { label: "Total earned",    value: `${profile?.totalEarned.toLocaleString() ?? 0} $H` },
                  { label: "Total slashed",   value: `${profile?.totalSlashed.toLocaleString() ?? 0} $H` },
                ]},
                { title: "Program", fields: [
                  { label: "Program ID",   value: short("B3hcYp5nnHH8iWXoEsF2UJpNy82fi7thTHeKJBoNq4pa") },
                  { label: "Active cases", value: String(profile?.activePots ?? 0)                       },
                ]},
              ].map((section, i) => (
                <div key={i} style={{ background: G.card, border: `0.5px solid ${G.border}`, borderRadius: 14, padding: "24px 28px" }}>
                  <div style={{ fontSize: 11, ...mono, color: G.muted, letterSpacing: "0.06em", marginBottom: 20 }}>{section.title.toUpperCase()}</div>
                  {section.fields.map((f, j) => (
                    <div key={j} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, paddingBottom: 14, borderBottom: j < section.fields.length - 1 ? `0.5px solid ${G.border}` : "none" }}>
                      <span style={{ fontSize: 13, color: G.muted }}>{f.label}</span>
                      <span style={{ fontSize: 13, ...mono, color: G.text }}>{f.value}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}