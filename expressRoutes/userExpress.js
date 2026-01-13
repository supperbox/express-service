import express from "express";
import model from "../db/User.js";
import { authMiddleware } from "./loginExpress.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: 用户信息管理接口
 */

/**
 * @swagger
 * /home/userInfo/getAllUserInfo:
 *   get:
 *     summary: 获取所有用户信息
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: 返回所有用户信息
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   age:
 *                     type: integer
 *                   interests:
 *                     type: array
 *                     items:
 *                       type: string
 */
router.get("/userInfo/getAllUserInfo", async (req, res) => {
  let data = await model.find();
  // console.log("查询所有数据:", data);
  res.send(data);
});

/**
 * @swagger
 * /home/userInfo/new:
 *   post:
 *     summary: 创建新用户
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: 用户姓名
 *               age:
 *                 type: integer
 *                 description: 用户年龄
 *               interests:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 用户兴趣
 *     responses:
 *       200:
 *         description: 用户创建成功
 */
router.post("/userInfo/new", async (req, res) => {
  let { name, age, interests } = req.body;
  console.log("数据主体:", req.body);
  let newUser = model.create({ name, age, interests });
  // newUser.save()
  res.json({ message: "创建新用户", user: newUser });
});

/**
 * @swagger
 * /home/userInfo/edit:
 *   post:
 *     summary: 编辑用户信息
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: 用户 ID
 *               name:
 *                 type: string
 *                 description: 用户姓名
 *               age:
 *                 type: integer
 *                 description: 用户年龄
 *               interests:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 用户兴趣
 *     responses:
 *       200:
 *         description: 用户信息更新成功
 */
router.post("/userInfo/edit", async (req, res) => {
  let { id, name, age, interests } = req.body;
  console.log("编辑数据主体:", req.body);
  let updatedUser = await model.findOneAndUpdate(
    { id: id },
    { name, age, interests },
    { new: true }
  );
  res.json({ message: "用户信息已更新", user: updatedUser });
});

/**
 * @swagger
 * /home/userInfo/delete:
 *   post:
 *     summary: 删除用户
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: 用户 ID
 *     responses:
 *       200:
 *         description: 用户删除成功
 */
router.post("/userInfo/delete", async (req, res) => {
  console.log("删除数据主体:", req.body);
  let { id } = req.body;
  let deletedUser = await model.deleteOne({
    id: id,
  });
  res.json({ message: "用户已删除", user: deletedUser });
});

export default router;
