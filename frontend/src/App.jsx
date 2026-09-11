import React, { useState, useEffect, useCallback } from "react";
import { T, LangContext } from "./i18n.js";
import { api, getToken, setToken } from "./api.js";
import { Loading } from "./components/atoms.jsx";
import Sidebar from "./components/Sidebar.jsx";
import { AccessibilityProvider, useAccessibility } from "./accessibility.jsx";
import AccessibilityWidget from "./components/AccessibilityWidget.jsx";
import GuidedTour from "./components/GuidedTour.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import Overview from "./pages/Overview.jsx";
import WorkerAssessment from "./pages/WorkerAssessment.jsx";
import Resume from "./pages/Resume.jsx";
import BrowseJobs from "./pages/BrowseJobs.jsx";
import MsmePost from "./pages/MsmePost.jsx";
import Postings from "./pages/Postings.jsx";
import Match from "./pages/Match.jsx";
import Passport from "./pages/Passport.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import Insights from "./pages/Insights.jsx";

export default function App() {
  const [lang, setLang] = useState("en");
  const t = (k) => T[lang]?.[k] ?? T.en[k] ?? k;

  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [screen, setScreen] = useState("overview");
  const [matchPresetJobId, setMatchPresetJobId] = useState("");

  const [workers, setWorkers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [myProfiles, setMyProfiles] = useState([]);
  const [myJobs, setMyJobs] = useState([]);
  const [myApplications, setMyApplications] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminMsme, setAdminMsme] = useState([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async (currentSession) => {
    const s = currentSession || session;
    if (!s) return;
    try {
      const [w, j] = await Promise.all([api.listWorkers(), api.listJobs()]);
      setWorkers(w);
      setJobs(j);
      if (s.role === "worker") {
        const [mine, apps] = await Promise.all([api.myWorkers(), api.myApplications()]);
        setMyProfiles(mine);
        setMyApplications(apps);
      } else if (s.role === "msme") {
        const mine = await api.myJobs();
        setMyJobs(mine);
      } else if (s.role === "admin") {
        const [users, msme] = await Promise.all([api.adminListUsers(), api.adminListMsme()]);
        setAdminUsers(users);
        setAdminMsme(msme);
      }
    } finally {
      setReady(true);
    }
  }, [session]);

  // Try to restore session from a stored token on first load.
  useEffect(() => {
    (async () => {
      const token = getToken();
      if (token) {
        try {
          const { user } = await api.me();
          setSession(user);
          setLang(user.uiLanguage || "en");
        } catch (e) {
          setToken(null);
        }
      }
      setAuthChecked(true);
    })();
  }, []);

  useEffect(() => {
    if (session) refresh(session);
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogin = async (username, password) => {
    const { token, user } = await api.login(username, password);
    setToken(token);
    setSession(user);
    setLang(user.uiLanguage || "en");
  };

  const handleSignup = async (payload) => {
    const { token, user } = await api.signup(payload);
    setToken(token);
    setSession(user);
    setLang(user.uiLanguage || "en");
  };

  const handleLogout = () => {
    setToken(null);
    setSession(null);
    setScreen("overview");
    setWorkers([]); setJobs([]); setMyProfiles([]); setMyJobs([]); setMyApplications([]);
    setAdminUsers([]); setAdminMsme([]);
    setReady(false);
  };

  const goToMatch = (jobId) => { setMatchPresetJobId(jobId); setScreen("match"); };

  const stats = { workers: workers.length, jobs: jobs.length };

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      <AccessibilityProvider lang={lang}>
        {!authChecked ? (
          <div className="pram-app"><div className="pram-screen"><Loading label="…" /></div></div>
        ) : !session ? (
          <div className="pram-app"><AuthPage onLogin={handleLogin} onSignup={handleSignup} /></div>
        ) : (
          <AppShell
            screen={screen} setScreen={setScreen} stats={stats} session={session} onLogout={handleLogout}
            ready={ready} t={t} workers={workers} jobs={jobs} myProfiles={myProfiles} myJobs={myJobs}
            myApplications={myApplications} adminUsers={adminUsers} adminMsme={adminMsme}
            refresh={refresh} goToMatch={goToMatch} matchPresetJobId={matchPresetJobId}
          />
        )}
      </AccessibilityProvider>
    </LangContext.Provider>
  );
}

// Split out so it can call useAccessibility() (must be inside the provider),
// applying big-text/high-contrast body classes and offering the floating
// help widget + guided tour to every signed-in screen.
function AppShell({
  screen, setScreen, stats, session, onLogout, ready, t,
  workers, jobs, myProfiles, myJobs, myApplications, adminUsers, adminMsme,
  refresh, goToMatch, matchPresetJobId,
}) {
  const a11y = useAccessibility();
  const [tourOpen, setTourOpen] = useState(false);

  // Offer the guided tour once, automatically, the first time a worker or
  // MSME owner signs in — after that it's only reachable via the help widget.
  useEffect(() => {
    if (a11y && !a11y.tourSeen && (session.role === "worker" || session.role === "msme")) {
      const id = setTimeout(() => setTourOpen(true), 600);
      return () => clearTimeout(id);
    }
  }, [a11y, session.role]);

  const appClass = `pram-app${a11y?.bigText ? " a11y-bigtext" : ""}${a11y?.highContrast ? " a11y-contrast" : ""}`;

  return (
    <div className={appClass}>
      <Sidebar screen={screen} setScreen={setScreen} stats={stats} session={session} onLogout={onLogout} />
      {!ready ? (
        <div className="pram-screen"><Loading label={t("loading_network")} /></div>
      ) : screen === "overview" ? (
        <Overview stats={stats} setScreen={setScreen} session={session} />
      ) : screen === "worker" && session.role === "worker" ? (
        <WorkerAssessment onSaved={() => refresh(session)} />
      ) : screen === "resume" && session.role === "worker" ? (
        <Resume myProfiles={myProfiles} />
      ) : screen === "browse" && session.role === "worker" ? (
        <BrowseJobs jobs={jobs} myApplications={myApplications} myProfiles={myProfiles} refresh={() => refresh(session)} />
      ) : screen === "msme" && session.role === "msme" ? (
        <MsmePost onSaved={() => refresh(session)} />
      ) : screen === "postings" && session.role === "msme" ? (
        <Postings myJobs={myJobs} goToMatch={goToMatch} />
      ) : screen === "match" && session.role === "msme" ? (
        <Match myJobs={myJobs} presetJobId={matchPresetJobId} refresh={() => refresh(session)} />
      ) : screen === "passport" ? (
        <Passport workers={workers} />
      ) : screen === "insights" ? (
        <Insights workers={workers} jobs={jobs} />
      ) : screen === "admin" && session.role === "admin" ? (
        <AdminPage users={adminUsers} msmeJobs={adminMsme} refresh={() => refresh(session)} />
      ) : (
        <Overview stats={stats} setScreen={setScreen} session={session} />
      )}

      <AccessibilityWidget onOpenTour={() => setTourOpen(true)} />
      {tourOpen && (
        <GuidedTour role={session.role} setScreen={setScreen} onClose={() => setTourOpen(false)} />
      )}
    </div>
  );
}
