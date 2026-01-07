import express from "express";
import multer from "multer";
import path from "path";
import Client from "ssh2-sftp-client";
import sharp from "sharp";
import { fileURLToPath } from "url";
import File from "../db/images.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     File:
 *       type: object
 *       properties:
 *         serialNumber:
 *           type: integer
 *           description: 文件序列号
 *         name:
 *           type: string
 *           description: 文件名
 *         size:
 *           type: integer
 *           description: 文件大小(字节)
 *         path:
 *           type: string
 *           description: 远程文件路径
 *         uploadTime:
 *           type: string
 *           format: date-time
 *           description: 上传时间
 *         imageHeight:
 *           type: integer
 *           description: 图片高度
 */

/**
 * @swagger
 * tags:
 *   name: Files
 *   description: 图片文件管理接口
 */

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置 multer 内存存储
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 单文件100MB
    files: 500, // 最多500个文件
  },
});

// 云服务器配置（确保这里的信息和你用 ssh/sftp 登录时完全一致）
const SERVER_CONFIG = {
  host: "121.37.23.86",
  port: 22, // 注意使用数字而不是字符串
  username: "root",
  password: "wsjlw-12",
  // 如果服务器禁止密码登录，可以改用私钥：
  // privateKey: fs.readFileSync('f:/coder/Ts-mongoDb-express/keys/id_rsa'),
  // passphrase: '你的私钥密码，如果有的话',
};

const loadPath = "/var/www/images/fenwei/";

/**
 * @swagger
 * /file/upload:
 *   post:
 *     summary: 单文件上传
 *     description: 上传单个图片文件，支持自动压缩和同名检查
 *     tags: [Files]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: 图片文件
 *     responses:
 *       200:
 *         description: 上传成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 文件上传成功
 *                 file:
 *                   $ref: '#/components/schemas/File'
 *       400:
 *         description: 未上传文件
 *       409:
 *         description: 同名文件已存在
 *       500:
 *         description: 服务器错误
 */
// 单文件上传接口
router.post("/upload", upload.single("file"), async (req, res) => {
  const sftp = new Client();
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "没有上传文件" });
    }

    // 获取原始文件名并修改后缀为 .webp
    const originalName = Buffer.from(req.file.originalname, "latin1").toString(
      "utf8"
    );
    const nameWithoutExt = path.parse(originalName).name;
    const fileName = `${nameWithoutExt}.webp`;

    // 1. 同名检查：数据库中已有同名文件则直接拒绝
    const existed = await File.findOne({ fileName });
    if (existed) {
      return res.status(409).json({
        success: false,
        message: "同名图片已存在，已跳过上传",
        file: {
          serialNumber: existed.serialNumber,
          name: existed.fileName,
          size: existed.fileSize,
          path: existed.filePath,
          uploadTime: existed.uploadTime,
          imageHeight: existed.imageHeight,
        },
      });
    }

    const remoteFilePath = path.posix.join(loadPath, fileName);

    console.log("准备连接 SFTP 上传文件:", {
      host: SERVER_CONFIG.host,
      port: SERVER_CONFIG.port,
      username: SERVER_CONFIG.username,
      remoteFilePath,
    });

    try {
      await sftp.connect(SERVER_CONFIG);
      console.log("SFTP 连接成功");
    } catch (connErr) {
      console.error("SFTP 连接失败: ", connErr);
      console.error("SFTP 连接失败 level: ", connErr.level);
      return res.status(500).json({
        success: false,
        message: "SFTP 连接失败，请检查用户名、密码/密钥或服务器 SSH 配置",
      });
    }

    // 2. 强制转换为 WebP 格式
    let bufferToUpload;
    try {
      bufferToUpload = await sharp(req.file.buffer)
        .rotate()
        .resize({
          width: 1280,
          withoutEnlargement: true,
        })
        .webp({ quality: 45 })
        .toBuffer();

      console.log(
        `图片转换 WebP 完成: ${originalName} -> ${fileName}, 原大小=${req.file.size}B, 转换后=${bufferToUpload.length}B`
      );
    } catch (compressErr) {
      console.error("图片转换失败:", compressErr);
      return res.status(500).json({ success: false, message: "图片转换失败" });
    }

    await sftp.put(bufferToUpload, remoteFilePath);
    console.log("SFTP 上传成功:", remoteFilePath);

    const lastFile = await File.findOne().sort({ serialNumber: -1 });
    const serialNumber = lastFile ? lastFile.serialNumber + 1 : 1;
    const imageHeight = Math.floor(Math.random() * 350) + 350;

    const fileDoc = new File({
      serialNumber,
      fileName,
      filePath: remoteFilePath,
      fileSize: bufferToUpload.length,
      mimeType: "image/webp",
      imageHeight,
    });
    await fileDoc.save();

    res.json({
      success: true,
      message: "文件上传成功",
      file: {
        serialNumber: fileDoc.serialNumber,
        name: fileName,
        size: fileDoc.fileSize,
        path: remoteFilePath,
        uploadTime: fileDoc.uploadTime,
        imageHeight: fileDoc.imageHeight,
      },
    });
  } catch (error) {
    console.error("文件上传失败:", error);
    res.status(500).json({ success: false, message: "文件上传失败" });
  } finally {
    sftp.end();
  }
});

