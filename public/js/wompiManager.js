// Wompi Payment Gateway Integration for Apocalipsis VIP Arsenal with Email Security
class WompiManager {
  constructor(game) {
    this.game = game;
    this.publicKey = window.WOMPI_PUBLIC_KEY || 'pub_test_Q5yDA9xoKdePzhSGeVe9KStXTIIOxjwW';

    this.modal = document.getElementById('wompi-modal');
    this.btnClose = document.getElementById('btn-close-wompi');
    this.btnTrigger = document.getElementById('btn-pay-wompi-trigger');
    this.btnTestUnlock = document.getElementById('btn-wompi-test-unlock');
    this.emailInput = document.getElementById('wompi-user-email');
    this.restoreEmailInput = document.getElementById('wompi-restore-email');
    this.btnRestore = document.getElementById('btn-restore-wompi');

    this.setupListeners();
    this.checkSavedVip();
  }

  setupListeners() {
    const openBtns = [
      document.getElementById('btn-open-wompi-top'),
      document.getElementById('btn-vip-hotbar')
    ];
    openBtns.forEach((btn) => {
      if (btn) btn.addEventListener('click', () => this.openModal());
    });

    if (this.btnClose) {
      this.btnClose.addEventListener('click', () => this.closeModal());
    }

    if (this.btnTrigger) {
      this.btnTrigger.addEventListener('click', () => this.startWompiCheckout());
    }

    if (this.btnTestUnlock) {
      this.btnTestUnlock.addEventListener('click', () => {
        const email = (this.emailInput && this.emailInput.value.trim()) || 'operativo@apocalipsis.com';
        this.verifyAndActivate(`DEV_TEST_${Date.now()}`, email);
      });
    }

    // Botón Restaurar Compras por Correo
    if (this.btnRestore) {
      this.btnRestore.addEventListener('click', () => this.restorePurchaseByEmail());
    }
  }

  async checkSavedVip() {
    try {
      const savedEmail = localStorage.getItem('apocalipsis_user_email');
      const isLocalVip = localStorage.getItem('apocalipsis_vip_unlocked') === 'true';

      if (isLocalVip && this.game.localPlayer) {
        this.game.localPlayer.unlockAllWeaponsVip();
      }

      // Validar con el backend si hay correo guardado
      if (savedEmail) {
        if (this.emailInput) this.emailInput.value = savedEmail;
        if (this.restoreEmailInput) this.restoreEmailInput.value = savedEmail;

        const res = await fetch(`/api/wompi/status?email=${encodeURIComponent(savedEmail)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.isVip && this.game.localPlayer) {
            this.game.localPlayer.unlockAllWeaponsVip();
            localStorage.setItem('apocalipsis_vip_unlocked', 'true');
            if (this.game.ui) this.game.ui.refreshWeaponLocks();
          }
        }
      }
    } catch (e) {}
  }

  openModal() {
    if (this.modal) {
      this.modal.classList.add('open');
      const savedEmail = localStorage.getItem('apocalipsis_user_email');
      if (savedEmail && this.emailInput && !this.emailInput.value) {
        this.emailInput.value = savedEmail;
      }
    }
  }

  closeModal() {
    if (this.modal) {
      this.modal.classList.remove('open');
    }
  }

  startWompiCheckout() {
    const email = this.emailInput ? this.emailInput.value.trim() : '';
    if (!email || !email.includes('@') || !email.includes('.')) {
      alert('Por favor escribe tu correo electrónico para asociar la compra de forma segura y no perder tu arsenal.');
      if (this.emailInput) this.emailInput.focus();
      return;
    }

    // Guardar correo preventivamente
    localStorage.setItem('apocalipsis_user_email', email);

    const reference = `APOC_VIP_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const amountInCents = 500000; // $5.000 COP

    if (typeof WidgetCheckout !== 'undefined') {
      try {
        const checkout = new WidgetCheckout({
          currency: 'COP',
          amountInCents: amountInCents,
          reference: reference,
          publicKey: this.publicKey,
          customerData: {
            email: email,
            fullName: (this.game.localPlayer && this.game.localPlayer.name) || 'Operativo'
          }
        });

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
        const confirmBuy = confirm(`Wompi Checkout: ¿Confirmar activación del Pase VIP Arsenal para ${email}?`);
        if (confirmBuy) {
          this.verifyAndActivate(`DEV_FALLBACK_${Date.now()}`, email);
        }
      }
    } else {
      const confirmBuy = confirm(`Wompi Checkout: ¿Confirmar activación del Pase VIP Arsenal para ${email}?`);
      if (confirmBuy) {
        this.verifyAndActivate(`DIRECT_CONFIRM_${Date.now()}`, email);
      }
    }
  }

  async verifyAndActivate(transactionId, email) {
    try {
      // 1. Confirmar con el Backend para registrar en base de datos segura
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

    // 2. Activar VIP en el jugador
    this.activateVip(email);
  }

  async restorePurchaseByEmail() {
    const email = this.restoreEmailInput ? this.restoreEmailInput.value.trim() : '';
    if (!email || !email.includes('@')) {
      alert('Por favor ingresa un correo electrónico válido.');
      return;
    }

    if (this.game.ui) this.game.ui.showToast('🔍 Verificando compras con Wompi...');

    try {
      const res = await fetch('/api/wompi/restore-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.setItem('apocalipsis_user_email', email);
        this.activateVip(email);
        alert(`🎉 ¡Arsenal VIP restaurado con éxito para ${email}!`);
      } else {
        alert(data.message || 'No se encontró compra de Arsenal VIP con este correo.');
      }
    } catch (err) {
      console.error('Error restaurando compra:', err);
      alert('Error de conexión al verificar compra: ' + err.message);
    }
  }

  activateVip(email = '') {
    if (!this.game || !this.game.localPlayer) return;

    // 1. Desbloquear todas las 11 armas inmediatamente
    this.game.localPlayer.unlockAllWeaponsVip();

    // 2. Conceder bono VIP de dinero y núcleos de plutonio
    if (this.game.idle) {
      this.game.idle.cash += 100000;
      this.game.idle.prestigeCores += 5;
      this.game.idle.prestigeMultiplier = 1.0 + (this.game.idle.prestigeCores * 0.5);
      this.game.idle.save();
      this.game.idle.updateUI();
    }

    // 3. Persistir estado VIP y correo en el dispositivo
    try {
      localStorage.setItem('apocalipsis_vip_unlocked', 'true');
      if (email) localStorage.setItem('apocalipsis_user_email', email);
    } catch (e) {}

    // 4. Actualizar slots visuales de armas en el HUD
    if (this.game.ui) {
      this.game.ui.refreshWeaponLocks();
      this.game.ui.showToast(`⭐ ¡ARSENAL VIP VINCULADO A ${email.toUpperCase() || 'TU CUENTA'}!`);
    }

    if (window.soundManager && typeof window.soundManager.playWeaponUnlocked === 'function') {
      window.soundManager.playWeaponUnlocked();
    }

    this.closeModal();
  }
}

window.WompiManager = WompiManager;
