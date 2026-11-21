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
    this.modal = document.getElementById('video-export-modal');
    this.videoPlayer = document.getElementById('video-preview-player');
    this.btnDownload = document.getElementById('btn-download-video');
    this.btnShare = document.getElementById('btn-share-video');
    this.btnClose = document.getElementById('btn-close-video-modal');

    this.setupListeners();
  }

  setupListeners() {
    if (this.btnRecord) {
      this.btnRecord.addEventListener('click', () => {
        if (!this.isRecording) {
          this.startRecording();
        } else {
          this.stopRecording();
        }
      });
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
            const file = new File([this.currentBlob], 'apocalipsis_gameplay.webm', { type: this.currentBlob.type });
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
      // 60 FPS stream directly from game canvas
      const stream = canvas.captureStream ? canvas.captureStream(60) : canvas.mozCaptureStream(60);
      
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

      // Check supported codecs
      let mimeType = 'video/webm;codecs=vp9,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8,opus';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }

      this.recordedChunks = [];
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        videoBitsPerSecond: 6000000 // 6 Mbps high quality
      });

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.processRecording();
      };

      this.mediaRecorder.start(250); // Slice every 250ms
      this.isRecording = true;
      this.recordingStartTime = Date.now();

      // Update UI button
      if (this.btnRecord) {
        this.btnRecord.classList.add('recording');
      }

      this.timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
        const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const secs = String(elapsed % 60).padStart(2, '0');
        if (this.recLabel) {
          this.recLabel.textContent = `REC ${mins}:${secs} (DETENER)`;
        }
      }, 1000);

      if (this.game.ui) {
        this.game.ui.showToast('🔴 ¡GRABANDO PARTIDA A 60 FPS! Destruye la web...');
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

    if (this.game.ui) {
      this.game.ui.showToast('🎬 Procesando video para redes sociales...');
    }
  }

  processRecording() {
    const mime = (this.mediaRecorder && this.mediaRecorder.mimeType) || 'video/webm';
    this.currentBlob = new Blob(this.recordedChunks, { type: mime });
    const videoUrl = URL.createObjectURL(this.currentBlob);

    if (this.videoPlayer) {
      this.videoPlayer.src = videoUrl;
      this.videoPlayer.play().catch(() => {});
    }

    if (this.btnDownload) {
      const pageDomain = (this.game.level && this.game.level.presetName) || 'web';
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      this.btnDownload.download = `apocalipsis_${pageDomain}_${timestamp}.webm`;
      this.btnDownload.href = videoUrl;
    }

    if (this.modal) {
      this.modal.classList.add('open');
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
