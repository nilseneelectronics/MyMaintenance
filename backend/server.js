const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const APP_ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT || 3000);

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@mymaintenance.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

const sessions = new Map();

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function createSession(email) {
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, { email, role: "admin", createdAt: Date.now() });
  return token;
}

function getAuthToken(req) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice("Bearer ".length).trim();
}

function resolveFilePath(requestUrl) {
  const pathname = decodeURIComponent((requestUrl || "/").split("?")[0]);
  const normalizedPath = pathname === "/" ? "/index.html" : pathname;
  const fullPath = path.join(APP_ROOT, normalizedPath);
  if (!fullPath.startsWith(APP_ROOT)) {
    return null;
  }
  return fullPath;
}

function serveStatic(req, res) {
  const filePath = resolveFilePath(req.url);
  if (!filePath) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (statErr, stats) => {
    if (statErr) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const actualPath = stats.isDirectory() ? path.join(filePath, "index.html") : filePath;
    fs.readFile(actualPath, (readErr, data) => {
      if (readErr) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }

      const extension = path.extname(actualPath).toLowerCase();
      res.writeHead(200, {
        "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
      });
      res.end(data);
    });
  });
}

async function handleApi(req, res) {
  if (req.method === "GET" && req.url === "/api/health") {
    sendJson(res, 200, { ok: true, service: "backend", timestamp: new Date().toISOString() });
    return true;
  }

  if (req.method === "POST" && req.url === "/api/auth/login") {
    try {
      const rawBody = await readRequestBody(req);
      const body = rawBody ? JSON.parse(rawBody) : {};
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");

      if (!email || !password) {
        sendJson(res, 400, { ok: false, message: "Email and password are required." });
        return true;
      }

      if (email !== ADMIN_EMAIL.toLowerCase() || password !== ADMIN_PASSWORD) {
        sendJson(res, 401, { ok: false, message: "Invalid credentials." });
        return true;
      }

      const token = createSession(email);
      sendJson(res, 200, {
        ok: true,
        token,
        user: { email, role: "admin" },
      });
      return true;
    } catch (error) {
      sendJson(res, 400, { ok: false, message: "Invalid request payload." });
      return true;
    }
  }

  if (req.method === "POST" && req.url === "/api/auth/logout") {
    const token = getAuthToken(req);
    if (token) {
      sessions.delete(token);
    }
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (req.method === "GET" && req.url === "/api/auth/session") {
    const token = getAuthToken(req);
    if (!token || !sessions.has(token)) {
      sendJson(res, 401, { ok: false, authenticated: false });
      return true;
    }

    const user = sessions.get(token);
    sendJson(res, 200, {
      ok: true,
      authenticated: true,
      user: { email: user.email, role: user.role },
    });
    return true;
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  try {
    const handledByApi = await handleApi(req, res);
    if (handledByApi) return;
    serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { ok: false, message: "Internal server error." });
  }
});

server.listen(PORT, () => {
  console.log(`APP_SERVER http://localhost:${PORT}`);
  console.log(`ADMIN_LOGIN email=${ADMIN_EMAIL} password=${ADMIN_PASSWORD}`);
});