/**
 * @swagger
 * /file/upload-batch:
 *   post:
 *     summary: 批量文件上传
 *     description: 上传多个图片文件，支持自动压缩和同名跳过
 *     tags: [Files]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: 图片文件数组
 *     responses:
 *       200:
 *         description: 批量上传完成
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                 files:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/File'
 *                 skipped:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/File'
 *       500:
 *         description: 服务器错误
 */
// 批量文件上传接口
router.post("/upload-batch", upload.array("files", 500), async (req, res) => {
  const sftp = new Client();
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: "没有上传文件" });
    }

    console.log("准备连接 SFTP 进行批量上传:", {
      host: SERVER_CONFIG.host,
      port: SERVER_CONFIG.port,
      username: SERVER_CONFIG.username,
    });

    try {
      await sftp.connect(SERVER_CONFIG);
      console.log("SFTP 连接成功（批量上传）");
    } catch (connErr) {
      console.error("SFTP 连接失败（批量上传）:", connErr);
      console.error("SFTP 连接失败 level: ", connErr.level);
      return res.status(500).json({
        success: false,
        message: "SFTP 连接失败，请检查用户名、密码/密钥或服务器 SSH 配置",
      });
    }

    const lastFile = await File.findOne().sort({ serialNumber: -1 });
    let currentSerial = lastFile ? lastFile.serialNumber : 0;

    const uploadedFiles = [];
    const skippedFiles = [];

    for (const file of req.files) {
      const originalName = Buffer.from(file.originalname, "latin1").toString(
        "utf8"
      );
      const nameWithoutExt = path.parse(originalName).name;
      const fileName = `${nameWithoutExt}.webp`;

      // 1. 批量同名检查：已存在则跳过
      const existed = await File.findOne({ fileName });
      if (existed) {
        console.log(`批量上传跳过同名文件: ${fileName}`);
        skippedFiles.push({
          serialNumber: existed.serialNumber,
          name: existed.fileName,
          size: existed.fileSize,
          path: existed.filePath,
          uploadTime: existed.uploadTime,
          imageHeight: existed.imageHeight,
        });
        continue;
      }

      const remoteFilePath = path.posix.join(loadPath, fileName);

      // 2. 批量转换为 WebP
      let bufferToUpload;
      try {
        bufferToUpload = await sharp(file.buffer)
          .rotate()
          .resize({ width: 1280, withoutEnlargement: true })
          .webp({ quality: 75 })
          .toBuffer();

        console.log(`批量转换 WebP: ${originalName} -> ${fileName}`);
      } catch (compressErr) {
        console.warn(
          `图片转换失败（${originalName}），跳过此文件:`,
          compressErr
        );
        continue;
      }

      await sftp.put(bufferToUpload, remoteFilePath);
      console.log("SFTP 上传成功:", remoteFilePath);

      currentSerial += 1;
      const imageHeight = Math.floor(Math.random() * 500) + 200;

      const fileDoc = new File({
        serialNumber: currentSerial,
        fileName,
        filePath: remoteFilePath,
        fileSize: bufferToUpload.length,
        mimeType: "image/webp",
        imageHeight,
      });
      await fileDoc.save();

      uploadedFiles.push({
        serialNumber: fileDoc.serialNumber,
        name: fileName,
        size: fileDoc.fileSize,
        path: remoteFilePath,
        uploadTime: fileDoc.uploadTime,
        imageHeight: fileDoc.imageHeight,
      });
    }

    res.json({
      success: true,
      message: `成功上传 ${uploadedFiles.length} 个文件，跳过 ${skippedFiles.length} 个同名文件`,
      files: uploadedFiles,
      skipped: skippedFiles,
    });
  } catch (error) {
    console.error("批量上传失败:", error);
    res.status(500).json({ success: false, message: "批量上传失败" });
  } finally {
    sftp.end();
  }
});

