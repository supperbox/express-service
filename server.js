import "dotenv/config";
import {
  httpLoggerMiddleware,
  installConsoleRedirect,
  logger,
} from "./utils/logger.js";
import model from "./db/User.js";
import setupSwagger from "./swagger.js";
import express from "express";
import cors from "cors";
import userRoute from "./expressRoutes/userExpress.js";
import loginRoute from "./expressRoutes/loginExpress.js";
import imageRoute from "./expressRoutes/imageExpress.js";
import updateExpressRoute from "./expressRoutes/updateExpress.js";
import newsRoute from "./expressRoutes/newsExpress.js";
import path from "path";
import { fileURLToPath } from "url";

// 计算 ES 模块中的 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 将 console.* 输出纳入统一日志（控制台 + 文件）
installConsoleRedirect();

// 捕获未处理异常/Promise 拒绝，确保落盘
process.on("unhandledRejection", (reason) => {
  logger.error(
    `UnhandledRejection: ${
      reason instanceof Error ? reason.stack : String(reason)
    }`
  );
});

process.on("uncaughtException", (err) => {
  logger.error(`UncaughtException: ${err?.stack || String(err)}`);
});

// 触发更新123
// 支持通过环境变量配置端口与绑定地址
const PORT = process.env.PORT ? Number(process.env.PORT) : 3008;
// 绑定到 0.0.0.0 使外部能通过服务器 IP 访问；可通过环境变量覆盖
const HOST = process.env.HOST || "0.0.0.0";

app.use(express.json());

// HTTP 请求日志
app.use(httpLoggerMiddleware);

// 如果需要让前端或其它域名访问 API，可以启用 CORS（按需配置）
// 在严格生产环境下，请把 origin 限制为你的前端域名
if (process.env.ENABLE_CORS === "true") {
  app.use(cors());
}

app.use("/home", userRoute);
app.use("/login", loginRoute);
app.use("/file", imageRoute);
app.use("/update", updateExpressRoute);
app.use("/news", newsRoute);
// 将 uploads 文件夹公开为静态资源
const uploadDir = path.join(__dirname, "../uploads"); // 确保路径正确
app.use("/uploads", express.static(uploadDir));

/*
  如果你要在同一台服务器上通过 Express 同时提供前端（dist），
  请先在项目根运行 `pnpm run build`，然后把 dist 放到项目根下。
  下面把 dist 目录当作静态资源目录来提供，并在 SPA 模式下作回退到 index.html。
*/
const DIST_PATH = path.join(__dirname, "../dist");
import fs from "fs";
if (fs.existsSync(DIST_PATH)) {
  app.use(express.static(DIST_PATH));
  // SPA 回退 — 仅在没有匹配到其他路由时返回 index.html
  app.get("*", (req, res, next) => {
    // 如果请求是以 /api 或其它后端路由开头，交给后面的路由处理
    // 这里我们假设后端路由都已定义（/home /login /file 等）
    res.sendFile(path.join(DIST_PATH, "index.html"));
  });
}

app.get("/", (req, res) => {
  res.send("Hello World!");
});

// 统一错误日志
app.use((err, req, res, next) => {
  logger.error(err);
  res.status(500).json({ message: "Internal Server Error" });
});

app.listen(PORT, HOST, () => {
  logger.info(`Server running at http://${HOST}:${PORT}`);
});
