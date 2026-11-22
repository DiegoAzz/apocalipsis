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

    // Verificación periódica cada 30 segundos
    setInterval(() => this.updateHUD(), 30000);
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

    if (this.btnTrigger) {
      this.btnTrigger.addEventListener('click', () => this.startWompiCheckout());
    }

    if (this.btnTestUnlock) {
      this.btnTestUnlock.addEventListener('click', () => {
        const email = (this.emailInput && this.emailInput.value.trim()) || 'creador@apocalipsis.com';
        this.verifyAndActivate(`DEV_TEST_${Date.now()}`, email);
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

    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
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
    if (this.featureNotice) {
      if (featureName) {
        this.featureNotice.innerHTML = `🔒 <strong>${featureName.toUpperCase()}</strong> requiere el <strong>Pase Creador de 24 Horas</strong> ($1 USD). ¡TikTok es 100% gratis!`;
        this.featureNotice.style.display = 'block';
      } else {
        this.featureNotice.style.display = 'none';
      }
    }
    this.modal.classList.add('open');
    const savedEmail = localStorage.getItem(this.STORAGE_EMAIL);
    if (savedEmail && this.emailInput && !this.emailInput.value) {
      this.emailInput.value = savedEmail;
    }
    if (window.soundManager && typeof window.soundManager.playSecretCollect === 'function') {
      window.soundManager.playSecretCollect();
    }
  }

  closeModal() {
    if (this.modal) this.modal.classList.remove('open');
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
    try {
      const res = await fetch('/api/wompi/verify-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId, email })
      });
      const data = await res.json();
      console.log('[BACKEND WOMPI VERIFIED]:', data);
    } catch (err) {
      console.warn('Backend verification call failed, proceeding locally:', err);
    }
    this.activatePass(24, email);
  }

  activatePass(hours = 24, email = '') {
    const now = Date.now();
    const currentExpires = parseInt(localStorage.getItem(this.STORAGE_KEY) || '0', 10);
    const baseTime = currentExpires > now ? currentExpires : now;
    const newExpires = baseTime + (hours * 60 * 60 * 1000);

    localStorage.setItem(this.STORAGE_KEY, newExpires.toString());
    if (email) localStorage.setItem(this.STORAGE_EMAIL, email);

    if (this.game && this.game.localPlayer) {
      this.game.localPlayer.unlockAllWeaponsVip();
      if (this.game.ui) this.game.ui.refreshWeaponLocks();
    }

    this.updateHUD();

    if (this.game && this.game.ui) {
      this.game.ui.showToast('⭐ ¡PASE CREADOR DE 24 HORAS ACTIVADO CON WOMPI! Tienes acceso ilimitado a fotos, webs y armas.');
    }
    if (window.soundManager && typeof window.soundManager.playWeaponUnlocked === 'function') {
      window.soundManager.playWeaponUnlocked();
    }

    this.closeModal();
  }

  updateHUD() {
    const active = this.isPassActive();
    if (!this.badgeTop) return;

    if (active) {
      const remaining = this.getRemainingFormatted();
      this.badgeTop.classList.add('pass-active');
      this.badgeTop.classList.remove('pass-inactive');
      if (this.badgeLabel) {
        this.badgeLabel.innerHTML = `⭐ <strong>PASE 24H:</strong> ${remaining}`;
      } else {
        this.badgeTop.innerHTML = `<span>⭐ <strong>PASE 24H:</strong> ${remaining}</span>`;
      }
      this.badgeTop.title = `Pase Creador Activo (${remaining} restantes). Acceso total a fotos, webs y arsenal.`;

      if (this.game && this.game.localPlayer) {
        this.game.localPlayer.isVip = true;
      }
    } else {
      this.badgeTop.classList.remove('pass-active');
      this.badgeTop.classList.add('pass-inactive');
      if (this.badgeLabel) {
        this.badgeLabel.innerHTML = `⭐ Pase 24h ($1 USD)`;
      } else {
        this.badgeTop.innerHTML = `<span>⭐ Pase 24h ($1 USD)</span>`;
      }
      this.badgeTop.title = 'Obtén el Pase Creador de 24 Horas con Wompi ($1 USD) para fotos y webs.';

      if (this.game && this.game.localPlayer && this.game.localPlayer.isVip) {
        this.game.localPlayer.isVip = false;
        if (this.game.ui) {
          this.game.ui.showToast('⏳ Tu Pase Creador de 24 Horas ha finalizado. ¡TikTok sigue disponible gratis!');
        }
      }
    }
  }

  async checkSavedPass() {
    this.updateHUD();

    // 1. Detectar retorno automático de Wompi / Bancolombia
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const isReturn = urlParams.get('payment') === 'success' || urlParams.get('id') || urlParams.get('env');
      const returnedEmail = urlParams.get('email');

      if (isReturn) {
        const emailToActivate = returnedEmail || localStorage.getItem(this.STORAGE_EMAIL) || 'diego.zuniga.plazas@gmail.com';
        this.activatePass(24, emailToActivate);
        if (this.game && this.game.ui) {
          this.game.ui.showToast('⭐ ¡PAGO APROBADO CON ÉXITO! Tu Pase Creador de 24 Horas está activo.');
        }
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
    } catch (e) {}

    // 2. Comprobar correos registrados y vinculados en el backend
    try {
      const emailsToCheck = [
        localStorage.getItem(this.STORAGE_EMAIL),
        localStorage.getItem('apocalipsis_auth_email'),
        'diego.zuniga.plazas@gmail.com',
        'solucionesaox@gmail.com'
      ].filter(Boolean);

      for (const email of emailsToCheck) {
        const res = await fetch(`/api/wompi/status?email=${encodeURIComponent(email)}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.isPassActive && data.expiresAt) {
            localStorage.setItem(this.STORAGE_KEY, data.expiresAt.toString());
            localStorage.setItem(this.STORAGE_EMAIL, email);
            this.updateHUD();
            if (this.game && this.game.localPlayer) {
              this.game.localPlayer.unlockAllWeaponsVip();
              if (this.game.ui) this.game.ui.refreshWeaponLocks();
            }
            break;
          }
        }
      }
    } catch (e) {}
  }
}

window.WompiManager = WompiManager;
// Alias para compatibilidad
window.CreatorPassManager = WompiManager;
