import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Set security headers for Cross-Origin Isolation (required for SharedArrayBuffer / FFmpeg.wasm)
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});

// Serve client dist static files
const distPath = path.join(process.cwd(), 'client', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('Çevirici Static Server: Lütfen client klasöründe "npm run build" çalıştırın.');
  });
}

app.listen(port, () => {
  console.log(`Çevirici sunucusu çalışıyor: http://localhost:${port}`);
});
