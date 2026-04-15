import { app } from "../dist/app.js";
import { connectDatabase } from "../dist/config/db.js";

let databaseReadyPromise = null;

async function ensureDatabaseReady() {
  if (!databaseReadyPromise) {
    databaseReadyPromise = connectDatabase().catch((error) => {
      databaseReadyPromise = null;
      throw error;
    });
  }

  await databaseReadyPromise;
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(request, response) {
  try {
    await ensureDatabaseReady();
    return app(request, response);
  } catch (error) {
    console.error("Vercel handler bootstrap failed", error);
    response.statusCode = 500;
    response.setHeader("Content-Type", "application/json");
    response.end(
      JSON.stringify({
        message: "Backend initialization failed",
      }),
    );
  }
}
