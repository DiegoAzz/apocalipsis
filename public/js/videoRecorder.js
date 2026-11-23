// Video Recorder for Apocalipsis (60 FPS Social Media Gameplay Capture)
class GameRecorder {
  constructor(game) {
    this.game = game;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.recordingStartTime = 0;
    this.timerInterval = null;

    this.btnRecord = document.getElementById('btn-screen-record');
    this.recLabel = document.getElementById('rec-label');
    this.btnDrawerRecord = document.getElementById('btn-screen-record-drawer');
    this.drawerRecLabel = document.getElementById('drawer-rec-label');
    this.btnMenuToggle = document.getElementById('btn-menu-toggle');
    this.modal = document.getElementById('video-export-modal');
    this.videoPlayer = document.getElementById('video-preview-player');
    this.btnDownload = document.getElementById('btn-download-video');
    this.btnShare = document.getElementById('btn-share-video');
    this.btnClose = document.getElementById('btn-close-video-modal');

    this.setupListeners();
  }

  setupListeners() {
    const toggleAction = () => {
      if (!this.isRecording) {
        this.startRecording();
      } else {
        this.stopRecording();
      }
    };

    if (this.btnRecord) {
      this.btnRecord.addEventListener('click', toggleAction);
    }
    if (this.btnDrawerRecord) {
      this.btnDrawerRecord.addEventListener('click', toggleAction);
    }

    if (this.btnClose) {
      this.btnClose.addEventListener('click', () => {
        this.closeModal();
      });
    }

    if (this.btnShare) {
      this.btnShare.addEventListener('click', async () => {
        if (this.currentBlob && navigator.share) {
          try {
            const ext = (this.currentBlob.type && this.currentBlob.type.includes('mp4')) ? 'mp4' : 'webm';
            const file = new File([this.currentBlob], `apocalipsis_clip.${ext}`, { type: this.currentBlob.type || 'video/webm' });
            if (navigator.canShare && !navigator.canShare({ files: [file] })) {
              await navigator.share({
                title: '¡Mira cómo destruí esta web en Apocalipsis!',
                text: 'Destruyendo cualquier página web con armas y bombas nucleares en https://apocalipsis.appzplay.online',
                url: 'https://apocalipsis.appzplay.online'
              });
              return;
            }
            await navigator.share({
              title: '¡Mira cómo destruí esta web en Apocalipsis!',
              text: 'Destruyendo cualquier página web con armas y bombas nucleares en https://apocalipsis.appzplay.online',
              files: [file]
            });
          } catch (e) {
            console.log('Share canceled or unsupported:', e);
          }
        } else {
          // Fallback copy link
          navigator.clipboard.writeText('https://apocalipsis.appzplay.online');
          if (this.game.ui) {
            this.game.ui.showToast('📋 ¡Enlace copiado! Sube tu video a TikTok o Reels.');
          }
        }
      });
    }

    // Hotkey R para grabar/detener
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyR' && document.activeElement.tagName !== 'INPUT') {
        if (!this.isRecording) {
          this.startRecording();
        } else {
          this.stopRecording();
        }
      }
    });
  }

  startRecording() {
    const canvas = this.game.canvas;
    if (!canvas) return;

    try {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (window.innerWidth <= 820);
      const fps = isMobile ? 30 : 60;
      // Capture stream directly from game canvas (30 FPS en móvil para rendimiento óptimo y peso ligero, 60 FPS en PC)
      const stream = canvas.captureStream ? canvas.captureStream(fps) : canvas.mozCaptureStream(fps);
      
      // Try to attach Web Audio if available
      if (window.soundManager && window.soundManager.ctx) {
        try {
          const dest = window.soundManager.ctx.createMediaStreamDestination();
          window.soundManager.masterGain.connect(dest);
          const audioTrack = dest.stream.getAudioTracks()[0];
          if (audioTrack) {
            stream.addTrack(audioTrack);
          }
        } catch (e) {}
      }

      // Check supported codecs (Prefer MP4 for native Windows & Mobile scrubbing, fallback to high-quality WebM)
      const preferredMimes = [
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4;codecs=avc1',
        'video/mp4',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm'
      ];
      let mimeType = 'video/webm';
      for (const t of preferredMimes) {
        if (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(t)) {
          mimeType = t;
          break;
        }
      }

      // Bitrate optimizado: 2.5 Mbps en móviles (~9 MB cada 30 seg, ideal para WhatsApp/TikTok), 6 Mbps en PC
      const videoBps = isMobile ? 2500000 : 6000000;
      const audioBps = isMobile ? 96000 : 128000;

      this.recordedChunks = [];
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        videoBitsPerSecond: videoBps,
        audioBitsPerSecond: audioBps
      });

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.processRecording();
      };

      this.mediaRecorder.start(1000); // Fragmentos cada 1 segundo (más ligero en CPU y memoria)
      this.isRecording = true;
      this.recordingStartTime = Date.now();

      // Update UI buttons
      if (this.btnRecord) this.btnRecord.classList.add('recording');
      if (this.btnDrawerRecord) this.btnDrawerRecord.classList.add('recording');
      if (this.btnMenuToggle) this.btnMenuToggle.classList.add('is-recording');

      this.timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
        const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const secs = String(elapsed % 60).padStart(2, '0');
        const timerText = `REC ${mins}:${secs} (DETENER)`;
        if (this.recLabel) this.recLabel.textContent = timerText;
        if (this.drawerRecLabel) this.drawerRecLabel.textContent = timerText;
      }, 1000);

      if (this.game.ui) {
        this.game.ui.showToast(`🔴 ¡GRABANDO PARTIDA A ${fps} FPS! Destruye la web...`);
      }
    } catch (err) {
      console.error('Error starting screen recorder:', err);
      alert('Tu navegador no soporta grabación directa de canvas: ' + err.message);
    }
  }

  stopRecording() {
    if (!this.isRecording || !this.mediaRecorder) return;
    this.mediaRecorder.stop();
    this.isRecording = false;
    clearInterval(this.timerInterval);

    if (this.btnRecord) {
      this.btnRecord.classList.remove('recording');
      if (this.recLabel) this.recLabel.textContent = 'REC (TikTok/Reels)';
    }
    if (this.btnDrawerRecord) {
      this.btnDrawerRecord.classList.remove('recording');
      if (this.drawerRecLabel) this.drawerRecLabel.textContent = 'REC (TikTok/Reels)';
    }
    if (this.btnMenuToggle) {
      this.btnMenuToggle.classList.remove('is-recording');
    }

    if (this.game.ui) {
      this.game.ui.showToast('🎬 Procesando video para redes sociales...');
    }
  }

  async processRecording() {
    const rawMime = (this.mediaRecorder && this.mediaRecorder.mimeType) || 'video/webm';
    const rawBlob = new Blob(this.recordedChunks, { type: rawMime });
    const elapsedMs = Math.max(1000, Date.now() - this.recordingStartTime);

    let finalBlob = rawBlob;

    // Inject exact Duration and Cues header into WebM so Windows Media Player timeline works!
    if (rawMime.includes('webm') && typeof window.ysFixWebmDuration === 'function') {
      try {
        finalBlob = await window.ysFixWebmDuration(rawBlob, elapsedMs);
      } catch (err) {
        console.warn('Could not patch WebM duration header:', err);
        finalBlob = rawBlob;
      }
    }

    this.currentBlob = finalBlob;
    const videoUrl = URL.createObjectURL(finalBlob);

    if (this.videoPlayer) {
      this.videoPlayer.src = videoUrl;
      this.videoPlayer.controls = true;
      this.videoPlayer.load();
      this.videoPlayer.play().catch(() => {});
    }

    const sizeMB = (finalBlob.size / (1024 * 1024)).toFixed(1);

    if (this.btnDownload) {
      const pageDomain = (this.game.level && this.game.level.presetName) || 'web';
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const ext = rawMime.includes('mp4') ? 'mp4' : 'webm';
      this.btnDownload.download = `apocalipsis_${pageDomain}_${timestamp}.${ext}`;
      this.btnDownload.href = videoUrl;
      this.btnDownload.innerHTML = `<span>💾 DESCARGAR VIDEO (${sizeMB} MB)</span>`;
    }

    if (this.game.ui) {
      this.game.ui.showToast(`🎬 ¡Video optimizado listo (${sizeMB} MB)!`);
    }

    if (this.modal) {
      this.modal.classList.add('open');
    }

    // Auto-descargar inmediatamente si fue activado por completar la misión
    if (this.pendingAutoDownload) {
      this.pendingAutoDownload = false;
      setTimeout(() => {
        if (this.btnDownload) {
          this.btnDownload.click();
          if (this.game.ui) {
            this.game.ui.showToast('💾 ¡Video HD descargado con éxito a tu carpeta de descargas!');
          }
        }
      }, 500);
    }
  }

  // Se dispara automáticamente al completar la misión (encontrar los 5 secretos o aniquilar el sitio)
  onMissionComplete() {
    if (this.isRecording) {
      this.pendingAutoDownload = true;
      if (this.game.ui) {
        this.game.ui.showToast('🏆 ¡MISIÓN CUMPLIDA! Finalizando grabación y descargando automáticamente...');
      }
      this.stopRecording();
    }
  }

  closeModal() {
    if (this.modal) this.modal.classList.remove('open');
    if (this.videoPlayer) {
      this.videoPlayer.pause();
      this.videoPlayer.src = '';
    }
  }
}

window.GameRecorder = GameRecorder;
