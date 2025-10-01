import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { SupportProvider } from "./modules/support";

createRoot(document.getElementById("root")!).render(
  <SupportProvider>
    <App />
  </SupportProvider>
);
