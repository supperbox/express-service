import express from "express";
import { execFile } from "child_process";
import path from "path";

const router = express.Router();

const SCRIPT_TIMEOUT_MS = 2 * 60 * 1000; // 5 分钟

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
