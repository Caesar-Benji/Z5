import { AuthProvider, useAuth } from "./auth";
import { ScanlineWrap } from "./ui";
import Auth from "./screens/Auth";
import Shell from "./screens/Shell";
import { C } from "./theme";

function Inner() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <ScanlineWrap>
        <div style={{ padding: 40, color: C.dim }}>BOOTING TERMINAL...</div>
      </ScanlineWrap>
    );
  }

  if (!session) return <Auth />;

  // Edge case: session exists but profile failed to load (e.g. RLS race).
  if (!profile) {
    return (
      <ScanlineWrap>
        <div style={{ padding: 40, color: C.dim }}>LOADING PROFILE...</div>
      </ScanlineWrap>
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
