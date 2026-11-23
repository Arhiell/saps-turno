import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import routes from "./routes/index.js";
import { chatbotBodyParser } from "./routes/chatbot.routes.js";

import {
  notFoundHandler
} from "./middlewares/not-found.middleware.js";

import {
  errorHandler
} from "./middlewares/error.middleware.js";

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

app.use('/api/chatbot', chatbotBodyParser);

app.use(
  express.json({
    limit: "1mb",
  }),
);

app.use(morgan("dev"));

/**
 * IMPORTANTE:
 * las rutas deben ir ANTES del notFoundHandler.
 */
app.use("/api", routes);

/**
 * Estos dos siempre deben estar al final.
 */
app.use(notFoundHandler);

app.use(errorHandler);

export default app;
