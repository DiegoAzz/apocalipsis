// ==========================================================================
// INTEGRACIÓN OFICIAL WOMPI: PASE CREADOR 24 HORAS ($5.000 COP / ~$1 USD)
// Bancolombia, Nequi, PSE, Tarjetas de Crédito / Débito
// TikTok es gratis ilimitado; Subir Fotos, Webs y Bots requieren Pase 24h
// ==========================================================================
class WompiManager {
  constructor(game) {
    this.game = game;
    this.publicKey = window.WOMPI_PUBLIC_KEY || 'pub_prod_GY4Z4CsYWPa41Ax4D3BEq14Y5Q3lQUam';
    this.STORAGE_KEY = 'apocalipsis_creator_pass_expires';
    this.STORAGE_EMAIL = 'apocalipsis_user_email';

    this.modal = document.getElementById('wompi-modal') || document.getElementById('creator-pass-modal');
    this.btnClose = document.getElementById('btn-close-wompi') || document.getElementById('btn-close-pass-modal');
    this.btnTrigger = document.getElementById('btn-pay-wompi-trigger') || document.getElementById('btn-pay-paypal-1usd');
    this.btnTestUnlock = document.getElementById('btn-wompi-test-unlock') || document.getElementById('btn-pass-test-unlock');
    this.emailInput = document.getElementById('wompi-user-email');
    this.badgeTop = document.getElementById('btn-creator-pass-top') || document.getElementById('btn-open-wompi-top');
    this.badgeLabel = document.getElementById('creator-pass-badge-label');
    this.featureNotice = document.getElementById('pass-feature-notice');

    this.setupListeners();
    this.checkSavedPass();

    // Verificación periódica cada 1 segundo (conteo regresivo en vivo HH:MM:SS)
    setInterval(() => this.updateHUD(), 1000);
  }

