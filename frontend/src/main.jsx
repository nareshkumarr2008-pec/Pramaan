import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import VerifyCredential from "./pages/VerifyCredential.jsx";
import { T, LangContext } from "./i18n.js";
import "./styles.css";

// No router is used elsewhere in this app (App.jsx is screen-state based),
// so the one page that genuinely needs a real, shareable URL — the public
// credential verify page reached via QR code or link — gets its own tiny
// path check here instead of pulling in a routing library. Both Vite's dev
// server and the Express production fallback already serve index.html for
// any unknown path, so a path like /verify/worker_123 lands here with
// nothing extra to configure.
function VerifyRoot({ workerId }) {
  const [lang, setLang] = useState("en");
  const t = (k) => T[lang]?.[k] ?? T.en[k] ?? k;
  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      <VerifyCredential workerId={workerId} />
    </LangContext.Provider>
  );
}

const verifyMatch = /^\/verify\/([^/]+)\/?$/.exec(window.location.pathname);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {verifyMatch ? <VerifyRoot workerId={decodeURIComponent(verifyMatch[1])} /> : <App />}
  </React.StrictMode>
);
