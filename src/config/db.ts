import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import { env } from "./env.js";

let memoryServer: MongoMemoryServer | null = null;

export async function connectDatabase() {
  mongoose.set("strictQuery", true);

  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    console.log("Connected to primary MongoDB");
    return;
  } catch (error) {
    if (env.NODE_ENV !== "development") {
      throw error;
    }

    console.warn("Primary MongoDB connection failed, starting in-memory MongoDB for development.");
    memoryServer ??= await MongoMemoryServer.create();
    await mongoose.connect(memoryServer.getUri(), {
      dbName: "medicnct-dev",
    });
    console.log("Connected to in-memory MongoDB for development");
  }
}
