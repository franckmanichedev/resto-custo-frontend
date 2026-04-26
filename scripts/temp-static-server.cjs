const http = require('http');
const fs = require('fs');
const path = require('path');

const baseDir = path.resolve(__dirname, '..', 'public');
const port = 3000;

const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.json': 'application/json; charset=utf-8'
};

const sendFile = (res, filePath) => {
    fs.readFile(filePath, (error, data) => {
        if (error) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Not found');
            return;
        }

        const contentType = mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
};

const server = http.createServer((req, res) => {
    const requestPath = decodeURIComponent((req.url || '/').split('?')[0]);

    let filePath = path.join(baseDir, requestPath === '/' ? '/platform/pricing.html' : requestPath);

    fs.stat(filePath, (error, stats) => {
        if (!error && stats.isDirectory()) {
            filePath = path.join(filePath, 'index.html');
            sendFile(res, filePath);
            return;
        }

        if (error) {
            const fallbackPath = path.join(baseDir, requestPath, 'index.html');
            sendFile(res, fallbackPath);
            return;
        }

        sendFile(res, filePath);
    });
});

server.listen(port, () => {
    console.log(`Static server running at http://localhost:${port}`);
});
