import { AuthProvider, useAuth } from "./auth";
import { Page } from "./ui";
import Auth from "./screens/Auth";
import Shell from "./screens/Shell";
import { C } from "./theme";

function Inner() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <Page>
        <div style={{ padding: 48, color: C.dim, fontSize: 14 }}>Booting terminal…</div>
      </Page>
    );
  }

  if (!session) return <Auth />;

  if (!profile) {
    return (
      <Page>
        <div style={{ padding: 48, color: C.dim, fontSize: 14 }}>Loading profile…</div>
      </Page>
    );
  }

  return <Shell />;
}

export default function App() {
  return (
    <AuthProvider>
      <Inner />
    </AuthProvider>
  );
}
