import express from "express";
import loginModel from "../db/loginDB.js";
import jwt from "jsonwebtoken";

const router = express.Router();
const JWT_SECRET = "your_secret_key"; // 建议放到环境变量

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: 用户认证接口
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: 用户注册
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               account:
 *                 type: string
 *                 description: 用户账号
 *               password:
 *                 type: string
 *                 description: 用户密码
 *     responses:
 *       200:
 *         description: 注册成功
 *       401:
 *         description: 账号已存在
 */
router.post("/register", async (req, res) => {
  let { account, password } = req.body;
  console.log("注册数据主体:", req.body);

  let foundUser = await loginModel.findOne({ account });
  if (foundUser) {
    res.status(401).json({ message: "该账号已经存在" });
  } else {
    let newLogin = await loginModel.create({ account, password });
    // 注册成功后生成 token
    const token = jwt.sign(
      { account: newLogin.account, id: newLogin._id },
      JWT_SECRET,
      {
        expiresIn: "2h",
      }
    );
    res.json({ message: "创建新用户", user: newLogin, token });
  }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: 用户登录
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               account:
 *                 type: string
 *                 description: 用户账号
 *               password:
 *                 type: string
 *                 description: 用户密码
 *     responses:
 *       200:
 *         description: 登录成功
 *       401:
 *         description: 登录失败（账号不存在或密码错误）
 */
router.post("/login", async (req, res) => {
  let { account, password } = req.body;
  console.log("登录数据主体:", req.body);
  let findAcc = await loginModel.findOne({ account });
  if (!findAcc) {
    res.status(401).json({ message: "该账号不存在" });
    return;
  }
  let foundUser = await loginModel.findOne({ account, password });
  if (foundUser) {
    // 登录成功，生成 token
    const token = jwt.sign(
      { account: foundUser.account, id: foundUser._id },
      JWT_SECRET,
      {
        expiresIn: "2h",
      }
    );
    res.json({ message: "登录成功", user: foundUser, token });
  } else {
    res.status(401).json({ message: "账号或密码错误" });
  }
});

// JWT鉴权中间件示例
export function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token)
    return res.status(401).json({ message: "未登录请先登录", code: "reload" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ code: "reload", message: "token无效或已过期" });
  }
}

export default router;
