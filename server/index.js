import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn, exec } from 'child_process';
import ffmpegPath from 'ffmpeg-static';

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

// Create default output folder in user's home directory
const outputDir = path.join(os.homedir(), 'Cevirici_Ciktilari');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Configure multer for temporary uploads
const tempDir = path.join(os.tmpdir(), 'cevirim-temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}
const upload = multer({ dest: tempDir });

// Active background jobs store
const jobs = new Map();

// Helper to parse file duration from logs to compute progress
const durationRegex = /Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/;
const timeRegex = /time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/;
const speedRegex = /speed=\s*([\d.]+)x/;
const sizeRegex = /size=\s*(\d+)kB/;

// API Endpoints
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    platform: process.platform,
    outputDir: outputDir
  });
});

app.get('/api/open-folder', (req, res) => {
  try {
    let command = '';
    if (process.platform === 'win32') {
      command = `explorer.exe "${outputDir}"`;
    } else if (process.platform === 'darwin') {
      command = `open "${outputDir}"`;
    } else {
      command = `xdg-open "${outputDir}"`;
    }
    exec(command);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/convert-native', upload.single('file'), (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const options = JSON.parse(req.body.options || '{}');
  const jobId = Date.now().toString() + Math.random().toString(36).substring(2, 7);
  
  const originalBase = path.basename(file.originalname, path.extname(file.originalname));
  const cleanName = originalBase.replace(/[^a-zA-Z0-9_\-]/g, '_');
  const targetExt = options.format || 'mp4';
  const outFilename = `${cleanName}_converted_${Date.now()}.${targetExt}`;
  const outPath = path.join(outputDir, outFilename);

  const args = ['-y', '-i', file.path];

  // Video settings
  if (options.type === 'video') {
    if (options.videoCodec === 'copy') {
      args.push('-c:v', 'copy');
    } else if (options.videoCodec === 'h264') {
      args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '22');
    } else if (options.videoCodec === 'hevc') {
      args.push('-c:v', 'libx265', '-preset', 'medium', '-crf', '25');
    } else if (options.videoCodec === 'vp9') {
      args.push('-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0');
    } else if (options.videoCodec === 'prores') {
      args.push('-c:v', 'prores_ks', '-profile:v', '3');
    } else if (options.videoCodec === 'none') {
      args.push('-vn');
    }

    if (options.resolution && options.resolution !== 'original') {
      const dimensions = options.resolution.split('x');
      if (dimensions.length === 2) {
        args.push('-vf', `scale=${dimensions[0]}:${dimensions[1]}`);
      }
    }

    if (options.fps && options.fps !== 'copy') {
      args.push('-r', options.fps);
    }

    if (options.audioCodec === 'copy') {
      args.push('-c:a', 'copy');
    } else if (options.audioCodec === 'aac') {
      args.push('-c:a', 'aac', '-b:a', `${options.audioBitrate || 192}k`);
    } else if (options.audioCodec === 'mp3') {
      args.push('-c:a', 'libmp3lame', '-b:a', `${options.audioBitrate || 192}k`);
    } else if (options.audioCodec === 'opus') {
      args.push('-c:a', 'libopus', '-b:a', `${options.audioBitrate || 128}k`);
    } else if (options.audioCodec === 'pcm') {
      args.push('-c:a', 'pcm_s16le');
    } else if (options.audioCodec === 'none') {
      args.push('-an');
    }
  } 
  else if (options.type === 'audio') {
    if (options.audioCodec === 'mp3') {
      args.push('-c:a', 'libmp3lame', '-b:a', `${options.audioBitrate || 320}k`);
    } else if (options.audioCodec === 'aac') {
      args.push('-c:a', 'aac', '-b:a', `${options.audioBitrate || 192}k`);
    } else if (options.audioCodec === 'opus') {
      args.push('-c:a', 'libopus', '-b:a', `${options.audioBitrate || 128}k`);
    } else if (options.audioCodec === 'flac') {
      args.push('-c:a', 'flac');
    } else if (options.audioCodec === 'wav') {
      args.push('-c:a', 'pcm_s16le');
    }
  } 
  else if (options.type === 'image') {
    if (targetExt === 'webp') {
      args.push('-quality', options.imageQuality || '90');
    } else if (targetExt === 'jpeg' || targetExt === 'jpg') {
      args.push('-qscale:v', '2');
    }
    
    let scaleFilter = '';
    if (options.imageWidth || options.imageHeight) {
      const w = options.imageWidth || '-1';
      const h = options.imageHeight || '-1';
      scaleFilter = `scale=${w}:${h}`;
    }
    if (scaleFilter) {
      args.push('-vf', scaleFilter);
    }
  }

  args.push(outPath);

  console.log(`[Yerel Motor] Job ${jobId} başlatılıyor: ffmpeg ${args.join(' ')}`);

  const job = {
    id: jobId,
    status: 'converting',
    progress: 0,
    speed: 'N/A',
    size: '0 MB',
    outputPath: outPath,
    error: null,
    durationSec: 0,
    startTime: Date.now()
  };
  jobs.set(jobId, job);

  const ffmpeg = spawn(ffmpegPath, args);

  ffmpeg.stderr.on('data', (data) => {
    const text = data.toString();
    
    if (job.durationSec === 0) {
      const durMatch = text.match(durationRegex);
      if (durMatch) {
        const hours = parseInt(durMatch[1]);
        const minutes = parseInt(durMatch[2]);
        const seconds = parseInt(durMatch[3]);
        job.durationSec = hours * 3600 + minutes * 60 + seconds;
      }
    }

    const timeMatch = text.match(timeRegex);
    if (timeMatch && job.durationSec > 0) {
      const hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      const seconds = parseInt(timeMatch[3]);
      const currentSec = hours * 3600 + minutes * 60 + seconds;
      job.progress = Math.min(99, Math.round((currentSec / job.durationSec) * 100));
    }

    const speedMatch = text.match(speedRegex);
    if (speedMatch) {
      job.speed = speedMatch[1] + 'x';
    }

    const sizeMatch = text.match(sizeRegex);
    if (sizeMatch) {
      const kb = parseInt(sizeMatch[1]);
      job.size = (kb / 1024).toFixed(2) + ' MB';
    }
  });

  ffmpeg.on('close', (code) => {
    fs.unlink(file.path, () => {});

    if (code === 0) {
      job.status = 'completed';
      job.progress = 100;
      console.log(`[Yerel Motor] Job ${jobId} başarıyla tamamlandı. Çıktı: ${outPath}`);
    } else {
      job.status = 'error';
      job.error = `FFmpeg çıkış kodu: ${code}`;
      console.error(`[Yerel Motor] Job ${jobId} başarısız oldu (Kod: ${code})`);
    }
  });

  res.json({ jobId });
});

app.get('/api/job-status', (req, res) => {
  const jobId = req.query.jobId;
  const job = jobs.get(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job bulunamadı' });
  }
  res.json(job);
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
  console.log(`Yerel Çıktı Klasörü: ${outputDir}`);
});
