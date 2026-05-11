import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useHealthProgram } from "../hooks/useHealthProgram";

const G = {
  bg: "#0a0f0d", surface: "#0f1f18", card: "#111c16",
  border: "rgba(29,158,117,0.15)", borderHover: "rgba(29,158,117,0.35)",
  green: "#1D9E75", greenLight: "#5DCAA5", greenMuted: "#9FE1CB",
  text: "#e8f0eb", muted: "#8aab9a", faint: "#2d4a38",
  red: "#D4537E", amber: "#EF9F27", blue: "#378ADD",
};

const mono: React.CSSProperties = { fontFamily: "'DM Mono', monospace" };
const short = (pk: string) => `${pk.slice(0, 4)}…${pk.slice(-4)}`;

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

function HealthBar({ value, color = G.green }: { value: number; color?: string }) {
  return (
    <div style={{ height: 5, background: "rgba(29,158,117,0.1)", borderRadius: 999, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${value}%`, background: color, borderRadius: 999 }} />
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

export default function PatientDashboard() {
  const { publicKey, disconnect } = useWallet();
  const { patientProfile, activePots, protocolState, healthBalance, loading, error, refetch } = useHealthProgram();
  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const healthScore = patientProfile?.healthScore ?? 0;
  const totalStaked = activePots.reduce((s, p) => s + p.totalAmount, 0);
  const slashEvents = activePots.filter(p => p.currentHealthScore < p.baselineHealthScore).length;

  const scoreChange = patientProfile
    ? patientProfile.healthScore - patientProfile.baselineScore
    : 0;

  return (
    <div style={{ display: "flex", height: "100vh", background: G.bg, color: G.text, fontFamily: "'Outfit', sans-serif", overflow: "hidden" }}>

      {/* Sidebar */}
      <aside style={{ width: sidebarOpen ? 220 : 64, background: G.surface, borderRight: `0.5px solid ${G.border}`, display: "flex", flexDirection: "column", transition: "width 0.25s ease", flexShrink: 0 }}>
        <div style={{ padding: "22px 18px", borderBottom: `0.5px solid ${G.border}`, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, background: G.green, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: G.bg, flexShrink: 0 }}>H</div>
          {sidebarOpen && <span style={{ ...mono, fontSize: 13, color: G.greenMuted, letterSpacing: "0.04em" }}>$HEALTH</span>}
        </div>

        <nav style={{ flex: 1, padding: "16px 10px" }}>
          {[
            { id: "overview", icon: "◈", label: "Overview" },
            { id: "pots", icon: "⬡", label: "Stake Pots" },
            { id: "protocol", icon: "◉", label: "Protocol" },
            { id: "settings", icon: "✦", label: "Settings" },
          ].map(item => (
            <div key={item.id} onClick={() => setActiveTab(item.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 8, marginBottom: 4, cursor: "pointer", background: activeTab === item.id ? "rgba(29,158,117,0.12)" : "transparent", color: activeTab === item.id ? G.greenLight : G.muted, transition: "all 0.2s", border: activeTab === item.id ? `0.5px solid ${G.border}` : "0.5px solid transparent" }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>{item.icon}</span>
              {sidebarOpen && <span style={{ fontSize: 13 }}>{item.label}</span>}
            </div>
          ))}
        </nav>

        <div style={{ padding: "16px 10px", borderTop: `0.5px solid ${G.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
            <div style={{
              width: 28, height: 28,
              background: "rgba(29,158,117,0.15)",
              borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 600, color: G.greenLight, flexShrink: 0
            }}>
              {publicKey ? publicKey.toBase58().slice(0, 2).toUpperCase() : "?"}
            </div>
            {sidebarOpen && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500 }}>
                  {publicKey ? short(publicKey.toBase58()) : "—"}
                </div>
                <div style={{ fontSize: 10, color: G.muted, ...mono }}>
                  {healthBalance.toLocaleString()} $HEALTH
                </div>
              </div>
            )}
          </div>

          <div
            onClick={() => disconnect()}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 12px", borderRadius: 8,
              cursor: "pointer",
              color: G.red,
              border: `0.5px solid transparent`,
              transition: "all 0.2s",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(212,83,126,0.08)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(212,83,126,0.2)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.borderColor = "transparent";
            }}
          >
            <span style={{ fontSize: 14, flexShrink: 0 }}>⏻</span>
            {sidebarOpen && <span style={{ fontSize: 13 }}>Disconnect</span>}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>

        {/* Topbar */}
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 32px", borderBottom: `0.5px solid ${G.border}`, background: G.surface, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: "none", border: "none", color: G.muted, cursor: "pointer", fontSize: 16, padding: 4 }}>☰</button>
            <div style={{ fontSize: 15, fontWeight: 500, textTransform: "capitalize" }}>{activeTab}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ ...mono, fontSize: 12, color: G.greenLight, background: "rgba(29,158,117,0.1)", padding: "5px 12px", borderRadius: 999, border: `0.5px solid rgba(29,158,117,0.25)` }}>
              ◆ Devnet
            </div>
            <div style={{ width: 8, height: 8, background: G.greenLight, borderRadius: "50%" }} />
            <span style={{ fontSize: 12, color: G.muted }}>{publicKey ? short(publicKey.toBase58()) : "—"}</span>
            <button onClick={refetch} style={{ background: "none", border: `0.5px solid ${G.border}`, color: G.muted, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", ...mono }}>↻ refresh</button>
          </div>
        </header>

        {/* Content */}
        <div style={{ padding: "32px", flex: 1 }}>
          {loading && <Spinner />}
          {error && <div style={{ color: G.red, ...mono, fontSize: 13, marginBottom: 16 }}>⚠ {error}</div>}

          {!loading && activeTab === "overview" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 28 }}>
                <MetricCard
                  label="$HEALTH balance"
                  value={healthBalance.toLocaleString()}
                  sub="your wallet balance"
                />
                <MetricCard
                  label="Health score"
                  value={String(healthScore)}
                  sub={`${scoreChange >= 0 ? "+" : ""}${scoreChange} pts from baseline`}
                  color={G.greenLight}
                />
                <MetricCard
                  label="Total staked"
                  value={totalStaked.toLocaleString()}
                  sub={`across ${activePots.length} pot${activePots.length !== 1 ? "s" : ""}`}
                  color={G.blue}
                />
                <MetricCard
                  label="Slash events"
                  value={String(slashEvents)}
                  sub="pots with declined health"
                  color={slashEvents > 0 ? G.red : G.muted}
                />
              </div>

              {/* Health score bar */}
              <div style={{ background: G.card, border: `0.5px solid ${G.border}`, borderRadius: 14, padding: "24px 28px", marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 13, color: G.muted, ...mono, letterSpacing: "0.06em", marginBottom: 4 }}>HEALTH SCORE</div>
                    <div style={{ fontSize: 28, fontWeight: 700, ...mono, color: G.greenLight }}>
                      {healthScore} <span style={{ fontSize: 14, color: healthScore >= patientProfile?.baselineScore! ? G.green : G.red }}>
                        {scoreChange >= 0 ? "↑" : "↓"} {Math.abs(scoreChange)} pts
                      </span>
                    </div>
                  </div>
                  <div style={{ ...mono, fontSize: 11, color: G.faint }}>baseline: {patientProfile?.baselineScore ?? "—"}</div>
                </div>
                <HealthBar value={healthScore} color={healthScore >= 70 ? G.green : healthScore >= 50 ? G.amber : G.red} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: G.faint, ...mono }}>
                  <span>0</span><span>50</span><span>100</span>
                </div>
              </div>

              {/* Sessions counter */}
              {patientProfile && (
                <div style={{ background: G.card, border: `0.5px solid ${G.border}`, borderRadius: 14, padding: "20px 28px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24 }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ ...mono, fontSize: 32, fontWeight: 700, color: G.text }}>{patientProfile.sessionCount}</div>
                      <div style={{ fontSize: 12, color: G.muted, marginTop: 4 }}>total sessions</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ ...mono, fontSize: 32, fontWeight: 700, color: G.green }}>{patientProfile.totalEarned.toLocaleString()}</div>
                      <div style={{ fontSize: 12, color: G.muted, marginTop: 4 }}>$HEALTH earned</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ ...mono, fontSize: 32, fontWeight: 700, color: G.blue }}>{patientProfile.activePots}</div>
                      <div style={{ fontSize: 12, color: G.muted, marginTop: 4 }}>active pots</div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {!loading && activeTab === "pots" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {activePots.length === 0 ? (
                <div style={{ background: G.card, border: `0.5px solid ${G.border}`, borderRadius: 14, padding: "48px", textAlign: "center" }}>
                  <div style={{ fontSize: 32, marginBottom: 16 }}>⬡</div>
                  <div style={{ fontSize: 15, color: G.muted }}>No stake pots yet</div>
                  <div style={{ fontSize: 13, color: G.faint, marginTop: 8 }}>Open a pot with a practitioner to begin treatment</div>
                </div>
              ) : activePots.map((pot, i) => {
                const improved = pot.currentHealthScore >= pot.baselineHealthScore;
                return (
                  <div key={i} style={{ background: G.card, border: `0.5px solid ${G.border}`, borderRadius: 14, padding: "24px 28px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Pot with {short(pot.practitioner.toBase58())}</div>
                        <div style={{ ...mono, fontSize: 11, color: G.faint }}>expires {new Date(pot.expiresAt * 1000).toLocaleDateString()}</div>
                      </div>
                      <div style={{ ...mono, fontSize: 11, padding: "4px 12px", borderRadius: 999, background: pot.status === "active" ? "rgba(29,158,117,0.1)" : "rgba(239,159,39,0.1)", color: pot.status === "active" ? G.green : G.amber, border: `0.5px solid ${pot.status === "active" ? G.green : G.amber}30`, textTransform: "uppercase" }}>{pot.status}</div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 16 }}>
                      <div>
                        <div style={{ fontSize: 10, color: G.muted, ...mono, marginBottom: 4 }}>TOTAL POT</div>
                        <div style={{ fontSize: 20, fontWeight: 700, ...mono }}>{pot.totalAmount}</div>
                        <div style={{ fontSize: 10, color: G.faint }}>$HEALTH</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: G.muted, ...mono, marginBottom: 4 }}>YOUR STAKE</div>
                        <div style={{ fontSize: 20, fontWeight: 700, ...mono }}>{pot.patientStaked}</div>
                        <div style={{ fontSize: 10, color: G.faint }}>$HEALTH</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: G.muted, ...mono, marginBottom: 4 }}>SESSIONS</div>
                        <div style={{ fontSize: 20, fontWeight: 700, ...mono }}>{pot.sessionCount}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: G.muted, ...mono, marginBottom: 4 }}>HEALTH Δ</div>
                        <div style={{ fontSize: 20, fontWeight: 700, ...mono, color: improved ? G.green : G.red }}>
                          {improved ? "+" : ""}{pot.currentHealthScore - pot.baselineHealthScore} pts
                        </div>
                      </div>
                    </div>

                    {/* Share distribution */}
                    <div style={{ height: 8, borderRadius: 999, overflow: "hidden", display: "flex" }}>
                      <div style={{ width: `${pot.patientShareBps / 100}%`, background: G.green }} />
                      <div style={{ width: `${pot.practitionerShareBps / 100}%`, background: G.blue }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: G.faint, ...mono }}>
                      <span>You {(pot.patientShareBps / 100).toFixed(0)}%</span>
                      <span>Practitioner {(pot.practitionerShareBps / 100).toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && activeTab === "protocol" && protocolState && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
              {[
                { label: "Total patients", value: protocolState.totalPatients.toLocaleString() },
                { label: "Total practitioners", value: protocolState.totalPractitioners.toLocaleString() },
                { label: "Total pots opened", value: protocolState.totalPots.toLocaleString() },
                { label: "Total $HEALTH slashed", value: protocolState.totalSlashed.toLocaleString() },
                { label: "Total $HEALTH rewarded", value: protocolState.totalRewarded.toLocaleString() },
                { label: "Health mint", value: short(protocolState.healthMint.toBase58()) },
              ].map((s, i) => (
                <div key={i} style={{ background: G.card, border: `0.5px solid ${G.border}`, borderRadius: 12, padding: "20px 24px" }}>
                  <div style={{ fontSize: 11, color: G.muted, ...mono, letterSpacing: "0.06em", marginBottom: 10 }}>{s.label.toUpperCase()}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, ...mono, color: G.text }}>{s.value}</div>
                </div>
              ))}
            </div>
          )}

          {!loading && activeTab === "settings" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[
                { title: "Wallet", fields: [
                  { label: "Connected address", value: publicKey ? short(publicKey.toBase58()) : "—" },
                  { label: "Network", value: "Devnet" },
                ]},
                { title: "Patient profile", fields: [
                  { label: "Health score", value: String(healthScore) },
                  { label: "Sessions completed", value: String(patientProfile?.sessionCount ?? 0) },
                ]},
                { title: "Token", fields: [
                  { label: "$HEALTH balance", value: `${healthBalance.toLocaleString()} $H` },
                  { label: "Total earned", value: `${patientProfile?.totalEarned.toLocaleString() ?? 0} $H` },
                ]},
                { title: "Program", fields: [
                  { label: "Program ID", value: short("B3hcYp5nnHH8iWXoEsF2UJpNy82fi7thTHeKJBoNq4pa") },
                  { label: "Active pots", value: String(patientProfile?.activePots ?? 0) },
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