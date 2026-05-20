import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn, exec } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import SysTrayModule from 'systray2';

const SysTray = SysTrayModule.default || SysTrayModule;

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

// Default output directory is the user's Downloads folder
let outputDir = path.join(os.homedir(), 'Downloads');
if (!fs.existsSync(outputDir)) {
  outputDir = path.join(os.homedir(), 'Cevirici_Ciktilari');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

// Hardware-accelerated GPU encoder auto-detection
let supportedVideoEncoders = {
  h264: 'libx264',
  hevc: 'libx265'
};

const checkHardwareEncoders = () => {
  try {
    const ffmpeg = spawn(ffmpegPath, ['-encoders']);
    let output = '';
    
    ffmpeg.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    ffmpeg.on('close', () => {
      // Check H.264
      if (output.includes('h264_nvenc')) {
        supportedVideoEncoders.h264 = 'h264_nvenc';
        console.log('[Sistem] NVIDIA NVENC H.264 donanım hızlandırma aktif!');
      } else if (output.includes('h264_amf')) {
        supportedVideoEncoders.h264 = 'h264_amf';
        console.log('[Sistem] AMD AMF H.264 donanım hızlandırma aktif!');
      } else if (output.includes('h264_qsv')) {
        supportedVideoEncoders.h264 = 'h264_qsv';
        console.log('[Sistem] Intel QSV H.264 donanım hızlandırma aktif!');
      }

      // Check HEVC (H.265)
      if (output.includes('hevc_nvenc')) {
        supportedVideoEncoders.hevc = 'hevc_nvenc';
        console.log('[Sistem] NVIDIA NVENC HEVC donanım hızlandırma aktif!');
      } else if (output.includes('hevc_amf')) {
        supportedVideoEncoders.hevc = 'hevc_amf';
        console.log('[Sistem] AMD AMF HEVC donanım hızlandırma aktif!');
      } else if (output.includes('hevc_qsv')) {
        supportedVideoEncoders.hevc = 'hevc_qsv';
        console.log('[Sistem] Intel QSV HEVC donanım hızlandırma aktif!');
      }
    });
  } catch (err) {
    console.error('[Hata] Donanım hızlandırıcı kontrolü başarısız:', err);
  }
};

checkHardwareEncoders();

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
      const encoder = supportedVideoEncoders.h264;
      args.push('-c:v', encoder);
      if (encoder.includes('nvenc')) {
        args.push('-preset', 'p4', '-pix_fmt', 'yuv420p');
      } else if (encoder.includes('amf') || encoder.includes('qsv')) {
        args.push('-pix_fmt', 'yuv420p');
      } else {
        // CPU fallback
        args.push('-preset', 'medium', '-crf', '22', '-pix_fmt', 'yuv420p');
      }
    } else if (options.videoCodec === 'hevc') {
      const encoder = supportedVideoEncoders.hevc;
      args.push('-c:v', encoder);
      if (encoder.includes('nvenc')) {
        args.push('-preset', 'p4', '-pix_fmt', 'yuv420p');
      } else if (encoder.includes('amf') || encoder.includes('qsv')) {
        args.push('-pix_fmt', 'yuv420p');
      } else {
        // CPU fallback
        args.push('-preset', 'medium', '-crf', '25', '-pix_fmt', 'yuv420p');
      }
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

  console.log(`[Hızlandırıcı] Job ${jobId} başlatılıyor: ffmpeg ${args.join(' ')}`);

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
      console.log(`[Hızlandırıcı] Job ${jobId} başarıyla tamamlandı. Çıktı: ${outPath}`);
    } else {
      job.status = 'error';
      job.error = `FFmpeg çıkış kodu: ${code}`;
      console.error(`[Hızlandırıcı] Job ${jobId} başarısız oldu (Kod: ${code})`);
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

// Windows System Tray Integration
const iconPath = path.join(process.cwd(), 'cevirim.ico');
let systray = null;

if (fs.existsSync(iconPath)) {
  try {
    systray = new SysTray({
      menu: {
        icon: fs.readFileSync(iconPath).toString('base64'),
        title: 'Cevir.im Hızlandırıcı',
        tooltip: 'Cevir.im Donanım Hızlandırıcı Servisi',
        items: [
          {
            title: 'Cevir.im Hızlandırıcı (Çalışıyor)',
            tooltip: 'Servis durumu',
            checked: false,
            enabled: false
          },
          {
            title: 'Çıktı Klasörünü Aç',
            tooltip: 'Dönüştürülen dosyaların klasörünü aç',
            checked: false,
            enabled: true
          },
          {
            title: 'Servisi Kapat',
            tooltip: 'Hızlandırıcıyı sonlandırır',
            checked: false,
            enabled: true
          }
        ]
      },
      debug: false,
      copyDir: true
    });

    systray.onClick((action) => {
      if (action.seq_id === 1) {
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
        } catch (err) {
          console.error('Error opening folder from tray:', err);
        }
      } else if (action.seq_id === 2) {
        systray.kill();
        process.exit(0);
      }
    });

    systray.ready(() => {
      console.log('[Sistem] System tray simgesi başarıyla eklendi.');
    });
  } catch (err) {
    console.error('[Hata] System tray simgesi başlatılamadı:', err);
  }
}

app.listen(port, () => {
  console.log(`Cevir.im Entegre Hızlandırıcı port ${port} üzerinde hazır!`);
});
