import React, { useState, useEffect, useRef } from 'react';
import { 
  UploadCloud, 
  FileText, 
  Video, 
  Music, 
  Image as ImageIcon, 
  Trash2, 
  Play, 
  Square, 
  Terminal, 
  ExternalLink, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Sparkles,
  Layers
} from 'lucide-react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// Format bytes helper
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Extract extension from filename
function getExtension(filename) {
  return filename.split('.').pop().toLowerCase();
}

// Group extensions into categories
function getFormatGroup(ext) {
  const videoExts = ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'm4v', 'wmv', '3gp'];
  const audioExts = ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a', 'wma', 'opus'];
  const imageExts = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'tiff', 'ico', 'svg'];
  const docExts = ['txt', 'html', 'md', 'pdf'];

  if (videoExts.includes(ext)) return 'video';
  if (audioExts.includes(ext)) return 'audio';
  if (imageExts.includes(ext)) return 'image';
  if (docExts.includes(ext)) return 'document';
  return 'unknown';
}

// Format duration from seconds to HH:MM:SS
function formatDuration(sec) {
  if (isNaN(sec) || !isFinite(sec)) return '00:00:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return [
    h.toString().padStart(2, '0'),
    m.toString().padStart(2, '0'),
    s.toString().padStart(2, '0')
  ].join(':');
}

// Preset Configurations for Video
const VIDEO_PRESETS = [
  { id: 'none', name: '--- Hazır Video Şablonu Seçin ---' },
  {
    id: 'premiere_prores',
    name: 'Premiere Pro Düzenleme (ProRes 422 MOV - Kayıpsız)',
    options: {
      videoFormat: 'mov',
      videoCodec: 'prores',
      videoBitrate: '',
      resolution: 'original',
      fps: 'copy',
      videoAudioCodec: 'pcm',
      videoAudioBitrate: ''
    }
  },
  {
    id: 'premiere_mp4',
    name: 'Premiere Pro Düzenleme (Yüksek Kalite H.264 MP4)',
    options: {
      videoFormat: 'mp4',
      videoCodec: 'h264',
      videoBitrate: '15000',
      resolution: 'original',
      fps: 'copy',
      videoAudioCodec: 'aac',
      videoAudioBitrate: '320'
    }
  },
  {
    id: 'youtube_1080p',
    name: 'YouTube Standardı (1080p H.264 MP4)',
    options: {
      videoFormat: 'mp4',
      videoCodec: 'h264',
      videoBitrate: '8000',
      resolution: '1080p',
      fps: '30',
      videoAudioCodec: 'aac',
      videoAudioBitrate: '384'
    }
  },
  {
    id: 'instagram_reels',
    name: 'Instagram / TikTok Reels (Dikey 9:16 H.264)',
    options: {
      videoFormat: 'mp4',
      videoCodec: 'h264',
      videoBitrate: '4000',
      resolution: '1080x1920',
      fps: '30',
      videoAudioCodec: 'aac',
      videoAudioBitrate: '192'
    }
  },
  {
    id: 'discord_low',
    name: 'Discord Optimize (H.264 MP4 - Düşük Boyut)',
    options: {
      videoFormat: 'mp4',
      videoCodec: 'h264',
      videoBitrate: '1000',
      resolution: '720p',
      fps: '30',
      videoAudioCodec: 'aac',
      videoAudioBitrate: '96'
    }
  },
  {
    id: 'whatsapp_mobile',
    name: 'WhatsApp Uyumlu (Düşük Profil H.264 MP4)',
    options: {
      videoFormat: 'mp4',
      videoCodec: 'h264',
      videoBitrate: '600',
      resolution: '480p',
      fps: '25',
      videoAudioCodec: 'aac',
      videoAudioBitrate: '64'
    }
  }
];

// Preset Configurations for Audio
const AUDIO_PRESETS = [
  { id: 'none', name: '--- Hazır Ses Şablonu Seçin ---' },
  {
    id: 'studio_flac',
    name: 'Stüdyo Kayıt (Kayıpsız FLAC)',
    options: {
      audioFormat: 'flac',
      audioCodec: 'flac',
      audioBitrate: '',
      audioSampleRate: '48000',
      audioChannels: '2'
    }
  },
  {
    id: 'studio_wav',
    name: 'Stüdyo Kayıt (Kayıpsız WAV PCM)',
    options: {
      audioFormat: 'wav',
      audioCodec: 'pcm',
      audioBitrate: '',
      audioSampleRate: '48000',
      audioChannels: '2'
    }
  },
  {
    id: 'podcast_mp3',
    name: 'Podcast Optimize (Mono MP3)',
    options: {
      audioFormat: 'mp3',
      audioCodec: 'mp3',
      audioBitrate: '128',
      audioSampleRate: '44100',
      audioChannels: '1'
    }
  },
  {
    id: 'mobile_m4a',
    name: 'Yüksek Kalite Mobil Ses (AAC M4A)',
    options: {
      audioFormat: 'm4a',
      audioCodec: 'aac',
      audioBitrate: '192',
      audioSampleRate: '44100',
      audioChannels: '2'
    }
  }
];

// Preset Configurations for Images
const IMAGE_PRESETS = [
  { id: 'none', name: '--- Hazır Görsel Şablonu Seçin ---' },
  {
    id: 'web_webp',
    name: 'Web Görseli Optimize (WebP %75 Kalite)',
    options: {
      imageFormat: 'webp',
      imageQuality: '75',
      imageWidth: '',
      imageHeight: ''
    }
  },
  {
    id: 'hq_jpeg',
    name: 'Sosyal Medya Paylaşımı (High Quality JPEG %95)',
    options: {
      imageFormat: 'jpeg',
      imageQuality: '95',
      imageWidth: '',
      imageHeight: ''
    }
  },
  {
    id: 'banner_png',
    name: 'Paylaşım Görseli / Banner (1200x630 PNG)',
    options: {
      imageFormat: 'png',
      imageQuality: '100',
      imageWidth: '1200',
      imageHeight: '630'
    }
  },
  {
    id: 'favicon_ico',
    name: 'Web Favicon / Simge (32x32 ICO)',
    options: {
      imageFormat: 'ico',
      imageQuality: '100',
      imageWidth: '32',
      imageHeight: '32'
    }
  }
];

// Share a single FFmpeg WASM instance
let ffmpegInstance = null;

const getFFmpeg = async (onLog, onProgress) => {
  if (!ffmpegInstance) {
    ffmpegInstance = new FFmpeg();
  }
  
  ffmpegInstance.off('log');
  ffmpegInstance.off('progress');
  ffmpegInstance.on('log', onLog);
  ffmpegInstance.on('progress', onProgress);

  if (!ffmpegInstance.loaded) {
    console.log('Loading FFmpeg Core...');
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';
    await ffmpegInstance.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    console.log('FFmpeg Core loaded successfully!');
  }
  return ffmpegInstance;
};

