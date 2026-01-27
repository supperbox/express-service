import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import Client from "ssh2-sftp-client";
import fs from "fs";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PRIVATE_KEY_PATH =
  process.env.HTML_SFTP_PRIVATE_KEY_PATH ||
  process.env.SFTP_PRIVATE_KEY_PATH ||
  "";
const PRIVATE_KEY = PRIVATE_KEY_PATH
  ? fs.readFileSync(PRIVATE_KEY_PATH, "utf8")
  : undefined;

// 远程服务器配置（建议用环境变量配置，避免明文写在代码里）
const SERVER_CONFIG = {
  host: process.env.HTML_SFTP_HOST || process.env.SFTP_HOST || "115.190.184.29",
  port: Number(process.env.HTML_SFTP_PORT || process.env.SFTP_PORT || 22),
  username:
    process.env.HTML_SFTP_USERNAME || process.env.SFTP_USERNAME || "root",
  password:
    process.env.HTML_SFTP_PASSWORD || process.env.SFTP_PASSWORD || "wsjlw-12",
  privateKey: PRIVATE_KEY,
  passphrase: process.env.HTML_SFTP_PASSPHRASE || process.env.SFTP_PASSPHRASE,
  readyTimeout: 20000,
};

// 远程目录：默认 /var/www/resource/html
const REMOTE_HTML_DIR =
  process.env.HTML_REMOTE_DIR ||
  process.env.REMOTE_HTML_DIR ||
  "/var/www/resource/html";

// 可选：公开访问的 URL 前缀（例如 https://your-domain.com）
// 若不配置则仅返回 remotePath
const PUBLIC_BASE_URL = process.env.HTML_PUBLIC_BASE_URL || "";

async function ensureRemoteDir(sftp, remoteDir) {
  // ssh2-sftp-client: exists() 返回 false / '-' / 'd' / 'l'
  const exists = await sftp.exists(remoteDir);
  if (exists === "d") return;
  if (exists === "-") {
    throw new Error(`远程路径已存在但不是目录: ${remoteDir}`);
  }

  // recursive=true 会递归创建父目录
  await sftp.mkdir(remoteDir, true);
}

function decodeOriginalName(originalname) {
  try {
    return Buffer.from(originalname, "latin1").toString("utf8");
  } catch {
    return originalname;
  }
}

function sanitizeBaseName(name) {
  // 去除非法文件名字符（Windows/Linux 通用保守处理）
  const replaced = name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return replaced || "index";
}

// 直接将文件读入内存，再通过 SFTP 上传到远端
const storage = multer.memoryStorage();

function isHtmlFile(file) {
  const originalName = decodeOriginalName(file.originalname);
  const ext = path.extname(originalName).toLowerCase();

  // 部分浏览器/系统会把 html 当成 application/octet-stream，这里优先信任扩展名
  const extOk = ext === ".html" || ext === ".htm";
  const mimeOk =
    file.mimetype === "text/html" ||
    file.mimetype === "application/xhtml+xml" ||
    file.mimetype === "application/octet-stream";

  return extOk && mimeOk;
}

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (!isHtmlFile(file)) {
      cb(new Error("仅允许上传 .html/.htm 文件"));
      return;
    }
    cb(null, true);
  },
});

/**
 * POST /html/upload
 * form-data: file=<html>
 * 返回：保存后的文件名与可访问 URL（/uploads/html/...）
 */
router.post("/upload", upload.single("file"), async (req, res) => {
  const sftp = new Client();
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "没有上传文件" });
    }

    const originalName = decodeOriginalName(req.file.originalname);
    const parsed = path.parse(originalName);
    const base = sanitizeBaseName(parsed.name);
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const filename = `${base}-${suffix}.html`;
    const remoteFilePath = path.posix.join(REMOTE_HTML_DIR, filename);

    if (!SERVER_CONFIG.host) {
      return res.status(500).json({
        success: false,
        message: "未配置 SFTP 主机地址，请设置 HTML_SFTP_HOST（或 SFTP_HOST）",
      });
    }

    if (!SERVER_CONFIG.password && !SERVER_CONFIG.privateKey) {
      return res.status(500).json({
        success: false,
        message:
          "未配置 SFTP 登录凭据，请设置 HTML_SFTP_PASSWORD 或 HTML_SFTP_PRIVATE_KEY_PATH",
      });
    }

    console.log("准备连接 SFTP 上传 HTML:", {
      host: SERVER_CONFIG.host,
      port: SERVER_CONFIG.port,
      username: SERVER_CONFIG.username,
      remoteFilePath,
      remoteDir: REMOTE_HTML_DIR,
      auth: SERVER_CONFIG.privateKey ? "privateKey" : "password",
    });

    try {
      await sftp.connect(SERVER_CONFIG);
    } catch (connErr) {
      console.error("SFTP 连接失败:", {
        message: connErr?.message,
        code: connErr?.code,
        level: connErr?.level,
        stack: connErr?.stack,
      });
      return res.status(500).json({
        success: false,
        message: "SFTP 连接失败，请检查服务器 SSH 配置与账号信息",
        ...(process.env.NODE_ENV !== "production"
          ? { details: { code: connErr?.code, level: connErr?.level } }
          : {}),
      });
    }

    try {
      // 确保远程目录存在（否则会出现 code=2: No such file）
      await ensureRemoteDir(sftp, REMOTE_HTML_DIR);
      await sftp.put(req.file.buffer, remoteFilePath);
    } catch (putErr) {
      console.error("SFTP 上传失败:", {
        message: putErr?.message,
        code: putErr?.code,
        level: putErr?.level,
        stack: putErr?.stack,
      });
      return res.status(500).json({
        success: false,
        message: `SFTP 上传失败（可能是远程目录不存在或无写入权限），请检查 ${REMOTE_HTML_DIR} 是否存在且可写`,
        ...(process.env.NODE_ENV !== "production"
          ? { details: { code: putErr?.code, level: putErr?.level } }
          : {}),
      });
    }

    const publicUrl = PUBLIC_BASE_URL
      ? `${PUBLIC_BASE_URL.replace(/\/$/, "")}/${encodeURIComponent(filename)}`
      : "";

    return res.json({
      success: true,
      message: "HTML 上传成功",
      file: {
        name: filename,
        originalName,
        size: req.file.size,
        mimeType: req.file.mimetype,
        remoteDir: REMOTE_HTML_DIR,
        remotePath: remoteFilePath,
        url: publicUrl,
        uploadTime: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("HTML 上传失败:", error);
    return res.status(500).json({ success: false, message: "HTML 上传失败" });
  } finally {
    sftp.end();
  }
});

// 该路由文件内的错误处理（multer/fileFilter）
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ success: false, message: "文件过大（最大 10MB）" });
    }
    return res.status(400).json({ success: false, message: err.message });
  }

  if (err?.message?.includes("仅允许上传")) {
    return res.status(400).json({ success: false, message: err.message });
  }

  return next(err);
});

export default router;
