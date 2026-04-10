import { AuthProvider, useAuth } from "./auth";
import { I18nProvider, useI18n } from "./i18n";
import { Page, CenteredColumn, Panel, Btn, ErrLine } from "./ui";
import Auth from "./screens/Auth";
import Shell from "./screens/Shell";
import { C } from "./theme";

function Inner() {
  const { session, profile, profileError, loading, refreshProfile, signOut } = useAuth();
  const { t } = useI18n();

  if (loading) {
    return (
      <Page>
        <div style={{ padding: 48, color: C.dim, fontSize: 14 }}>{t("common.loading")}</div>
      </Page>
    );
  }

  if (!session) return <Auth />;

  if (!profile) {
    return (
      <Page>
        <CenteredColumn maxWidth={480}>
          <Panel title={t("prof.title")}>
            {profileError ? (
              <>
                <div style={{ color: C.text, fontSize: 14, marginBottom: 12 }}>
                  Could not load your profile.
                </div>
                <ErrLine>{profileError}</ErrLine>
              </>
            ) : (
              <div style={{ color: C.dim, fontSize: 14, marginBottom: 12 }}>
                {t("common.loading")}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <Btn onClick={refreshProfile}>Retry</Btn>
              <Btn onClick={signOut}>{t("nav.logout")}</Btn>
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
    <I18nProvider>
      <AuthProvider>
        <Inner />
      </AuthProvider>
    </I18nProvider>
  );
}