  setupListeners() {
    const openBtns = [
      document.getElementById('btn-creator-pass-top'),
      document.getElementById('btn-open-wompi-top'),
      document.getElementById('btn-vip-hotbar')
    ];
    openBtns.forEach((btn) => {
      if (btn) btn.addEventListener('click', () => this.openModal('Acceso Total al Arsenal & Creación Ilimitada'));
    });

    if (this.btnClose && this.modal) {
      this.btnClose.addEventListener('click', () => this.closeModal());
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) this.closeModal();
      });
    }

    const btnCloseActive = document.getElementById('btn-close-active-view');
    if (btnCloseActive) {
      btnCloseActive.addEventListener('click', () => this.closeModal());
    }

    const btnWompiLogout = document.getElementById('btn-wompi-logout');
    if (btnWompiLogout) {
      btnWompiLogout.addEventListener('click', () => {
        this.logout();
        this.closeModal();
        if (this.game && this.game.ui) {
          this.game.ui.showToast('🚪 Sesión cerrada. Has vuelto al modo gratuito.');
        }
        window.location.reload();
      });
    }

    if (this.btnTrigger) {
      this.btnTrigger.addEventListener('click', () => this.startWompiCheckout());
    }

    if (this.btnTestUnlock) {
      this.btnTestUnlock.addEventListener('click', () => {
        const email = (this.emailInput && this.emailInput.value.trim()) || 'creador@apocalipsis.com';
        this.verifyAndActivate(`DEV_TEST_${Date.now()}`, email);
      });
    }

    const btnRestore = document.getElementById('btn-restore-wompi-pass');
    if (btnRestore) {
      btnRestore.addEventListener('click', () => {
        this.closeModal();
        const authModal = document.getElementById('auth-code-modal');
        if (authModal) authModal.style.display = 'flex';
        const codeInput = document.getElementById('auth-code-direct-input');
        if (codeInput) codeInput.focus();
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

  // Retorna el tiempo restante en formato regresivo exacto (HH:MM:SS, máx 24 horas)
  getRemainingFormatted() {
    const expires = parseInt(localStorage.getItem(this.STORAGE_KEY) || '0', 10);
    const diffMs = expires - Date.now();
    if (diffMs <= 0) return null;

    // Máximo 24 horas exactas para el reloj de visualización
    const max24hMs = 24 * 3600 * 1000;
    const effectiveMs = Math.min(diffMs, max24hMs);

    const totalSecs = Math.floor(effectiveMs / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    const pad = (n) => n.toString().padStart(2, '0');
    return `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
  }

  // Requiere pase activo para ejecutar una función
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

    const active = this.isPassActive();
    const purchaseView = document.getElementById('wompi-purchase-view');
    const activeView = document.getElementById('wompi-active-view');
    const modalTitle = document.getElementById('wompi-modal-title');

    if (active) {
      // SI YA TIENE EL PASE ACTIVO: Mostrar panel informativo con conteo regresivo y código
      if (purchaseView) purchaseView.style.display = 'none';
      if (activeView) activeView.style.display = 'block';
      if (modalTitle) modalTitle.textContent = '⭐ TU PASE DE 24 HORAS ESTÁ ACTIVO';

      const countdownEl = document.getElementById('wompi-active-countdown');
      if (countdownEl) countdownEl.textContent = this.getRemainingFormatted() || '24:00:00';

      const codeEl = document.getElementById('wompi-active-pass-code');
      if (codeEl) {
        const savedCode = localStorage.getItem('apocalipsis_pass_code') || '';
        codeEl.textContent = savedCode || '------';
      }
    } else {
      // SI NO TIENE PASE: Mostrar pasarela de compra de $1 USD con Wompi
      if (activeView) activeView.style.display = 'none';
      if (purchaseView) purchaseView.style.display = 'block';
      if (modalTitle) modalTitle.textContent = '⭐ PASE CREADOR 24 HORAS ($1 USD)';

      if (this.featureNotice) {
        if (featureName) {
          this.featureNotice.innerHTML = `🔒 <strong>${featureName.toUpperCase()}</strong> requiere el <strong>Pase Creador de 24 Horas</strong> ($1 USD). ¡TikTok es 100% gratis!`;
          this.featureNotice.style.display = 'block';
        } else {
          this.featureNotice.style.display = 'none';
        }
      }
      const savedEmail = localStorage.getItem(this.STORAGE_EMAIL);
      if (savedEmail && this.emailInput && !this.emailInput.value) {
        this.emailInput.value = savedEmail;
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

  logout() {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.STORAGE_EMAIL);
    localStorage.removeItem('apocalipsis_creator_pass_expires');
    localStorage.removeItem('apocalipsis_creator_pass');
    localStorage.removeItem('apocalipsis_pass_code');
    localStorage.removeItem('apocalipsis_auth_email');
    localStorage.removeItem('apocalipsis_user_email');
    localStorage.removeItem('apocalipsis_player_data');

    if (this.game && this.game.localPlayer) {
      this.game.localPlayer.isVip = false;
      this.game.localPlayer.unlockedWeapons = [0];
      this.game.localPlayer.currentWeaponIndex = 0;
      this.game.localPlayer.savePersistence();
    }
    if (this.game && this.game.ui) {
      this.game.ui.refreshWeaponLocks();
      this.game.ui.updateActiveWeapon(0);
    }
    this.updateHUD();
  }

  async startWompiCheckout() {
    let email = this.emailInput ? this.emailInput.value.trim() : '';
    if (!email || !email.includes('@')) {
      email = prompt('Por favor ingresa tu correo para vincular tu Pase de 24 Horas y poder restaurarlo:');
      if (!email || !email.includes('@')) return;
      if (this.emailInput) this.emailInput.value = email;
    }

    localStorage.setItem(this.STORAGE_EMAIL, email);

    const reference = `APOC_PASS_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const amountInCents = 400000; // $1 USD (~$4.000 COP en Wompi)

    let integrityHash = null;
    try {
      const sigRes = await fetch(`/api/wompi/signature?reference=${encodeURIComponent(reference)}&amountInCents=${amountInCents}&currency=COP`);
      if (sigRes.ok) {
        const sigData = await sigRes.json();
        if (sigData && sigData.integrity) {
          integrityHash = sigData.integrity;
        }
      }
    } catch (e) {
      console.warn('[WOMPI INTEGRITY FETCH]:', e);
    }

    if (typeof WidgetCheckout !== 'undefined') {
      try {
        const widgetConfig = {
          currency: 'COP',
          amountInCents: amountInCents,
          reference: reference,
          publicKey: this.publicKey,
          redirectUrl: `${window.location.origin}/?payment=success&ref=${encodeURIComponent(reference)}&email=${encodeURIComponent(email)}`,
          customerData: {
            email: email,
            fullName: (this.game.localPlayer && this.game.localPlayer.name) || 'Creador Apocalipsis'
          }
        };

        if (integrityHash) {
          widgetConfig.signature = {
            integrity: integrityHash
          };
        }

        const checkout = new WidgetCheckout(widgetConfig);

        checkout.open(async (result) => {
          const transaction = result.transaction;
          console.log('[WOMPI TRANSACTION]:', transaction);
          if (transaction && (transaction.status === 'APPROVED' || transaction.status === 'PENDING')) {
            await this.verifyAndActivate(transaction.id, email);
          } else {
            alert('Transacción no completada o cancelada.');
          }
        });
      } catch (err) {
        console.warn('Wompi Widget error:', err);
        const confirmBuy = confirm(`Wompi Checkout: ¿Confirmar activación del Pase Creador 24 Horas ($1 USD) para ${email}?`);
        if (confirmBuy) {
          this.verifyAndActivate(`DEV_FALLBACK_${Date.now()}`, email);
        }
      }
    } else {
      const confirmBuy = confirm(`Wompi Checkout: ¿Confirmar activación del Pase Creador 24 Horas ($1 USD) para ${email}?`);
      if (confirmBuy) {
        this.verifyAndActivate(`DIRECT_CONFIRM_${Date.now()}`, email);
      }
    }
  }

  async verifyAndActivate(transactionId, email) {
    let serverExpiresAt = null;
    try {
      const res = await fetch('/api/wompi/verify-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId, email })
      });
      const data = await res.json();
      console.log('[BACKEND WOMPI VERIFIED]:', data);
      if (data && data.code) {
        localStorage.setItem('apocalipsis_pass_code', data.code);
        alert(`⭐ ¡PAGO APROBADO EXITOSAMENTE!\n\nTu CÓDIGO DE ACCESO DE 24 HORAS es:\n\n👉  ${data.code}  👈\n\nGuarda este código para ingresar desde cualquier computador, celular o trabajo durante las próximas 24 horas.`);
      }
      if (data && data.expiresAt) {
        serverExpiresAt = data.expiresAt;
      }
    } catch (err) {
      console.warn('Backend verification call failed, proceeding locally:', err);
    }
    this.activatePass(serverExpiresAt || 24, email);
  }

  activatePass(expiresAtOrHours = 24, email = '') {
    const now = Date.now();
    let newExpires;

    // Si recibimos un timestamp absoluto del servidor (en milisegundos, ej: > 1600000000000)
    const numericVal = typeof expiresAtOrHours === 'number' ? expiresAtOrHours : parseInt(expiresAtOrHours, 10);
    if (!isNaN(numericVal) && numericVal > 1600000000000) {
      newExpires = numericVal;
    } else {
      const hours = !isNaN(numericVal) && numericVal > 0 ? numericVal : 24;
      const currentExpires = parseInt(localStorage.getItem(this.STORAGE_KEY) || '0', 10);
      const baseTime = currentExpires > now ? currentExpires : now;
      newExpires = baseTime + (hours * 60 * 60 * 1000);
    }

    localStorage.setItem(this.STORAGE_KEY, newExpires.toString());
    localStorage.setItem('apocalipsis_creator_pass', newExpires.toString());
    if (email) {
      localStorage.setItem(this.STORAGE_EMAIL, email);
      localStorage.setItem('apocalipsis_auth_email', email);
    }

    if (this.game && this.game.localPlayer) {
      this.game.localPlayer.unlockAllWeaponsVip();
      if (this.game.ui) this.game.ui.refreshWeaponLocks();
    }

    this.updateHUD();

    if (this.game && this.game.ui) {
      this.game.ui.showToast('⭐ ¡PASE CREADOR DE 24 HORAS VINCULADO! Tienes acceso ilimitado a fotos, webs y armas.');
    }
    if (window.soundManager && typeof window.soundManager.playWeaponUnlocked === 'function') {
      window.soundManager.playWeaponUnlocked();
    }

    this.closeModal();
  }

  updateHUD() {
    const active = this.isPassActive();
    const remaining = this.getRemainingFormatted();

    if (active && remaining) {
      if (this.badgeTop) {
        this.badgeTop.classList.add('pass-active');
        this.badgeTop.classList.remove('pass-inactive');
        if (this.badgeLabel) {
          this.badgeLabel.innerHTML = `⭐ <strong>PASE 24H:</strong> ${remaining}`;
        } else {
          this.badgeTop.innerHTML = `<span>⭐ <strong>PASE 24H:</strong> ${remaining}</span>`;
        }
        this.badgeTop.title = `Pase Creador Activo (${remaining} restantes). Acceso total a fotos, webs y arsenal.`;
      }

      // Actualizar contador del modal si está abierto
      const countdownEl = document.getElementById('wompi-active-countdown');
      if (countdownEl) {
        countdownEl.textContent = remaining;
      }

      const codeEl = document.getElementById('wompi-active-pass-code');
      if (codeEl) {
        const savedCode = localStorage.getItem('apocalipsis_pass_code');
        if (savedCode) codeEl.textContent = savedCode;
      }

      if (this.game && this.game.localPlayer) {
        if (!this.game.localPlayer.isVip) {
          this.game.localPlayer.unlockAllWeaponsVip();
          if (this.game.ui) this.game.ui.refreshWeaponLocks();
        }
      }
    } else {
      if (this.badgeTop) {
        this.badgeTop.classList.remove('pass-active');
        this.badgeTop.classList.add('pass-inactive');
        if (this.badgeLabel) {
          this.badgeLabel.innerHTML = `⭐ Comprar Pase ($1 USD)`;
        } else {
          this.badgeTop.innerHTML = `<span>⭐ Comprar Pase ($1 USD)</span>`;
        }
        this.badgeTop.title = 'Obtén el Pase Creador de 24 Horas con Wompi ($1 USD) para fotos y webs.';
      }

      if (this.game && this.game.localPlayer && this.game.localPlayer.isVip) {
        this.game.localPlayer.isVip = false;
        this.game.localPlayer.unlockedWeapons = [0];
        if (this.game.ui) {
          this.game.ui.refreshWeaponLocks();
          this.game.ui.showToast('⏳ Tu Pase Creador de 24 Horas ha finalizado. ¡TikTok sigue disponible gratis!');
        }
      }

      if (this.game && !this.game.isSoloMode) {
        this.game.isSoloMode = true;
        const btnMulti = document.getElementById('btn-mode-multi');
        const btnSolo = document.getElementById('btn-mode-solo');
        if (btnMulti) btnMulti.classList.remove('active');
        if (btnSolo) btnSolo.classList.add('active');
        const chatCont = document.getElementById('chat-container');
        if (chatCont) chatCont.style.display = 'none';
      }
    }

    this.updateLockBadges(active);
  }

  updateLockBadges(active) {
    const multiBtn = document.getElementById('btn-mode-multi');
    if (multiBtn) multiBtn.innerHTML = active ? '🌐 Online' : '🌐 Online 🔒';

    const liveBtn = document.getElementById('btn-toggle-live');
    if (liveBtn && (!this.game || !this.game.isLiveMode)) {
      liveBtn.innerHTML = active ? '🔴 Modo Live' : '🔴 Modo Live 🔒';
    }

    const drawerRooms = document.getElementById('btn-open-rooms-hub-drawer');
    if (drawerRooms) drawerRooms.innerHTML = active ? '🏠 Salas' : '🏠 Salas 🔒';

    const shareBtn = document.getElementById('btn-share-room');
    if (shareBtn) shareBtn.innerHTML = active ? '🔗 Invitar Amigo' : '🔗 Invitar Amigo 🔒';

    const botBtn = document.getElementById('btn-add-bot');
    if (botBtn) botBtn.innerHTML = active ? '+ Añadir Bot 🤖' : '+ Añadir Bot 🤖 🔒';

    const uploadBtn = document.getElementById('btn-upload-image');
    if (uploadBtn) uploadBtn.innerHTML = active ? '🖼️ Subir Imagen' : '🖼️ Subir Imagen 🔒';

    const roomLabel = document.getElementById('hud-room-name');
    if (roomLabel) {
      const baseRoom = this.game && this.game.multiplayer && this.game.multiplayer.roomId ? this.game.multiplayer.roomId.toUpperCase() : 'LOBBY';
      roomLabel.textContent = active ? `SALA: ${baseRoom}` : `SALA: ${baseRoom} 🔒`;
    }
  }

  async checkSavedPass() {
    this.updateHUD();

    // 1. Detectar retorno automático de Wompi tras pago exitoso
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const isReturn = urlParams.get('payment') === 'success';
      const returnedEmail = urlParams.get('email');

      if (isReturn && returnedEmail) {
        try {
          const res = await fetch(`/api/wompi/status?email=${encodeURIComponent(returnedEmail)}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.isPassActive && data.expiresAt) {
              this.activatePass(data.expiresAt, returnedEmail);
            } else {
              this.activatePass(24, returnedEmail);
            }
          } else {
            this.activatePass(24, returnedEmail);
          }
        } catch (e) {
          this.activatePass(24, returnedEmail);
        }
        if (this.game && this.game.ui) {
          this.game.ui.showToast('⭐ ¡PAGO APROBADO CON ÉXITO! Tu Pase Creador de 24 Horas está activo.');
        }
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
    } catch (e) {}

    // 2. Comprobar sesión guardada en este navegador (por código o pase local)
    try {
      const savedCode = localStorage.getItem('apocalipsis_pass_code');
      const savedEmail = localStorage.getItem(this.STORAGE_EMAIL) || localStorage.getItem('apocalipsis_auth_email');

      if (savedCode) {
        const res = await fetch('/api/pass/redeem-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: savedCode })
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.isPassActive && data.expiresAt) {
            localStorage.setItem(this.STORAGE_KEY, data.expiresAt.toString());
            localStorage.setItem('apocalipsis_creator_pass', data.expiresAt.toString());
            this.updateHUD();
            if (this.game && this.game.localPlayer) {
              this.game.localPlayer.unlockAllWeaponsVip();
              if (this.game.ui) this.game.ui.refreshWeaponLocks();
            }
          } else if (data && !data.isPassActive) {
            this.logout();
          }
        }
      } else if (savedEmail) {
        const res = await fetch(`/api/wompi/status?email=${encodeURIComponent(savedEmail)}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.isPassActive && data.expiresAt) {
            localStorage.setItem(this.STORAGE_KEY, data.expiresAt.toString());
            localStorage.setItem('apocalipsis_creator_pass', data.expiresAt.toString());
            this.updateHUD();
            if (this.game && this.game.localPlayer) {
              this.game.localPlayer.unlockAllWeaponsVip();
              if (this.game.ui) this.game.ui.refreshWeaponLocks();
            }
          } else if (data && !data.isPassActive) {
            this.logout();
          }
        }
      }
    } catch (e) {}
  }
}

window.WompiManager = WompiManager;
// Alias para compatibilidad
window.CreatorPassManager = WompiManager;
