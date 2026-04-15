import { app } from "../src/app.js";
import { connectDatabase } from "../src/config/db.js";

let databaseReadyPromise: Promise<void> | null = null;

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

export default async function handler(request: Parameters<typeof app>[0], response: Parameters<typeof app>[1]) {
  try {
    await ensureDatabaseReady();
    return app(request, response);
  } catch (error) {
    console.error("Vercel handler bootstrap failed", error);
    response.status(500).json({
      message: "Backend initialization failed",
    });
  }
}
