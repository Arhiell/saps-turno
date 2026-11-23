import { createServer } from "node:http";
import app from "./app.js";
import { env } from "./config/env.js";
import { iniciarProcesadorNotificaciones } from "./services/notificacion-worker.service.js";
import { initSocketServer } from "./services/socket.service.js";
import { revisarSincronizacionCalendario } from './services/calendario-sync.service.js';

const detenerNotificaciones = iniciarProcesadorNotificaciones(revisarSincronizacionCalendario);

const server = createServer(app);
initSocketServer(server);

server.listen(
  env.PORT,
  () => {
    console.log("");
    console.log("==================================");
    console.log("🏥 SAPS Turno API (con WebSockets)");
    console.log("==================================");
    console.log(`🚀 Servidor: http://localhost:${env.PORT}`);
    console.log(`🌎 Entorno: ${env.NODE_ENV}`);
    console.log("==================================");
    console.log("");
  }
);

const shutdown = () => {
  console.log("Cerrando SAPS Turno API...");

  server.close(async () => {
    await detenerNotificaciones();
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
