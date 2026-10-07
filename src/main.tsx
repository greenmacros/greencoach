import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { AppProvider } from "./app-context";
import { requestPersistence } from "./db";
import App from "./App";
import "./styles.css";

registerSW({ immediate: true });
void requestPersistence();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
);