/**
 * @swagger
 * /file/delete/{identifier}:
 *   delete:
 *     summary: 删除文件
 *     description: 根据序列号或文件名删除文件（同时删除数据库记录和远程文件）
 *     tags: [Files]
 *     parameters:
 *       - in: path
 *         name: identifier
 *         schema:
 *           type: string
 *         required: true
 *         description: 文件序列号或文件名
 *     responses:
 *       200:
 *         description: 删除成功
 *       404:
 *         description: 文件不存在
 *       500:
 *         description: 服务器错误
 */
// 删除文件接口（同时删除数据库记录和云服务器文件）
router.delete("/delete/:identifier", async (req, res) => {
  const sftp = new Client();
  try {
    const identifier = req.params.identifier;
    let fileDoc;

    // 判断是序列号还是文件名
    if (/^\d+$/.test(identifier)) {
      fileDoc = await File.findOne({ serialNumber: parseInt(identifier) });
    } else {
      fileDoc = await File.findOne({ fileName: identifier });
    }

    if (!fileDoc) {
      return res.status(404).json({ success: false, message: "文件不存在" });
    }

    console.log("准备连接 SFTP 删除远程文件:", {
      host: SERVER_CONFIG.host,
      port: SERVER_CONFIG.port,
      username: SERVER_CONFIG.username,
      remoteFilePath: fileDoc.filePath,
    });

    try {
      await sftp.connect(SERVER_CONFIG);
      console.log("SFTP 连接成功（删除）");
      await sftp.delete(fileDoc.filePath);
      console.log("远程文件删除成功:", fileDoc.filePath);
    } catch (err) {
      console.warn(
        "远程文件删除失败或不存在:",
        err.message,
        " level:",
        err.level
      );
    } finally {
      sftp.end();
    }

    await File.deleteOne({ _id: fileDoc._id });

    res.json({ success: true, message: "文件删除成功" });
  } catch (error) {
    console.error("文件删除失败:", error);
    res.status(500).json({ success: false, message: "文件删除失败" });
  }
});

/**
 * @swagger
 * /file/list:
 *   get:
 *     summary: 获取文件列表
 *     description: 分页获取上传的文件列表
 *     tags: [Files]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 页码
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 每页数量
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     files:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/File'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         pageSize:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *       500:
 *         description: 服务器错误
 */
// 获取文件列表接口（支持分页）
router.get("/list", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const skip = (page - 1) * pageSize;

    const total = await File.countDocuments();
    const files = await File.find()
      .sort({ uploadTime: -1 })
      .skip(skip)
      .limit(pageSize);

    res.json({
      success: true,
      data: {
        files: files.map((file) => ({
          serialNumber: file.serialNumber,
          name: file.fileName,
          size: file.fileSize,
          path: file.filePath,
          uploadTime: file.uploadTime,
          mimeType: file.mimeType,
          imageHeight: file.imageHeight,
        })),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    console.error("获取文件列表失败:", error);
    res.status(500).json({ success: false, message: "获取文件列表失败" });
  }
});

export default router;
