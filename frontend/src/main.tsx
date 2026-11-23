import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";

import "./styles/variables.css";
import "./index.css";
import "./App.css";
import "./styles/turnos.css";
import "./styles/layout.css";
import "./styles/pacientes.css";
import "./styles/professional-agenda.css";
import "./styles/historia-clinica.css";

import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { AgendaSocketProvider } from "./context/AgendaSocketContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <AgendaSocketProvider>
        <App />
      </AgendaSocketProvider>
    </AuthProvider>
  </StrictMode>,
);
