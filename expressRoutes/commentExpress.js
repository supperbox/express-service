import express from "express";
import mongoose from "../db/db.js";

import CommentModel from "../db/comments.js";
import { authMiddleware } from "./loginExpress.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Comments
 *   description: 博客评论接口
 */

function toInt(value, fallback) {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function normalizeString(value) {
  return String(value ?? "").trim();
}

function generateAnonymousName() {
  const num = Math.floor(Math.random() * 10000);
  return `热心网友${String(num).padStart(4, "0")}`;
}

/**
 * @swagger
 * /comment/list:
 *   get:
 *     summary: 获取某篇文章的评论列表
 *     tags: [Comments]
 *     parameters:
 *       - in: query
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: 文章 slug（对应 /blog/[slug]）
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: pageSize
 *         required: false
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: 返回评论列表
 */
router.get("/list", async (req, res, next) => {
  try {
    const slug = normalizeString(req.query.slug);
    if (!slug) return res.status(400).json({ message: "slug 不能为空" });

    const page = toInt(req.query.page, 1);
    const pageSize = Math.min(toInt(req.query.pageSize, 20), 50);
    const skip = (page - 1) * pageSize;

    const filter = { postSlug: slug, status: "approved" };

    const [items, total] = await Promise.all([
      CommentModel.find(filter)
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      CommentModel.countDocuments(filter),
    ]);

    res.json({ items, total, page, pageSize });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /comment/create:
 *   post:
 *     summary: 创建评论
 *     tags: [Comments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [slug, content]
 *             properties:
 *               slug:
 *                 type: string
 *               content:
 *                 type: string
 *               authorName:
 *                 type: string
 *               parentId:
 *                 type: string
 *                 description: 回复某条评论时传入（可选）
 *     responses:
 *       200:
 *         description: 创建成功
 */
router.post("/create", async (req, res, next) => {
  try {
    const slug = normalizeString(req.body.slug);
    const content = normalizeString(req.body.content);
    const authorNameRaw = normalizeString(req.body.authorName);
    const parentIdRaw = normalizeString(req.body.parentId);

    if (!slug) return res.status(400).json({ message: "slug 不能为空" });
    if (!content) return res.status(400).json({ message: "content 不能为空" });

    if (content.length > 2000)
      return res.status(400).json({ message: "content 过长" });

    const authorName = authorNameRaw || generateAnonymousName();
    if (authorName.length > 40)
      return res.status(400).json({ message: "authorName 过长" });

    let parentId = null;
    if (parentIdRaw) {
      if (!mongoose.Types.ObjectId.isValid(parentIdRaw)) {
        return res.status(400).json({ message: "parentId 不合法" });
      }
      parentId = new mongoose.Types.ObjectId(parentIdRaw);
    }

    const created = await CommentModel.create({
      postSlug: slug,
      content,
      authorName,
      parentId,
      // 生产环境可改为 pending 并做审核
      status: "approved",
      ip: req.ip ?? "",
      userAgent: req.headers["user-agent"] ?? "",
    });

    res.json({ message: "评论创建成功", item: created });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /comment/{id}:
 *   delete:
 *     summary: 删除评论（需要登录）
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 删除成功
 */
router.delete("/:id", authMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "id 不合法" });
    }

    const result = await CommentModel.deleteOne({ _id: id });
    res.json({ message: "删除成功", result });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /comment/{id}/status:
 *   patch:
 *     summary: 更新评论状态（需要登录）
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [approved, pending, spam]
 *     responses:
 *       200:
 *         description: 更新成功
 */
router.patch("/:id/status", authMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;
    const status = normalizeString(req.body.status);
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "id 不合法" });
    }
    if (!["approved", "pending", "spam"].includes(status)) {
      return res.status(400).json({ message: "status 不合法" });
    }

    const updated = await CommentModel.findByIdAndUpdate(
      id,
      { status },
      { new: true },
    );
    res.json({ message: "更新成功", item: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
