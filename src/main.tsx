import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { initPwa } from "./pwa";
import { AppProvider } from "./app-context";
import { requestPersistence } from "./db";
import App from "./App";
import "./styles.css";

initPwa();
void requestPersistence();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
);
