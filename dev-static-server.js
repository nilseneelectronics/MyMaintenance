const http = require('http');
const fs = require('fs');
const path = require('path');

const APP_ROOT = path.resolve(__dirname);
const PORT = Number(process.env.PORT || 5501);

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8'
};

function resolveFilePath(requestUrl) {
    const pathname = decodeURIComponent((requestUrl || '/').split('?')[0]);
    const normalizedPath = pathname === '/' ? '/index.html' : pathname;
    const fullPath = path.join(APP_ROOT, normalizedPath);
    if (!fullPath.startsWith(APP_ROOT)) return null;
    return fullPath;
}

const server = http.createServer((req, res) => {
    const filePath = resolveFilePath(req.url);
    if (!filePath) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
    }

    fs.readFile(filePath, (error, data) => {
        if (error) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Not found');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`STATIC_SERVER http://localhost:${PORT}`);
});
