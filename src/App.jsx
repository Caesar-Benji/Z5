import { AuthProvider, useAuth } from "./auth";
import { Page, CenteredColumn, Panel, Btn, ErrLine } from "./ui";
import Auth from "./screens/Auth";
import Shell from "./screens/Shell";
import { C } from "./theme";

function Inner() {
  const { session, profile, profileError, loading, refreshProfile, signOut } = useAuth();

  if (loading) {
    return (
      <Page>
        <div style={{ padding: 48, color: C.dim, fontSize: 14 }}>Booting terminal…</div>
      </Page>
    );
  }

  if (!session) return <Auth />;

  if (!profile) {
    // If we have an error, show recovery options. Otherwise show a loading
    // state with an escape hatch so the user is never permanently stuck.
    return (
      <Page>
        <CenteredColumn maxWidth={480}>
          <Panel title="Profile">
            {profileError ? (
              <>
                <div style={{ color: C.text, fontSize: 14, marginBottom: 12 }}>
                  Could not load your profile.
                </div>
                <ErrLine>{profileError}</ErrLine>
              </>
            ) : (
              <div style={{ color: C.dim, fontSize: 14, marginBottom: 12 }}>
                Loading profile…
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <Btn onClick={refreshProfile}>Retry</Btn>
              <Btn onClick={signOut}>Sign out</Btn>
            </div>
          </Panel>
        </CenteredColumn>
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