export default function App() {
  // Queue state
  const [queue, setQueue] = useState([]);
  
  // Selected tab in options panel
  const [activeTab, setActiveTab] = useState('video');
  
  // Active selected item in queue for settings application (null means applying to all)
  const [selectedQueueItemId, setSelectedQueueItemId] = useState(null);

  // Active preset selected state
  const [activePreset, setActivePreset] = useState('none');

  // Global option presets
  const [options, setOptions] = useState({
    videoFormat: 'mp4',
    videoCodec: 'h264',
    videoBitrate: '2000', 
    resolution: 'original',
    fps: 'copy',
    videoAudioCodec: 'aac',
    videoAudioBitrate: '192',

    audioFormat: 'mp3',
    audioCodec: 'mp3',
    audioBitrate: '320', 
    audioSampleRate: '44100', 
    audioChannels: '2', 

    imageFormat: 'webp',
    imageQuality: '90', 
    imageWidth: '',
    imageHeight: '',

    docFormat: 'pdf'
  });

  // Modal Log Viewer State
  const [logViewerJob, setLogViewerJob] = useState(null);
  const logTerminalRef = useRef(null);

  // Toast state
  const [toast, setToast] = useState(null);

  // Refs for file trigger
  const fileInputRef = useRef(null);

  // Trigger Toast Notification
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Trigger Local Standard File Selector Dialog
  const handleSelectFilesClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToQueue(Array.from(e.target.files));
    }
  };

  // Add selected file objects to conversion queue and probe metadata client-side
  const addFilesToQueue = (files) => {
    const newItems = files.map((file) => {
      const name = file.name;
      const ext = getExtension(name);
      const formatGroup = getFormatGroup(ext);
      
      let initialFormat = 'mp4';
      if (formatGroup === 'audio') initialFormat = 'mp3';
      if (formatGroup === 'image') initialFormat = 'webp';
      if (formatGroup === 'document') initialFormat = 'pdf';

      const id = 'job-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();

      return {
        id,
        file,
        name,
        ext,
        formatGroup,
        size: formatBytes(file.size),
        sizeBytes: file.size,
        status: 'idle',
        progress: 0,
        speed: 'N/A',
        timeRemaining: 'Hazır',
        elapsedTime: '00:00:00',
        outputSize: '0 B',
        logs: [],
        outputPath: '',
        meta: null,
        options: {
          formatGroup,
          format: initialFormat,
          videoCodec: options.videoCodec,
          videoBitrate: options.videoBitrate,
          resolution: options.resolution,
          fps: options.fps,
          audioCodec: options.videoAudioCodec,
          audioBitrate: options.videoAudioBitrate,
          audioSampleRate: options.audioSampleRate,
          audioChannels: options.audioChannels,
          quality: options.imageQuality,
          width: options.imageWidth,
          height: options.imageHeight,
          duration: 0
        }
      };
    });

    setQueue(prev => [...prev, ...newItems]);
    showToast(`${newItems.length} dosya kuyruğa eklendi.`, 'success');

    // Probe metadata for each added file client-side
    newItems.forEach((item) => {
      probeFileMetadataClientSide(item.id, item.file);
    });
  };

  // Probe file details natively using HTML5 APIs (extremely fast!)
  const probeFileMetadataClientSide = async (id, file) => {
    const formatGroup = getFormatGroup(getExtension(file.name));
    
    try {
      if (formatGroup === 'video' || formatGroup === 'audio') {
        const url = URL.createObjectURL(file);
        const media = document.createElement(formatGroup);
        media.preload = 'metadata';
        media.src = url;
        
        media.onloadedmetadata = () => {
          const duration = media.duration;
          let codecDetails = formatGroup.toUpperCase();
          if (formatGroup === 'video') {
            codecDetails = `${media.videoWidth}x${media.videoHeight} | ${Math.round(duration)}sn`;
          } else {
            codecDetails = `${Math.round(duration)}sn`;
          }
          
          setQueue(prev => prev.map(item => {
            if (item.id === id) {
              return {
                ...item,
                meta: {
                  duration,
                  codecDetails,
                  formatLong: file.type,
                  bitrate: 'N/A'
                },
                options: {
                  ...item.options,
                  duration
                }
              };
            }
            return item;
          }));
          URL.revokeObjectURL(url);
        };
        
        media.onerror = () => {
          setQueue(prev => prev.map(item => {
            if (item.id === id) {
              return {
                ...item,
                meta: {
                  duration: 0,
                  codecDetails: 'Okunuyor (WASM ile dönüştürülebilir)',
                  formatLong: file.type || 'Bilinmeyen Format',
                  bitrate: 'N/A'
                }
              };
            }
            return item;
          }));
          URL.revokeObjectURL(url);
        };
      } else if (formatGroup === 'image') {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.src = url;
        img.onload = () => {
          const codecDetails = `${img.width}x${img.height}`;
          setQueue(prev => prev.map(item => {
            if (item.id === id) {
              return {
                ...item,
                meta: {
                  duration: 0,
                  codecDetails,
                  formatLong: file.type,
                  bitrate: 'N/A'
                }
              };
            }
            return item;
          }));
          URL.revokeObjectURL(url);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
        };
      } else {
        setQueue(prev => prev.map(item => {
          if (item.id === id) {
            return {
              ...item,
              meta: {
                duration: 0,
                codecDetails: 'Belge',
                formatLong: 'Text/Document',
                bitrate: 'N/A'
              }
            };
          }
          return item;
        }));
      }
    } catch (err) {
      console.error('Probing failed for:', file.name, err);
    }
  };

  // Handle single item options update
  const updateItemOptions = (itemId, key, val) => {
    setQueue(prev => prev.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          options: {
            ...item.options,
            [key]: val
          }
        };
      }
      return item;
    }));
  };

  // Apply active UI options (global panel state) to current selected item or all matching format items
  const handleApplyOptions = (applyToAll = false) => {
    if (applyToAll) {
      setQueue(prev => prev.map(item => {
        if (item.formatGroup === activeTab) {
          let updatedOptions = { ...item.options };
          if (activeTab === 'video') {
            updatedOptions.format = options.videoFormat;
            updatedOptions.videoCodec = options.videoCodec;
            updatedOptions.videoBitrate = options.videoBitrate;
            updatedOptions.resolution = options.resolution;
            updatedOptions.fps = options.fps;
            updatedOptions.audioCodec = options.videoAudioCodec;
            updatedOptions.audioBitrate = options.videoAudioBitrate;
          } else if (activeTab === 'audio') {
            updatedOptions.format = options.audioFormat;
            updatedOptions.audioCodec = options.audioCodec;
            updatedOptions.audioBitrate = options.audioBitrate;
            updatedOptions.audioSampleRate = options.audioSampleRate;
            updatedOptions.audioChannels = options.audioChannels;
          } else if (activeTab === 'image') {
            updatedOptions.format = options.imageFormat;
            updatedOptions.quality = options.imageQuality;
            updatedOptions.width = options.imageWidth;
            updatedOptions.height = options.imageHeight;
          } else if (activeTab === 'document') {
            updatedOptions.format = options.docFormat;
          }
          return { ...item, options: updatedOptions };
        }
        return item;
      }));
      showToast(`Tüm ${activeTab.toUpperCase()} dosyalarının ayarları güncellendi.`, 'success');
    } else if (selectedQueueItemId) {
      setQueue(prev => prev.map(item => {
        if (item.id === selectedQueueItemId) {
          let updatedOptions = { ...item.options };
          if (activeTab === 'video') {
            updatedOptions.format = options.videoFormat;
            updatedOptions.videoCodec = options.videoCodec;
            updatedOptions.videoBitrate = options.videoBitrate;
            updatedOptions.resolution = options.resolution;
            updatedOptions.fps = options.fps;
            updatedOptions.audioCodec = options.videoAudioCodec;
            updatedOptions.audioBitrate = options.videoAudioBitrate;
          } else if (activeTab === 'audio') {
            updatedOptions.format = options.audioFormat;
            updatedOptions.audioCodec = options.audioCodec;
            updatedOptions.audioBitrate = options.audioBitrate;
            updatedOptions.audioSampleRate = options.audioSampleRate;
            updatedOptions.audioChannels = options.audioChannels;
          } else if (activeTab === 'image') {
            updatedOptions.format = options.imageFormat;
            updatedOptions.quality = options.imageQuality;
            updatedOptions.width = options.imageWidth;
            updatedOptions.height = options.imageHeight;
          } else if (activeTab === 'document') {
            updatedOptions.format = options.docFormat;
          }
          return { ...item, options: updatedOptions };
        }
        return item;
      }));
      showToast('Seçili dosya ayarları güncellendi.', 'success');
    }
  };

  // Handle Preset Select
  const handleSelectPreset = (presetId) => {
    setActivePreset(presetId);
    if (presetId === 'none') return;
    
    let selectedPreset = null;
    if (activeTab === 'video') {
      selectedPreset = VIDEO_PRESETS.find(p => p.id === presetId);
    } else if (activeTab === 'audio') {
      selectedPreset = AUDIO_PRESETS.find(p => p.id === presetId);
    } else if (activeTab === 'image') {
      selectedPreset = IMAGE_PRESETS.find(p => p.id === presetId);
    }

    if (selectedPreset) {
      setOptions(prev => ({
        ...prev,
        ...selectedPreset.options
      }));

      if (selectedQueueItemId) {
        setQueue(prev => prev.map(item => {
          if (item.id === selectedQueueItemId) {
            return {
              ...item,
              options: {
                ...item.options,
                format: selectedPreset.options.videoFormat || selectedPreset.options.audioFormat || selectedPreset.options.imageFormat,
                videoCodec: selectedPreset.options.videoCodec || item.options.videoCodec,
                videoBitrate: selectedPreset.options.videoBitrate || item.options.videoBitrate,
                resolution: selectedPreset.options.resolution || item.options.resolution,
                fps: selectedPreset.options.fps || item.options.fps,
                audioCodec: selectedPreset.options.audioCodec || selectedPreset.options.videoAudioCodec || item.options.audioCodec,
                audioBitrate: selectedPreset.options.audioBitrate || selectedPreset.options.videoAudioBitrate || item.options.audioBitrate,
                quality: selectedPreset.options.imageQuality || item.options.quality,
                width: selectedPreset.options.imageWidth || item.options.width,
                height: selectedPreset.options.imageHeight || item.options.height
              }
            };
          }
          return item;
        }));
      }

      showToast(`"${selectedPreset.name}" şablonu yüklendi.`);
    }
  };

  // Sync tab selection with selected queue item
  const handleSelectItem = (item) => {
    setSelectedQueueItemId(item.id);
    setActiveTab(item.formatGroup);
    setActivePreset('none');
    
    setOptions(prev => {
      const next = { ...prev };
      if (item.formatGroup === 'video') {
        next.videoFormat = item.options.format;
        next.videoCodec = item.options.videoCodec;
        next.videoBitrate = item.options.videoBitrate;
        next.resolution = item.options.resolution;
        next.fps = item.options.fps;
        next.videoAudioCodec = item.options.audioCodec;
        next.videoAudioBitrate = item.options.audioBitrate;
      } else if (item.formatGroup === 'audio') {
        next.audioFormat = item.options.format;
        next.audioCodec = item.options.audioCodec;
        next.audioBitrate = item.options.audioBitrate;
        next.audioSampleRate = item.options.audioSampleRate;
        next.audioChannels = item.options.audioChannels;
      } else if (item.formatGroup === 'image') {
        next.imageFormat = item.options.format;
        next.imageQuality = item.options.quality;
        next.imageWidth = item.options.width;
        next.imageHeight = item.options.height;
      } else if (item.formatGroup === 'document') {
        next.docFormat = item.options.format;
      }
      return next;
    });
  };

  // Remove single file from queue
  const handleRemoveItem = (id) => {
    const item = queue.find(i => i.id === id);
    if (item && (item.status === 'converting' || item.status === 'pending')) {
      handleCancelConversion(id);
    }
    setQueue(prev => prev.filter(item => item.id !== id));
    if (selectedQueueItemId === id) setSelectedQueueItemId(null);
  };

  // Clear all successful/failed/cancelled files
  const handleClearCompleted = () => {
    setQueue(prev => prev.filter(item => item.status === 'pending' || item.status === 'converting'));
    showToast('Tamamlanan işlemler temizlendi.');
  };

  // Start conversion for a specific item
  const handleStartConversion = async (id) => {
    setQueue(prev => prev.map(q => {
      if (q.id === id) {
        return { ...q, status: 'pending', progress: 0, speed: 'N/A', timeRemaining: 'Kuyrukta...', logs: [] };
      }
      return q;
    }));
  };

  // Document processing directly inside user device
  const runDocumentConversionClientSide = async (item) => {
    try {
      const fileText = await item.file.text();
      const targetExt = item.options.format.toLowerCase();
      
      let outputBlob = null;
      
      if (targetExt === 'html') {
        let htmlContent = '';
        if (item.file.name.endsWith('.md')) {
          let parsed = fileText
            .replace(/# (.*)/g, '<h1>$1</h1>')
            .replace(/## (.*)/g, '<h2>$1</h2>')
            .replace(/### (.*)/g, '<h3>$1</h3>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br/>');
          htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Dönüştürülen Belge</title><style>body { font-family: sans-serif; padding: 20px; line-height: 1.6; color: #333; }</style></head><body>${parsed}</body></html>`;
        } else {
          const paragraphs = fileText.split('\n').map(p => `<p>${p}</p>`).join('');
          htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Dönüştürülen Belge</title></head><body>${paragraphs}</body></html>`;
        }
        outputBlob = new Blob([htmlContent], { type: 'text/html' });
      } 
      else if (targetExt === 'txt') {
        let stripped = fileText;
        if (item.file.name.endsWith('.html') || item.file.name.endsWith('.htm')) {
          stripped = fileText.replace(/<[^>]*>/g, '');
        }
        outputBlob = new Blob([stripped], { type: 'text/plain' });
      } 
      else if (targetExt === 'pdf') {
        const pdfBytes = generateSimplePDFClientSide(fileText);
        outputBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      } else {
        throw new Error('Desteklenmeyen belge türü: ' + targetExt);
      }

      const blobUrl = URL.createObjectURL(outputBlob);
      
      // Auto download
      const cleanBase = item.name.substring(0, item.name.lastIndexOf('.')) || item.name;
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${cleanBase}_converted.${targetExt}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setQueue(prev => prev.map(q => {
        if (q.id === item.id) {
          return {
            ...q,
            status: 'success',
            progress: 100,
            timeRemaining: 'Tamamlandı',
            outputSize: formatBytes(outputBlob.size),
            outputPath: blobUrl
          };
        }
        return q;
      }));

      showToast('Dönüşüm tamamlandı ve indirme başlatıldı.', 'success');

    } catch (err) {
      console.error('Document conversion failed:', err);
      setQueue(prev => prev.map(q => {
        if (q.id === item.id) {
          return {
            ...q,
            status: 'error',
            timeRemaining: 'Hata',
            logs: [err.message]
          };
        }
        return q;
      }));
    }
  };

  // Generate a valid minimal PDF buffer
  const generateSimplePDFClientSide = (text) => {
    const lines = text.split('\n');
    let pdfText = '';
    let y = 700;
    lines.forEach((line) => {
      const escaped = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
      pdfText += `BT /F1 12 Tf 72 ${y} Td (${escaped}) Tj ET\n`;
      y -= 15;
      if (y < 50) {
        y = 700; 
      }
    });

    const obj1 = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`;
    const obj2 = `2 0 obj\n<< /Type /Pages /Kids [ 3 0 R ] /Count 1 >>\nendobj`;
    const obj3 = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [ 0 0 612 792 ] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj`;
    const obj4 = `4 0 obj\n<< /Length ${pdfText.length} >>\nstream\n${pdfText}endstream\nendobj`;
    const obj5 = `5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`;

    let pdf = `%PDF-1.4\n`;
    const offsets = [];
    
    const addPDFObj = (objStr) => {
      offsets.push(pdf.length);
      pdf += objStr + '\n';
    };

    addPDFObj(obj1);
    addPDFObj(obj2);
    addPDFObj(obj3);
    addPDFObj(obj4);
    addPDFObj(obj5);

    const startxref = pdf.length;
    pdf += `xref\n0 6\n0000000000 65535 f \n`;
    offsets.forEach((offset) => {
      pdf += offset.toString().padStart(10, '0') + ` 00000 n \n`;
    });
    pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF`;
    
    const buf = new Uint8Array(pdf.length);
    for (let i = 0; i < pdf.length; i++) {
      buf[i] = pdf.charCodeAt(i) & 0xff;
    }
    return buf;
  };

  // In-browser conversion using FFmpeg WebAssembly
  const executeConversionClientSide = async (item) => {
    let tickInterval = null;
    try {
      setQueue(prev => prev.map(q => {
        if (q.id === item.id) {
          return { ...q, status: 'converting', timeRemaining: 'Başlatılıyor...' };
        }
        return q;
      }));

      if (item.formatGroup === 'document') {
        await runDocumentConversionClientSide(item);
        return;
      }

      const logLines = [];
      const updateLogs = (newText) => {
        logLines.push(newText);
        setQueue(prev => prev.map(q => {
          if (q.id === item.id) {
            return { ...q, logs: [...logLines] };
          }
          return q;
        }));
        
        if (logViewerJob && logViewerJob.id === item.id) {
          setTimeout(() => {
            if (logTerminalRef.current) {
              logTerminalRef.current.scrollTop = logTerminalRef.current.scrollHeight;
            }
          }, 50);
        }
      };

      const handleFFmpegProgress = ({ progress }) => {
        const percent = Math.min(Math.round(progress * 100 * 10) / 10, 99.9);
        setQueue(prev => prev.map(q => {
          if (q.id === item.id) {
            return { ...q, progress: percent, timeRemaining: 'Dönüştürülüyor...' };
          }
          return q;
        }));
      };

      updateLogs('FFmpeg motoru yükleniyor (CDN aracılığıyla)...\n');

      let lastSpeed = 'N/A';
      let lastSize = '0 B';

      const ffmpeg = await getFFmpeg((log) => {
        const msg = log.message;
        updateLogs(msg + '\n');

        // Extract speed (e.g. speed= 1.25x or speed=2.5x)
        const speedMatch = msg.match(/speed=\s*([\d\.]+)x/);
        if (speedMatch) {
          lastSpeed = speedMatch[1] + 'x';
        }

        // Extract size (e.g. size=   1024kB)
        const sizeMatch = msg.match(/size=\s*(\d+)\s*kB/);
        if (sizeMatch) {
          lastSize = formatBytes(parseInt(sizeMatch[1]) * 1024);
        } else {
          const sizeMatch2 = msg.match(/size=\s*(\d+)([kKmM]?i?B)/);
          if (sizeMatch2) {
            lastSize = sizeMatch2[1] + ' ' + sizeMatch2[2];
          }
        }

        // Update real-time stats in the UI
        if (speedMatch || sizeMatch) {
          setQueue(prev => prev.map(q => {
            if (q.id === item.id && q.status === 'converting') {
              return {
                ...q,
                speed: lastSpeed,
                outputSize: lastSize
              };
            }
            return q;
          }));
        }
      }, handleFFmpegProgress);

      updateLogs('Dosya tarayıcı belleğine yazılıyor...\n');
      const inputName = item.name;
      const targetExt = item.options.format.toLowerCase();
      const cleanBase = item.name.substring(0, item.name.lastIndexOf('.')) || item.name;
      const outputName = `${cleanBase}_converted_${Date.now()}.${targetExt}`;

      await ffmpeg.writeFile(inputName, await fetchFile(item.file));

      const args = ['-y', '-i', inputName];
      const options = item.options;

      if (item.formatGroup === 'video') {
        if (options.videoCodec === 'copy') {
          args.push('-c:v', 'copy');
        } else if (options.videoCodec === 'h264') {
          args.push('-c:v', 'libx264');
        } else if (options.videoCodec === 'h265') {
          args.push('-c:v', 'libx265');
        } else if (options.videoCodec === 'vp9') {
          args.push('-c:v', 'libvpx-vp9');
        } else if (options.videoCodec === 'av1') {
          args.push('-c:v', 'libx264'); // Fallback to x264 on wasm if AV1 encoder missing
        } else if (options.videoCodec === 'prores') {
          args.push('-c:v', 'prores_ks', '-profile:v', '2');
        }

        if (options.videoBitrate && options.videoCodec !== 'copy' && options.videoCodec !== 'prores') {
          args.push('-b:v', `${options.videoBitrate}k`);
        }

        if (options.resolution && options.resolution !== 'original' && options.videoCodec !== 'copy') {
          const resMap = {
            '4k': '3840:-2',
            '1080p': '1920:-2',
            '720p': '1280:-2',
            '480p': '854:-2',
            '360p': '640:-2'
          };
          if (options.resolution === '1080x1920') {
            args.push('-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920');
          } else if (resMap[options.resolution]) {
            args.push('-vf', `scale=${resMap[options.resolution]}`);
          }
        }

        if (options.fps && options.fps !== 'copy' && options.videoCodec !== 'copy') {
          args.push('-r', options.fps);
        }

        if (options.audioCodec === 'copy') {
          args.push('-c:a', 'copy');
        } else if (options.audioCodec === 'aac') {
          args.push('-c:a', 'aac');
        } else if (options.audioCodec === 'mp3') {
          args.push('-c:a', 'libmp3lame');
        } else if (options.audioCodec === 'opus') {
          args.push('-c:a', 'libopus');
        } else if (options.audioCodec === 'pcm') {
          args.push('-c:a', 'pcm_s16le');
        } else if (options.audioCodec === 'none') {
          args.push('-an');
        }

        if (options.audioBitrate && options.audioCodec !== 'copy' && options.audioCodec !== 'none') {
          args.push('-b:a', `${options.audioBitrate}k`);
        }
      } 
      else if (item.formatGroup === 'audio') {
        if (options.audioCodec === 'mp3') {
          args.push('-c:a', 'libmp3lame');
        } else if (options.audioCodec === 'aac') {
          args.push('-c:a', 'aac');
        } else if (options.audioCodec === 'pcm') {
          args.push('-c:a', targetExt === 'wav' ? 'pcm_s16le' : 'pcm_s16be');
        } else if (options.audioCodec === 'flac') {
          args.push('-c:a', 'flac');
        } else if (options.audioCodec === 'opus') {
          args.push('-c:a', 'libopus');
        }

        if (options.audioBitrate) {
          args.push('-b:a', `${options.audioBitrate}k`);
        }

        if (options.audioSampleRate && options.audioSampleRate !== 'copy') {
          args.push('-ar', options.audioSampleRate);
        }

        if (options.audioChannels && options.audioChannels !== 'copy') {
          args.push('-ac', options.audioChannels);
        }
      } 
      else if (item.formatGroup === 'image') {
        if (options.quality && (targetExt === 'jpg' || targetExt === 'jpeg' || targetExt === 'webp')) {
          if (targetExt === 'webp') {
            args.push('-qscale:v', Math.round((100 - options.quality) / 5) || 1);
          } else {
            args.push('-q:v', Math.round((101 - options.quality) / 10) || 1);
          }
        }

        if ((options.width || options.height) && !isNaN(options.width) && !isNaN(options.height)) {
          const w = options.width || -1;
          const h = options.height || -1;
          args.push('-vf', `scale=${w}:${h}`);
        }
      }

      args.push(outputName);

      updateLogs(`Komut yürütülüyor: ffmpeg ${args.join(' ')}\n`);
      const startTime = Date.now();

      // Start elapsed time ticking
      tickInterval = setInterval(() => {
        const elapsedSec = (Date.now() - startTime) / 1000;
        setQueue(prev => prev.map(q => {
          if (q.id === item.id && q.status === 'converting') {
            return {
              ...q,
              elapsedTime: formatDuration(elapsedSec)
            };
          }
          return q;
        }));
      }, 1000);

      await ffmpeg.exec(args);

      // Stop timer
      if (tickInterval) {
        clearInterval(tickInterval);
        tickInterval = null;
      }

      updateLogs('İşlem tamamlandı. Dosya sistemden alınıyor...\n');
      const data = await ffmpeg.readFile(outputName);

      const mimeTypes = {
        'mp4': 'video/mp4',
        'mkv': 'video/x-matroska',
        'webm': 'video/webm',
        'avi': 'video/x-msvideo',
        'mov': 'video/quicktime',
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'aac': 'audio/aac',
        'flac': 'audio/flac',
        'ogg': 'audio/ogg',
        'm4a': 'audio/mp4',
        'webp': 'image/webp',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'bmp': 'image/bmp',
        'gif': 'image/gif',
        'ico': 'image/x-icon'
      };
      const mime = mimeTypes[targetExt] || 'application/octet-stream';
      const outputBlob = new Blob([data], { type: mime });
      const blobUrl = URL.createObjectURL(outputBlob);

      // Clean virtual files
      try {
        await ffmpeg.deleteFile(inputName);
        await ffmpeg.deleteFile(outputName);
      } catch (err) {
        console.error('Virtual FS cleanup error:', err);
      }

      const elapsedMs = Date.now() - startTime;
      const formattedElapsed = formatDuration(elapsedMs / 1000);

      // Trigger automatic browser download
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${cleanBase}_converted.${targetExt}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setQueue(prev => prev.map(q => {
        if (q.id === item.id) {
          return {
            ...q,
            status: 'success',
            progress: 100,
            timeRemaining: 'Tamamlandı',
            elapsedTime: formattedElapsed,
            outputSize: formatBytes(outputBlob.size),
            outputPath: blobUrl
          };
        }
        return q;
      }));

      showToast('Dönüşüm tamamlandı ve indirme başlatıldı.', 'success');

    } catch (err) {
      console.error('Transcode failure:', err);
      setQueue(prev => prev.map(q => {
        if (q.id === item.id) {
          return {
            ...q,
            status: 'error',
            timeRemaining: 'Hata',
            logs: [...q.logs, `\n[Hata] İşlem yarıda kesildi: ${err.message}`]
          };
        }
        return q;
      }));
    } finally {
      if (tickInterval) {
        clearInterval(tickInterval);
      }
    }
  };

  // Abort conversion and clean instance
  const handleCancelConversion = (id) => {
    if (ffmpegInstance) {
      try {
        ffmpegInstance.terminate();
        ffmpegInstance = null;
      } catch (err) {
        console.error('Error terminating FFmpeg WASM:', err);
      }
    }

    setQueue(prev => prev.map(q => {
      if (q.id === id) {
        return { ...q, status: 'cancelled', timeRemaining: 'İptal Edildi' };
      }
      return q;
    }));
    showToast('İşlem iptal edildi.', 'error');
  };

  // Trigger all eligible files
  const handleStartAll = () => {
    setQueue(prev => prev.map(item => {
      if (item.status === 'idle' || item.status === 'error' || item.status === 'cancelled') {
        return { ...item, status: 'pending', progress: 0, speed: 'N/A', timeRemaining: 'Kuyrukta...', logs: [] };
      }
      return item;
    }));
    showToast('Tüm işlemler sıraya alındı.', 'success');
  };

  // Concurrency Scheduler Loop (1 job at a time for WASM browser stability)
  useEffect(() => {
    const convertingJobs = queue.filter(q => q.status === 'converting');
    const pendingJobs = queue.filter(q => q.status === 'pending');

    if (convertingJobs.length < 1 && pendingJobs.length > 0) {
      const nextJob = pendingJobs[0];
      executeConversionClientSide(nextJob);
    }
  }, [queue]);

  // Drag & Drop events
  const [dragActive, setDragActive] = useState(false);
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToQueue(Array.from(e.dataTransfer.files));
    }
  };

  const idleCount = queue.filter(q => q.status === 'idle').length;
  const pendingCount = queue.filter(q => q.status === 'pending').length;
  const convertingCount = queue.filter(q => q.status === 'converting').length;
  const completedCount = queue.filter(q => q.status === 'success').length;

  return (
    <div className="app-container">
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle size={20} /> : <XCircle size={20} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Hidden standard file pick trigger */}
      <input 
        type="file" 
        multiple 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        onChange={handleFileChange}
      />

      {/* Header */}
      <header className="app-header">
        <div className="brand">
          <Sparkles className="brand-icon" size={36} />
          <div>
            <h1 className="brand-title glow-text-purple">Cevir.im</h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>developer: <span style={{ color: 'var(--accent-purple)', fontWeight: 'bold' }}>kayapater</span></p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div className="cloudflare-badge">
            <Sparkles size={14} style={{ color: 'var(--accent-blue)' }} />
            <span>%100 Güvenli & Tarayıcıda (WASM)</span>
          </div>
        </div>
      </header>

      <div className="dashboard-grid">
        <div className="dashboard-column">
          
          {/* File Picker Zone */}
          <div 
            className={`dropzone ${dragActive ? 'active' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={handleSelectFilesClick}
          >
            <UploadCloud className="dropzone-icon" size={54} />
            <h3 className="dropzone-title">Dosya Eklemek İçin Sürükleyin veya Tıklayın</h3>
            <p className="dropzone-desc">Çoklu video, ses, görsel ve metin belgeleri ekleyebilirsiniz.</p>
            <p className="dropzone-desc" style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--accent-purple)' }}>
              * Dosyalarınız sunucuya yüklenmez, doğrudan kendi bilgisayarınızda dönüştürülür.
            </p>
          </div>

          {/* Options Panel Card */}
          <div className="glass panel-section">
            <div className="panel-header">
              <Layers size={18} style={{ color: 'var(--accent-purple)' }} />
              <div className="panel-title">
                Format ve Codec Ayarları 
                {selectedQueueItemId && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--accent-blue)', fontWeight: 'normal' }}>
                    (Seçili Dosya İçin)
                  </span>
                )}
              </div>
            </div>

            <div className="settings-tabs">
              <button 
                className={`tab-btn ${activeTab === 'video' ? 'active' : ''}`}
                onClick={() => { setActiveTab('video'); setActivePreset('none'); }}
              >
                <Video size={14} /> Video
              </button>
              <button 
                className={`tab-btn ${activeTab === 'audio' ? 'active' : ''}`}
                onClick={() => { setActiveTab('audio'); setActivePreset('none'); }}
              >
                <Music size={14} /> Ses
              </button>
              <button 
                className={`tab-btn ${activeTab === 'image' ? 'active' : ''}`}
                onClick={() => { setActiveTab('image'); setActivePreset('none'); }}
              >
                <ImageIcon size={14} /> Görsel
              </button>
              <button 
                className={`tab-btn ${activeTab === 'document' ? 'active' : ''}`}
                onClick={() => { setActiveTab('document'); setActivePreset('none'); }}
              >
                <FileText size={14} /> Belge
              </button>
            </div>

            {activeTab !== 'document' && (
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-purple)' }}>
                  <Sparkles size={14} />
                  Hazır Şablonlar (Presets)
                </label>
                <select 
                  className="select-input"
                  style={{ border: '1px solid rgba(168, 85, 247, 0.4)', background: 'rgba(15, 10, 30, 0.6)' }}
                  value={activePreset}
                  onChange={(e) => handleSelectPreset(e.target.value)}
                >
                  {activeTab === 'video' && VIDEO_PRESETS.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                  {activeTab === 'audio' && AUDIO_PRESETS.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                  {activeTab === 'image' && IMAGE_PRESETS.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="settings-grid">
              {activeTab === 'video' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Hedef Format</label>
                    <select 
                      className="select-input"
                      value={options.videoFormat}
                      onChange={(e) => {
                        setOptions(prev => ({ ...prev, videoFormat: e.target.value }));
                        if (selectedQueueItemId) updateItemOptions(selectedQueueItemId, 'format', e.target.value);
                      }}
                    >
                      <option value="mp4">MP4 (.mp4)</option>
                      <option value="mkv">MKV (.mkv)</option>
                      <option value="webm">WebM (.webm)</option>
                      <option value="avi">AVI (.avi)</option>
                      <option value="mov">MOV (.mov)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Video Codec</label>
                    <select 
                      className="select-input"
                      value={options.videoCodec}
                      onChange={(e) => {
                        setOptions(prev => ({ ...prev, videoCodec: e.target.value }));
                        if (selectedQueueItemId) updateItemOptions(selectedQueueItemId, 'videoCodec', e.target.value);
                      }}
                    >
                      <option value="h264">H.264 (x264) - En Uyumlu</option>
                      <option value="h265">H.265 (HEVC/x265) - Yüksek Sıkıştırma</option>
                      <option value="vp9">VP9 (WebM için ideal)</option>
                      <option value="av1">AV1 (En Yeni Standard)</option>
                      <option value="prores">Apple ProRes 422 (Kurgu Uyumlu)</option>
                      <option value="copy">Kopyala (Doğrudan Çıkar - Çok Hızlı)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Video Bitrate</label>
                    <select 
                      className="select-input"
                      value={options.videoBitrate}
                      onChange={(e) => {
                        setOptions(prev => ({ ...prev, videoBitrate: e.target.value }));
                        if (selectedQueueItemId) updateItemOptions(selectedQueueItemId, 'videoBitrate', e.target.value);
                      }}
                      disabled={options.videoCodec === 'copy' || options.videoCodec === 'prores'}
                    >
                      <option value="">Orijinal Bitrate</option>
                      <option value="6000">6000 kbps (1080p Yüksek)</option>
                      <option value="4000">4000 kbps (1080p Orta)</option>
                      <option value="2000">2000 kbps (720p Orta)</option>
                      <option value="1000">1000 kbps (Düşük)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Çözünürlük</label>
                    <select 
                      className="select-input"
                      value={options.resolution}
                      onChange={(e) => {
                        setOptions(prev => ({ ...prev, resolution: e.target.value }));
                        if (selectedQueueItemId) updateItemOptions(selectedQueueItemId, 'resolution', e.target.value);
                      }}
                      disabled={options.videoCodec === 'copy'}
                    >
                      <option value="original">Orijinal Boyut</option>
                      <option value="4k">4K Ultra HD (2160p)</option>
                      <option value="1080p">1080p Full HD</option>
                      <option value="720p">720p HD</option>
                      <option value="480p">480p Standart</option>
                      <option value="1080x1920">Dikey Reels/Shorts (1080x1920)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">FPS (Kare Hızı)</label>
                    <select 
                      className="select-input"
                      value={options.fps}
                      onChange={(e) => {
                        setOptions(prev => ({ ...prev, fps: e.target.value }));
                        if (selectedQueueItemId) updateItemOptions(selectedQueueItemId, 'fps', e.target.value);
                      }}
                      disabled={options.videoCodec === 'copy'}
                    >
                      <option value="copy">Orijinal FPS</option>
                      <option value="60">60 FPS (Pürüzsüz)</option>
                      <option value="30">30 FPS (Standart)</option>
                      <option value="25">25 FPS</option>
                      <option value="24">24 FPS (Sinematik)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Ses Codec</label>
                    <select 
                      className="select-input"
                      value={options.videoAudioCodec}
                      onChange={(e) => {
                        setOptions(prev => ({ ...prev, videoAudioCodec: e.target.value }));
                        if (selectedQueueItemId) updateItemOptions(selectedQueueItemId, 'audioCodec', e.target.value);
                      }}
                    >
                      <option value="aac">AAC (En Uyumlu)</option>
                      <option value="mp3">MP3 (Yüksek Sıkıştırma)</option>
                      <option value="opus">Opus (Çok Düşük Boyut)</option>
                      <option value="pcm">Kayıpsız PCM (MOV/ProRes Uyumlu)</option>
                      <option value="copy">Kopyala (Orijinal Ses)</option>
                      <option value="none">Sesi Kapat (Sessiz)</option>
                    </select>
                  </div>
                </>
              )}

              {activeTab === 'audio' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Hedef Format</label>
                    <select 
                      className="select-input"
                      value={options.audioFormat}
                      onChange={(e) => {
                        setOptions(prev => ({ ...prev, audioFormat: e.target.value }));
                        if (selectedQueueItemId) updateItemOptions(selectedQueueItemId, 'format', e.target.value);
                      }}
                    >
                      <option value="mp3">MP3 (.mp3)</option>
                      <option value="wav">WAV (Kayıpsız / Büyük)</option>
                      <option value="aac">AAC (.aac)</option>
                      <option value="flac">FLAC (Kayıpsız Sıkıştırılmış)</option>
                      <option value="ogg">OGG (.ogg)</option>
                      <option value="m4a">M4A (.m4a)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Ses Codec / Sıkıştırma</label>
                    <select 
                      className="select-input"
                      value={options.audioCodec}
                      onChange={(e) => {
                        setOptions(prev => ({ ...prev, audioCodec: e.target.value }));
                        if (selectedQueueItemId) updateItemOptions(selectedQueueItemId, 'audioCodec', e.target.value);
                      }}
                    >
                      {options.audioFormat === 'mp3' && <option value="mp3">LAME MP3 Encoder</option>}
                      {options.audioFormat === 'wav' && <option value="pcm">WAV PCM 16-bit</option>}
                      {options.audioFormat === 'aac' && <option value="aac">AAC Native Encoder</option>}
                      {options.audioFormat === 'flac' && <option value="flac">FLAC Encoder</option>}
                      {options.audioFormat === 'ogg' && <option value="opus">Opus Audio Codec</option>}
                      {options.audioFormat === 'm4a' && (
                        <>
                          <option value="aac">AAC Encoder (M4A)</option>
                          <option value="flac">ALAC (Kayıpsız Apple)</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Ses Bitrate</label>
                    <select 
                      className="select-input"
                      value={options.audioBitrate}
                      onChange={(e) => {
                        setOptions(prev => ({ ...prev, audioBitrate: e.target.value }));
                        if (selectedQueueItemId) updateItemOptions(selectedQueueItemId, 'audioBitrate', e.target.value);
                      }}
                      disabled={options.audioFormat === 'wav' || options.audioFormat === 'flac'}
                    >
                      <option value="320">320 kbps (Ultra Kalite)</option>
                      <option value="256">256 kbps (Stüdyo)</option>
                      <option value="192">192 kbps (CD Kalitesi)</option>
                      <option value="128">128 kbps (Standart)</option>
                      <option value="96">96 kbps (Haber/Ses)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Örnekleme Hızı</label>
                    <select 
                      className="select-input"
                      value={options.audioSampleRate}
                      onChange={(e) => {
                        setOptions(prev => ({ ...prev, audioSampleRate: e.target.value }));
                        if (selectedQueueItemId) updateItemOptions(selectedQueueItemId, 'audioSampleRate', e.target.value);
                      }}
                    >
                      <option value="copy">Orijinal Hız</option>
                      <option value="48000">48000 Hz (Video Uyumlu)</option>
                      <option value="44100">44100 Hz (Müzik Standardı)</option>
                      <option value="32000">32000 Hz</option>
                      <option value="22050">22050 Hz</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Ses Kanalları</label>
                    <select 
                      className="select-input"
                      value={options.audioChannels}
                      onChange={(e) => {
                        setOptions(prev => ({ ...prev, audioChannels: e.target.value }));
                        if (selectedQueueItemId) updateItemOptions(selectedQueueItemId, 'audioChannels', e.target.value);
                      }}
                    >
                      <option value="copy">Orijinal Kanal</option>
                      <option value="2">Stereo (2 Kanal)</option>
                      <option value="1">Mono (Tek Kanal)</option>
                    </select>
                  </div>
                </>
              )}

              {activeTab === 'image' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Hedef Format</label>
                    <select 
                      className="select-input"
                      value={options.imageFormat}
                      onChange={(e) => {
                        setOptions(prev => ({ ...prev, imageFormat: e.target.value }));
                        if (selectedQueueItemId) updateItemOptions(selectedQueueItemId, 'format', e.target.value);
                      }}
                    >
                      <option value="webp">WebP (Optimize İnternet)</option>
                      <option value="jpeg">JPEG (.jpg)</option>
                      <option value="png">PNG (Şeffaflık Korur)</option>
                      <option value="bmp">BMP (Kayıpsız Ham)</option>
                      <option value="gif">GIF (.gif)</option>
                      <option value="ico">ICO (Simge/Favicon)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Görsel Kalitesi (0-100)</label>
                    <input 
                      type="number" 
                      className="text-input"
                      value={options.imageQuality}
                      min="1"
                      max="100"
                      onChange={(e) => {
                        setOptions(prev => ({ ...prev, imageQuality: e.target.value }));
                        if (selectedQueueItemId) updateItemOptions(selectedQueueItemId, 'quality', e.target.value);
                      }}
                      disabled={options.imageFormat === 'png' || options.imageFormat === 'bmp'}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Genişlik (Genişlik Px)</label>
                    <input 
                      type="number" 
                      className="text-input"
                      value={options.imageWidth}
                      placeholder="Orijinal Genişlik"
                      onChange={(e) => {
                        setOptions(prev => ({ ...prev, imageWidth: e.target.value }));
                        if (selectedQueueItemId) updateItemOptions(selectedQueueItemId, 'width', e.target.value);
                      }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Yükseklik (Yükseklik Px)</label>
                    <input 
                      type="number" 
                      className="text-input"
                      value={options.imageHeight}
                      placeholder="Orijinal Yükseklik"
                      onChange={(e) => {
                        setOptions(prev => ({ ...prev, imageHeight: e.target.value }));
                        if (selectedQueueItemId) updateItemOptions(selectedQueueItemId, 'height', e.target.value);
                      }}
                    />
                  </div>
                </>
              )}

              {activeTab === 'document' && (
                <div className="form-group grid-col-span-2">
                  <label className="form-label">Hedef Belge Formatı</label>
                  <select 
                    className="select-input"
                    value={options.docFormat}
                    onChange={(e) => {
                      setOptions(prev => ({ ...prev, docFormat: e.target.value }));
                      if (selectedQueueItemId) updateItemOptions(selectedQueueItemId, 'format', e.target.value);
                    }}
                  >
                    <option value="pdf">PDF Belgesi (.pdf)</option>
                    <option value="html">HTML Web Sayfası (.html)</option>
                    <option value="txt">Düz Metin Belgesi (.txt)</option>
                  </select>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                    * Desteklenen dönüşümler: Markdown (.md) veya Text (.txt) dosyalarınızı PDF veya HTML sayfalarına, HTML sayfalarınızı ise temizleyerek Text belgesine dönüştürebilirsiniz.
                  </p>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              {selectedQueueItemId ? (
                <>
                  <button 
                    className="action-btn btn-secondary" 
                    style={{ flex: 1 }}
                    onClick={() => setSelectedQueueItemId(null)}
                  >
                    Seçimi Kaldır
                  </button>
                  <button className="action-btn" style={{ flex: 1 }} onClick={() => handleApplyOptions(false)}>
                    Dosyaya Uygula
                  </button>
                </>
              ) : (
                <button className="action-btn" style={{ width: '100%' }} onClick={() => handleApplyOptions(true)}>
                  Tüm {activeTab.toUpperCase()} Dosyalarına Uygula
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Queue & Process Listing */}
        <div className="dashboard-column">
          <div className="glass panel-section queue-section">
            <div className="queue-header-actions">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="panel-title">İşlem Sırası</span>
                {queue.length > 0 && (
                  <span className="queue-count">
                    ({queue.length} dosya - {idleCount} hazır, {pendingCount} sırada, {convertingCount} aktif)
                  </span>
                )}
              </div>

              {queue.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="settings-btn" onClick={handleClearCompleted} style={{ padding: '0.4rem 0.8rem' }}>
                    Bitenleri Temizle
                  </button>
                  <button className="action-btn" onClick={handleStartAll} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                    <Play size={14} /> Hepsini Başlat
                  </button>
                </div>
              )}
            </div>

            {queue.length === 0 ? (
              <div className="empty-queue">
                <FileText size={32} />
                <p style={{ fontWeight: 600 }}>Dönüştürülecek dosya yok</p>
                <p style={{ fontSize: '0.8rem' }}>Soldaki panelden dosya seçerek başlayın.</p>
              </div>
            ) : (
              <div className="queue-list">
                {queue.map((item) => {
                  const isSelected = selectedQueueItemId === item.id;
                  
                  return (
                    <div 
                      key={item.id} 
                      className={`queue-item status-${item.status}`}
                      style={{ 
                        borderColor: isSelected ? 'var(--accent-purple)' : 'var(--border-color)',
                        boxShadow: isSelected ? 'var(--shadow-purple)' : 'none'
                      }}
                      onClick={() => handleSelectItem(item)}
                    >
                      <div className="item-top">
                        <div className="item-info">
                          <div className="item-icon-wrapper">
                            {item.formatGroup === 'video' && <Video size={20} />}
                            {item.formatGroup === 'audio' && <Music size={20} />}
                            {item.formatGroup === 'image' && <ImageIcon size={20} />}
                            {item.formatGroup === 'document' && <FileText size={20} />}
                            {item.formatGroup === 'unknown' && <FileText size={20} />}
                          </div>

                          <div className="item-details">
                            <div className="item-name" title={item.name}>{item.name}</div>
                            <div className="item-meta">
                              <span className={`badge badge-${item.formatGroup}`}>{item.ext}</span>
                              <span className="meta-split">|</span>
                              <span>{item.size}</span>
                              {item.meta && (
                                <>
                                  <span className="meta-split">|</span>
                                  <span style={{ fontSize: '0.75rem' }}>{item.meta.codecDetails}</span>
                                </>
                              )}
                              <span className="meta-split">|</span>
                              <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>
                                ➜ {item.options.format.toUpperCase()}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="item-actions" onClick={e => e.stopPropagation()}>
                          {item.logs && item.logs.length > 0 && (
                            <button 
                              className="btn-icon" 
                              title="Konsol Logları"
                              onClick={() => setLogViewerJob(item)}
                            >
                              <Terminal size={14} />
                            </button>
                          )}

                          {item.status === 'converting' ? (
                            <button 
                              className="btn-icon btn-danger" 
                              title="İptal Et"
                              onClick={() => handleCancelConversion(item.id)}
                            >
                              <Square size={14} />
                            </button>
                          ) : item.status === 'success' ? (
                            <a 
                              href={item.outputPath}
                              download={`${item.name.substring(0, item.name.lastIndexOf('.')) || item.name}_converted.${item.options.format}`}
                              className="btn-icon btn-success" 
                              title="Dosyayı İndir"
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <ExternalLink size={14} />
                            </a>
                          ) : (
                            <button 
                              className="btn-icon" 
                              title="Dönüştürmeyi Başlat"
                              onClick={() => handleStartConversion(item.id)}
                            >
                              <Play size={14} />
                            </button>
                          )}

                          <button 
                            className="btn-icon btn-danger" 
                            title="Kuyruktan Çıkar"
                            onClick={() => handleRemoveItem(item.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="progress-container">
                        <div className="progress-info">
                          <span>
                            {item.status === 'idle' && 'Dönüşüme Hazır'}
                            {item.status === 'pending' && 'Kuyrukta Bekliyor...'}
                            {item.status === 'converting' && `Dönüştürülüyor... %${item.progress}`}
                            {item.status === 'success' && 'Dönüşüm Başarılı!'}
                            {item.status === 'error' && 'Dönüştürme Hatası!'}
                            {item.status === 'cancelled' && 'İşlem İptal Edildi.'}
                          </span>
                          <span>{item.timeRemaining}</span>
                        </div>
                        
                        <div className="progress-track">
                          <div 
                            className={`progress-fill ${item.status}`} 
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                      </div>

                      {item.status === 'converting' && (
                        <div className="item-stats">
                          <div className="stat-box">
                            <span className="stat-label">Hız</span>
                            <span className="stat-val">{item.speed}</span>
                          </div>
                          <div className="stat-box">
                            <span className="stat-label">Geçen Süre</span>
                            <span className="stat-val">{item.elapsedTime}</span>
                          </div>
                          <div className="stat-box">
                            <span className="stat-label">Çıktı Boyutu</span>
                            <span className="stat-val">{item.outputSize}</span>
                          </div>
                          <div className="stat-box">
                            <span className="stat-label">Codec</span>
                            <span className="stat-val" style={{ textTransform: 'uppercase' }}>
                              {item.options.videoCodec || item.options.audioCodec}
                            </span>
                          </div>
                        </div>
                      )}

                      {item.status === 'error' && item.logs.length > 0 && (
                        <div 
                          style={{ 
                            background: 'rgba(239, 68, 68, 0.1)', 
                            border: '1px solid rgba(239, 68, 68, 0.2)', 
                            padding: '0.5rem 0.75rem', 
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.8rem',
                            color: 'var(--error)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}
                        >
                          <AlertCircle size={14} style={{ flexShrink: 0 }} />
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.logs[item.logs.length - 1]}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Terminal logs Modal */}
      {logViewerJob && (
        <div className="modal-overlay" onClick={() => setLogViewerJob(null)}>
          <div className="glass modal-content animate-slide-in" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <Terminal size={18} style={{ color: 'var(--accent-purple)' }} />
                <span>FFmpeg Konsol Çıktısı - {logViewerJob.name}</span>
              </div>
              <button className="btn-icon" onClick={() => setLogViewerJob(null)}>
                <XCircle size={16} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="terminal-console" ref={logTerminalRef}>
                {logViewerJob.logs.join('') || 'Konsol çıktıları yükleniyor...'}
              </div>
            </div>

            <div className="modal-footer">
              <button className="action-btn" onClick={() => setLogViewerJob(null)}>
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Footer */}
      <footer style={{ 
        textAlign: 'center', 
        marginTop: '3rem', 
        paddingBottom: '2rem', 
        color: 'var(--text-secondary)', 
        fontSize: '0.85rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span>&copy; 2026 Cevir.im. Tüm hakları saklıdır.</span>
          <span style={{ color: 'rgba(255,255,255,0.1)' }}>|</span>
          <a 
            href="/privacy" 
            target="_blank" 
            rel="noopener noreferrer" 
            style={{ 
              color: 'var(--accent-purple)', 
              textDecoration: 'none',
              fontWeight: 500,
              transition: 'color 0.2s'
            }}
            onMouseOver={e => e.target.style.color = 'var(--accent-blue)'}
            onMouseOut={e => e.target.style.color = 'var(--accent-purple)'}
          >
            Gizlilik Politikası & Kullanım Koşulları
          </a>
        </div>
      </footer>
    </div>
  );
}
