import http from 'node:http';
import { readFile } from 'node:fs/promises';
const files = new Map([['/','index.html'],['/index.html','index.html'],['/app.js','app.js'],['/model.js','model.js'],['/style.css','style.css']]);
http.createServer(async (req, res) => { const file = files.get(new URL(req.url, 'http://localhost').pathname); if (!file) { res.writeHead(404); return res.end('Not found'); } try { res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html'); res.end(await readFile(new URL(file, import.meta.url))); } catch { res.writeHead(500); res.end('Unable to read file'); } }).listen(4173,'127.0.0.1',() => console.log('Local: http://127.0.0.1:4173'));
