import { ReleaseViewer } from "./ReleaseViewer";
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./editor.css";
import "./site.css";
import "./directions.css";
import "./identity.css";
import "./composition.css";
import "./new-directions.css";
import "./canvas-focus.css";
import "./work-context.css";
import "./relationships.css";
import { Examples } from "./Examples";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {new URLSearchParams(window.location.search).get("view") === "release" ? (
      <ReleaseViewer />
    ) : new URLSearchParams(window.location.search).has("examples") ? (
      <Examples />
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
