# express-service

一个基于 **Express 5（ESM）+ MongoDB(Mongoose)** 的后端服务，包含：

- 用户信息 CRUD
- 登录/注册（JWT）
- 图片上传（Multer 内存上传 → Sharp 转 WebP → SFTP 上传到远程服务器，同时写入 MongoDB）
- 远程更新触发（执行脚本）
- 新闻聚合与详情抓取（含 SSRF 基础防护）
- 统一日志（Winston + DailyRotateFile）

> Node 版本要求见 [package.json](package.json) 的 `engines`（Node `^20.19.0 || >=22.12.0`）。

---

## 目录结构

- [server.js](server.js)：服务入口（注册路由、中间件、静态资源、日志等）
- [expressRoutes/](expressRoutes/)：路由实现
  - [expressRoutes/userExpress.js](expressRoutes/userExpress.js)：用户信息接口（挂载到 `/home`）
  - [expressRoutes/loginExpress.js](expressRoutes/loginExpress.js)：登录/注册接口（挂载到 `/login`）
  - [expressRoutes/imageExpress.js](expressRoutes/imageExpress.js)：图片上传/列表/删除（挂载到 `/file`）
  - [expressRoutes/updateExpress.js](expressRoutes/updateExpress.js)：触发更新脚本（挂载到 `/update`）
  - [expressRoutes/newsExpress.js](expressRoutes/newsExpress.js)：新闻聚合/详情（挂载到 `/news`）
- [db/](db/)：Mongoose 连接与数据模型
- [utils/logger.js](utils/logger.js)：日志（console 重定向、HTTP 日志、按天滚动）
- [ecosystem.config.cjs](ecosystem.config.cjs)：PM2 配置
- [swagger.js](swagger.js)：Swagger 生成/挂载（当前入口未启用，见下文）

---

## 快速开始

### 1) 安装依赖

使用 `pnpm`：

```bash
pnpm install
```

### 2) 环境变量

项目根目录已有 [.env](.env) 示例配置，可按需调整：

- `HOST`：监听地址（默认 `0.0.0.0`）
- `PORT`：端口（默认 `3008`）
- `ENABLE_CORS`：是否启用 CORS（`true/false`）

日志相关（可选）：

- `LOG_DIR`：日志目录（默认 `./logs`）
- `LOG_LEVEL`：日志级别（默认开发 `debug`，生产 `info`）
- `LOG_MAX_FILES`：日志保留时间/数量（默认 `14d`）

> 注意：当前代码里仍存在部分“硬编码配置”（MongoDB 连接串 / SFTP 登录 / JWT secret 等），详见「安全说明」。

### 3) 本地启动（开发）

```bash
pnpm run node
```

默认启动后：

- 服务地址：`http://HOST:PORT`（例如 `http://localhost:3008`）
- 健康检查：`GET /` 返回 `Hello World!`

### 4) 使用 PM2 启动（更偏生产）

需先全局安装 pm2：

```bash
npm i -g pm2
```

启动/停止/重启：

```bash
pnpm run start
pnpm run stop
pnpm run restart
```

PM2 配置见 [ecosystem.config.cjs](ecosystem.config.cjs)。

---

## 路由与接口

服务入口在 [server.js](server.js)，路由挂载如下：

- `/home` → 用户信息
- `/login` → 认证
- `/file` → 图片文件
- `/update` → 更新脚本
- `/news` → 新闻

### 用户信息（/home）

来自 [expressRoutes/userExpress.js](expressRoutes/userExpress.js)：

- `GET /home/userInfo/getAllUserInfo`：获取全部用户
- `POST /home/userInfo/new`：创建用户
  - body：`{ "name": string, "age": number, "interests": string[] }`
- `POST /home/userInfo/edit`：编辑用户
  - body：`{ "id": string, "name": string, "age": number, "interests": string[] }`
- `POST /home/userInfo/delete`：删除用户
  - body：`{ "id": string }`

> 备注：当前 `edit/delete` 用的是 `{ id: id }` 作为查询条件；而 `User` schema 定义的是 `name/age/interests`，`id` 字段是否存在取决于你实际写入的数据（schema `strict: false` 允许额外字段）。

### 认证（/login）

来自 [expressRoutes/loginExpress.js](expressRoutes/loginExpress.js)：

- `POST /login/register`：注册
  - body：`{ "account": string, "password": string }`
  - 成功返回 `token`
- `POST /login/login`：登录
  - body：`{ "account": string, "password": string }`
  - 成功返回 `token`

鉴权中间件：`Authorization: Bearer <token>`（见 `authMiddleware`）。

### 图片文件（/file）

