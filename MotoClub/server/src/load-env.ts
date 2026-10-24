import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

// Resolve the shared project-level .env regardless of the command's working directory.
dotenv.config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });
