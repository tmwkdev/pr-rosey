import App from "@pr-rosey/desktop/renderer/App";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@pr-rosey/desktop/renderer/styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