来自 [expressRoutes/imageExpress.js](expressRoutes/imageExpress.js)：

- `POST /file/upload`：单文件上传（字段名 `file`）
  - 上传后会转为 `.webp` 并上传到远示服务器，再写入 MongoDB
  - 同名文件会返回 `409` 并跳过上传
- `POST /file/upload-batch`：批量上传（字段名 `files`，最多 500）
- `GET /file/list?page=1&pageSize=20`：分页列表
- `DELETE /file/delete/:identifier`：删除（`:identifier` 可为 `serialNumber` 或 `fileName`）

### 更新脚本（/update）

来自 [expressRoutes/updateExpress.js](expressRoutes/updateExpress.js)：

- `POST /update/updateExpress`：执行更新脚本
  - 在 `NODE_ENV=production` 时执行 `scripts/update.sh`（bash）
  - 非生产环境默认用 PowerShell 执行 `scripts/test-update.ps1`
- `POST /update/updateBlog`：仅生产环境，执行 `scripts/updateBlog.sh`

> 备注：代码里预留了 `WEBHOOK_SECRET` 等说明，但当前路由实现未实际校验 token（如需校验可后续补上）。

### 新闻（/news）

来自 [expressRoutes/newsExpress.js](expressRoutes/newsExpress.js)：

- `GET /news/list?tag=财经&source=bing®ion=CN`
  - `tag`：关键词（也兼容 `q`）
  - `source`：`bing | toutiao | weibo`（默认 `bing`）
  - `region`：`CN | US | ALL | AUTO`（默认 `CN`）
  - 返回会随机抽取 10 条
- `GET /news/detail?url=https://...&region=CN`
  - 抓取原文 HTML 并抽取正文（含 SSRF 基础防护：禁止内网/localhost）

---

## 静态资源

- `/uploads`：会把项目根的 `uploads/` 目录作为静态资源公开（见 [server.js](server.js)）
- 如果项目根存在 `dist/`：会自动提供前端静态资源并做 SPA 回退到 `dist/index.html`

---

## 日志

日志实现见 [utils/logger.js](utils/logger.js)：

- `console.*` 会被重定向到 winston（同时输出到控制台与文件）
- HTTP 日志通过 `morgan` 写入（前缀 `[HTTP]`）
- 默认日志目录：`./logs`（可用 `LOG_DIR` 覆盖）
- 日志按天滚动：`app-YYYY-MM-DD.log`、`error-YYYY-MM-DD.log`

---

## Swagger / API 文档（可选）

项目已有 [swagger.js](swagger.js)，理论上可在 `http://HOST:PORT/api-docs` 查看。

但当前 [server.js](server.js) **只导入了 `setupSwagger`，没有实际调用**；另外 swagger 的 `apis` 路径也与当前目录结构不一致。

如果你要启用 Swagger，通常需要：

1. 在 [server.js](server.js) 中注册：`setupSwagger(app)`
2. 在 [swagger.js](swagger.js) 中把：

- `apis: ["./server/expressRoutes/*.js"]`

改为更符合当前结构的：

- `apis: ["./expressRoutes/*.js"]`

---

## 安全说明（强烈建议）

当前仓库里存在敏感信息/硬编码配置，建议在上线前处理：

- MongoDB 连接串在 [db/db.js](db/db.js) 内硬编码（包含账号密码与公网地址）
- SFTP 服务器配置在 [expressRoutes/imageExpress.js](expressRoutes/imageExpress.js) 内硬编码（包含公网 IP 与账号密码）
- JWT secret 在 [expressRoutes/loginExpress.js](expressRoutes/loginExpress.js) 内硬编码（`JWT_SECRET`）

建议做法：

- 把以上内容全部迁移到 `.env`（或部署平台的环境变量/密钥管理）
- 确保 `.env` 不提交真实密钥（你现在的 `.env` 示例是安全的）

---

## 常见问题

### 1) Windows 下如何运行更新脚本？

[expressRoutes/updateExpress.js](expressRoutes/updateExpress.js) 在非生产环境默认用 PowerShell 执行 `scripts/test-update.ps1`（如果该文件不存在，需要自行创建或调整 `UPDATE_SCRIPT_LOCAL`）。

### 2) 图片上传为什么返回 409？

单文件与批量上传都有“同名检查”：数据库存在同名 `.webp` 就会跳过并返回冲突信息。

### 3) 为什么我访问 /api-docs 没反应？

需要在入口注册 `setupSwagger(app)`，并修正 swagger 的 `apis` 路径，见「Swagger / API 文档」。

---

## License

未声明（如需开源协议，请补充 LICENSE 文件）。
