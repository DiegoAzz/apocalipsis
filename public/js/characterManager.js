/**
 * Selector de Personajes de Demolición - Apocalipsis VI
 * Módulo 100% Configurable y Extensible.
 * 
 * ==============================================================================
 * ¿CÓMO AGREGAR MÁS PERSONAJES? (CONDICIONES QUE DEBE CUMPLIR)
 * ==============================================================================
 * Para agregar un nuevo personaje, simplemente agrega un objeto a CHARACTER_CATALOG abajo:
 * 
 * 1. "id" (Obligatorio): Texto único en minúsculas sin espacios (ej: 'demonio_fuego', 'robot_x').
 * 2. "name" (Obligatorio): Nombre visible en el juego (ej: 'Robot Destructor X').
 * 3. "description": Breve frase descriptiva de su estilo.
 * 4. "icon": Emoji o ícono representativo (ej: '🤖', '🔥', '💀').
 * 5. "badge": Etiqueta de tipo (ej: 'TÁCTICO', 'PESADO', 'VIP', 'RÁPIDO').
 * 6. "requiresVip": true si requiere Pase VIP Wompi, false si es gratis para todos.
 * 7. "color": Color principal en HEX (ej: '#ef4444').
 * 8. "hueShift": Grados de rotación de color (0 a 360) para teñir el spritesheet oficial:
 *       0 = Naranja original, 45 = Dorado, 95 = Verde Neón, 185 = Cyan eléctrico,
 *       210 = Azul Cobalto, 260 = Púrpura, 315 = Rosa Neón, 345 = Rojo Carmesí.
 * 9. "saturation": Saturación de color (ej: 1.2, 1.5, o 0 para blanco y negro).
 * 10. "scale": Tamaño visual del personaje (ej: 1.0 estándar, 1.12 para tanque pesado, 0.9 para ninja ágil).
 * 11. "auraColor": Color RGBA del halo de energía (ej: 'rgba(239, 68, 68, 0.5)' o null si no lleva).
 * 12. "customSpriteUrl" (Opcional): Si deseas usar una imagen propia (.PNG):
 *       - Formato: PNG con fondo 100% transparente.
 *       - Tamaño recomendado: 64x64 o 128x128 píxeles.
 *       - Colocar la imagen en 'assets/characters/tu_imagen.png'.
 *       - Poner: customSpriteUrl: 'assets/characters/tu_imagen.png'.
 * ==============================================================================
 */

