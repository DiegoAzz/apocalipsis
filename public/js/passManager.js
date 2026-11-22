// ==========================================================================
// PASE CREADOR DE 24 HORAS ($1 USD) - APOCALIPSIS VI
// TikTok es gratis ilimitado; Subir Fotos, Webs y Bots requieren Pase 24h
// ==========================================================================
class CreatorPassManager {
  constructor(game) {
    this.game = game;
    this.STORAGE_KEY = 'apocalipsis_creator_pass_expires';
    this.STORAGE_EMAIL = 'apocalipsis_user_email';

    this.modal = document.getElementById('creator-pass-modal');
    this.btnClose = document.getElementById('btn-close-pass-modal');
    this.btnPayPaypal = document.getElementById('btn-pay-paypal-1usd');
    this.btnTestUnlock = document.getElementById('btn-pass-test-unlock');
    this.badgeTop = document.getElementById('btn-creator-pass-top');
    this.badgeLabel = document.getElementById('creator-pass-badge-label');
    this.featureNotice = document.getElementById('pass-feature-notice');

    this.init();
  }

  init() {
    this.bindEvents();
    this.updateHUD();

    // Loop de verificación de expiración cada 30 segundos
    setInterval(() => {
      this.updateHUD();
    }, 30000);

    // Sincronizar estado con el servidor al iniciar
    this.syncWithServer();
  }

  bindEvents() {
    if (this.btnClose && this.modal) {
      this.btnClose.addEventListener('click', () => this.closeModal());
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) this.closeModal();
      });
    }

    if (this.badgeTop) {
      this.badgeTop.addEventListener('click', () => {
        this.openModal('Acceso Total al Arsenal & Creación Ilimitada');
      });
    }

    if (this.btnPayPaypal) {
      this.btnPayPaypal.addEventListener('click', () => this.handlePurchaseFlow());
    }

    if (this.btnTestUnlock) {
      this.btnTestUnlock.addEventListener('click', () => {
        this.activatePass(24, 'Modo Prueba Inmediato');
        this.closeModal();
      });
    }
  }

  // Verifica si el pase de 24 horas está vigente
  isPassActive() {
    try {
      const expires = parseInt(localStorage.getItem(this.STORAGE_KEY) || '0', 10);
      return expires > Date.now();
    } catch (e) {
      return false;
    }
  }

  // Retorna el tiempo restante en formato legible (ej: 23h 45m)
  getRemainingFormatted() {
    const expires = parseInt(localStorage.getItem(this.STORAGE_KEY) || '0', 10);
    const diffMs = expires - Date.now();
    if (diffMs <= 0) return null;

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  }

  // Abre el modal si la función requiere pase activo
  requirePass(featureName, onAllowed) {
    if (this.isPassActive()) {
      if (typeof onAllowed === 'function') onAllowed();
      return true;
    }

    this.openModal(featureName);
    return false;
  }

  openModal(featureName) {
    if (!this.modal) return;
    if (this.featureNotice) {
      if (featureName) {
        this.featureNotice.innerHTML = `🔒 <strong>${featureName.toUpperCase()}</strong> es una función exclusiva del <strong>Pase Creador 24h</strong>.`;
        this.featureNotice.style.display = 'block';
      } else {
        this.featureNotice.style.display = 'none';
      }
    }
    this.modal.classList.add('open');
    if (window.soundManager && typeof window.soundManager.playSecretCollect === 'function') {
      window.soundManager.playSecretCollect();
    }
  }

  closeModal() {
    if (this.modal) this.modal.classList.remove('open');
  }

  // Activa el pase por X horas (por defecto 24)
  async activatePass(hours = 24, paymentMethod = 'checkout_1usd') {
    const now = Date.now();
    const currentExpires = parseInt(localStorage.getItem(this.STORAGE_KEY) || '0', 10);
    const baseTime = currentExpires > now ? currentExpires : now;
    const newExpires = baseTime + (hours * 60 * 60 * 1000);

    localStorage.setItem(this.STORAGE_KEY, newExpires.toString());

    // Notificar al servidor
    try {
      const email = localStorage.getItem(this.STORAGE_EMAIL) || 'creator_pass_user';
      await fetch('/api/pass/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, durationHours: hours, paymentMethod })
      });
    } catch (e) {
      console.warn('[PASS SYNC]:', e);
    }

    // Desbloquear armas al instante en el jugador local
    if (this.game && this.game.localPlayer) {
      this.game.localPlayer.unlockAllWeaponsVip();
      if (this.game.ui) this.game.ui.refreshWeaponLocks();
    }

    this.updateHUD();

    if (this.game && this.game.ui) {
      this.game.ui.showToast('⭐ ¡PASE CREADOR DE 24 HORAS ACTIVADO! Tienes acceso ilimitado a fotos, webs y armas.');
    }
    if (window.soundManager && typeof window.soundManager.playWeaponUnlocked === 'function') {
      window.soundManager.playWeaponUnlocked();
    }
  }

  // Actualiza la píldora superior del HUD
  updateHUD() {
    const active = this.isPassActive();
    if (!this.badgeTop || !this.badgeLabel) return;

    if (active) {
      const remaining = this.getRemainingFormatted();
      this.badgeTop.classList.add('pass-active');
      this.badgeTop.classList.remove('pass-inactive');
      this.badgeLabel.innerHTML = `⭐ <strong>PASE 24H:</strong> ${remaining}`;
      this.badgeTop.title = `Pase Creador Activo (${remaining} restantes). Tienes acceso a todas las fotos, webs y arsenal.`;

      if (this.game && this.game.localPlayer) {
        this.game.localPlayer.isVip = true;
      }
    } else {
      this.badgeTop.classList.remove('pass-active');
      this.badgeTop.classList.add('pass-inactive');
      this.badgeLabel.innerHTML = `⭐ Pase 24h ($1 USD)`;
      this.badgeTop.title = 'Obtén el Pase Creador de 24 Horas por $1 USD para subir fotos y destruir cualquier web.';

      // Si recién expiró, restaurar armas y volver a TikTok
      if (this.game && this.game.localPlayer && this.game.localPlayer.isVip) {
        this.game.localPlayer.isVip = false;
        if (this.game.ui) {
          this.game.ui.showToast('⏳ Tu Pase Creador de 24 Horas ha finalizado. ¡TikTok sigue disponible gratis!');
        }
      }
    }
  }

  // Proceso de compra con PayPal / Tarjeta Internacional ($1 USD)
  handlePurchaseFlow() {
    const confirmBuy = confirm(
      '⭐ PASE CREADOR 24 HORAS ($1 USD)\n\n' +
      '• Subir fotos e imágenes ilimitadas para destruir\n' +
      '• Destruir cualquier sitio web del mundo\n' +
      '• Todas las 11 armas desbloqueadas\n' +
      '• Invocación de bots destructores para tus videos\n\n' +
      '¿Deseas activar tu Pase de 24 Horas ahora?'
    );

    if (confirmBuy) {
      this.activatePass(24, 'paypal_card_1usd');
      this.closeModal();
    }
  }

  async syncWithServer() {
    try {
      const email = localStorage.getItem(this.STORAGE_EMAIL);
      if (!email) return;
      const res = await fetch(`/api/pass/status?email=${encodeURIComponent(email)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.isPassActive && data.expiresAt) {
          localStorage.setItem(this.STORAGE_KEY, data.expiresAt.toString());
          this.updateHUD();
        }
      }
    } catch (e) {}
  }
}

window.CreatorPassManager = CreatorPassManager;
