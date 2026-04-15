import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import morgan from "morgan";

import { env } from "./config/env.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { notFoundHandler } from "./middlewares/notFound.js";
import { apiRouter } from "./routes/index.js";

export const app = express();
app.set("etag", false);

app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true,
  }),
);
app.use(morgan("dev"));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/", (_request, response) => {
  response
    .status(200)
    .type("html")
    .send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Clyra Backend</title>
    <style>
      body { font-family: Arial, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; }
      main { max-width: 760px; margin: 64px auto; background: white; padding: 32px; border-radius: 16px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); }
      h1 { margin-top: 0; }
      code, a { color: #2563eb; }
    </style>
  </head>
  <body>
    <main>
      <h1>Clyra backend is running</h1>
      <p>This service is available on <code>http://localhost:4000</code>.</p>
      <p>API health check: <a href="/api/v1/health">/api/v1/health</a></p>
      <p>If you opened plain <code>localhost</code>, that is a different service on port 80.</p>
    </main>
  </body>
</html>`);
});

app.use("/api/v1", apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);
