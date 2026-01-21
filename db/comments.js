import mongoose from "./db.js";

const commentSchema = new mongoose.Schema(
  {
    postSlug: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    authorName: {
      type: String,
      required: true,
      trim: true,
      default: () => {
        const num = Math.floor(Math.random() * 10000);
        return `热心网友${String(num).padStart(4, "0")}`;
      },
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    status: {
      type: String,
      enum: ["approved", "pending", "spam"],
      default: "approved",
      index: true,
    },
    ip: {
      type: String,
      default: "",
    },
    userAgent: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "comments",
  },
);

commentSchema.index({ postSlug: 1, createdAt: -1 });

const CommentModel = mongoose.model("comments", commentSchema);

export default CommentModel;
