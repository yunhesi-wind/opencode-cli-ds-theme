// Extract a frame with Chromium's video decoder, without installing FFmpeg.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const video = process.argv[2];
const output = path.join(__dirname, '..', 'assets', 'maid-whale.png');
if (!video || !fs.existsSync(video)) throw new Error('Usage: node tools/capture-frame.cjs <source.mp4>');
if (fs.existsSync(output)) throw new Error('Frame already exists; refusing overwrite.');
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><title>CLI wallpaper frame capture</title><style>body{margin:0;background:#0b1528;color:#eef}video{max-width:100%}</style><video muted controls src="/video"></video><p id="status">Capturing frame...</p><script>
const video=document.querySelector('video');video.addEventListener('loadeddata',()=>{video.currentTime=2},{once:true});
video.addEventListener('seeked',async()=>{try{const c=document.createElement('canvas');c.width=video.videoWidth;c.height=video.videoHeight;c.getContext('2d').drawImage(video,0,0);const b=await new Promise(r=>c.toBlob(r,'image/png'));const response=await fetch('/frame',{method:'POST',headers:{'Content-Type':'image/png'},body:b});if(!response.ok)throw new Error(await response.text());document.querySelector('#status').textContent='Frame saved. You may close this tab.';}catch(e){document.querySelector('#status').textContent=e.message;}},{once:true});</script>`);
    return;
  }
  if (req.method === 'GET' && req.url === '/video') {
    const size = fs.statSync(video).size;
    const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
    const start = range ? Number(range[1]) : 0;
    const end = range?.[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start > end || start >= size) { res.writeHead(416); res.end(); return; }
    res.writeHead(range ? 206 : 200, { 'Content-Type': 'video/mp4', 'Content-Length': end - start + 1,
      'Accept-Ranges': 'bytes', ...(range ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}) });
    const stream = fs.createReadStream(video, { start, end });
    stream.on('error', () => res.destroy()); res.on('close', () => stream.destroy()); stream.pipe(res); return;
  }
  if (req.method === 'POST' && req.url === '/frame' && req.headers.origin === 'http://127.0.0.1:8832') {
    const chunks = []; let length = 0;
    req.on('data', (chunk) => { length += chunk.length; if (length > 8 * 1024 * 1024) req.destroy(); else chunks.push(chunk); });
    req.on('end', () => {
      const data = Buffer.concat(chunks);
      if (!data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) { res.writeHead(400); res.end('Invalid PNG'); return; }
      try { fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, data, { flag: 'wx' }); }
      catch (error) { res.writeHead(409); res.end(error.message); return; }
      res.end('Saved', () => {
        server.close(() => console.log('Saved frame: ' + output));
        server.closeAllConnections();
      });
    }); return;
  }
  res.writeHead(404); res.end();
});
server.listen(8832, '127.0.0.1', () => console.log('Open http://127.0.0.1:8832 to extract a PNG frame.'));
