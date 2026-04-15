import { app } from "./app.js";
import { connectDatabase } from "./config/db.js";
import { env } from "./config/env.js";

async function bootstrap() {
  app.listen(env.PORT, () => {
    console.log(`MedicNCT backend listening on port ${env.PORT}`);
  });

  try {
    await connectDatabase();
    console.log("Database connected successfully");
  } catch (error) {
    console.error("Database connection failed; server will stay up for local development", error);
  }
}

bootstrap().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
