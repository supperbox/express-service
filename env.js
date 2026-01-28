import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nodeEnv = process.env.NODE_ENV || "development";
const envFile =
  nodeEnv === "production" ? ".env.production" : ".env.development";
const envPath = path.join(__dirname, envFile);

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  // 兜底：不阻塞启动，但给出提示
  console.warn(`[env] 未找到环境变量文件: ${envPath}`);
}

export { nodeEnv, envFile, envPath };