(function () {
  'use strict';

  // CATÁLOGO DE PERSONAJES CONFIGURABLE
  const CHARACTER_CATALOG = [
    {
      id: 'operative_orange',
      name: 'Operativo Nova',
      description: 'Traje táctico estándar con blindaje térmico de asalto.',
      icon: '⚡',
      badge: 'ESTÁNDAR',
      requiresVip: false,
      color: '#f97316',
      hueShift: 0,
      saturation: 1.2,
      scale: 1.0,
      auraColor: null,
      customSpriteUrl: null
    },
    {
      id: 'cyborg_cyan',
      name: 'Cyborg V-9',
      description: 'Chasis bio-mecánico refrigerado por plasma cuántico.',
      icon: '🤖',
      badge: 'CUÁNTICO',
      requiresVip: false,
      color: '#38bdf8',
      hueShift: 185,
      saturation: 1.5,
      scale: 1.0,
      auraColor: 'rgba(56, 189, 248, 0.45)',
      customSpriteUrl: null
    },
    {
      id: 'hazard_green',
      name: 'Tóxico Biohazard',
      description: 'Especialista en demolición química e inmunidad radiactiva.',
      icon: '☣️',
      badge: 'TOXIC',
      requiresVip: false,
      color: '#22c55e',
      hueShift: 95,
      saturation: 1.6,
      scale: 1.02,
      auraColor: 'rgba(34, 197, 94, 0.45)',
      customSpriteUrl: null
    },
    {
      id: 'stickman_classic',
      name: 'Stickman Retro 2D',
      description: 'El legendario monigote minimalista de la era Flash.',
      icon: '🧍',
      badge: 'RETRO',
      requiresVip: false,
      color: '#38bdf8',
      renderType: 'stickman',
      scale: 1.0,
      auraColor: null,
      customSpriteUrl: null
    },
    {
      id: 'shadow_ninja',
      name: 'Shadow Kuro',
      description: 'Ágil destructor cibernético con traje stealth anti-radar.',
      icon: '🥷',
      badge: 'SIGILO • VIP',
      requiresVip: true,
      color: '#a855f7',
      hueShift: 260,
      saturation: 1.8,
      scale: 0.93,
      auraColor: 'rgba(168, 85, 247, 0.55)',
      customSpriteUrl: null
    },
    {
      id: 'titan_red',
      name: 'Juggernaut Titán',
      description: 'Blindaje reforzado de titanio y propulsores de alta potencia.',
      icon: '🛡️',
      badge: 'PESADO • VIP',
      requiresVip: true,
      color: '#ef4444',
      hueShift: 345,
      saturation: 1.7,
      scale: 1.12,
      auraColor: 'rgba(239, 68, 68, 0.55)',
      customSpriteUrl: null
    },
    {
      id: 'gold_commander',
      name: 'Comando Midas',
      description: 'Armadura forjada en oro espacial para los mejores destructores.',
      icon: '👑',
      badge: 'LEGENDARIO • VIP',
      requiresVip: true,
      color: '#facc15',
      hueShift: 45,
      saturation: 2.1,
      scale: 1.05,
      auraColor: 'rgba(250, 204, 21, 0.65)',
      customSpriteUrl: null
    },
    {
      id: 'ghost_spectre',
      name: 'Spectre 00',
      description: 'Espectro monocromático desaturado con estela luminosa.',
      icon: '👻',
      badge: 'ESPECTRO • VIP',
      requiresVip: true,
      color: '#f8fafc',
      customFilter: 'grayscale(1) brightness(1.4) contrast(1.2)',
      scale: 1.0,
      auraColor: 'rgba(255, 255, 255, 0.45)',
      customSpriteUrl: null
    }
  ];

  class CharacterManager {
    constructor() {
      this.catalog = CHARACTER_CATALOG;
      this.modal = null;
      this.selectedId = localStorage.getItem('apocalipsis_selected_character') || 'operative_orange';
      this.init();
    }

    init() {
      this.injectModalHtml();
      this.bindTriggers();
      this.applyInitialSelection();
    }

    getCharacter(id) {
      return this.catalog.find(c => c.id === id) || this.catalog[0];
    }

    injectModalHtml() {
      if (document.getElementById('character-select-modal')) return;

      const modalHtml = `
      <div id="character-select-modal" class="custom-modal character-modal-root" style="display:none;">
        <div class="modal-card character-card-modal">
          <div class="modal-head character-modal-head">
            <div class="char-head-title">
              <span class="char-head-icon">👤</span>
              <div>
                <h2>SELECTOR DE PERSONAJES</h2>
                <span class="char-head-sub">Elige tu operativo o destructor de mundos</span>
              </div>
            </div>
            <button class="close-btn" id="btn-close-character-modal" title="Cerrar">✕</button>
          </div>

          <div class="character-modal-body">
            <div class="char-instructions-banner">
              <span>⚡ Elige tu personaje favorito. Todos cuentan con vuelo infinito y disparos automáticos.</span>
            </div>

            <div class="character-grid" id="character-cards-grid">
              <!-- Renderizado dinámicamente -->
            </div>
          </div>
        </div>
      </div>
      `;

      document.body.insertAdjacentHTML('beforeend', modalHtml);
      this.modal = document.getElementById('character-select-modal');

      const closeBtn = document.getElementById('btn-close-character-modal');
      if (closeBtn) closeBtn.addEventListener('click', () => this.close());

      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.modal && this.modal.classList.contains('open')) {
          this.close();
        }
      });
    }

    bindTriggers() {
      // 1. Botón en Nav Drawer (Opciones)
      const drawerGrid = document.querySelector('#nav-drawer .drawer-category:nth-child(5) .drawer-btn-grid');
      if (drawerGrid && !document.getElementById('btn-open-character-modal')) {
        const btnDrawer = document.createElement('button');
        btnDrawer.className = 'btn btn-drawer-item btn-char';
        btnDrawer.id = 'btn-open-character-modal';
        btnDrawer.title = 'Cambiar Personaje y Skin';
        btnDrawer.innerHTML = `<span>👤 Personajes</span>`;
        btnDrawer.addEventListener('click', () => {
          const navDrawer = document.getElementById('nav-drawer');
          const backdrop = document.getElementById('nav-drawer-backdrop');
          if (navDrawer) navDrawer.classList.remove('open');
          if (backdrop) backdrop.classList.remove('open');
          this.open();
        });
        drawerGrid.insertBefore(btnDrawer, drawerGrid.firstChild);
      }
    }

    open() {
      if (!this.modal) this.modal = document.getElementById('character-select-modal');
      if (!this.modal) return;
      this.renderGrid();
      this.modal.classList.add('open');
      this.modal.style.display = 'flex';
    }

    close() {
      if (!this.modal) return;
      this.modal.classList.remove('open');
      this.modal.style.display = 'none';
    }

    renderGrid() {
      const container = document.getElementById('character-cards-grid');
      if (!container) return;

      const isVip = (window.game && window.game.wompi && window.game.wompi.isPassActive) || false;

      container.innerHTML = '';
      this.catalog.forEach(char => {
        const isSelected = char.id === this.selectedId;
        const isLocked = char.requiresVip && !isVip;

        const card = document.createElement('div');
        card.className = `char-card ${isSelected ? 'active' : ''} ${isLocked ? 'locked' : ''}`;
        card.setAttribute('data-char-id', char.id);

        card.innerHTML = `
          <div class="char-card-top">
            <span class="char-badge ${char.requiresVip ? 'badge-vip' : 'badge-free'}">${char.badge}</span>
            ${isLocked ? '<span class="char-lock-tag">🔒 VIP</span>' : (isSelected ? '<span class="char-equipped-tag">✓ EQUIPADO</span>' : '')}
          </div>
          
          <div class="char-preview-box" style="background:radial-gradient(circle, ${char.auraColor || 'rgba(56, 189, 248, 0.15)'} 0%, rgba(15, 23, 42, 0.8) 70%);">
            <canvas class="char-mini-canvas" width="64" height="64" data-char-id="${char.id}"></canvas>
            <div class="char-avatar-icon">${char.icon}</div>
          </div>

          <div class="char-info">
            <h3 class="char-name" style="color:${char.color};">${char.name}</h3>
            <p class="char-desc">${char.description}</p>
          </div>

          <button class="btn btn-block ${isSelected ? 'btn-char-equipped' : (isLocked ? 'btn-char-locked' : 'btn-primary')}">
            ${isSelected ? 'EQUIPADO' : (isLocked ? '🔒 DESBLOQUEAR VIP' : 'SELECCIONAR')}
          </button>
        `;

        card.addEventListener('click', () => {
          if (isLocked) {
            this.close();
            const wompiModal = document.getElementById('wompi-modal');
            if (wompiModal) {
              wompiModal.classList.add('open');
              wompiModal.style.display = 'flex';
            }
          } else {
            this.selectCharacter(char.id);
          }
        });

        container.appendChild(card);
        this.renderCharacterPreview(char, card.querySelector('.char-mini-canvas'));
      });
    }

    renderCharacterPreview(char, canvas) {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (char.renderType === 'stickman') {
        ctx.save();
        ctx.translate(32, 34);
        ctx.strokeStyle = char.color || '#38bdf8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, -14, 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(0, 10);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(10, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 10);
        ctx.lineTo(-8, 22);
        ctx.moveTo(0, 10);
        ctx.lineTo(8, 22);
        ctx.stroke();
        ctx.restore();
        return;
      }

      if (char.customSpriteUrl) {
        if (!char._previewImg) {
          char._previewImg = new Image();
          char._previewImg.src = char.customSpriteUrl;
          char._previewImg.onload = () => this.drawCharacterPreview(canvas, char);
        }
        if (char._previewImg.complete && char._previewImg.naturalWidth > 0) {
          ctx.save();
          ctx.translate(32, 54);
          const h = 48;
          const w = Math.round(h * (char._previewImg.naturalWidth / char._previewImg.naturalHeight));
          ctx.drawImage(char._previewImg, -w / 2, -h, w, h);
          ctx.restore();
          return;
        }
      }

      const img = window.spriteSheetImg;
      if (img && img.complete && img.naturalWidth > 0 && window.SPRITES && window.SPRITES.hero) {
        ctx.save();
        ctx.translate(32, 54);
        if (char.customFilter) {
          ctx.filter = char.customFilter;
        } else if (char.hueShift !== 0 || char.saturation) {
          ctx.filter = `hue-rotate(${char.hueShift || 0}deg) saturate(${char.saturation || 1.2})`;
        }
        const sp = window.SPRITES.hero.idle[0];
        const h = 48;
        const w = Math.round(h * (sp.w / sp.h));
        ctx.drawImage(img, sp.x, sp.y, sp.w, sp.h, -w / 2, -h, w, h);
        ctx.restore();
      }
    }

    selectCharacter(charId) {
      const char = this.getCharacter(charId);
      if (!char) return;

      this.selectedId = char.id;
      try {
        localStorage.setItem('apocalipsis_selected_character', char.id);
      } catch (e) {}

      // Aplicar al jugador local en vivo
      if (window.game && window.game.localPlayer) {
        window.game.localPlayer.setCharacter(char);
        if (window.game.ui) {
          window.game.ui.showToast(`👤 Personaje cambiado a: ${char.name}`);
        }
        // Emitir al servidor si está en multijugador
        if (window.game.network && window.game.network.socket) {
          window.game.network.socket.emit('player-update', {
            characterId: char.id,
            color: char.color
          });
        }
      }

      this.renderGrid();
      setTimeout(() => this.close(), 250);
    }

    applyInitialSelection() {
      const char = this.getCharacter(this.selectedId);
      if (window.game && window.game.localPlayer) {
        window.game.localPlayer.setCharacter(char);
      }
    }
  }

  // Exportar globalmente
  window.CharacterManager = new CharacterManager();
  window.CHARACTER_CATALOG = CHARACTER_CATALOG;
})();
