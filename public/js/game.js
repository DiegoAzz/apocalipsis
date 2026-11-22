// Main Game Orchestrator, Camera, Input, and UI Integration
class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');

    this.level = new LevelEngine(1500, 2600, 5);
    this.physics = new PhysicsEngine(this.level);

    const savedName = (typeof localStorage !== 'undefined' && localStorage.getItem('destroy_player_name')) || 'Operativo';
    this.localPlayer = new Player('local', savedName, '#f97316', true);
    this.bots = [];
    this.multiplayer = new MultiplayerManager(this);

    // Online Multiplayer is DEFAULT: shared real-time battlefield!
    this.isSoloMode = false;

    // Camera State
    this.camera = {
      x: 0,
      y: 0,
      zoom: 1.0,
      targetX: 0,
      targetY: 0,
      isPanning: false,
      panStartX: 0,
      panStartY: 0,
      camStartX: 0,
      camStartY: 0
    };

    // Input State
    this.input = {
      keys: {},
      justPressedJump: false,
      mouseX: 0,
      mouseY: 0,
      screenMouseX: 0,
      screenMouseY: 0,
      isMouseDown: false,
      isRightMouseDown: false
    };

    this.lastTime = performance.now();
    this.timeScale = 1.0;
    this.isLiveMode = false;
    this.isGameStarted = false; // Prevents auto-fire and bomb drops before player starts mission
    this.ui = new UIManager(this);

    this.init();
  }

  toggleLiveMode() {
    this.isLiveMode = !this.isLiveMode;
    this.timeScale = this.isLiveMode ? 0.35 : 1.0;

    const btnLive = document.getElementById('btn-toggle-live');
    const badge = document.getElementById('live-overlay-badge');

    if (btnLive) {
      if (this.isLiveMode) {
        btnLive.classList.add('active');
        btnLive.textContent = '🔴 LIVE (0.35x)';
      } else {
        btnLive.classList.remove('active');
        btnLive.textContent = '🔴 Modo Live';
      }
    }

    if (badge) {
      if (this.isLiveMode) badge.classList.add('active');
      else badge.classList.remove('active');
    }

    if (this.ui) {
      this.ui.appendChatMessage({
        sender: 'SISTEMA',
        color: this.isLiveMode ? '#ef4444' : '#22c55e',
        text: this.isLiveMode ? '🔴 ¡Modo Live activado! Cámara lenta cinematográfica (0.35x)' : '⚡ Modo normal restaurado (1.0x)'
      });
    }
  }

  clampCamera() {
    if (!this.level || !this.camera) return;
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    const halfW = (screenW / 2) / (this.camera.zoom || 1);
    const halfH = (screenH / 2) / (this.camera.zoom || 1);

    // Horizontal bounds: center if it fits on screen, otherwise clamp within level bounds
    if (this.level.width <= halfW * 2) {
      this.camera.x = this.level.width / 2;
      this.camera.targetX = this.camera.x;
    } else {
      this.camera.x = Math.max(halfW, Math.min(this.level.width - halfW, this.camera.x));
    }

    // Vertical bounds: center if it fits on screen, otherwise clamp within level bounds
    if (this.level.height <= halfH * 2) {
      this.camera.y = this.level.height / 2;
      this.camera.targetY = this.camera.y;
    } else {
      this.camera.y = Math.max(halfH, Math.min(this.level.height - halfH, this.camera.y));
    }
  }

  snapCameraToPlayer() {
    if (!this.localPlayer) return;
    this.camera.x = this.localPlayer.x;
    this.camera.y = this.localPlayer.y;
    this.camera.targetX = this.localPlayer.x;
    this.camera.targetY = this.localPlayer.y;
    this.camera.isPanning = false;
    this.clampCamera();
  }

  init() {
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    this.setupInputListeners();

    // Initialize Idle Incremental Manager
    this.idle = new IdleManager(this);

    // Initialize Video Gameplay Recorder (60 FPS para TikTok/Reels)
    if (typeof GameRecorder !== 'undefined') {
      this.recorder = new GameRecorder(this);
    }

    // Initialize Wompi Payment Manager (Pase VIP Inmediato)
    if (typeof WompiManager !== 'undefined') {
      this.wompi = new WompiManager(this);
    }

    this.secretsFoundCount = 0;

    // Default Level: Authentic TikTok or Wikipedia
    this.loadMapPreset('wikipedia', 'https://en.wikipedia.org/wiki/Stick_figure', false);
    if (this.level && this.idle) {
      this.level.onCellsDestroyed = (count, x, y) => this.idle.onCellsDestroyed(count, x, y);
    }
    if (this.level) {
      this.level.onSecretRevealed = (sec) => {
        if (this.ui) this.ui.showToast(`🔍 ¡SECRETO DESENTERRADO: ${sec.name}! Acércate para extraerlo.`);
      };
    }
    this.snapCameraToPlayer();

    // Draw authentic futuristic weapon sprites on all bottom slots
    this.drawWeaponIcons();
    if (window.spriteSheetImg) {
      if (!window.spriteSheetImg.complete) {
        window.spriteSheetImg.addEventListener('load', () => this.drawWeaponIcons());
      }
    }

    // Setup GTA VI Style Intro Overlay
    this.setupGtaIntro();

    if (this.ui) {
      this.ui.refreshWeaponLocks();
    }

    // Auto-connect to Online Multiplayer (room parameter or default 'lobby')
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room') || 'lobby';
    const soloParam = urlParams.get('solo');

    if (soloParam === '1' || soloParam === 'true') {
      this.isSoloMode = true;
      const btnMulti = document.getElementById('btn-mode-multi');
      const btnSolo = document.getElementById('btn-mode-solo');
      if (btnMulti) btnMulti.classList.remove('active');
      if (btnSolo) btnSolo.classList.add('active');
      const chatCont = document.getElementById('chat-container');
      if (chatCont) chatCont.style.display = 'none';
    } else {
      this.isSoloMode = false;
      const btnMulti = document.getElementById('btn-mode-multi');
      const btnSolo = document.getElementById('btn-mode-solo');
      if (btnMulti) btnMulti.classList.add('active');
      if (btnSolo) btnSolo.classList.remove('active');
      const chatCont = document.getElementById('chat-container');
      if (chatCont && window.innerWidth > 900) chatCont.style.display = 'flex';

      // Connect to online room in real time with the custom player nickname!
      this.multiplayer.init(roomParam, this.localPlayer.name, this.localPlayer.color);
    }

    // Touch & Mobile Screen Detection
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 900;
    if (hasTouch) {
      document.body.classList.add('touch-active');
      this.setupMobileTouchControls();
    }
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  setupMobileTouchControls() {
    const joyZone = document.getElementById('touch-joystick-zone');
    const joyBase = document.getElementById('touch-joystick-base');
    const joyKnob = document.getElementById('touch-joystick-knob');
    const btnJump = document.getElementById('touch-btn-jump');
    const btnGrenade = document.getElementById('touch-btn-grenade');

    let joyTouchId = null;
    let joyStartX = 0;
    let joyStartY = 0;

    if (joyZone && joyBase && joyKnob) {
      const handleJoyMove = (touch) => {
        const rawDx = touch.clientX - joyStartX;
        const rawDy = touch.clientY - joyStartY;
        const dist = Math.hypot(rawDx, rawDy);
        const maxDist = 45;
        const angle = Math.atan2(rawDy, rawDx);
        const clampedDist = Math.min(dist, maxDist);

        const dx = Math.cos(angle) * clampedDist;
        const dy = Math.sin(angle) * clampedDist;

        if (joyKnob) joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;

        // Horizontal movement
        if (dx < -12) {
          this.input.keys['KeyA'] = true;
          this.input.keys['KeyD'] = false;
        } else if (dx > 12) {
          this.input.keys['KeyD'] = true;
          this.input.keys['KeyA'] = false;
        } else {
          this.input.keys['KeyA'] = false;
          this.input.keys['KeyD'] = false;
        }

        // Upward movement (Jump / Jetpack)
        if (dy < -14) {
          if (!this.input.keys['Space']) {
            this.input.justPressedJump = true;
          }
          this.input.keys['Space'] = true;
        } else {
          this.input.keys['Space'] = false;
        }
      };

      joyZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.soundManager.ensureContext();
        joyZone.classList.add('active');
        if (joyTouchId === null) {
          const touch = e.changedTouches[0];
          joyTouchId = touch.identifier;
          joyStartX = touch.clientX;
          joyStartY = touch.clientY;
          handleJoyMove(touch);
        }
      }, { passive: false });

      joyZone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        e.stopPropagation();
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === joyTouchId) {
            handleJoyMove(e.changedTouches[i]);
            break;
          }
        }
      }, { passive: false });

      const handleJoyEnd = (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === joyTouchId) {
            joyTouchId = null;
            joyZone.classList.remove('active');
            if (joyKnob) joyKnob.style.transform = 'translate(0px, 0px)';
            this.input.keys['KeyA'] = false;
            this.input.keys['KeyD'] = false;
            this.input.keys['Space'] = false;
            break;
          }
        }
      };

      joyZone.addEventListener('touchend', handleJoyEnd);
      joyZone.addEventListener('touchcancel', handleJoyEnd);
    }

    // Touch Action Buttons
    if (btnJump) {
      btnJump.addEventListener('touchstart', (e) => {
        e.preventDefault();
        window.soundManager.ensureContext();
        this.input.justPressedJump = true;
        this.input.keys['Space'] = true;
      }, { passive: false });

      btnJump.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.input.keys['Space'] = false;
      }, { passive: false });
    }

    if (btnGrenade) {
      btnGrenade.addEventListener('touchstart', (e) => {
        e.preventDefault();
        window.soundManager.ensureContext();
        this.localPlayer.tryGrenade(this.physics);
      }, { passive: false });
    }

    // Direct Canvas Touch to Aim & Shoot Continuously (Reserved right/general area)
    const activeShootTouches = new Set();
    let initialPinchDist = null;
    let initialZoom = 1.0;

    const isOverReservedJoystick = (clientX, clientY) => {
      const joyZone = document.getElementById('touch-joystick-zone');
      if (!joyZone) return false;
      const rect = joyZone.getBoundingClientRect();
      return clientX >= rect.left && clientX <= rect.right &&
             clientY >= rect.top && clientY <= rect.bottom;
    };

    this.canvas.addEventListener('touchstart', (e) => {
      window.soundManager.ensureContext();

      // 2-Finger Pinch to Zoom
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        initialPinchDist = Math.hypot(dx, dy);
        initialZoom = this.camera.zoom;
        this.input.isMouseDown = false;
        activeShootTouches.clear();
        return;
      }

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (!isOverReservedJoystick(touch.clientX, touch.clientY)) {
          activeShootTouches.add(touch.identifier);
          this.updateTouchAim(touch);
          this.input.isMouseDown = true;
        }
      }
    }, { passive: true });

    this.canvas.addEventListener('touchmove', (e) => {
      // 2-Finger Pinch Zooming
      if (e.touches.length === 2 && initialPinchDist) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const factor = dist / initialPinchDist;
        this.camera.zoom = Math.max(0.2, Math.min(3.0, initialZoom * factor));
        this.clampCamera();
        return;
      }

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (activeShootTouches.has(touch.identifier)) {
          this.updateTouchAim(touch);
          this.input.isMouseDown = true;
        }
      }
    }, { passive: true });

    const handleShootEnd = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        activeShootTouches.delete(e.changedTouches[i].identifier);
      }
      if (e.touches && e.touches.length < 2) {
        initialPinchDist = null;
      }
      if (activeShootTouches.size === 0 || (e.touches && e.touches.length === 0)) {
        activeShootTouches.clear();
        this.input.isMouseDown = false;
      } else if (e.touches && e.touches.length > 0) {
        for (let i = 0; i < e.touches.length; i++) {
          const t = e.touches[i];
          if (!isOverReservedJoystick(t.clientX, t.clientY)) {
            this.updateTouchAim(t);
            this.input.isMouseDown = true;
            break;
          }
        }
      }
    };
    this.canvas.addEventListener('touchend', handleShootEnd, { passive: true });
    this.canvas.addEventListener('touchcancel', handleShootEnd, { passive: true });
  }

  updateTouchAim(touch) {
    this.input.screenMouseX = touch.clientX;
    this.input.screenMouseY = touch.clientY;
    this.input.mouseX = (touch.clientX - window.innerWidth / 2) / this.camera.zoom + this.camera.x;
    this.input.mouseY = (touch.clientY - window.innerHeight / 2) / this.camera.zoom + this.camera.y;
  }

  // Configuración del Menú de Entrada e Intro estilo GTA VI
  setupGtaIntro() {
    const overlay = document.getElementById('gta-intro-overlay');
    const startBtn = document.getElementById('btn-gta-start');
    if (!overlay || !startBtn) return;

    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = (urlParams.get('room') || '').trim();
    const isFriendInvite = roomParam && roomParam !== 'lobby';

    if (isFriendInvite) {
      startBtn.innerHTML = `<span>🚀 ENTRAR A LA SALA (${roomParam.toUpperCase()})</span>`;
      const subtitle = document.querySelector('.gta-subtitle');
      if (subtitle) {
        subtitle.innerHTML = `🎮 <strong>¡INVITACIÓN DETECTADA!</strong> Te estás uniendo a la sala <em>${roomParam.toUpperCase()}</em> de tu amigo.`;
        subtitle.style.color = '#38bdf8';
      }
    }

    let selectedPreset = 'tiktok';
    const urlInput = document.getElementById('gta-url-input');
    const nameInput = document.getElementById('gta-player-name');
    const fileInput = document.getElementById('gta-file-input');
    const btnUpload = document.getElementById('btn-gta-upload');

    // Inicializar nombre guardado en input
    if (nameInput && this.localPlayer) {
      nameInput.value = this.localPlayer.name;
    }

    // Botones de presets en la intro
    document.querySelectorAll('[data-gta-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-gta-preset]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedPreset = btn.getAttribute('data-gta-preset');
        const mapUrls = {
          tiktok: 'https://www.tiktok.com',
          youtube: 'https://www.youtube.com',
          google: 'https://www.google.com',
          wikipedia: 'https://en.wikipedia.org/wiki/Stick_figure',
          amazon: 'https://www.amazon.com',
          facebook: 'https://www.facebook.com'
        };
        if (urlInput) urlInput.value = mapUrls[selectedPreset] || `https://www.${selectedPreset}.com`;
      });
    });

    // Paleta de colores de traje en la intro
    document.querySelectorAll('.gta-color-swatch').forEach((swatch) => {
      swatch.addEventListener('click', () => {
        document.querySelectorAll('.gta-color-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        const col = swatch.getAttribute('data-color');
        if (this.localPlayer) {
          this.localPlayer.color = col;
          this.localPlayer.savePersistence();
          const dot = document.getElementById('color-dot');
          if (dot) dot.style.background = col;
        }
      });
    });

    // Modos en la intro
    const btnSolo = document.getElementById('gta-mode-solo');
    const btnMulti = document.getElementById('gta-mode-multi');
    if (btnSolo && btnMulti) {
      btnSolo.addEventListener('click', () => {
        this.isSoloMode = true;
        btnSolo.classList.add('active');
        btnMulti.classList.remove('active');
        const topSolo = document.getElementById('btn-mode-solo');
        const topMulti = document.getElementById('btn-mode-multi');
        if (topSolo) topSolo.classList.add('active');
        if (topMulti) topMulti.classList.remove('active');
      });
      btnMulti.addEventListener('click', () => {
        this.isSoloMode = false;
        btnMulti.classList.add('active');
        btnSolo.classList.remove('active');
        const topSolo = document.getElementById('btn-mode-solo');
        const topMulti = document.getElementById('btn-mode-multi');
        if (topSolo) topSolo.classList.remove('active');
        if (topMulti) topMulti.classList.add('active');
      });
    }

    // Subida de imagen desde la intro
    if (btnUpload && fileInput) {
      btnUpload.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = async (ev) => {
            const dataUrl = ev.target.result;
            await this.loadUserImage(dataUrl);
            btnUpload.textContent = `🖼️ Imagen: ${file.name.substring(0, 16)}...`;
            btnUpload.style.borderColor = '#10b981';
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // Botón Iniciar Misión GTA VI
    startBtn.addEventListener('click', async () => {
      this.isGameStarted = true;
      this.input.isMouseDown = false;
      this.input.isRightMouseDown = false;

      if (window.soundManager && typeof window.soundManager.playCinematicBoom === 'function') {
        window.soundManager.playCinematicBoom();
      }

      if (nameInput && nameInput.value.trim() && this.localPlayer) {
        this.localPlayer.name = nameInput.value.trim();
        this.localPlayer.savePersistence();
        const topName = document.getElementById('player-name-input');
        if (topName) topName.value = this.localPlayer.name;
      }

      overlay.classList.add('hidden');

      if (isFriendInvite) {
        // Enlace de amigo (?room=): Entrar a la sala compartida directamente sin sobreescribir el nivel
        this.snapCameraToPlayer();
        if (this.ui) {
          this.ui.showToast(`🎮 ¡Conectado a la sala ${roomParam.toUpperCase()} con tu amigo!`);
        }
        return;
      }

      const targetUrl = urlInput ? urlInput.value.trim() : '';
      if (targetUrl) {
        const topUrlInput = document.getElementById('webpage-url-input');
        if (topUrlInput) topUrlInput.value = targetUrl;
        const destroyBtn = document.getElementById('btn-destroy-url');
        if (destroyBtn) {
          destroyBtn.click();
        } else {
          this.loadMapPreset(selectedPreset, targetUrl, true);
        }
      }

      this.snapCameraToPlayer();
      if (this.ui) {
        this.ui.showToast('🚀 ¡MISIÓN INICIADA! Excava los 5 núcleos y desata el armamento.');
      }
    });

    // Botón Saltar Intro y entrar directo a jugar
    const btnSkip = document.getElementById('btn-gta-skip');
    if (btnSkip) {
      btnSkip.addEventListener('click', () => {
        this.isGameStarted = true;
        this.input.isMouseDown = false;
        this.input.isRightMouseDown = false;
        if (window.soundManager && typeof window.soundManager.playCinematicBoom === 'function') {
          window.soundManager.playCinematicBoom();
        }
        overlay.classList.add('hidden');
        this.snapCameraToPlayer();
      });
    }

    // Efecto interactivo al tocar los bloques de cómic GTA VI
    document.querySelectorAll('.gta-comic-cell').forEach((cell) => {
      cell.addEventListener('click', () => {
        if (window.soundManager && typeof window.soundManager.playSecretCollect === 'function') {
          window.soundManager.playSecretCollect();
        }
      });
    });
  }

  resizeCanvas() {
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    this.dpr = dpr;
    this.canvas.width = Math.round(window.innerWidth * dpr);
    this.canvas.height = Math.round(window.innerHeight * dpr);
    this.adaptZoomForCurrentMap();
  }

  setupInputListeners() {
    window.addEventListener('keydown', (e) => {
      // Ignore input if typing in chat or url bar
      if (document.activeElement === document.getElementById('chat-input') ||
          document.activeElement === document.getElementById('webpage-url-input')) {
        if (e.code === 'Enter' && document.activeElement === document.getElementById('chat-input')) {
          this.ui.sendChat();
        }
        return;
      }

      if (e.code === 'Enter') {
        this.ui.focusChat();
        e.preventDefault();
        return;
      }

      if (e.code === 'Tab') {
        e.preventDefault();
        this.ui.showScoreboard(true);
        return;
      }

      if (e.code === 'KeyF' || e.code === 'KeyJ') {
        this.input.isMouseDown = false;
      }
      if (e.code === 'KeyG' || e.code === 'KeyK') {
        this.input.isRightMouseDown = false;
      }
      if (['Space', 'KeyW', 'ArrowUp'].includes(e.code)) {
        if (!this.input.keys[e.code]) {
          this.input.justPressedJump = true;
        }
      }

      this.input.keys[e.code] = true;

      // Shoot keys: KeyF or KeyJ in addition to Mouse Click
      if (e.code === 'KeyF' || e.code === 'KeyJ') {
        window.soundManager.ensureContext();
        this.input.isMouseDown = true;
      }
      if (e.code === 'KeyG' || e.code === 'KeyK') {
        window.soundManager.ensureContext();
        this.input.isRightMouseDown = true;
      }

      if (e.code === 'KeyC') {
        this.snapCameraToPlayer();
      }

      if (e.code === 'KeyL') {
        this.toggleLiveMode();
      }

      // Tecla H: Alternar Modo Cine (Ocultar/Mostrar Interfaz para grabar)
      if (e.code === 'KeyH') {
        document.body.classList.toggle('ui-hidden');
      }

      // Tecla G: Seleccionar Granada / Lanzagranadas
      if (e.code === 'KeyG') {
        if (this.localPlayer.isWeaponUnlocked(10)) {
          this.localPlayer.selectWeapon(10);
          this.ui.updateActiveWeapon(10);
        } else {
          if (window.soundManager && window.soundManager.playLockedBuzz) window.soundManager.playLockedBuzz();
          this.ui.showToast('🔒 Lanzagranadas Bloqueado: Requiere 10% de Destrucción');
        }
      }

      // Weapon Hotkeys 1-9 y 0 (Tsar Bomba)
      let targetIdx = -1;
      if (e.key === '0') targetIdx = 9;
      else {
        const keyNum = parseInt(e.key);
        if (keyNum >= 1 && keyNum <= 9) targetIdx = keyNum - 1;
      }
      if (targetIdx !== -1) {
        if (this.localPlayer.isWeaponUnlocked(targetIdx)) {
          this.localPlayer.selectWeapon(targetIdx);
          this.ui.updateActiveWeapon(targetIdx);
        } else {
          const w = this.localPlayer.weapons[targetIdx];
          const rule = this.localPlayer.weaponUnlockRules.find(r => r.index === targetIdx);
          if (window.soundManager && window.soundManager.playLockedBuzz) window.soundManager.playLockedBuzz();
          this.ui.showToast(`🔒 ${w ? w.name : 'Arma'} Bloqueada: ${rule ? rule.desc : 'bloqueada'}`);
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Tab') {
        this.ui.showScoreboard(false);
      }
      this.input.keys[e.code] = false;
      if (e.code === 'KeyF' || e.code === 'KeyJ') {
        this.input.isMouseDown = false;
      }
      if (e.code === 'KeyG' || e.code === 'KeyK') {
        this.input.isRightMouseDown = false;
      }
      if (['Space', 'KeyW', 'ArrowUp'].includes(e.code)) {
        this.input.justPressedJump = false;
      }
    });

    const isTargetUI = (target) => {
      if (!target || target === this.canvas || target === document.body || target === document.documentElement) {
        return false;
      }
      return !!target.closest(
        'button, input, select, textarea, a, label, kbd, .slot, .hud-bottom-wrap, #top-nav, .floating-pills-top, .idle-drawer, .custom-modal, #help-modal, #chat-container, #mobile-controls, .gta-intro-overlay, .btn, .hud-weapons, #destruction-meter-container, #secret-meter-container, .wompi-card'
      );
    };

    // Prevenir disparos accidentales cuando se interactúa con botones o elementos de interfaz
    window.addEventListener('pointerdown', (e) => {
      if (isTargetUI(e.target)) {
        this.input.isMouseDown = false;
        this.input.isRightMouseDown = false;
      }
    }, { capture: true });

    window.addEventListener('touchstart', (e) => {
      if (e.target && isTargetUI(e.target)) {
        this.input.isMouseDown = false;
        this.input.isRightMouseDown = false;
      }
    }, { capture: true, passive: true });

    window.addEventListener('mousemove', (e) => {
      this.input.screenMouseX = e.clientX;
      this.input.screenMouseY = e.clientY;

      if (isTargetUI(e.target)) {
        this.input.isMouseDown = false;
        return;
      }

      this.input.mouseX = (e.clientX - this.canvas.width / 2) / this.camera.zoom + this.camera.x;
      this.input.mouseY = (e.clientY - this.canvas.height / 2) / this.camera.zoom + this.camera.y;

      // Middle mouse button / Wheel drag camera pan (Hand grab tool)
      if (this.camera.isPanning) {
        const dx = (e.clientX - this.camera.panStartX) / this.camera.zoom;
        const dy = (e.clientY - this.camera.panStartY) / this.camera.zoom;
        this.camera.x = this.camera.camStartX - dx;
        this.camera.y = this.camera.camStartY - dy;
        this.camera.targetX = this.camera.x;
        this.camera.targetY = this.camera.y;
        this.canvas.style.cursor = 'grabbing';
      }
    });

    window.addEventListener('mousedown', (e) => {
      window.soundManager.ensureContext();

      // Si el clic es sobre un botón, menú, barra de armas o UI: NO DISPARAR
      if (isTargetUI(e.target)) {
        this.input.isMouseDown = false;
        this.input.isRightMouseDown = false;
        return;
      }

      if (e.button === 1) {
        // Middle click / Wheel press activates pan hand tool
        e.preventDefault();
        this.camera.isPanning = true;
        this.camera.panStartX = e.clientX;
        this.camera.panStartY = e.clientY;
        this.camera.camStartX = this.camera.x;
        this.camera.camStartY = this.camera.y;
        this.canvas.style.cursor = 'grabbing';
      } else if (e.button === 0) {
        this.input.isMouseDown = true;
      } else if (e.button === 2) {
        e.preventDefault();
        this.input.isRightMouseDown = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 1) {
        this.camera.isPanning = false;
        this.canvas.style.cursor = 'crosshair';
      } else if (e.button === 0) {
        this.input.isMouseDown = false;
      } else if (e.button === 2) {
        this.input.isRightMouseDown = false;
      }
    });

    window.addEventListener('contextmenu', (e) => e.preventDefault());

    // Mouse scroll wheel: Zoom with Ctrl/Alt/Shift, or cycle weapons
    window.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.altKey || e.shiftKey) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        this.camera.zoom = Math.max(0.4, Math.min(2.5, this.camera.zoom * factor));
        return;
      }
      const dir = e.deltaY > 0 ? 1 : -1;
      let newIdx = this.localPlayer.currentWeaponIndex;
      for (let step = 0; step < this.localPlayer.weapons.length; step++) {
        newIdx += dir;
        if (newIdx < 0) newIdx = this.localPlayer.weapons.length - 1;
        if (newIdx >= this.localPlayer.weapons.length) newIdx = 0;
        if (this.localPlayer.isWeaponUnlocked(newIdx)) {
          this.localPlayer.selectWeapon(newIdx);
          this.ui.updateActiveWeapon(newIdx);
          break;
        }
      }
    }, { passive: false });
  }

  adaptZoomForCurrentMap() {
    if (!this.level || !this.camera) return;
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    // Adapt zoom to fill screen width edge-to-edge with 0 black side bars!
    const fitZoomX = screenW / this.level.width;

    this.camera.zoom = fitZoomX;
    this.camera.x = this.level.width / 2;
    this.camera.y = Math.min(this.level.height / 2, (screenH / 2) / this.camera.zoom);
    this.camera.targetX = this.camera.x;
    this.camera.targetY = this.camera.y;
    this.clampCamera();
  }

  // Conteo Regresivo Gigante de 3 Segundos con Pantalla Negra Alpha
  triggerDestructionCountdown(targetUrl, onReadyAction) {
    const overlay = document.getElementById('destruction-countdown-overlay');
    const numEl = document.getElementById('countdown-number');
    const urlEl = document.getElementById('countdown-target-url');
    const statusEl = document.getElementById('countdown-status');

    if (!overlay || !numEl) {
      if (typeof onReadyAction === 'function') onReadyAction();
      return;
    }

    if (urlEl) urlEl.textContent = targetUrl || 'Arena Web Destructible';
    if (statusEl) statusEl.textContent = '⚡ Sincronizando terreno y armamento...';

    overlay.classList.add('active');
    overlay.style.display = 'flex';
    overlay.style.opacity = '1';

    // Ejecutar la carga, captura o sincronización de inmediato en segundo plano
    if (typeof onReadyAction === 'function') {
      try {
        onReadyAction();
      } catch (err) {
        console.warn('[COUNTDOWN TASK ERROR]:', err);
      }
    }

    let count = 3;
    numEl.textContent = count;
    numEl.className = 'countdown-number pop';
    setTimeout(() => numEl && numEl.classList.remove('pop'), 200);

    if (window.soundManager) {
      window.soundManager.ensureContext();
      window.soundManager.playCountdownTick();
    }

    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        numEl.textContent = count;
        numEl.className = 'countdown-number pop';
        setTimeout(() => numEl && numEl.classList.remove('pop'), 200);
        if (window.soundManager) window.soundManager.playCountdownTick();
      } else if (count === 0) {
        numEl.textContent = '¡A DESTRUIR!';
        numEl.className = 'countdown-number go pop';
        if (statusEl) statusEl.textContent = '🚀 ¡FUEGO A DISCRECIÓN!';
        if (window.soundManager) window.soundManager.playCountdownGo();
      } else {
        clearInterval(interval);
        overlay.style.opacity = '0';
        setTimeout(() => {
          overlay.classList.remove('active');
          overlay.style.display = 'none';
          overlay.style.opacity = '1';
          this.snapCameraToPlayer();
        }, 250);
      }
    }, 1000);
  }

  loadMapPreset(preset, url = '', notifyServer = true) {
    const lowerUrl = (url || preset).toLowerCase();

    // Comprobar si la URL tiene subcarpetas específicas (ej: /wiki/..., /watch?v=..., /noticias/...)
    let hasSubpath = false;
    try {
      if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        const parsed = new URL(url);
        if (parsed.pathname && parsed.pathname !== '/' && parsed.pathname.length > 1) {
          hasSubpath = true;
        }
      }
    } catch (e) {}

    // Si tiene subcarpetas, no forzar plantillas raíz genéricas sino generar el nivel con la ruta real
    if (!hasSubpath) {
      if (lowerUrl.includes('amazon')) {
        this.level.generateAmazon();
      } else if (lowerUrl.includes('facebook') || lowerUrl.includes('fb.com')) {
        this.level.generateFacebook();
      } else if (preset === 'wikipedia' || lowerUrl.includes('wikipedia')) {
        this.level.generateWikipedia();
      } else if (preset === 'google' || lowerUrl.includes('google')) {
        this.level.generateGoogle();
      } else if (preset === 'youtube' || lowerUrl.includes('youtube') || lowerUrl.includes('youtu.be')) {
        this.level.generateYouTube();
      } else if (preset === 'tiktok' || lowerUrl.includes('tiktok')) {
        this.level.generateTikTok();
      } else {
        this.level.generateCustom(url || preset);
      }
    } else {
      this.level.generateCustom(url || preset);
    }

    this.localPlayer.respawn(this.level);
    this.adaptZoomForCurrentMap();

    if (this.level && this.idle) {
      this.level.onCellsDestroyed = (count, x, y) => this.idle.onCellsDestroyed(count, x, y);
    }

    if (notifyServer && !this.isSoloMode) {
      this.multiplayer.emitChangeMap(preset, url);
    }

    if (this.ui) this.ui.victoryShown = false;
    this.ui.updateDestructionBar(0);
    this.ui.setPresetDisplay(preset, this.level.pageUrl);
  }

  async loadParsedWebpage(pageData, notifyServer = true) {
    const lowerUrl = (pageData.url || '').toLowerCase();
    if (lowerUrl.includes('amazon')) {
      this.level.generateAmazon();
    } else if (lowerUrl.includes('facebook') || lowerUrl.includes('fb.com')) {
      this.level.generateFacebook();
    } else {
      await this.level.renderFetchedPage(pageData);
    }

    this.localPlayer.respawn(this.level);
    this.adaptZoomForCurrentMap();

    if (this.level && this.idle) {
      this.level.onCellsDestroyed = (count, x, y) => this.idle.onCellsDestroyed(count, x, y);
    }

    if (notifyServer && !this.isSoloMode) {
      this.multiplayer.emitChangeMap('custom', pageData.url, pageData);
    }

    if (this.ui) this.ui.victoryShown = false;
    this.ui.updateDestructionBar(0);
    this.ui.setPresetDisplay('custom', pageData.url);
  }

  async loadUserImage(imageSource) {
    await this.level.loadImageAsLevel(imageSource);
    this.localPlayer.respawn(this.level);
    this.adaptZoomForCurrentMap();

    if (this.level && this.idle) {
      this.level.onCellsDestroyed = (count, x, y) => this.idle.onCellsDestroyed(count, x, y);
    }

    // Auto-hide the top UI bars on image load so the image is 100% visible and clean
    document.body.classList.add('ui-hidden');

    if (this.ui) this.ui.victoryShown = false;
    this.ui.updateDestructionBar(0);
    this.ui.setPresetDisplay('image', 'Imagen Personalizada');
  }

  // Draw Pixel-Art Icons on bottom weapon slots using uploaded Futuristic Spritesheet
  drawWeaponIcons() {
    const weaponMap = [
      { id: 'icon-0', name: 'Pistol' },
      { id: 'icon-1', name: 'SMG' },
      { id: 'icon-2', name: 'Shotgun' },
      { id: 'icon-3', name: 'Rocket Launcher' },
      { id: 'icon-4', name: 'Railgun' },
      { id: 'icon-5', name: 'Flamethrower' },
      { id: 'icon-6', name: 'Too Much' },
      { id: 'icon-7', name: 'The Magic Wand' },
      { id: 'icon-8', name: 'PSR B0531+21' },
      { id: 'icon-9', name: 'Tsar Bomba' },
      { id: 'icon-alt', name: 'Grenade' }
    ];

    weaponMap.forEach(({ id, name }) => {
      this.drawIcon(id, (ctx, c) => {
        const sp = window.SPRITES && window.SPRITES.weapons[name];
        if (window.spriteSheetImg && window.spriteSheetImg.complete && window.spriteSheetImg.naturalWidth > 0 && sp) {
          const pad = 2;
          const availW = c.width - pad * 2;
          const availH = c.height - pad * 2;
          const scale = Math.min(availW / sp.w, availH / sp.h);
          const dw = Math.round(sp.w * scale);
          const dh = Math.round(sp.h * scale);
          const dx = Math.round((c.width - dw) / 2);
          const dy = Math.round((c.height - dh) / 2);
          ctx.drawImage(window.spriteSheetImg, sp.x, sp.y, sp.w, sp.h, dx, dy, dw, dh);
        } else {
          // Fallback vector shape
          ctx.fillStyle = '#64748b';
          ctx.fillRect(8, 12, 32, 8);
        }
      });
    });
  }

  drawIcon(canvasId, drawFn) {
    const c = document.getElementById(canvasId);
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    drawFn(ctx, c);
  }

  spawnBot() {
    const botData = {
      id: 'bot_' + Math.random().toString(36).substring(2, 7),
      name: 'Bot#' + Math.floor(Math.random() * 90 + 10),
      color: ['#ec4899', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444'][Math.floor(Math.random() * 5)],
      x: 300 + Math.random() * 800,
      y: 200
    };
    const bot = new BotController(botData, this.level, this.physics);
    this.bots.push(bot);
  }

  clearBots() {
    this.bots = [];
  }

  findTargetById(id) {
    if (this.localPlayer.id === id) return this.localPlayer;
    if (this.multiplayer.remotePlayers.has(id)) return this.multiplayer.remotePlayers.get(id);
    for (const b of this.bots) {
      if (b.player.id === id) return b.player;
    }
    return null;
  }

  getAllTargets() {
    const list = [this.localPlayer];
    if (!this.isSoloMode) {
      for (const rp of this.multiplayer.remotePlayers.values()) {
        list.push(rp);
      }
    }
    for (const b of this.bots) {
      list.push(b.player);
    }
    return list;
  }

  spawnRemoteShot(data) {
    const w = this.localPlayer.weapons[data.weaponIndex] || this.localPlayer.weapons[0];
    const angle = data.aimAngle;
    const originX = data.originX;
    const originY = data.originY;

    this.physics.spawnMuzzleSmoke(originX, originY, angle);

    if (w.name === 'Pistol') {
      window.soundManager.playPistol();
      this.physics.addProjectile({
        type: 'bullet',
        weapon: 'pistol',
        ownerId: data.playerId,
        x: originX,
        y: originY,
        vx: Math.cos(angle) * 22,
        vy: Math.sin(angle) * 22,
        damage: w.damage,
        radius: w.radius,
        life: 2.0
      });
    } else if (w.name === 'SMG') {
      window.soundManager.playSMG();
      const spread = (Math.random() - 0.5) * 0.12;
      this.physics.addProjectile({
        type: 'bullet',
        weapon: 'smg',
        ownerId: data.playerId,
        x: originX,
        y: originY,
        vx: Math.cos(angle + spread) * 24,
        vy: Math.sin(angle + spread) * 24,
        damage: w.damage,
        radius: w.radius,
        life: 2.0
      });
    } else if (w.name === 'Shotgun') {
      window.soundManager.playShotgun();
      for (let i = 0; i < 6; i++) {
        const spread = (Math.random() - 0.5) * 0.32;
        const spd = 18 + Math.random() * 6;
        this.physics.addProjectile({
          type: 'bullet',
          weapon: 'shotgun',
          ownerId: data.playerId,
          x: originX,
          y: originY,
          vx: Math.cos(angle + spread) * spd,
          vy: Math.sin(angle + spread) * spd,
          damage: w.damage,
          radius: w.radius,
          life: 0.8
        });
      }
    } else if (w.name === 'Rocket Launcher') {
      window.soundManager.playRocketLaunch();
      this.physics.addProjectile({
        type: 'rocket',
        weapon: 'rocket',
        ownerId: data.playerId,
        x: originX,
        y: originY,
        vx: Math.cos(angle) * 14,
        vy: Math.sin(angle) * 14,
        damage: w.damage,
        radius: w.radius,
        life: 4.0
      });
    } else if (w.name === 'Railgun') {
      window.soundManager.playRailgun();
      const maxDist = 1800;
      const endX = originX + Math.cos(angle) * maxDist;
      const endY = originY + Math.sin(angle) * maxDist;
      this.level.carveLine(originX, originY, endX, endY, 18);
      this.physics.spawnShockwave(originX, originY, 40, '#38bdf8');
      this.physics.particles.push({
        type: 'laser',
        x1: originX,
        y1: originY,
        x2: endX,
        y2: endY,
        color: '#38bdf8',
        life: 1.0,
        decay: 0.08
      });
    } else if (w.name === 'Flamethrower') {
      window.soundManager.playFlamethrower();
      const spread = (Math.random() - 0.5) * 0.22;
      const spd = 10 + Math.random() * 4;
      this.physics.addProjectile({
        type: 'flame',
        weapon: 'flame',
        ownerId: data.playerId,
        x: originX,
        y: originY,
        vx: Math.cos(angle + spread) * spd,
        vy: Math.sin(angle + spread) * spd,
        damage: w.damage,
        radius: w.radius,
        life: 0.45
      });
    }
  }

  gameLoop(timestamp) {
    const rawDt = Math.min(0.1, (timestamp - this.lastTime) / 1000);
    this.lastTime = timestamp;
    const dt = rawDt * this.timeScale;

    this.update(dt);
    this.render();

    requestAnimationFrame((t) => this.gameLoop(t));
  }

  update(dt) {
    // Si la misión aún no inicia (intro de inicio activa), prevenir disparos, bombas y proyectiles
    if (!this.isGameStarted) {
      this.input.isMouseDown = false;
      this.input.isRightMouseDown = false;
      return;
    }

    const targets = this.getAllTargets();

    // 1. Update Local Player
    this.localPlayer.update(
      dt,
      this.input,
      this.level,
      this.physics,
      (shootData) => {
        if (!this.isSoloMode) this.multiplayer.emitShoot(shootData);
      },
      (grenadeData) => {
        if (!this.isSoloMode) this.multiplayer.emitGrenade(grenadeData);
      }
    );

    this.input.justPressedJump = false;

    if (!this.isSoloMode) {
      this.multiplayer.emitPlayerUpdate(this.localPlayer);
    }

    // 2. Interpolate Remote Players (Only in Online mode)
    if (!this.isSoloMode) {
      for (const rp of this.multiplayer.remotePlayers.values()) {
        if (rp.targetX !== undefined) {
          rp.x += (rp.targetX - rp.x) * 0.28;
          rp.y += (rp.targetY - rp.y) * 0.28;
        }
        if (rp.jetpackActive) {
          this.physics.spawnJetpackFlame(rp.x, rp.y, rp.facing);
        }
      }
    }

    // 3. Update Bots (if any spawned)
    for (const bot of this.bots) {
      bot.update(
        dt,
        targets,
        (shootData) => {
          if (!this.isSoloMode) this.multiplayer.emitShoot({ ...shootData, playerId: bot.player.id });
        },
        (grenadeData) => {
          if (!this.isSoloMode) this.multiplayer.emitGrenade({ ...grenadeData, playerId: bot.player.id });
        }
      );
    }

    // 4. Update Physics
    this.physics.update(
      dt,
      targets,
      (x, y, radius, weapon) => {
        if (!this.isSoloMode) this.multiplayer.emitTerrainDamage(x, y, radius, weapon);
        this.ui.updateDestructionBar(this.level.getDestructionPercentage());
      },
      (targetId, damage, weapon, attackerId) => {
        if (!this.isSoloMode) {
          this.multiplayer.emitPlayerHit(targetId, damage, weapon, attackerId);
        } else {
          const t = this.findTargetById(targetId);
          if (t) t.takeDamage(damage, weapon, attackerId, this.physics);
        }
      }
    );

    // 5. Update Camera (Always centered smoothly on player)
    if (!this.camera.isPanning) {
      this.camera.targetX = this.localPlayer.x;
      this.camera.targetY = this.localPlayer.y;

      const lerpSpeed = 0.22;
      this.camera.x += (this.camera.targetX - this.camera.x) * lerpSpeed;
      this.camera.y += (this.camera.targetY - this.camera.y) * lerpSpeed;
    }

    this.clampCamera();

    // 6. Update Idle Incremental Mechanics (Drones, Meteors, Boosts, Cash)
    if (this.idle) {
      this.idle.update(dt);
    }

    // 7. Recolección de Reliquias y Secretos Excavados
    if (this.level && this.level.secrets) {
      for (const secret of this.level.secrets) {
        if (secret.revealed && !secret.collected) {
          const dist = Math.hypot(this.localPlayer.x - secret.x, this.localPlayer.y - secret.y);
          if (dist < 42) {
            secret.collected = true;
            this.secretsFoundCount = (this.secretsFoundCount || 0) + 1;
            const secCounter = document.getElementById('secrets-found-count');
            if (secCounter) secCounter.textContent = this.secretsFoundCount;

            if (this.idle) {
              this.idle.cash += secret.cash;
              this.idle.save();
              this.idle.updateUI();
            }

            if (window.soundManager && typeof window.soundManager.playSecretCollect === 'function') {
              window.soundManager.playSecretCollect();
            }

            // Street Fighter 6 Super 3D Effects en Reliquia Excavada
            if (this.physics) {
              this.physics.triggerSuperArtCutIn('RELIQUIA ANCESTRAL', `⭐ ${secret.name.toUpperCase()} EXCAVADO`, '#facc15');
              this.physics.spawnDriveImpact(secret.x, secret.y, 'sf6');
              this.physics.spawn3DDepthDebris(secret.x, secret.y, 35, '#facc15');
            }

            if (this.ui) {
              this.ui.showToast(`🔍 ¡RELIQUIA EXTRAÍDA: ${secret.name} (+ $${secret.cash.toLocaleString()})!`);
              const pct = this.level.getDestructionPercentage();
              const unlocked = this.localPlayer.checkUnlocks(pct, this.secretsFoundCount);
              if (unlocked && unlocked.length > 0) {
                unlocked.forEach(w => {
                  this.ui.showToast(`🎉 ¡NUEVA ARMA DESBLOQUEADA: ${w.name.toUpperCase()}!`);
                });
                if (window.soundManager && typeof window.soundManager.playWeaponUnlocked === 'function') {
                  window.soundManager.playWeaponUnlocked();
                }
                this.ui.refreshWeaponLocks();
              }

              // Verificación de Victoria de Misión por Secretos (Auto-descarga de video)
              if (this.secretsFoundCount >= 5 && !this.victoryAnnounced) {
                this.victoryAnnounced = true;
                if (this.physics) {
                  this.physics.triggerSuperArtCutIn('¡VICTORIA TOTAL!', '🏆 TODOS LOS SECRETOS REVELADOS - MISIÓN CUMPLIDA', '#10b981');
                }
                if (this.ui) {
                  this.ui.showToast('🏆 ¡VICTORIA TOTAL! Has desenterrado todos los secretos y conquistado la web.');
                }
                if (this.recorder) {
                  this.recorder.onMissionComplete();
                }
              }
            }
          }
        }
      }
    }

    // Verificación de Victoria por Destrucción Total del Sitio (Auto-descarga de video)
    const currentPct = this.level ? this.level.getDestructionPercentage() : 0;
    if (currentPct >= 99 && !this.destructionVictoryAnnounced) {
      this.destructionVictoryAnnounced = true;
      if (this.physics) {
        this.physics.triggerSuperArtCutIn('ANIQUILACIÓN 100%', '💥 PÁGINA WEB TOTALMENTE PULVERIZADA', '#ef4444');
      }
      if (this.ui) {
        this.ui.showToast('💥 ¡ANIQUILACIÓN COMPLETA! Sitio destruido al 100%.');
      }
      if (this.recorder) {
        this.recorder.onMissionComplete();
      }
    }

    // Update UI HUD
    this.ui.updateHUD(this.localPlayer);
  }

  render() {
    const ctx = this.ctx;
    const dpr = this.dpr || 1;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    ctx.scale(dpr, dpr);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const shake = this.physics.getShakeOffset();

    ctx.save();
    ctx.translate(window.innerWidth / 2 + shake.x, window.innerHeight / 2 + shake.y);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.rotate(shake.rot);
    ctx.translate(-this.camera.x, -this.camera.y);

    // 1. Draw Level Canvas (Webpage with dithered craters)
    ctx.drawImage(this.level.canvas, 0, 0);

    // 1.5 Draw Excavated Secrets / Relics on Terrain
    if (this.level && typeof this.level.renderSecrets === 'function') {
      this.level.renderSecrets(ctx);
    }

    // 2. Draw Physics (Debris, Shockwaves, Projectiles)
    this.physics.render(ctx);

    // 3. Draw Remote Players (Only if online)
    if (!this.isSoloMode) {
      for (const rp of this.multiplayer.remotePlayers.values()) {
        rp.render(ctx);
      }
    }

    // 4. Draw Bots
    for (const bot of this.bots) {
      bot.render(ctx);
    }

    // 5. Draw Local Player
    this.localPlayer.render(ctx);

    // 5.5 Draw Idle Autonomous Drones & Floating Cash Numbers
    if (this.idle) {
      this.idle.render(ctx);
    }

    ctx.restore();

    // 6. Draw Minimap & HUD Crosshair
    this.renderMinimap(ctx);
    this.renderCrosshair(ctx);

    // 7. Destello Nuclear Cegador (Tsar Bomba)
    if (this.physics && this.physics.screenFlash > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, this.physics.screenFlash * 0.95)})`;
      ctx.fillRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);
      ctx.restore();
    }

    // 7.5 Render Street Fighter 6 3D Depth Debris (flying out of the screen at the player)
    this.render3DDepthDebris(ctx, dpr);

    // 7.8 Render Street Fighter 6 Critical Art / Super Art Cut-In Banner
    this.renderSuperArtCutIn(ctx, dpr);

    ctx.restore();
  }

  // Street Fighter 6 Perspective 3D Debris (Particles explode towards the screen)
  render3DDepthDebris(ctx, dpr) {
    if (!this.physics || !this.physics.depth3DParticles || this.physics.depth3DParticles.length === 0) return;
    const fov = 340;
    const screenW = this.canvas.width / dpr;
    const screenH = this.canvas.height / dpr;
    const centerX = screenW / 2;
    const centerY = screenH / 2;

    for (const p of this.physics.depth3DParticles) {
      const zClamped = Math.max(8, p.z);
      const scale = fov / zClamped;

      // Project world coords to camera to screen space
      const scrX = (p.x - this.camera.x) * this.camera.zoom + centerX;
      const scrY = (p.y - this.camera.y) * this.camera.zoom + centerY;

      // Radial perspective pop-out towards camera
      const popFactor = Math.min(2.8, scale * 0.45);
      const projX = scrX + (scrX - centerX) * (popFactor - 1) * 0.35;
      const projY = scrY + (scrY - centerY) * (popFactor - 1) * 0.35;

      const renderW = Math.max(2, p.size * scale * Math.abs(Math.cos(p.rotX)));
      const renderH = Math.max(2, p.size * scale * Math.abs(Math.sin(p.rotY)));

      ctx.save();
      ctx.translate(projX, projY);
      ctx.rotate(p.rotZ);
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = scale > 1.8 ? 16 : 4;

      ctx.fillRect(-renderW / 2, -renderH / 2, renderW, renderH);

      // Fast speed trail when flying directly towards player screen
      if (scale > 2.0) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-p.vx * 0.04 * scale, -p.vy * 0.04 * scale);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // Street Fighter 6 Critical Art / Super Art Diagonal Cut-In Banner
  renderSuperArtCutIn(ctx, dpr) {
    if (!this.physics || !this.physics.superArtBanner) return;
    const banner = this.physics.superArtBanner;
    const w = this.canvas.width / dpr;
    const h = this.canvas.height / dpr;

    const t = banner.time;
    const dur = banner.duration;
    // Enter fast (0 to 0.12s), hold (0.12 to 1.1s), exit (1.1 to 1.45s)
    let enterProgress = 1;
    if (t < 0.12) {
      enterProgress = t / 0.12;
    } else if (t > dur - 0.25) {
      enterProgress = Math.max(0, (dur - t) / 0.25);
    }

    ctx.save();
    ctx.globalAlpha = Math.min(1, enterProgress * 1.25);

    // 1. Dynamic Speed lines streaming diagonally
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.5;
    const numLines = 18;
    for (let i = 0; i < numLines; i++) {
      const lineY = (h * (i / numLines) + (t * 850) % h) % h;
      ctx.beginPath();
      ctx.moveTo(0, lineY - 50);
      ctx.lineTo(w, lineY + 50);
      ctx.stroke();
    }

    // 2. Diagonal Cut-in Ribbon across screen center (SF6 Style)
    const ribbonH = Math.min(145, h * 0.26);
    const centerY = h * 0.46;
    const skewOffset = 55;

    // Outer glow / chromatic split
    ctx.save();
    ctx.fillStyle = banner.color || '#ec4899';
    ctx.beginPath();
    ctx.moveTo(0, centerY - ribbonH / 2 - 8);
    ctx.lineTo(w, centerY - ribbonH / 2 + skewOffset - 8);
    ctx.lineTo(w, centerY + ribbonH / 2 + skewOffset + 8);
    ctx.lineTo(0, centerY + ribbonH / 2 + 8);
    ctx.closePath();
    ctx.globalAlpha = 0.4 * enterProgress;
    ctx.fill();
    ctx.restore();

    // Main dark carbon ribbon
    ctx.save();
    ctx.fillStyle = '#09090b';
    ctx.beginPath();
    ctx.moveTo(0, centerY - ribbonH / 2);
    ctx.lineTo(w, centerY - ribbonH / 2 + skewOffset);
    ctx.lineTo(w, centerY + ribbonH / 2 + skewOffset);
    ctx.lineTo(0, centerY + ribbonH / 2);
    ctx.closePath();
    ctx.fill();

    // Neon borders on top and bottom of diagonal ribbon
    ctx.strokeStyle = banner.color || '#ec4899';
    ctx.lineWidth = 4;
    ctx.shadowColor = banner.color || '#ec4899';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.moveTo(0, centerY - ribbonH / 2);
    ctx.lineTo(w, centerY - ribbonH / 2 + skewOffset);
    ctx.moveTo(0, centerY + ribbonH / 2);
    ctx.lineTo(w, centerY + ribbonH / 2 + skewOffset);
    ctx.stroke();
    ctx.restore();

    // 3. Street Fighter 6 Bold Punchy Typography
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textSlideX = (1 - enterProgress) * 140;

    // Small Top Tag: "★ CRITICAL ART ★" / "★ SUPER ART ★"
    ctx.font = '900 clamp(12px, 2.5vw, 18px) "Montserrat", "Impact", sans-serif';
    ctx.fillStyle = banner.color || '#ec4899';
    ctx.shadowColor = banner.color || '#ec4899';
    ctx.shadowBlur = 12;
    ctx.fillText(`★ ${banner.title} ★`, w / 2 + textSlideX, centerY - 24);

    // Giant Main Title: "☢️ TSAR BOMBA: ANIQUILACIÓN TOTAL"
    ctx.font = '950 clamp(20px, 4.5vw, 38px) "Montserrat", "Impact", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 10;
    ctx.fillText(banner.subtitle, w / 2 - textSlideX, centerY + 16);

    ctx.restore();
    ctx.restore();
  }

  renderMinimap(ctx) {
    // Hide minimap completely on mobile, tablets or narrow screens (< 860px) so it doesn't obstruct gameplay
    if (this.canvas.width < 860 || window.innerWidth < 860 || document.body.classList.contains('touch-active')) {
      return;
    }

    const mw = 160;
    const mh = Math.floor(mw * (this.level.height / this.level.width));
    const mx = this.canvas.width - mw - 20;
    const my = 80;

    ctx.save();
    ctx.fillStyle = 'rgba(24, 24, 27, 0.85)';
    ctx.strokeStyle = '#52525b';
    ctx.lineWidth = 1.5;
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeRect(mx, my, mw, mh);

    ctx.drawImage(this.level.canvas, mx, my, mw, mh);

    const scaleX = mw / this.level.width;
    const scaleY = mh / this.level.height;
    const camW = (this.canvas.width / this.camera.zoom) * scaleX;
    const camH = (this.canvas.height / this.camera.zoom) * scaleY;
    const camX = mx + (this.camera.x * scaleX) - camW / 2;
    const camY = my + (this.camera.y * scaleY) - camH / 2;

    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 1;
    ctx.strokeRect(camX, camY, camW, camH);

    // Local Player dot
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(mx + this.localPlayer.x * scaleX, my + this.localPlayer.y * scaleY, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  renderCrosshair(ctx) {
    const x = this.input.screenMouseX;
    const y = this.input.screenMouseY;

    ctx.save();
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x - 14, y);
    ctx.lineTo(x - 5, y);
    ctx.moveTo(x + 5, y);
    ctx.lineTo(x + 14, y);
    ctx.moveTo(x, y - 14);
    ctx.lineTo(x, y - 5);
    ctx.moveTo(x, y + 5);
    ctx.lineTo(x, y + 14);
    ctx.stroke();

    ctx.restore();
  }
}

// UI Manager
class UIManager {
  constructor(game) {
    this.game = game;

    this.hpBar = document.getElementById('hud-hp-bar');
    this.hpText = document.getElementById('hud-hp-text');
    this.fuelBar = document.getElementById('hud-fuel-bar');
    this.fuelText = document.getElementById('hud-fuel-text');
    this.wnameText = document.getElementById('wname-text');
    this.wnameAmmo = document.getElementById('wname-ammo');
    this.destructionBar = document.getElementById('destruction-bar-fill');
    this.destructionText = document.getElementById('destruction-percent-text');
    this.killFeed = document.getElementById('kill-feed');
    this.chatLog = document.getElementById('chat-log');
    this.chatInput = document.getElementById('chat-input');
    this.mobileChatToggle = document.getElementById('btn-mobile-chat-toggle');
    this.mobileChatClose = document.getElementById('btn-close-chat');
    this.chatContainer = document.getElementById('chat-container');
    this.unreadBadge = document.getElementById('chat-unread-badge');
    this.btnSendChat = document.getElementById('btn-send-chat');
    this.unreadCount = 0;
    this.scoreboard = document.getElementById('scoreboard-modal');
    this.urlInput = document.getElementById('webpage-url-input');
    this.helpModal = document.getElementById('help-modal');
    this.victoryShown = false;

    this.setupUIEvents();
  }

  setupUIEvents() {
    // Mapa de URLs de webs reales para los presets
    const presetMap = {
      google: 'https://www.google.com',
      youtube: 'https://www.youtube.com',
      tiktok: 'https://www.tiktok.com',
      wikipedia: 'https://en.wikipedia.org/wiki/Stick_figure',
      amazon: 'https://www.amazon.com',
      facebook: 'https://www.facebook.com'
    };

    // Captura real de sitios web en vivo con sincronización multijugador y soporte total de subcarpetas
    const loadLiveWebpage = async (targetUrl, fallbackPreset = 'custom') => {
      const btn = document.getElementById('btn-destroy-url');
      if (btn) btn.innerHTML = '<span>⏳ CAPTURANDO...</span>';

      try {
        const lower = targetUrl.toLowerCase();
        if (lower.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/)) {
          await this.game.loadUserImage(targetUrl);
          if (!this.game.isSoloMode) {
            this.game.multiplayer.emitChangeMap('image', targetUrl);
          }
          return;
        }

        const ssRes = await fetch(`/api/screenshot-url?url=${encodeURIComponent(targetUrl)}`);
        if (!ssRes.ok) throw new Error(`Captura no disponible (${ssRes.status})`);
        const blob = await ssRes.blob();
        const reader = new FileReader();
        const dataUrl = await new Promise((res, rej) => {
          reader.onload = () => res(reader.result);
          reader.onerror = rej;
          reader.readAsDataURL(blob);
        });
        await this.game.loadUserImage(dataUrl);
        this.game.level.pageUrl = targetUrl;
        this.setPresetDisplay(fallbackPreset, targetUrl);

        // Sincronizar captura a la sala multijugador para que todos jueguen sobre la misma web
        if (!this.game.isSoloMode) {
          const roomId = this.game.multiplayer.roomId || 'lobby';
          try {
            await fetch('/api/upload-room-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                roomId,
                imageBase64: dataUrl,
                pageUrl: targetUrl,
                preset: 'image'
              })
            });
          } catch (syncErr) {
            console.warn('[SYNC ROOM IMAGE ERR]:', syncErr);
          }
        }
      } catch (err) {
        console.warn('[SCREENSHOT FALLBACK]:', err.message);
        // Fallback Inteligente: Extraer HTML estructurado y subcarpetas reales del artículo/página
        try {
          const parseRes = await fetch(`/api/parse-url?url=${encodeURIComponent(targetUrl)}`);
          if (parseRes.ok) {
            const pageData = await parseRes.json();
            if (pageData && (pageData.title || (pageData.headings && pageData.headings.length))) {
              await this.game.loadParsedWebpage(pageData, true);
              return;
            }
          }
        } catch (pErr) {
          console.warn('[PARSE FALLBACK ERROR]:', pErr.message);
        }
        this.game.loadMapPreset(fallbackPreset, targetUrl, true);
      } finally {
        if (btn) btn.innerHTML = '<span>⚡ DESTRUIR</span>';
      }
    };

    // Presets con Conteo Regresivo de 3s y Sincronización Multijugador
    document.querySelectorAll('[data-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-preset]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const preset = btn.getAttribute('data-preset');
        const targetUrl = presetMap[preset] || `https://www.${preset}.com`;
        if (this.urlInput) this.urlInput.value = targetUrl;
        this.game.triggerDestructionCountdown(targetUrl, () => {
          this.game.loadMapPreset(preset, targetUrl, true);
        });
      });
    });

    // Destroy button con Conteo Regresivo de 3 Segundos
    const destroyBtn = document.getElementById('btn-destroy-url');
    const handleUrlSubmit = () => {
      const val = this.urlInput.value.trim();
      if (!val) return;
      this.game.triggerDestructionCountdown(val, () => {
        loadLiveWebpage(val, 'custom');
      });
    };

    if (destroyBtn) {
      destroyBtn.addEventListener('click', handleUrlSubmit);
    }

    if (this.urlInput) {
      this.urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleUrlSubmit();
      });
    }

    // Image Upload Button & Input con Conteo Regresivo
    const uploadBtn = document.getElementById('btn-upload-image');
    const fileInput = document.getElementById('image-upload-input');
    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const dataUrl = ev.target.result;
            this.game.triggerDestructionCountdown(`Imagen: ${file.name}`, async () => {
              await this.game.loadUserImage(dataUrl);

              // Sincronizar imagen a la sala multijugador persistente
              try {
                let currentRoom = this.game.multiplayer.roomId || 'lobby';
                if (this.game.isSoloMode || !currentRoom || currentRoom === 'solo') {
                  currentRoom = 'sala_' + Math.random().toString(36).substring(2, 7);
                  this.game.isSoloMode = false;
                  this.game.multiplayer.init(currentRoom, this.game.localPlayer.name, this.game.localPlayer.color);
                }

                await fetch('/api/upload-room-image', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ roomId: currentRoom, imageBase64: dataUrl, preset: 'image' })
                });
                this.setPresetDisplay('image', file.name);
              } catch (err) {
                console.warn('[IMAGE UPLOAD ROOM ERROR]:', err);
              }
            });
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // Atajos de Salas y Mi Cuenta dentro del cajón móvil de Opciones
    const drawerRooms = document.getElementById('btn-open-rooms-hub-drawer');
    const drawerAuth = document.getElementById('btn-open-auth-drawer');
    const btnRoomsHub = document.getElementById('btn-open-rooms-hub');
    const btnAuth = document.getElementById('btn-open-auth-modal');
    if (drawerRooms && btnRoomsHub) drawerRooms.addEventListener('click', () => btnRoomsHub.click());
    if (drawerAuth && btnAuth) drawerAuth.addEventListener('click', () => btnAuth.click());

    // Rooms Hub & Authentication Modals
    this.setupRoomsHub();
    this.setupAuthModal();

    // Mobile Navigation Drawer Toggle
    const menuToggle = document.getElementById('btn-menu-toggle');
    const navDrawer = document.getElementById('nav-drawer');
    if (menuToggle && navDrawer) {
      menuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        navDrawer.classList.toggle('open');
      });
      navDrawer.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
          navDrawer.classList.remove('open');
        }
      });
      document.addEventListener('click', (e) => {
        if (!menuToggle.contains(e.target) && !navDrawer.contains(e.target)) {
          navDrawer.classList.remove('open');
        }
      });
    }

    // Operative Visor/Armor Color Switcher
    const colorBtn = document.getElementById('btn-color-picker');
    const colorDot = document.getElementById('color-dot');
    const OPERATIVE_PALETTE = [
      { name: 'Naranja Futuro', hex: '#f97316' },
      { name: 'Cian Neón', hex: '#38bdf8' },
      { name: 'Verde Ácido', hex: '#22c55e' },
      { name: 'Púrpura Cyber', hex: '#a855f7' },
      { name: 'Rosa Láser', hex: '#ec4899' },
      { name: 'Amarillo Solar', hex: '#eab308' },
      { name: 'Rojo Carmesí', hex: '#ef4444' },
      { name: 'Azul Eléctrico', hex: '#3b82f6' }
    ];
    let currentColorIndex = 0;

    if (colorBtn) {
      colorBtn.addEventListener('click', () => {
        currentColorIndex = (currentColorIndex + 1) % OPERATIVE_PALETTE.length;
        const chosen = OPERATIVE_PALETTE[currentColorIndex];
        this.game.localPlayer.color = chosen.hex;
        if (colorDot) colorDot.style.background = chosen.hex;
        if (!this.game.isSoloMode && this.game.multiplayer) {
          this.game.multiplayer.emitPlayerUpdate(this.game.localPlayer);
        }
      });
    }

    // Solo Mode vs Online Toggle
    const btnSolo = document.getElementById('btn-mode-solo');
    const btnMulti = document.getElementById('btn-mode-multi');
    if (btnSolo && btnMulti) {
      btnSolo.addEventListener('click', () => {
        this.game.isSoloMode = true;
        btnSolo.classList.add('active');
        btnMulti.classList.remove('active');
        document.getElementById('chat-container').style.display = 'none';
        this.game.clearBots();
      });

      btnMulti.addEventListener('click', () => {
        this.game.isSoloMode = false;
        btnMulti.classList.add('active');
        btnSolo.classList.remove('active');
        document.getElementById('chat-container').style.display = 'flex';
        // Dynamic Visor & Light color shift when entering multiplayer!
        if (this.game.localPlayer.color === '#f97316') {
          this.game.localPlayer.color = '#38bdf8';
          if (colorDot) colorDot.style.background = '#38bdf8';
        }
        // Connect to online room
        this.game.multiplayer.init('lobby', this.game.localPlayer.name, this.game.localPlayer.color);
      });
    }

    // Add Bot & Clear Bots
    const botBtn = document.getElementById('btn-add-bot');
    if (botBtn) {
      botBtn.addEventListener('click', () => this.game.spawnBot());
    }

    const clearBtn = document.getElementById('btn-clear-bots');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.game.clearBots());
    }

    // Mute button
    const muteBtn = document.getElementById('btn-toggle-sound');
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        const isMuted = window.soundManager.toggleMute();
        muteBtn.textContent = isMuted ? '🔇 Silenciado' : '🔊 Sonido';
      });
    }

    // Help Modal
    const helpBtn = document.getElementById('btn-help');
    const closeHelp = document.getElementById('btn-close-help');
    const startPlay = document.getElementById('btn-start-playing');
    if (helpBtn && this.helpModal) {
      helpBtn.addEventListener('click', () => { this.helpModal.style.display = 'flex'; });
    }
    if (closeHelp && this.helpModal) {
      closeHelp.addEventListener('click', () => { this.helpModal.style.display = 'none'; });
    }
    if (startPlay && this.helpModal) {
      startPlay.addEventListener('click', () => { this.helpModal.style.display = 'none'; });
    }

    // Custom Player Nickname
    const nameInput = document.getElementById('player-name-input');
    if (nameInput) {
      const savedName = localStorage.getItem('destroy_player_name');
      if (savedName) {
        this.game.localPlayer.name = savedName;
        nameInput.value = savedName;
      }
      const handleNameChange = (val) => {
        const clean = val.replace(/[^a-zA-Z0-9_ -]/g, '').slice(0, 15);
        if (clean) {
          this.game.localPlayer.name = clean;
          localStorage.setItem('destroy_player_name', clean);
          if (!this.game.isSoloMode && this.game.multiplayer) {
            this.game.multiplayer.emitChangeName(clean);
            this.game.multiplayer.emitPlayerUpdate(this.game.localPlayer);
          }
        }
      };

      nameInput.addEventListener('input', (e) => handleNameChange(e.target.value));
      nameInput.addEventListener('change', (e) => handleNameChange(e.target.value));
    }

    // Centering Camera Button
    const btnCenter = document.getElementById('btn-center-camera');
    if (btnCenter) {
      btnCenter.addEventListener('click', () => {
        this.game.snapCameraToPlayer();
      });
    }

    // Mobile Chat Toggle Button
    if (this.mobileChatToggle && this.chatContainer) {
      this.mobileChatToggle.addEventListener('click', () => {
        this.chatContainer.classList.toggle('open-mobile');
        if (this.chatContainer.classList.contains('open-mobile')) {
          this.unreadCount = 0;
          if (this.unreadBadge) {
            this.unreadBadge.textContent = '0';
            this.unreadBadge.classList.remove('has-unread');
          }
          if (this.chatInput) this.chatInput.focus();
        }
      });
    }

    if (this.mobileChatClose && this.chatContainer) {
      this.mobileChatClose.addEventListener('click', () => {
        this.chatContainer.classList.remove('open-mobile');
      });
    }

    if (this.btnSendChat) {
      this.btnSendChat.addEventListener('click', () => {
        this.sendChat();
      });
    }

    // Live Mode Slow-Mo Button
    const btnLive = document.getElementById('btn-toggle-live');
    if (btnLive) {
      btnLive.addEventListener('click', () => {
        this.game.toggleLiveMode();
      });
    }

    // Fullscreen Toggle (Ideal for TikTok Live streaming from mobile)
    const fsBtn = document.getElementById('btn-toggle-fullscreen');
    if (fsBtn) {
      fsBtn.addEventListener('click', () => {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
          const docEl = document.documentElement;
          if (docEl.requestFullscreen) {
            docEl.requestFullscreen().catch(() => {});
          } else if (docEl.webkitRequestFullscreen) {
            docEl.webkitRequestFullscreen();
          }
          fsBtn.textContent = '🗗 Salir Pantalla Completa';
        } else {
          if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
          } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
          }
          fsBtn.textContent = '📺 Pantalla Completa';
        }
      });
      document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
          fsBtn.textContent = '📺 Pantalla Completa';
        } else {
          fsBtn.textContent = '🗗 Salir Pantalla Completa';
        }
        this.game.resizeCanvas();
      });
    }

    // 3D Victory Modal Buttons
    const btnVictoryAnother = document.getElementById('btn-victory-another');
    const btnVictoryRestart = document.getElementById('btn-victory-restart');
    const victoryModal = document.getElementById('victory-modal');

    if (btnVictoryAnother && victoryModal) {
      btnVictoryAnother.addEventListener('click', () => {
        victoryModal.style.display = 'none';
        this.victoryShown = false;
        if (this.urlInput) {
          this.urlInput.focus();
          this.urlInput.select();
        }
      });
    }

    if (btnVictoryRestart && victoryModal) {
      btnVictoryRestart.addEventListener('click', () => {
        victoryModal.style.display = 'none';
        this.victoryShown = false;
        this.game.loadMapPreset(this.game.level.presetName || 'wikipedia', this.game.level.pageUrl, true);
      });
    }

    // Hide / Show UI Controls (To clear entire top area for TikTok Live & gameplay)
    const btnHideUI = document.getElementById('btn-hide-ui');
    const btnShowUI = document.getElementById('btn-show-ui');
    if (btnHideUI) {
      btnHideUI.addEventListener('click', () => {
        document.body.classList.add('ui-hidden');
      });
    }
    if (btnShowUI) {
      btnShowUI.addEventListener('click', () => {
        document.body.classList.remove('ui-hidden');
      });
    }

    // Toggle barra inferior de armas
    const btnToggleHotbar = document.getElementById('btn-toggle-hotbar');
    const hudBottomWrap = document.getElementById('hud-bottom-wrap');
    if (btnToggleHotbar && hudBottomWrap) {
      btnToggleHotbar.addEventListener('click', () => {
        hudBottomWrap.classList.toggle('collapsed');
        btnToggleHotbar.innerHTML = hudBottomWrap.classList.contains('collapsed') ? '<span>▲ ARMAS</span>' : '<span>▼ ARMAS</span>';
      });
    }

    // Botón VIP en Hotbar
    const btnVipHotbar = document.getElementById('btn-vip-hotbar');
    if (btnVipHotbar) {
      btnVipHotbar.addEventListener('click', () => {
        if (this.game.wompi) this.game.wompi.openModal();
      });
    }

    // Hotbar Instant Selection on Touch (No delay, immediate weapon switch)
    document.querySelectorAll('.slot').forEach((slot) => {
      const selectSlot = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        if (slot.id === 'btn-vip-hotbar') {
          if (this.game.wompi) this.game.wompi.openModal();
          return;
        }

        const slotVal = slot.getAttribute('data-slot');
        const idx = slotVal === 'alt' ? 10 : parseInt(slotVal);
        if (!isNaN(idx)) {
          if (this.game.localPlayer.isWeaponUnlocked(idx)) {
            this.game.localPlayer.selectWeapon(idx);
            this.updateActiveWeapon(idx);
          } else {
            const w = this.game.localPlayer.weapons[idx];
            const rule = this.game.localPlayer.weaponUnlockRules.find(r => r.index === idx);
            if (window.soundManager && typeof window.soundManager.playLockedBuzz === 'function') {
              window.soundManager.playLockedBuzz();
            }
            slot.classList.remove('shake-error');
            void slot.offsetWidth;
            slot.classList.add('shake-error');
            this.showToast(`🔒 ${w ? w.name : 'Arma'} Bloqueada: Requiere ${rule ? rule.desc : 'más destrucción'} o Pase VIP`);
          }
        }
      };

      slot.addEventListener('pointerdown', selectSlot);
      slot.addEventListener('touchstart', selectSlot, { passive: false });
      slot.addEventListener('click', selectSlot);
    });
  }

  showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast-item';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3600);
  }

  refreshWeaponLocks() {
    document.querySelectorAll('.slot').forEach((slot) => {
      const slotVal = slot.getAttribute('data-slot');
      if (!slotVal || slot.id === 'btn-vip-hotbar') return;
      const idx = slotVal === 'alt' ? 10 : parseInt(slotVal);
      const isUnlocked = this.game.localPlayer && this.game.localPlayer.isWeaponUnlocked(idx);
      const lockOverlay = slot.querySelector('.slot-lock');
      if (isUnlocked) {
        slot.classList.remove('locked');
        if (lockOverlay) lockOverlay.style.display = 'none';
      } else {
        slot.classList.add('locked');
        if (lockOverlay) lockOverlay.style.display = 'flex';
      }
    });
  }

  updateHUD(player) {
    if (this.hpBar) {
      const pct = Math.max(0, (player.health / player.maxHealth) * 100);
      this.hpBar.style.width = `${pct}%`;
      this.hpText.textContent = `${Math.ceil(player.health)} HP`;
    }
    if (this.fuelBar) {
      const fpct = Math.max(0, (player.jetpackFuel / player.maxJetpackFuel) * 100);
      this.fuelBar.style.width = `${fpct}%`;
      this.fuelText.textContent = `${Math.ceil(player.jetpackFuel)}% JET`;
    }
    const w = player.getCurrentWeapon();
    if (this.wnameText) this.wnameText.textContent = w.name;
    if (this.wnameAmmo) {
      this.wnameAmmo.textContent = w.ammo === Infinity ? '∞' : `${w.ammo} / ${w.maxAmmo}`;
    }
  }

  updateActiveWeapon(index) {
    document.querySelectorAll('.slot').forEach((slot) => {
      const slotVal = slot.getAttribute('data-slot');
      const idx = slotVal === 'alt' ? 10 : parseInt(slotVal);
      if (idx === index) slot.classList.add('active');
      else slot.classList.remove('active');
    });
    const w = this.game.localPlayer.weapons[index];
    if (w && this.wnameText) {
      this.wnameText.textContent = w.name;
    }
  }

  updateDestructionBar(percent) {
    if (this.destructionBar) {
      this.destructionBar.style.width = `${percent.toFixed(1)}%`;
    }
    if (this.destructionText) {
      const secrets = this.game.secretsFoundCount || 0;
      this.destructionText.textContent = `${percent.toFixed(1)}% DESTRUIDO • 🔍 ${secrets}/5`;
    }

    // Comprobar progresión de desbloqueo de armas
    if (this.game.localPlayer) {
      const newlyUnlocked = this.game.localPlayer.checkUnlocks(percent, this.game.secretsFoundCount || 0);
      if (newlyUnlocked && newlyUnlocked.length > 0) {
        newlyUnlocked.forEach(w => {
          this.showToast(`🎉 ¡NUEVA ARMA DESBLOQUEADA: ${w.name.toUpperCase()}!`);
        });
        if (window.soundManager && typeof window.soundManager.playWeaponUnlocked === 'function') {
          window.soundManager.playWeaponUnlocked();
        }
        this.refreshWeaponLocks();
      }
    }

    // 3D Obliteration Victory Celebration
    if (percent >= 99.0 && !this.victoryShown) {
      this.victoryShown = true;
      const vModal = document.getElementById('victory-modal');
      if (vModal) {
        vModal.style.display = 'flex';
        const vPct = document.getElementById('vstat-percent');
        const vScore = document.getElementById('vstat-score');
        const vPlayer = document.getElementById('vstat-player');
        if (vPct) vPct.textContent = `${percent.toFixed(1)}%`;
        if (vScore) vScore.textContent = (Math.round((this.game.localPlayer.kills * 1000) + (percent * 150))).toLocaleString();
        if (vPlayer) {
          vPlayer.textContent = this.game.localPlayer.name;
          vPlayer.style.color = this.game.localPlayer.color;
        }
        this.game.physics.spawnVictoryConfetti(this.game.localPlayer.x, this.game.localPlayer.y - 120);
      }
    }
  }

  setPresetDisplay(preset, url) {
    if (this.urlInput) {
      this.urlInput.value = url || preset;
    }
  }

  setConnectionStatus(connected, room) {
    const el = document.getElementById('room-badge');
    if (el) {
      el.textContent = connected ? `SALA: ${room.toUpperCase()}` : 'SOLO';
      el.style.borderColor = connected ? '#22c55e' : '#ef4444';
    }
    const hudRoom = document.getElementById('hud-room-name');
    if (hudRoom) {
      hudRoom.textContent = connected ? `SALA: ${room.toUpperCase()}` : 'MODO SOLO';
    }
    const shareCode = document.getElementById('share-room-code');
    if (shareCode) {
      shareCode.textContent = room ? room.toUpperCase() : 'LOBBY';
    }
  }

  setupRoomsHub() {
    const shareBtn = document.getElementById('btn-share-room');
    const pillBtn = document.getElementById('btn-open-rooms-hub');
    const shareModal = document.getElementById('share-modal');
    const closeShare = document.getElementById('btn-close-share');
    const copyShareUrlBtn = document.getElementById('btn-copy-share-url');
    const shareRoomInput = document.getElementById('share-room-input');
    const shareRoomCode = document.getElementById('share-room-code');
    const whatsappBtn = document.getElementById('btn-whatsapp-share');
    const refreshBtn = document.getElementById('btn-refresh-rooms');
    const joinCustomBtn = document.getElementById('btn-join-custom-room');
    const customInput = document.getElementById('custom-room-input');

    const openRoomsModal = () => {
      let currentRoom = this.game.multiplayer.roomId || 'lobby';
      if (this.game.isSoloMode || !currentRoom || currentRoom === 'solo') {
        currentRoom = 'sala_' + Math.random().toString(36).substring(2, 7);
        this.game.isSoloMode = false;
        this.game.multiplayer.init(currentRoom, this.game.localPlayer.name, this.game.localPlayer.color);
      }

      const shareUrl = `${window.location.origin}${window.location.pathname}?room=${currentRoom}`;
      if (shareRoomInput) shareRoomInput.value = shareUrl;
      if (shareRoomCode) shareRoomCode.textContent = currentRoom.toUpperCase();

      if (whatsappBtn) {
        whatsappBtn.href = `https://api.whatsapp.com/send?text=${encodeURIComponent('¡Entra a destruir esta web conmigo en tiempo real! ' + shareUrl)}`;
      }

      if (shareModal) shareModal.style.display = 'flex';
      this.fetchAndRenderActiveRooms();
    };

    if (shareBtn) shareBtn.addEventListener('click', openRoomsModal);
    if (pillBtn) pillBtn.addEventListener('click', openRoomsModal);

    if (closeShare && shareModal) {
      closeShare.addEventListener('click', () => { shareModal.style.display = 'none'; });
    }

    if (copyShareUrlBtn && shareRoomInput) {
      copyShareUrlBtn.addEventListener('click', () => {
        shareRoomInput.select();
        shareRoomInput.setSelectionRange(0, 99999);
        if (navigator.clipboard) {
          navigator.clipboard.writeText(shareRoomInput.value);
        } else {
          document.execCommand('copy');
        }
        copyShareUrlBtn.textContent = '✅ ¡Copiado con Éxito!';
        setTimeout(() => { copyShareUrlBtn.textContent = '📋 Copiar Enlace'; }, 3000);
      });
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.fetchAndRenderActiveRooms());
    }

    if (joinCustomBtn && customInput) {
      joinCustomBtn.addEventListener('click', () => {
        const val = customInput.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
        if (val) {
          window.location.search = `?room=${encodeURIComponent(val)}`;
        }
      });
    }
  }

  async fetchAndRenderActiveRooms() {
    const listEl = document.getElementById('active-rooms-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="room-card-loading">Cargando salas activas...</div>';

    try {
      const res = await fetch('/api/rooms');
      if (!res.ok) throw new Error('Error al listar salas');
      const rooms = await res.json();
      const currentRoom = (this.game.multiplayer.roomId || 'lobby').toLowerCase();

      if (!rooms || rooms.length === 0) {
        listEl.innerHTML = '<div class="room-card-loading">No hay salas activas en este momento.</div>';
        return;
      }

      listEl.innerHTML = '';
      for (const r of rooms) {
        const isCurrent = r.id.toLowerCase() === currentRoom;
        const card = document.createElement('div');
        card.className = `room-card-item ${isCurrent ? 'room-card-current' : ''}`;
        card.innerHTML = `
          <div class="room-card-name">
            <span>🏠 ${r.id.toUpperCase()}</span>
            ${isCurrent ? '<span style="color:#10b981; font-size:10px;">(Tu Sala)</span>' : ''}
          </div>
          <div class="room-card-meta">👥 ${r.playerCount} jugador(es) • ${r.preset || 'web'}</div>
          ${!isCurrent ? `<button class="room-card-btn" data-room="${r.id}">🚀 Unirse a esta Sala</button>` : '<span style="font-size:11px;color:#10b981;font-weight:700;">Activa</span>'}
        `;

        const joinBtn = card.querySelector('.room-card-btn');
        if (joinBtn) {
          joinBtn.addEventListener('click', () => {
            window.location.search = `?room=${encodeURIComponent(r.id)}`;
          });
        }
        listEl.appendChild(card);
      }
    } catch (err) {
      console.warn('Error fetching rooms:', err);
      listEl.innerHTML = '<div class="room-card-loading" style="color:#ef4444;">Error al cargar salas activas.</div>';
    }
  }

  setupAuthModal() {
    const btnOpen = document.getElementById('btn-open-auth-modal');
    const modal = document.getElementById('auth-code-modal');
    const btnClose = document.getElementById('btn-close-auth-modal');
    const stepEmail = document.getElementById('auth-step-email');
    const stepCode = document.getElementById('auth-step-code');
    const stepLogged = document.getElementById('auth-step-logged');
    const emailInput = document.getElementById('auth-email-input');
    const codeInput = document.getElementById('auth-code-input');
    const btnSendCode = document.getElementById('btn-send-auth-code');
    const btnVerifyCode = document.getElementById('btn-verify-auth-code');
    const btnBack = document.getElementById('btn-auth-back-to-email');
    const btnLogout = document.getElementById('btn-logout-auth');
    const targetEmailLabel = document.getElementById('auth-target-email-label');
    const loggedEmailDisplay = document.getElementById('auth-logged-email-display');
    const vipStatusBadge = document.getElementById('auth-vip-status-badge');
    const btnAuthLabel = document.getElementById('auth-btn-label');

    const checkSavedSession = () => {
      const savedEmail = localStorage.getItem('apocalipsis_auth_email');
      if (savedEmail) {
        const isVip = localStorage.getItem('apocalipsis_vip_unlocked') === 'true';
        if (btnAuthLabel) btnAuthLabel.textContent = isVip ? '⭐ VIP' : 'Mi Cuenta';
        return savedEmail;
      }
      return null;
    };

    checkSavedSession();

    if (btnOpen && modal) {
      btnOpen.addEventListener('click', () => {
        modal.style.display = 'flex';
        const currentEmail = localStorage.getItem('apocalipsis_auth_email');
        if (currentEmail) {
          if (stepEmail) stepEmail.style.display = 'none';
          if (stepCode) stepCode.style.display = 'none';
          if (stepLogged) stepLogged.style.display = 'block';
          if (loggedEmailDisplay) loggedEmailDisplay.textContent = currentEmail;
          const isVip = localStorage.getItem('apocalipsis_vip_unlocked') === 'true';
          if (vipStatusBadge) {
            vipStatusBadge.textContent = isVip ? '⭐ Arsenal VIP Activado' : 'Operativo Estándar';
            vipStatusBadge.style.color = isVip ? '#facc15' : '#94a3b8';
          }
        } else {
          if (stepEmail) stepEmail.style.display = 'block';
          if (stepCode) stepCode.style.display = 'none';
          if (stepLogged) stepLogged.style.display = 'none';
        }
      });
    }

    if (btnClose && modal) {
      btnClose.addEventListener('click', () => { modal.style.display = 'none'; });
    }

    if (btnBack) {
      btnBack.addEventListener('click', () => {
        if (stepEmail) stepEmail.style.display = 'block';
        if (stepCode) stepCode.style.display = 'none';
      });
    }

    if (btnSendCode && emailInput) {
      btnSendCode.addEventListener('click', async () => {
        const email = emailInput.value.trim().toLowerCase();
        if (!email || !email.includes('@')) {
          this.showToast('⚠️ Por favor ingresa un correo electrónico válido');
          return;
        }

        btnSendCode.disabled = true;
        btnSendCode.innerHTML = '<span>⏳ Enviando Código...</span>';

        try {
          const res = await fetch('/api/auth/send-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
          });
          const data = await res.json();
          if (data.success) {
            if (targetEmailLabel) targetEmailLabel.textContent = email;
            if (stepEmail) stepEmail.style.display = 'none';
            if (stepCode) stepCode.style.display = 'block';

            const devHint = document.getElementById('auth-dev-code-hint');
            if (data.emailSent) {
              this.showToast(`📩 ¡Código de 6 dígitos enviado a ${email}! Revisa tu bandeja de entrada o spam.`);
              if (devHint) devHint.style.display = 'none';
              if (codeInput) {
                codeInput.value = '';
                codeInput.focus();
              }
            } else {
              // Si aún no hay SMTP en Coolify, mostrar el código en pantalla y auto-completarlo
              const directCode = data.devCode || data.code || '';
              this.showToast(`🔔 Código de Acceso: ${directCode}`);
              if (devHint) {
                devHint.innerHTML = `⚠️ <em>Servidor sin SMTP configurado todavía en Coolify</em>.<br>Tu código de acceso directo es: <strong style="font-size:20px; color:#facc15; letter-spacing:4px;">${directCode}</strong>`;
                devHint.style.display = 'block';
              }
              if (codeInput) {
                codeInput.value = directCode;
                codeInput.focus();
              }
            }
          } else {
            this.showToast(`❌ Error: ${data.error || 'No se pudo enviar el código'}`);
          }
        } catch (err) {
          this.showToast('❌ Error de conexión al servidor');
        } finally {
          btnSendCode.disabled = false;
          btnSendCode.innerHTML = '<span>📨 Enviar Código de 6 Dígitos</span>';
        }
      });
    }

    if (btnVerifyCode && codeInput && emailInput) {
      btnVerifyCode.addEventListener('click', async () => {
        const email = emailInput.value.trim().toLowerCase();
        const code = codeInput.value.trim();

        if (!code || code.length !== 6) {
          this.showToast('⚠️ Ingresa el código de 6 dígitos');
          return;
        }

        btnVerifyCode.disabled = true;
        btnVerifyCode.innerHTML = '<span>⏳ Verificando...</span>';

        try {
          const res = await fetch('/api/auth/verify-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code })
          });
          const data = await res.json();

          if (data.success) {
            localStorage.setItem('apocalipsis_auth_email', email);
            if (btnAuthLabel) btnAuthLabel.textContent = data.isVip ? '⭐ VIP' : 'Mi Cuenta';

            if (data.isVip) {
              this.game.localPlayer.unlockAllWeaponsVip();
              this.refreshWeaponLocks();
              this.showToast(`⭐ ¡Bienvenido VIP! Todas las armas han sido restauradas.`);
            } else {
              this.showToast(`✅ ¡Inicio de sesión confirmado!`);
            }

            if (modal) modal.style.display = 'none';
          } else {
            this.showToast(`❌ Código Incorrecto o Expirado: ${data.error || ''}`);
          }
        } catch (err) {
          this.showToast('❌ Error al validar código');
        } finally {
          btnVerifyCode.disabled = false;
          btnVerifyCode.innerHTML = '<span>✅ Confirmar y Entrar</span>';
        }
      });
    }

    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        localStorage.removeItem('apocalipsis_auth_email');
        if (btnAuthLabel) btnAuthLabel.textContent = 'Iniciar Sesión';
        if (stepLogged) stepLogged.style.display = 'none';
        if (stepEmail) stepEmail.style.display = 'block';
        this.showToast('👋 Sesión cerrada correctamente');
      });
    }
  }

  updatePlayerCount(count) {
    const el = document.getElementById('player-count-badge');
    if (el) el.textContent = `JUGADORES: ${count}`;
  }

  addKillFeedEntry(killData) {
    if (!this.killFeed) return;
    const item = document.createElement('div');
    item.className = 'kill-feed-item';
    item.innerHTML = `<strong>${killData.attackerName}</strong> [${killData.weapon}] <strong>${killData.targetName}</strong>`;
    this.killFeed.appendChild(item);
    setTimeout(() => {
      item.style.opacity = '0';
      setTimeout(() => item.remove(), 400);
    }, 4000);
  }

  focusChat() {
    if (this.chatInput) this.chatInput.focus();
  }

  sendChat() {
    if (!this.chatInput) return;
    const text = this.chatInput.value.trim();
    if (text) {
      this.game.multiplayer.emitChat(text);
      this.chatInput.value = '';
    }
    this.chatInput.blur();
  }

  appendChatMessage(msg) {
    if (!this.chatLog) return;
    const div = document.createElement('div');
    div.className = 'chat-entry';
    div.innerHTML = `<span style="color: ${msg.color || '#f97316'}; font-weight: bold;">${msg.sender}:</span> <span>${msg.text}</span>`;
    this.chatLog.appendChild(div);
    this.chatLog.scrollTop = this.chatLog.scrollHeight;

    // Mobile unread counter badge
    if (!this.chatContainer || !this.chatContainer.classList.contains('open-mobile')) {
      if (window.innerWidth <= 900) {
        this.unreadCount = (this.unreadCount || 0) + 1;
        if (this.unreadBadge) {
          this.unreadBadge.textContent = this.unreadCount;
          this.unreadBadge.classList.add('has-unread');
        }
      }
    }
  }

  showScoreboard(show) {
    if (!this.scoreboard) return;
    if (show) {
      const list = this.game.getAllTargets();
      const tbody = document.getElementById('scoreboard-rows');
      if (tbody) {
        tbody.innerHTML = list
          .sort((a, b) => b.kills - a.kills)
          .map((p) => `<tr>
            <td style="color: ${p.color}; font-weight: bold;">${p.name}</td>
            <td>${p.kills}</td>
            <td>${p.deaths}</td>
            <td>${p.damageDealt || 0}</td>
            <td>${p.score || 0}</td>
          </tr>`)
          .join('');
      }
      this.scoreboard.style.display = 'block';
    } else {
      this.scoreboard.style.display = 'none';
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
});
