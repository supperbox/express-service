import express from "express";

const router = express.Router();

// ====================================
// 聚合新闻数据源配置
// ====================================
// 支持的新闻搜索平台
const AGG_SOURCES = {
  bing: {
    label: "必应搜索",
    provider: "bing",
  },
  toutiao: {
    label: "今日头条/头条搜索",
    provider: "toutiao",
  },
  weibo: {
    label: "微博搜索",
    provider: "weibo",
  },
};

/**
 * 规范化地区参数
 * @param {string} region - 地区代码（CN/US/ALL等）
 * @returns {string} 规范化后的地区代码
 */
function normalizeRegion(region) {
  const r = String(region || "")
    .trim()
    .toUpperCase();
  // 空值或AUTO默认为中国大陆
  if (r === "" || r === "AUTO") return "CN";
  // 全球/不限地区
  if (r === "ALL" || r === "GLOBAL" || r === "WORLD") return "ALL";
  // 允许 GDELT 常见的两位国家码：CN/US/JP/UK等
  if (/^[A-Z]{2}$/.test(r)) return r;
  // 默认返回中国大陆
  return "CN";
}

/**
 * 检测字符串是否包含中文（汉字）
 * @param {string} s - 待检测字符串
 * @returns {boolean} 是否包含中文
 */
function hasHan(s) {
  try {
    // 优先使用 Unicode Script 属性（支持所有汉字范围）
    return /\p{Script=Han}/u.test(String(s || ""));
  } catch {
    // 兜底方案：旧环境不支持 Unicode property escape，使用常见汉字范围
    return /[\u3400-\u9FFF]/.test(String(s || ""));
  }
}

/**
 * 统计字符串中简体中文字符的数量
 * @param {string} s - 待统计字符串
 * @returns {number} 简体中文字符数量
 */
function countSimplifiedChinese(s) {
  const str = String(s || "");
  let count = 0;
  try {
    // 使用 Unicode Script 属性匹配所有汉字
    const matches = str.match(/\p{Script=Han}/gu);
    count = matches ? matches.length : 0;
  } catch {
    // 兜底方案：使用常见汉字范围
    const matches = str.match(/[\u3400-\u9FFF]/g);
    count = matches ? matches.length : 0;
  }
  return count;
}

/**
 * 判断域名是否为中国大陆站点（备用，当前已放宽限制不使用严格域名白名单）
 * @param {string} hostname - 域名
 * @returns {boolean} 是否为大陆域名
 */
function isMainlandHostname(hostname) {
  const h = String(hostname || "").toLowerCase();
  if (!h) return false;

  // 中国大陆顶级域名
  if (h === "cn" || h.endsWith(".cn")) return true;
  if (h.endsWith(".com.cn") || h.endsWith(".net.cn") || h.endsWith(".org.cn"))
    return true;
  if (h.endsWith(".gov.cn") || h.endsWith(".edu.cn")) return true;

  // 大陆常见平台使用 .com 的例外白名单
  const allow = [
    "baidu.com",
    "baijiahao.baidu.com",
    "qq.com",
    "weibo.com",
    "bilibili.com",
    "toutiao.com",
    "douyin.com",
    "kuaishou.com",
    "sohu.com",
    "163.com",
  ];
  return allow.some((x) => h === x || h.endsWith(`.${x}`));
}

/**
 * 判断URL是否为中国大陆站点（备用函数）
 * @param {string} urlStr - URL字符串
 * @returns {boolean} 是否为大陆URL
 */
function isMainlandUrl(urlStr) {
  try {
    const u = new URL(String(urlStr || ""));
    if (!/^https?:$/.test(u.protocol)) return false;
    // return isMainlandHostname(u.hostname);
    return true;
  } catch {
    return false;
  }
}

/**
 * 判断指定地区是否要求内容必须包含中文
 * @param {string} region - 地区代码
 * @returns {boolean} 是否要求中文
 */
