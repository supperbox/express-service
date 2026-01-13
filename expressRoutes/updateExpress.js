import express from "express";
import { execFile } from "child_process";
import path from "path";

const router = express.Router();

const SCRIPT_TIMEOUT_MS = 3 * 60 * 1000; // 5 分钟
/**
 * @swagger
 * /update/updateExpress:
 *   post:
 *     summary: 执行 updateExpress.sh 脚本以更新 Express 服务
 *     tags: [Update]
 *     responses:
 *       200:
 *         description: 脚本执行成功，并返回 stdout/stderr
 *       500:
 *         description: 执行失败
 */
router.post("/updateExpress", (req, res) => {
  const scriptPath = path.resolve(
    "/var/www/service-deploy-scripts",
    "updateExpress.sh"
  );
  execFile(
    "bash",
    [scriptPath],
    { timeout: SCRIPT_TIMEOUT_MS },
    (err, stdout, stderr) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Execution failed",
          error: err.message,
        });
      }
      res.json({ success: true, stdout, stderr });
    }
  );
});

/**
 * @swagger
 * /update/updateBlog:
 *   post:
 *     summary: 执行 updateBlog.sh 脚本以更新博客内容
 *     tags: [Update]
 *     responses:
 *       200:
 *         description: 脚本执行成功，并返回 stdout/stderr
 *       500:
 *         description: 执行失败
 */
router.post("/updateBlog", (req, res) => {
  const scriptPath = path.resolve(
    "/var/www/service-deploy-scripts",
    "updateBlog.sh"
  );
  execFile(
    "bash",
    [scriptPath],
    { timeout: SCRIPT_TIMEOUT_MS },
    (err, stdout, stderr) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Execution failed",
          error: err.message,
        });
      }
      res.json({ success: true, stdout, stderr });
    }
  );
});

/**
 * @swagger
 * /update/updateImageVue:
 *   post:
 *     summary: 执行 updateImageVue.sh 脚本以更新图片前端
 *     tags: [Update]
 *     responses:
 *       200:
 *         description: 脚本执行成功，并返回 stdout/stderr
 *       500:
 *         description: 执行失败
 */
router.post("/updateImageVue", (req, res) => {
  const scriptPath = path.resolve(
    "/var/www/service-deploy-scripts",
    "updateImageVue.sh"
  );
  execFile(
    "bash",
    [scriptPath],
    { timeout: SCRIPT_TIMEOUT_MS },
    (err, stdout, stderr) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Execution failed",
          error: err.message,
        });
      }
      res.json({ success: true, stdout, stderr });
    }
  );
});

/**
 * @swagger
 * /update/updateServiceDeploy:
 *   post:
 *     summary: 执行 updateScript.sh 脚本以部署服务脚本
 *     tags: [Update]
 *     responses:
 *       200:
 *         description: 脚本执行成功，并返回 stdout/stderr
 *       500:
 *         description: 执行失败
 */
router.post("/updateServiceDeploy", (req, res) => {
  const scriptPath = path.resolve(
    "/var/www/service-deploy-scripts",
    "updateScript.sh"
  );
  execFile(
    "bash",
    [scriptPath],
    { timeout: SCRIPT_TIMEOUT_MS },
    (err, stdout, stderr) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Execution failed",
          error: err.message,
        });
      }
      res.json({ success: true, stdout, stderr });
    }
  );
});

export default router;
