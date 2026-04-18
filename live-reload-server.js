const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const PORT = 5501;

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

const clients = new Set();
let reloadTimer = null;

const RELOAD_SNIPPET = `
<script>
(() => {
  const source = new EventSource('/__live_reload');
  source.onmessage = (event) => {
    if (event.data === 'reload') window.location.reload();
  };
  source.onerror = () => {
    source.close();
    setTimeout(() => location.reload(), 1000);
  };
})();
</script>
`;

function safePathFromUrl(urlPath) {
  const decoded = decodeURIComponent((urlPath || "/").split("?")[0]);
  const clean = decoded === "/" ? "/index.html" : decoded;
  const fullPath = path.join(ROOT, clean);
  if (!fullPath.startsWith(ROOT)) {
    return null;
  }
  return fullPath;
}

function serveFile(filePath, res) {
  fs.stat(filePath, (statErr, stat) => {
    if (statErr) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const actualPath = stat.isDirectory()
      ? path.join(filePath, "index.html")
      : filePath;

    fs.readFile(actualPath, (readErr, data) => {
      if (readErr) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }

      const ext = path.extname(actualPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || "application/octet-stream";

      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");

      if (ext === ".html") {
        const html = data.toString("utf8");
        if (html.includes("</body>")) {
          res.writeHead(200, { "Content-Type": contentType });
          res.end(html.replace("</body>", `${RELOAD_SNIPPET}</body>`));
        } else {
          res.writeHead(200, { "Content-Type": contentType });
          res.end(html + RELOAD_SNIPPET);
        }
        return;
      }

      res.writeHead(200, { "Content-Type": contentType });
      res.end(data);
    });
  });
}

function notifyReload() {
  for (const client of clients) {
    client.write("data: reload\n\n");
  }
}

const server = http.createServer((req, res) => {
  if (req.url && req.url.startsWith("/__live_reload")) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write("\n");

    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }

  const filePath = safePathFromUrl(req.url || "/");
  if (!filePath) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  serveFile(filePath, res);
});

fs.watch(ROOT, { recursive: true }, (eventType, filename) => {
  if (!filename) return;

  const lower = String(filename).toLowerCase();
  if (
    lower.includes(".git\\") ||
    lower.includes(".git/") ||
    lower.endsWith(".tmp")
  ) {
    return;
  }

  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(notifyReload, 120);
});

server.listen(PORT, () => {
  console.log(`LIVE_RELOAD_SERVER http://localhost:${PORT}`);
});