function shouldRequireHan(region) {
  // CN（中国大陆）和 ALL（全球中文）地区要求包含中文
  // 其他地区（如 US）不强制要求中文
  return region === "CN" || region === "ALL";
}

/**
 * 判断URL是否符合指定地区的过滤条件
 * @param {string} urlStr - URL字符串
 * @param {string} region - 地区代码
 * @returns {boolean} 是否允许该URL
 */
function isUrlAllowedByRegion(urlStr, region) {
  // ALL地区：允许所有来源
  if (region === "ALL") return true;

  // CN 地区：已放宽域名限制，允许所有 http/https 链接
  // 通过内容中文检测来确保相关性（避免错过国际媒体的中文报道）
  if (region === "CN") {
    try {
      const u = new URL(String(urlStr || ""));
      return /^https?:$/.test(u.protocol);
    } catch {
      return false;
    }
  }

  // 其他国家/地区：只检查协议合法性
  try {
    const u = new URL(String(urlStr || ""));
    return /^https?:$/.test(u.protocol);
  } catch {
    return false;
  }
}

/**
 * 格式化日期字符串为可读格式
 * @param {string} dateStr - 日期字符串
 * @returns {string} 格式化后的日期（如：2025-12-23 14:30）
 */
function formatDisplayDate(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hour = String(d.getHours()).padStart(2, "0");
    const minute = String(d.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day} ${hour}:${minute}`;
  } catch {
    return String(dateStr);
  }
}

/**
 * 转换为正整数，失败则返回默认值
 * @param {any} v - 待转换的值
 * @param {number} def - 默认值
 * @returns {number} 转换后的整数
 */
function toInt(v, def) {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}

/**
 * 限制数值在指定范围内
 * @param {number} n - 待限制的数值
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number} 限制后的数值
 */
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/**
 * 规范化新闻列表数据
 * @param {array} list - 原始新闻数组
 * @param {string} provider - 数据源标识（gdelt/newsapi）
 * @param {object} opts - 选项（region等）
 * @returns {array} 规范化后的新闻数组
 */
function normalizeList(list, provider, opts = {}) {
  if (!Array.isArray(list)) return [];
  const region = normalizeRegion(opts.region);
  return list
    .map((raw, idx) => {
      // 统一输出字段：提取标题/摘要/链接/时间等核心信息
      const id = String(
        raw?.id ?? raw?._id ?? raw?.url ?? raw?.document?.id ?? idx
      );
      const title = String(
        raw?.title ?? raw?.document?.title ?? raw?.seendate ?? ""
      );
      const dateRaw = String(
        raw?.publishedAt ??
          raw?.published_at ??
          raw?.seendate ??
          raw?.document?.seendate ??
          ""
      );
      const date = formatDisplayDate(dateRaw);
      const summary = String(
        raw?.description ?? raw?.summary ?? raw?.document?.snippet ?? ""
      );
      const url = String(raw?.url ?? raw?.document?.url ?? "");
      const source = String(
        raw?.source?.name ??
          raw?.source ??
          raw?.domain ??
          raw?.document?.domain ??
          ""
      );

      const language = String(
        raw?.language ?? raw?.lang ?? raw?.document?.language ?? ""
      );

      const content = [
        summary,
        url ? `\n\n原文链接：${url}` : "",
        source ? `\n来源：${source}` : "",
        provider ? `\n数据源：${provider}` : "",
      ]
        .join("")
        .trim();

      return {
        id,
        title,
        date,
        summary,
        content,
        url,
        source,
        language,
      };
    })
    .filter((x) => {
      // 1. URL地区过滤：检查URL是否符合地区要求
      if (!isUrlAllowedByRegion(x.url, region)) return false;

      // 2. 中国地区判断：标题中简体中文字符数量 >= 10
      if (region === "CN") {
        const chineseCount = countSimplifiedChinese(x.title || "");
        if (chineseCount < 10) return false;
      }

      // 3. 基础校验：必须有标题或摘要
      return Boolean(x.title || x.summary);
    });
}

/**
 * 从必应搜索获取新闻数据
 * @param {object} params - 查询参数
 * @returns {object} 规范化后的新闻数据
 */
async function fetchFromBing({ q, region }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const searchUrl = `https://cn.bing.com/search?q=${encodeURIComponent(q)}`;
    const resp = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9",
      },
    });
    if (!resp.ok) throw new Error(`必应搜索请求失败：HTTP ${resp.status}`);

    const html = await resp.text();
    const results = parseBingResults(html);
    return {
      provider: "bing",
      list: normalizeList(results, "bing", { region }),
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * 从今日头条搜索获取新闻数据
 * @param {object} params - 查询参数
 * @returns {object} 规范化后的新闻数据
 */
async function fetchFromToutiao({ q, region }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const url = new URL("https://www.toutiao.com/api/search/content/");
    url.searchParams.set("aid", "24");
    url.searchParams.set("app_name", "web_search");
    url.searchParams.set("offset", "0");
    url.searchParams.set("format", "json");
    url.searchParams.set("keyword", q);
    url.searchParams.set("autoload", "true");
    url.searchParams.set("count", "50");
    url.searchParams.set("cur_tab", "1");
    url.searchParams.set("from", "search_tab");
    url.searchParams.set("pd", "synthesis");

    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json,text/plain,*/*",
        Referer: `https://www.toutiao.com/search/?keyword=${encodeURIComponent(
          q
        )}`,
      },
    });
    if (!resp.ok) throw new Error(`今日头条搜索请求失败：HTTP ${resp.status}`);

    const data = await resp.json().catch(() => ({}));
    const items = Array.isArray(data?.data) ? data.data : [];

    const results = items
      .map((it) => {
        const title = String(it?.title || it?.display?.title || "").trim();
        const summary = String(
          it?.abstract || it?.display?.abstract || ""
        ).trim();
        const rawUrl =
          it?.article_url || it?.display_url || it?.share_url || it?.open_url;
        let urlStr = typeof rawUrl === "string" ? rawUrl : "";
        if (urlStr.startsWith("//")) urlStr = `https:${urlStr}`;
        const publishedAt =
          typeof it?.publish_time === "number"
            ? new Date(it.publish_time * 1000).toISOString()
            : new Date().toISOString();
        return {
          title,
          summary,
          url: urlStr,
          source: "今日头条",
          publishedAt,
          seendate: publishedAt,
        };
      })
      .filter((x) => x.title && x.url);

    return {
      provider: "toutiao",
      list: normalizeList(results, "toutiao", { region }),
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * 从微博搜索获取新闻数据
 * @param {object} params - 查询参数
 * @returns {object} 规范化后的新闻数据
 */
async function fetchFromWeibo({ q, region }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const apiUrl = new URL("https://m.weibo.cn/api/container/getIndex");
    apiUrl.searchParams.set("containerid", "100103type=1");
    apiUrl.searchParams.set("q", q);

    const resp = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        Accept: "application/json,text/plain,*/*",
        Referer: `https://m.weibo.cn/search?containerid=100103type%3D1%26q%3D${encodeURIComponent(
          q
        )}`,
      },
    });
    if (!resp.ok) throw new Error(`微博搜索请求失败：HTTP ${resp.status}`);

    const data = await resp.json().catch(() => ({}));
    const cards = Array.isArray(data?.data?.cards) ? data.data.cards : [];

    const results = [];
    for (const card of cards) {
      const mblog = card?.mblog;
      if (!mblog) continue;

      const textHtml = String(mblog?.text || "");
      const text = decodeHtmlEntities(stripTags(textHtml))
        .replace(/\s+/g, " ")
        .trim();
      const title = text.slice(0, 60) || "微博内容";
      const createdAt = String(mblog?.created_at || "");
      const scheme =
        typeof card?.scheme === "string" ? card.scheme : "https://m.weibo.cn";

      const safeIso = (() => {
        if (!createdAt) return new Date().toISOString();
        const d = new Date(createdAt);
        return Number.isFinite(d.getTime())
          ? d.toISOString()
          : new Date().toISOString();
      })();

      results.push({
        title,
        summary: text,
        url: scheme,
        source: "微博",
        publishedAt: safeIso,
        seendate: safeIso,
      });
    }

    return {
      provider: "weibo",
      list: normalizeList(results, "weibo", { region }),
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * 解析必应搜索结果HTML（尽量从页面结构提取标题/链接/摘要）
 * @param {string} html - bing 搜索返回的HTML
 * @returns {Array<{title:string, url:string, summary:string, source:string, publishedAt:string, seendate:string}>}
 */
function parseBingResults(html) {
  const results = [];
  const now = new Date().toISOString();
  const liPattern = /<li class=\"b_algo\"[\s\S]*?<\/li>/gi;
  const items = String(html || "").match(liPattern) || [];

  for (const itemHtml of items) {
    const a = itemHtml.match(
      /<h2[\s\S]*?<a[^>]+href=\"([^\"]+)\"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>/i
    );
    if (!a) continue;
    const url = String(a[1] || "").trim();
    const title = decodeHtmlEntities(stripTags(a[2] || ""))
      .replace(/\s+/g, " ")
      .trim();

    const p = itemHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const summary = p
      ? decodeHtmlEntities(stripTags(p[1] || ""))
          .replace(/\s+/g, " ")
          .trim()
      : "";

    if (!title || !url) continue;
    results.push({
      title,
      url,
      summary,
      source: "必应搜索",
      publishedAt: now,
      seendate: now,
    });
    if (results.length >= 60) break;
  }

  return results;
}

/**
 * @swagger
 * /news/list:
 *   get:
 *     summary: 获取新闻列表
 *     description: 根据关键词/分类从多数据源聚合并返回新闻列表（随机10条）
 *     tags: [News]
 *     parameters:
 *       - in: query
 *         name: tag
 *         schema:
 *           type: string
 *         description: 新闻分类或关键词（优先使用）
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: 关键词（兼容旧参数）
 *       - in: query
 *         name: source
 *         schema:
 *           type: string
 *           enum: [bing, toutiao, weibo]
 *         description: 指定数据源
 *       - in: query
 *         name: region
 *         schema:
 *           type: string
 *         description: 地区代码（CN/US/ALL 等）
 *     responses:
 *       200:
 *         description: 返回聚合后的新闻列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tag:
 *                   type: string
 *                 keyword:
 *                   type: string
 *                 searchTime:
 *                   type: string
 *                 provider:
 *                   type: string
 *                 region:
 *                   type: string
 *                 source:
 *                   type: string
 *                 list:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       title:
 *                         type: string
 *                       summary:
 *                         type: string
 *                       url:
 *                         type: string
 *                       source:
 *                         type: string
 *                       date:
 *                         type: string
 */
router.get("/list", async (req, res) => {
  // 1. 解析查询参数
  // “关键词就是分类”：前端直接把关键词放在 tag 里
  // 为兼容旧参数，这里也接受 q，但优先使用 tag
  const tag = typeof req.query.tag === "string" ? req.query.tag.trim() : "";
  const qFallback = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const keyword = tag || qFallback || "财经";
  const region = normalizeRegion(req.query.region); // 规范化地区参数

  // 2. 确定数据源（默认必应）
  const sourceIdRaw =
    typeof req.query.source === "string" ? req.query.source.trim() : "";
  const sourceId =
    sourceIdRaw && AGG_SOURCES[sourceIdRaw] ? sourceIdRaw : "bing";
  const sourceMeta = AGG_SOURCES[sourceId] || AGG_SOURCES.bing;
  const provider = sourceMeta.provider;

  // 3. 构建查询关键词：直接使用 keyword
  const q = keyword;

  // 获取当前搜索时间
  const searchTime = formatDisplayDate(new Date().toISOString());

  try {
    // 4. 根据数据源调用对应的搜索函数
    let result;
    switch (provider) {
      case "toutiao":
        result = await fetchFromToutiao({ q, region });
        break;
      case "weibo":
        result = await fetchFromWeibo({ q, region });
        break;
      case "bing":
      default:
        result = await fetchFromBing({ q, region });
        break;
    }

    // 5. 随机选择10条数据
    const allList = result.list || [];
    let randomList = [];
    if (allList.length <= 10) {
      randomList = allList;
    } else {
      // Fisher-Yates 洗牌算法随机选择10条
      const shuffled = [...allList];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      randomList = shuffled.slice(0, 10);
    }

    // 6. 构建响应数据
    const payload = {
      tag: keyword, // 关键词就是分类
      keyword: q, // 实际搜索关键词
      searchTime, // 搜索时间
      provider: result.provider, // 数据源
      region, // 地区
      source: sourceId, // 数据源ID
      list: randomList, // 随机新闻列表（10条）
    };

    // 7. 直接返回（不缓存）
    res.json(payload);
  } catch (e) {
    // 错误处理：记录日志并返回500错误
    console.error("news/list error:", e);
    res.status(500).json({ message: e?.message || "news/list failed" });
  }
});

/**
 * @swagger
 * /news/detail:
 *   get:
 *     summary: 获取新闻详情
 *     description: 抓取并解析新闻原文内容，返回标题和纯文本正文
 *     tags: [News]
 *     parameters:
 *       - in: query
 *         name: url
 *         schema:
 *           type: string
 *         required: true
 *         description: 新闻原文的完整 URL
 *       - in: query
 *         name: region
 *         schema:
 *           type: string
 *         description: 地区代码（可选，用于 CN 地区的域名限制）
 *     responses:
 *       200:
 *         description: 返回原文标题和解析后的正文
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *                 title:
 *                   type: string
 *                 content:
 *                   type: string
 */

/**
 * 检查域名是否被封禁（SSRF 防护）
 * 防止服务端请求伪造攻击：禁止访问内网地址/环回地址
 * @param {string} hostname - 域名或IP地址
 * @returns {boolean} 是否被封禁
 */
function isBlockedHostname(hostname) {
  const h = String(hostname || "").toLowerCase();
  if (!h) return true; // 空域名不允许

  // 封禁本地域名
  if (h === "localhost" || h.endsWith(".local")) return true;
  if (h === "::1") return true; // IPv6 环回地址

  // IPv4 私网/环回地址简单拦截
  const ipv4 = h.match(/^\d+\.\d+\.\d+\.\d+$/);
  if (ipv4) {
    const parts = h.split(".").map((x) => Number.parseInt(x, 10));
    const [a, b] = parts;
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // 127.0.0.0/8 环回地址
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  }
  return false;
}

/**
 * 解码HTML实体字符
 * @param {string} s - 包含HTML实体的字符串
 * @returns {string} 解码后的字符串
 */
function decodeHtmlEntities(s) {
  return String(s)
    .replace(/&nbsp;/gi, " ") // 不间断空格
    .replace(/&amp;/gi, "&") // &符号
    .replace(/&lt;/gi, "<") // 小于号
    .replace(/&gt;/gi, ">") // 大于号
    .replace(/&quot;/gi, '"') // 双引号
    .replace(/&#39;/g, "'"); // 单引号
}

/**
 * 移除HTML标签，保留纯文本
 * @param {string} s - HTML字符串
 * @returns {string} 移除标签后的纯文本
 */
function stripTags(s) {
  return String(s).replace(/<[^>]+>/g, " "); // 移除所有<>标签
}

/**
 * 从 HTML 中提取可读正文（去除脚本/样式/导航等噪音）
 * @param {string} html - 原始HTML内容
 * @returns {string} 提取的纯文本正文
 */
function extractReadableText(html) {
  const raw = String(html || "");

  // 第1步：移除噪音元素（脚本/样式/noscript/svg）
  let cleaned = raw
    .replace(/<script[\s\S]*?<\/script>/gi, " ") // 移除JS代码
    .replace(/<style[\s\S]*?<\/style>/gi, " ") // 移除CSS样式
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ") // 移除noscript
    .replace(/<svg[\s\S]*?<\/svg>/gi, " "); // 移除SVG图形

  // 第2步：优先提取 <article> 标签内的内容（通常是正文区域）
  const articleMatch = cleaned.match(/<article[\s\S]*?<\/article>/i);
  const focus = articleMatch ? articleMatch[0] : cleaned;

  // 第3步：提取所有 <p> 段落标签的文本
  const paragraphs = Array.from(focus.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi))
    .map((m) => decodeHtmlEntities(stripTags(m[1])).replace(/\s+/g, " ").trim())
    .filter((t) => t.length >= 20); // 过滤掉过短的段落（<20字符）

  let text = "";
  if (paragraphs.length) {
    // 有段落：拼接所有段落
    text = paragraphs.join("\n\n");
  } else {
    // 没有段落：兜底方案 - 提取 <body> 的纯文本
    const bodyMatch = cleaned.match(/<body[\s\S]*?<\/body>/i);
    const body = bodyMatch ? bodyMatch[0] : cleaned;
    text = decodeHtmlEntities(stripTags(body)).replace(/\s+/g, " ").trim();
  }

  // 第4步：防止响应过大（限制在50KB）
  const MAX = 50_000;
  if (text.length > MAX) text = text.slice(0, MAX) + "\n\n（内容过长，已截断）";
  return text;
}

/**
 * 从 HTML 中提取 <title> 标签的内容
 * @param {string} html - HTML字符串
 * @returns {string} 页面标题
 */
function extractHtmlTitle(html) {
  const m = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return "";
  return decodeHtmlEntities(stripTags(m[1])).replace(/\s+/g, " ").trim();
}

/**
 * GET /news/detail - 获取新闻详情（抓取原文内容）
 * @query {string} url - 新闻原文URL（必填）
 * @query {string} region - 地区（可选，用于CN地区的域名限制）
 */
router.get("/detail", async (req, res) => {
  // 1. 验证URL参数
  const urlParam =
    typeof req.query.url === "string" ? req.query.url.trim() : "";
  if (!urlParam) return res.status(400).json({ message: "缺少 url 参数" });

  const region = normalizeRegion(req.query.region);

  // 2. 解析并验证URL合法性
  let u;
  try {
    u = new URL(urlParam);
  } catch {
    return res.status(400).json({ message: "url 参数不合法" });
  }

  // 3. 安全检查：只允许 http/https 协议
  if (!/^https?:$/.test(u.protocol)) {
    return res.status(400).json({ message: "仅支持 http/https" });
  }

  // 4. SSRF 防护：禁止访问内网地址
  if (isBlockedHostname(u.hostname)) {
    return res.status(400).json({ message: "该 url 不被允许" });
  }
  // 已放宽域名限制：只要不是内网地址即可抓取

  // 5. 抓取原文（设置10秒超时）
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const resp = await fetch(u.toString(), {
      signal: controller.signal, // 超时控制
      redirect: "follow", // 跟随重定向
      headers: {
        "User-Agent": "TsLearnNewsBot/0.1 (demo) ", // 设置 User-Agent
        Accept: "text/html,application/xhtml+xml", // 只接受HTML
      },
    });

    // 7. 验证响应
    const contentType = resp.headers.get("content-type") || "";
    if (!resp.ok) throw new Error(`抓取原文失败：HTTP ${resp.status}`);
    if (!contentType.includes("text/html")) {
      throw new Error("原文不是 HTML 页面，无法解析");
    }

    // 8. 解析HTML内容
    const html = await resp.text();
    const title = extractHtmlTitle(html); // 提取标题
    const content = extractReadableText(html); // 提取正文

    // 9. 构建响应数据（不缓存）
    const payload = { url: u.toString(), title, content };
    res.json(payload);
  } catch (e) {
    // 错误处理：记录日志并返回500错误
    console.error("news/detail error:", e);
    res.status(500).json({ message: e?.message || "news/detail failed" });
  } finally {
    // 清理超时定时器
    clearTimeout(timeout);
  }
});

export default router;
