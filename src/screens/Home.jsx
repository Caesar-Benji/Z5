import { useAuth, roleLabel } from "../auth";
import { Panel, PageHeader, Badge } from "../ui";
import { C } from "../theme";

export default function Home() {
  const { profile } = useAuth();
  const greeting = greet();

  return (
    <>
      <PageHeader
        title={`${greeting}, ${profile?.callsign || "Operator"}`}
        subtitle={`Role: ${roleLabel(profile?.role)}${profile?.squad_id ? "" : " · no squad assigned"}`}
      />

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: 20,
      }}>
        <Panel title="Upcoming missions">
          <EmptyState>
            No missions scheduled. When missions are created, your next 5 will appear here
            with date, location and your personal readiness.
          </EmptyState>
        </Panel>

        <Panel title="Recent updates">
          <EmptyState>
            No announcements yet. Messages from admin, officers and squad leaders will land here.
          </EmptyState>
        </Panel>

        <Panel title="My squad status">
          {profile?.squad_id ? (
            <EmptyState>
              Squad roster will appear here with each member&apos;s readiness once the missions
              module is active.
            </EmptyState>
          ) : (
            <div style={{
              padding: "12px 0",
              color: C.warn,
              fontSize: 14,
            }}>
              You are not assigned to a squad yet.<br />
              <span style={{ color: C.dim, fontSize: 13 }}>
                Admin or squad leader must invite you via an invite code.
              </span>
            </div>
          )}
        </Panel>

        <Panel title="Personal readiness">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Row label="Gear logged" value="—" />
            <Row label="Missions assigned" value="0" />
            <Row label="Avg checklist completion" value="—" />
            <div style={{ marginTop: 4 }}>
              <Badge tone="warn">Pending first mission</Badge>
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}

function Row({ label, value }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      paddingBottom: 10,
      borderBottom: `1px solid ${C.border}`,
    }}>
      <span style={{ color: C.dim, fontSize: 13 }}>{label}</span>
      <span style={{ color: C.bright, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function EmptyState({ children }) {
  return (
    <div style={{
      color: C.dim,
      fontSize: 13,
      lineHeight: 1.6,
      padding: "8px 0",
    }}>{children}</div>
  );
}

function greet() {
  const h = new Date().getHours();
  if (h < 5)  return "Late watch";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
