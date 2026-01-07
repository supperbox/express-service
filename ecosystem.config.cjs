// 尝试加载 dotenv，但如果未安装则不抛出错误（避免 pm2 在全局上下文中 require 失败）
try {
  require("dotenv").config(); // 加载 .env 文件（可选）
} catch (e) {
  // dotenv 未安装或不可用；继续运行，.env 将不会被自动加载
}

// PM2 配置文件（使用绝对路径，避免被错误工作目录影响）
const path = require("path");
const ROOT_DIR = path.resolve(__dirname); // /var/www/express/Ts-mongoDb-express/server
module.exports = {
  apps: [
    {
      name: "ei",
      script: path.join(ROOT_DIR, "server.js"),
      cwd: ROOT_DIR,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3008,
        HOST: "0.0.0.0",
        // ENABLE_CORS: process.env.ENABLE_CORS || "false",
        // WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,
        // UPDATE_SCRIPT_PATH:
        //   process.env.UPDATE_SCRIPT_PATH || "./scripts/update.sh",
        PM2_APP_NAME: "ei",
      },
    },
  ],
};
