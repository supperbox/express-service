import mongoose from "mongoose";

// 通过环境变量配置连接串；不设置时使用本机 MongoDB（建议在生产中务必设置 MONGODB_URI）
const DEFAULT_URI = "mongodb://jlw:wsjlw-12@127.0.0.1:27017/userInfo";
const MONGODB_URI = process.env.MONGODB_URI || DEFAULT_URI;

// readyState: 0=disconnected,1=connected,2=connecting,3=disconnecting
export function getMongoState() {
  return {
    uri: MONGODB_URI,
    readyState: mongoose.connection.readyState,
    readyStateLabel: [
      "disconnected",
      "connected",
      "connecting",
      "disconnecting",
    ][mongoose.connection.readyState] || "unknown",
  };
}

let connectPromise = null;
let reconnectTimer = null;

function scheduleReconnect(reason) {
  const retryMs = Number.parseInt(process.env.MONGODB_RETRY_MS || "5000", 10);
  if (!Number.isFinite(retryMs) || retryMs <= 0) return;
  if (reconnectTimer) return;

  console.warn(
    `MongoDB reconnect scheduled in ${retryMs}ms${reason ? ` (${reason})` : ""}`
  );
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connectMongo().catch(() => {
      // 失败会在 connectMongo 内部记录；这里不再重复
      scheduleReconnect("connect failed");
    });
  }, retryMs);
}

export async function connectMongo() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connectPromise) return connectPromise;

  // 关键：避免在未连接时把查询缓冲 10s 后才超时（直接快速失败更可控）
  mongoose.set("bufferCommands", false);

  connectPromise = mongoose
    .connect(MONGODB_URI, {
      // 让“连不上库”更快暴露，而不是卡很久
      serverSelectionTimeoutMS: Number.parseInt(
        process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || "5000",
        10
      ),
      connectTimeoutMS: Number.parseInt(
        process.env.MONGODB_CONNECT_TIMEOUT_MS || "5000",
        10
      ),
    })
    .then((m) => {
      console.log(
        `MongoDB connected (db=${m.connection?.db?.databaseName || "unknown"})`
      );
      return m.connection;
    })
    .catch((err) => {
      console.error("MongoDB connect failed:", err);
      scheduleReconnect(err?.message || "unknown");
      throw err;
    })
    .finally(() => {
      connectPromise = null;
    });

  return connectPromise;
}

const db = mongoose.connection;
db.on("error", (err) => {
  console.error("MongoDB connection error:", err);
});
db.on("disconnected", () => {
  console.warn("MongoDB disconnected");
  scheduleReconnect("disconnected");
});
db.on("connected", () => {
  // connected 事件可能比 open 更早
  try {
    console.log(`MongoDB connected event (db=${db.db?.databaseName || "unknown"})`);
  } catch {
    console.log("MongoDB connected event");
  }
});
db.once("open", () => {
  console.log("MongoDB connection open");
});

export default mongoose;
