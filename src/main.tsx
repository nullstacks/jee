import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

/* Only the latin + latin-ext subsets are pulled in: the site is English and
   the base-36 decoder never emits anything outside Latin-1. The "wght" axis
   is enough — optical sizing is not used by the type scale. */
import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/bricolage-grotesque/opsz.css";
import "@fontsource-variable/jetbrains-mono/wght.css";

import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/app.css";
import "./styles/polish.css";

import { boot } from "./lib/boot";
import { registerServiceWorker } from "./lib/pwa";
import { App } from "./App";

boot();

const host = document.getElementById("root");
if (!host) throw new Error("missing #root");

createRoot(host).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerServiceWorker();
