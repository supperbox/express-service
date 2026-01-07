import express from "express";
const router = express.Router();
import { execFile } from "child_process";
import fs from "fs";
const fsPromises = fs.promises;
import path from "path";
import { fileURLToPath } from "url";

// ESM 中获取 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 简要说明：
// - 设置环境变量 WEBHOOK_SECRET（必需）用于验证请求。
// - 设置环境变量 UPDATE_SCRIPT_PATH 指定要执行的脚本（可执行文件），默认位于项目 scripts/update.sh。
// - 前端/CI 在触发请求时需在 header 中带上 x-webhook-token 或在 body/query 中带 token。
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "update_my_express";

// 支持：在本地开发环境触发 PowerShell 脚本以便测试；在生产环境使用真实的 update.sh

console.log("当前环境", process.env.NODE_ENV);

const isProduction = process.env.NODE_ENV === "production";

// 默认本地 PowerShell 脚本路径
const DEFAULT_LOCAL_POWERSHELL = path.join(
  __dirname,
  "..",
  "..",
  "scripts",
  "test-update.ps1"
);

// 脚本路径
let PROD_UPDATE_SCRIPT = path.join(
  __dirname,
  "..",
  "..",
  "scripts",
  "update.sh"
);
// 如果用户通过环境变量传入了相对路径（例如 "./scripts/update.sh"），
// 则基于本模块的上上级目录解析为绝对路径，避免 execFile spawn 出现 ENOENT
if (!path.isAbsolute(PROD_UPDATE_SCRIPT)) {
  PROD_UPDATE_SCRIPT = path.resolve(__dirname, "..", "..", PROD_UPDATE_SCRIPT);
}

const LOCAL_POWERSHELL_SCRIPT =
  process.env.UPDATE_SCRIPT_LOCAL || DEFAULT_LOCAL_POWERSHELL;

// 最终执行命令及参数（execFile 用）
let execCommand; // 可执行文件或可执行命令（例如 'powershell'）
let execArgs = [];
if (isProduction) {
  execCommand = PROD_UPDATE_SCRIPT;
  execArgs = [];
} else {
  // 本地开发：使用 PowerShell 执行 .ps1 脚本（兼容 Windows）
  execCommand = "powershell";
  execArgs = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    LOCAL_POWERSHELL_SCRIPT,
  ];
}

const MAX_OUTPUT_CHARS = 10000;
const SCRIPT_TIMEOUT_MS = 5 * 60 * 1000; // 5 分钟

function truncateOutput(s) {
  if (!s) return "";
  if (s.length > MAX_OUTPUT_CHARS)
    return s.slice(0, MAX_OUTPUT_CHARS) + "\n...[truncated]";
  return s;
}

router.post("/updateExpress", async (req, res) => {
  try {
    const args = [];

    // 执行脚本（execFile 更安全，不经过 shell）
    // 注意：如果本地使用 PowerShell，则 execCommand = 'powershell' 且 execArgs 在上方已包含 ps1 路径
    const finalArgs = execArgs.concat(args);

    console.log("执行脚本:", execCommand, "参数", finalArgs);

    execFile(
      execCommand,
      finalArgs,
      { timeout: SCRIPT_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          console.error("Update script error:", err);
          return res.status(500).json({
            success: false,
            message: "Update script execution failed",
            error: err && err.message,
            stdout: truncateOutput(stdout),
            stderr: truncateOutput(stderr),
          });
        }

        return res.json({
          success: true,
          message: "Update script executed",
          stdout: truncateOutput(stdout),
          stderr: truncateOutput(stderr),
        });
      }
    );
  } catch (e) {
    console.error("Unexpected error in /updateExpress:", e);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: e && e.message });
  }
});

// 更新博客项目；
router.post("/updateBlog", async (req, res) => {
  try {
    const args = [];

    // updateBlog.sh 为 bash 脚本：
    // - 直接 execFile(script) 依赖脚本可执行位，且在 noexec 挂载/权限漂移时会触发 EACCES
    // - 通过 bash 执行可避免上述问题（bash 读取脚本文件即可）
    // 另外：不要复用上方用于 Windows PowerShell 的 execArgs
    if (!isProduction) {
      return res.status(400).json({
        success: false,
        message: "updateBlog only supports production (bash) environment",
      });
    }

    const scriptPath = path.resolve(
      __dirname,
      "..",
      "..",
      "scripts",
      "updateBlog.sh"
    );

    const finalArgs = [scriptPath].concat(args);
    console.log("执行脚本(bash):", "bash", "参数", finalArgs);

    execFile(
      "bash",
      finalArgs,
      { timeout: SCRIPT_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          console.error("Update script error:", err);
          return res.status(500).json({
            success: false,
            message: "Update script execution failed",
            error: err && err.message,
            stdout: truncateOutput(stdout),
            stderr: truncateOutput(stderr),
          });
        }

        return res.json({
          success: true,
          message: "Update script executed",
          stdout: truncateOutput(stdout),
          stderr: truncateOutput(stderr),
        });
      }
    );
  } catch (e) {
    console.error("Unexpected error in /updateExpress:", e);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: e && e.message });
  }
});

export default router;
