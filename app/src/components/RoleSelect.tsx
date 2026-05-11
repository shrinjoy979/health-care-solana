import { useWallet } from "@solana/wallet-adapter-react";

const G = {
  bg: "#0a0f0d", surface: "#0f1f18", card: "#111c16",
  border: "rgba(29,158,117,0.15)", borderHover: "rgba(29,158,117,0.35)",
  green: "#1D9E75", greenLight: "#5DCAA5", greenMuted: "#9FE1CB",
  text: "#e8f0eb", muted: "#8aab9a", faint: "#2d4a38",
  blue: "#378ADD", coral: "#D85A30",
};
const mono: React.CSSProperties = { fontFamily: "'DM Mono', monospace" };

type Role = "patient" | "practitioner";

export default function RoleSelect({ onSelect }: { onSelect: (r: Role) => void }) {
  const { disconnect } = useWallet();

  const cards: { role: Role; icon: string; title: string; desc: string; accent: string }[] = [
    {
      role: "patient",
      icon: "◈",
      title: "I'm a Patient",
      desc: "Register to stake $HEALTH tokens alongside your practitioner and earn rewards when your health improves.",
      accent: G.green,
    },
    {
      role: "practitioner",
      icon: "⬡",
      title: "I'm a Practitioner",
      desc: "Register as a doctor or health professional. Stake tokens on patient outcomes and build your on-chain reputation.",
      accent: G.blue,
    },
  ];

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", background: G.bg, fontFamily: "'Outfit', sans-serif",
      padding: 24,
    }}>
      <div style={{ width: "100%", maxWidth: 640, textAlign: "center" }}>

        {/* Logo */}
        <div style={{
          width: 52, height: 52, background: G.green, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22, fontWeight: 700, color: G.bg, margin: "0 auto 28px",
        }}>H</div>

        <h2 style={{ color: G.text, fontSize: 24, fontWeight: 700, marginBottom: 10 }}>
          Welcome to $HEALTH
        </h2>
        <p style={{ color: G.muted, fontSize: 14, marginBottom: 40, lineHeight: 1.7 }}>
          How are you joining the protocol?
        </p>

        {/* Role cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
          {cards.map(card => (
            <div
              key={card.role}
              onClick={() => onSelect(card.role)}
              style={{
                background: G.surface,
                border: `0.5px solid ${G.border}`,
                borderRadius: 16,
                padding: "32px 24px",
                cursor: "pointer",
                textAlign: "center",
                transition: "border-color 0.2s, background 0.2s",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = card.accent + "60";
                (e.currentTarget as HTMLElement).style.background = card.accent + "08";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = G.border;
                (e.currentTarget as HTMLElement).style.background = G.surface;
              }}
            >
              <div style={{ fontSize: 32, color: card.accent, marginBottom: 16 }}>
                {card.icon}
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: G.text, marginBottom: 10 }}>
                {card.title}
              </div>
              <div style={{ fontSize: 13, color: G.muted, lineHeight: 1.6 }}>
                {card.desc}
              </div>
              <div style={{
                marginTop: 20, display: "inline-block",
                background: card.accent,
                color: G.bg, borderRadius: 8,
                padding: "8px 20px",
                fontSize: 13, fontWeight: 600,
              }}>
                Get started →
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={disconnect}
          style={{
            background: "none", border: "none",
            color: G.muted, fontSize: 13, cursor: "pointer",
            ...mono,
          }}
        >
          ← Disconnect wallet
        </button>
      </div>
    </div>
  );
}