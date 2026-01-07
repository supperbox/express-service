import fs from "fs";
import path from "path";
import util from "util";
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import morgan from "morgan";

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

const LOG_DIR = process.env.LOG_DIR
  ? path.resolve(process.env.LOG_DIR)
  : path.join(process.cwd(), "logs");

ensureDir(LOG_DIR);

const LOG_LEVEL =
  process.env.LOG_LEVEL ||
  (process.env.NODE_ENV === "production" ? "info" : "debug");

const baseFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
  winston.format.errors({ stack: true }),
  winston.format.printf((info) => {
    const meta = info.stack || info.message;
    return `${info.timestamp} [${info.level}] ${meta}`;
  })
);

export const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: baseFormat,
  transports: [
    new winston.transports.Console(),
    new DailyRotateFile({
      dirname: LOG_DIR,
      filename: "app-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxFiles: process.env.LOG_MAX_FILES || "14d",
      zippedArchive: true,
    }),
    new DailyRotateFile({
      dirname: LOG_DIR,
      filename: "error-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      level: "error",
      maxFiles: process.env.LOG_MAX_FILES || "14d",
      zippedArchive: true,
    }),
  ],
});

export function installConsoleRedirect() {
  const original = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug
      ? console.debug.bind(console)
      : console.log.bind(console),
  };

  function formatArgs(args) {
    return util.format(...args);
  }

  console.log = (...args) => {
    logger.info(formatArgs(args));
  };

  console.info = (...args) => {
    logger.info(formatArgs(args));
  };

  console.warn = (...args) => {
    logger.warn(formatArgs(args));
  };

  console.error = (...args) => {
    logger.error(formatArgs(args));
  };

  console.debug = (...args) => {
    logger.debug(formatArgs(args));
  };

  return () => {
    console.log = original.log;
    console.info = original.info;
    console.warn = original.warn;
    console.error = original.error;
    console.debug = original.debug;
  };
}

export const httpLoggerMiddleware = morgan(
  ":remote-addr :method :url :status :res[content-length] - :response-time ms",
  {
    stream: {
      write: (message) => logger.info(`[HTTP] ${message.trim()}`),
    },
  }
);
