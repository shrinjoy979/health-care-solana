import { useState } from "react";

const G = {
  bg: "#0a0f0d",
  surface: "#0f1f18",
  card: "#111c16",
  border: "rgba(29,158,117,0.15)",
  borderHover: "rgba(29,158,117,0.35)",
  green: "#1D9E75",
  greenLight: "#5DCAA5",
  greenMuted: "#9FE1CB",
  text: "#e8f0eb",
  muted: "#8aab9a",
  faint: "#2d4a38",
  red: "#D4537E",
  amber: "#EF9F27",
  blue: "#378ADD",
};

const mono: React.CSSProperties = { fontFamily: "'DM Mono', monospace" };

function MetricCard({ label, value, sub, color = G.greenLight }: { label: string; value: string; sub?: string; color?: string }) {
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

const practitioners = [
  { initials: "DC", name: "Dr. Chen", spec: "Primary Care", staked: 500, sessions: 8, outcome: 82, trend: "+14", status: "active" },
  { initials: "SR", name: "Dr. Rao", spec: "Nutritionist", staked: 300, sessions: 3, outcome: 54, trend: "-6", status: "watch" },
  { initials: "AM", name: "Dr. Mehta", spec: "Cardiologist", staked: 800, sessions: 12, outcome: 91, trend: "+22", status: "excellent" },
];

const timeline = [
  { icon: "✓", color: G.green, text: "Blood pressure normalized — Dr. Chen +120 $HEALTH", time: "2h ago" },
  { icon: "↓", color: G.red, text: "Dr. Rao slashed 80 $HEALTH — cholesterol worsened", time: "6d ago" },
  { icon: "⬡", color: G.blue, text: "New stake pot opened with Dr. Mehta (800 tokens)", time: "2w ago" },
  { icon: "✓", color: G.green, text: "Cardiac stress test passed — outcome score +22", time: "3w ago" },
  { icon: "◈", color: G.amber, text: "Diet plan review pending — 30 day checkpoint", time: "4w ago" },
];

const healthHistory = [68, 70, 69, 73, 71, 75, 74, 77, 76, 79, 78, 82];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const tabs = ["overview", "practitioners", "history", "settings"];

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
            { id: "practitioners", icon: "⬡", label: "Practitioners" },
            { id: "history", icon: "◉", label: "History" },
            { id: "settings", icon: "✦", label: "Settings" },
          ].map(item => (
            <div key={item.id} onClick={() => setActiveTab(item.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 8, marginBottom: 4, cursor: "pointer", background: activeTab === item.id ? "rgba(29,158,117,0.12)" : "transparent", color: activeTab === item.id ? G.greenLight : G.muted, transition: "all 0.2s", border: activeTab === item.id ? `0.5px solid ${G.border}` : "0.5px solid transparent" }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>{item.icon}</span>
              {sidebarOpen && <span style={{ fontSize: 13, fontWeight: 400 }}>{item.label}</span>}
            </div>
          ))}
        </nav>

        <div style={{ padding: "16px 10px", borderTop: `0.5px solid ${G.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
            <div style={{ width: 28, height: 28, background: "rgba(29,158,117,0.15)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: G.greenLight, flexShrink: 0 }}>JS</div>
            {sidebarOpen && <div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>Shrinjoy S.</div>
              <div style={{ fontSize: 10, color: G.muted, ...mono }}>2,400 $HEALTH</div>
            </div>}
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
              ◆ Localnet
            </div>
            <div style={{ width: 8, height: 8, background: G.greenLight, borderRadius: "50%", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 12, color: G.muted }}>0x4f2…3a1</span>
          </div>
        </header>

        {/* Content */}
        <div style={{ padding: "32px", flex: 1 }}>

          {activeTab === "overview" && (
            <>
              {/* Metrics */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 28 }}>
                <MetricCard label="$HEALTH balance" value="2,400" sub="↑ 320 this month" />
                <MetricCard label="Health score" value="82" sub="+14 pts from baseline" color={G.greenLight} />
                <MetricCard label="Total staked" value="1,600" sub="across 3 practitioners" color={G.blue} />
                <MetricCard label="Slash events" value="1" sub="Dr. Rao · 80 tokens" color={G.red} />
              </div>

              {/* Chart + Timeline */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, marginBottom: 16 }}>

                {/* Chart */}
                <div style={{ background: G.card, border: `0.5px solid ${G.border}`, borderRadius: 14, padding: "24px 28px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                    <div>
                      <div style={{ fontSize: 13, color: G.muted, ...mono, letterSpacing: "0.06em", marginBottom: 4 }}>HEALTH SCORE TREND</div>
                      <div style={{ fontSize: 24, fontWeight: 700, ...mono, color: G.greenLight }}>82 <span style={{ fontSize: 13, color: G.green }}>↑ +20.6%</span></div>
                    </div>
                    <div style={{ ...mono, fontSize: 11, color: G.faint }}>12 weeks</div>
                  </div>

                  {/* SVG chart */}
                  <svg viewBox="0 0 560 120" style={{ width: "100%", height: 120 }}>
                    <defs>
                      <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#1D9E75" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#1D9E75" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {/* Grid lines */}
                    {[0, 40, 80].map((y, i) => (
                      <line key={i} x1="0" y1={y} x2="560" y2={y} stroke="rgba(29,158,117,0.08)" strokeWidth="1" />
                    ))}
                    {/* Area fill */}
                    <path
                      d={`M ${healthHistory.map((v, i) => `${i * 50},${110 - ((v - 65) / 25) * 100}`).join(" L ")} L ${(healthHistory.length - 1) * 50},110 L 0,110 Z`}
                      fill="url(#chartGrad)"
                    />
                    {/* Line */}
                    <polyline
                      points={healthHistory.map((v, i) => `${i * 50},${110 - ((v - 65) / 25) * 100}`).join(" ")}
                      fill="none"
                      stroke="#1D9E75"
                      strokeWidth="2"
                      strokeLinejoin="round"
                    />
                    {/* Dots */}
                    {healthHistory.map((v, i) => (
                      <circle key={i} cx={i * 50} cy={110 - ((v - 65) / 25) * 100} r="3" fill="#1D9E75" />
                    ))}
                    {/* Latest dot */}
                    <circle cx={(healthHistory.length - 1) * 50} cy={110 - ((healthHistory[healthHistory.length - 1] - 65) / 25) * 100} r="5" fill="#5DCAA5" />
                  </svg>
                </div>

                {/* Timeline */}
                <div style={{ background: G.card, border: `0.5px solid ${G.border}`, borderRadius: 14, padding: "24px" }}>
                  <div style={{ fontSize: 11, ...mono, color: G.muted, letterSpacing: "0.06em", marginBottom: 20 }}>RECENT EVENTS</div>
                  <div style={{ position: "relative", paddingLeft: 16 }}>
                    <div style={{ position: "absolute", left: 6, top: 0, bottom: 0, width: 1, background: G.border }} />
                    {timeline.map((t, i) => (
                      <div key={i} style={{ position: "relative", marginBottom: 18 }}>
                        <div style={{ position: "absolute", left: -13, top: 3, width: 8, height: 8, borderRadius: "50%", background: G.card, border: `1.5px solid ${t.color}` }} />
                        <div style={{ fontSize: 12, color: G.text, lineHeight: 1.5, marginBottom: 3 }}>{t.text}</div>
                        <div style={{ fontSize: 10, color: G.faint, ...mono }}>{t.time}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Pot distribution */}
              <div style={{ background: G.card, border: `0.5px solid ${G.border}`, borderRadius: 14, padding: "24px 28px" }}>
                <div style={{ fontSize: 11, ...mono, color: G.muted, letterSpacing: "0.06em", marginBottom: 20 }}>STAKE POT DISTRIBUTION</div>
                <div style={{ display: "flex", gap: 40, alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", height: 32, borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ width: "37%", background: G.green, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, ...mono, fontWeight: 500, color: G.bg }}>You 37%</div>
                      <div style={{ width: "63%", background: G.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, ...mono, fontWeight: 500, color: "white" }}>Practitioners 63%</div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: G.muted }}>
                      <span>Patient earns if outcomes decline</span>
                      <span>Practitioners earn on improvement</span>
                    </div>
                  </div>
                  <div style={{ ...mono, fontSize: 28, fontWeight: 700, color: G.text, whiteSpace: "nowrap" }}>1,600 <span style={{ fontSize: 14, color: G.muted }}>$HEALTH</span></div>
                </div>
              </div>
            </>
          )}

          {activeTab === "practitioners" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {practitioners.map((p, i) => {
                const statusColor = p.status === "excellent" ? G.green : p.status === "watch" ? G.amber : G.blue;
                const statusBg = p.status === "excellent" ? "rgba(29,158,117,0.1)" : p.status === "watch" ? "rgba(239,159,39,0.1)" : "rgba(55,138,221,0.1)";
                const trendColor = p.trend.startsWith("+") ? G.green : G.red;
                return (
                  <div key={i} style={{ background: G.card, border: `0.5px solid ${G.border}`, borderRadius: 14, padding: "24px 28px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
                      <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(29,158,117,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600, color: G.greenLight, flexShrink: 0 }}>{p.initials}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 3 }}>{p.name}</div>
                        <div style={{ fontSize: 12, color: G.muted }}>{p.spec}</div>
                      </div>
                      <div style={{ ...mono, fontSize: 11, padding: "4px 12px", borderRadius: 999, background: statusBg, color: statusColor, border: `0.5px solid ${statusColor}30`, textTransform: "uppercase", letterSpacing: "0.04em" }}>{p.status}</div>
                      <div style={{ ...mono, fontSize: 18, fontWeight: 700, color: trendColor, minWidth: 60, textAlign: "right" }}>{p.trend}</div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 16 }}>
                      <div>
                        <div style={{ fontSize: 10, color: G.muted, ...mono, marginBottom: 4, letterSpacing: "0.06em" }}>STAKED</div>
                        <div style={{ fontSize: 20, fontWeight: 700, ...mono, color: G.text }}>{p.staked}</div>
                        <div style={{ fontSize: 10, color: G.faint }}>$HEALTH tokens</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: G.muted, ...mono, marginBottom: 4, letterSpacing: "0.06em" }}>SESSIONS</div>
                        <div style={{ fontSize: 20, fontWeight: 700, ...mono, color: G.text }}>{p.sessions}</div>
                        <div style={{ fontSize: 10, color: G.faint }}>completed</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: G.muted, ...mono, marginBottom: 4, letterSpacing: "0.06em" }}>OUTCOME SCORE</div>
                        <div style={{ fontSize: 20, fontWeight: 700, ...mono, color: p.outcome > 70 ? G.green : G.amber }}>{p.outcome}/100</div>
                        <div style={{ fontSize: 10, color: G.faint }}>health outcome</div>
                      </div>
                    </div>
                    <HealthBar value={p.outcome} color={p.outcome > 70 ? G.green : G.amber} />
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === "history" && (
            <div style={{ background: G.card, border: `0.5px solid ${G.border}`, borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: "20px 28px", borderBottom: `0.5px solid ${G.border}` }}>
                <div style={{ fontSize: 11, ...mono, color: G.muted, letterSpacing: "0.06em" }}>TRANSACTION HISTORY</div>
              </div>
              {[
                { type: "earn", label: "Outcome reward", from: "Dr. Chen", amount: "+120", date: "Apr 25, 2025" },
                { type: "slash", label: "Slash applied", from: "Dr. Rao", amount: "-80", date: "Apr 19, 2025" },
                { type: "stake", label: "Pot opened", from: "Dr. Mehta", amount: "-800", date: "Apr 10, 2025" },
                { type: "earn", label: "Outcome reward", from: "Dr. Mehta", amount: "+220", date: "Mar 28, 2025" },
                { type: "stake", label: "Pot opened", from: "Dr. Chen", amount: "-500", date: "Feb 14, 2025" },
              ].map((tx, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", padding: "16px 28px", borderBottom: `0.5px solid ${G.border}`, gap: 16 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: tx.type === "earn" ? "rgba(29,158,117,0.1)" : tx.type === "slash" ? "rgba(212,83,126,0.1)" : "rgba(55,138,221,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: tx.type === "earn" ? G.green : tx.type === "slash" ? G.red : G.blue, flexShrink: 0 }}>
                    {tx.type === "earn" ? "↑" : tx.type === "slash" ? "✕" : "⬡"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{tx.label}</div>
                    <div style={{ fontSize: 11, color: G.muted, marginTop: 2 }}>{tx.from}</div>
                  </div>
                  <div style={{ ...mono, fontSize: 14, fontWeight: 600, color: tx.amount.startsWith("+") ? G.green : G.red }}>{tx.amount} $HEALTH</div>
                  <div style={{ ...mono, fontSize: 11, color: G.faint, minWidth: 90, textAlign: "right" }}>{tx.date}</div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "settings" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[
                { title: "Wallet", fields: [{ label: "Connected address", value: "0x4f2a3…3a1" }, { label: "Network", value: "Localnet" }] },
                { title: "Notifications", fields: [{ label: "Outcome alerts", value: "Enabled" }, { label: "Slash warnings", value: "Enabled" }] },
                { title: "Health data", fields: [{ label: "Oracle source", value: "Self-reported" }, { label: "Update frequency", value: "Per session" }] },
                { title: "Token preferences", fields: [{ label: "Auto-stake", value: "Off" }, { label: "Min stake amount", value: "100 $HEALTH" }] },
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