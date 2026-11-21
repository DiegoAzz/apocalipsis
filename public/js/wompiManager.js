// Wompi Payment Gateway Integration for Apocalipsis VIP Arsenal
class WompiManager {
  constructor(game) {
    this.game = game;
    // Llave pública de Wompi (Pruebas / Producción)
    this.publicKey = window.WOMPI_PUBLIC_KEY || 'pub_test_Q5yDA9xoKdePzhSGeVe9KStXTIIOxjwW';

    this.modal = document.getElementById('wompi-modal');
    this.btnClose = document.getElementById('btn-close-wompi');
    this.btnTrigger = document.getElementById('btn-pay-wompi-trigger');
    this.btnTestUnlock = document.getElementById('btn-wompi-test-unlock');

    this.setupListeners();
    this.checkSavedVip();
  }

  setupListeners() {
    // Botones de apertura en interfaz
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
        this.activateVip('test_mode');
      });
    }
  }

  checkSavedVip() {
    try {
      const isVip = localStorage.getItem('apocalipsis_vip_unlocked') === 'true';
      if (isVip && this.game.localPlayer) {
        this.game.localPlayer.unlockAllWeaponsVip();
      }
    } catch (e) {}
  }

  openModal() {
    if (this.modal) {
      this.modal.classList.add('open');
    }
  }

  closeModal() {
    if (this.modal) {
      this.modal.classList.remove('open');
    }
  }

  startWompiCheckout() {
    const reference = `APOC_VIP_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const amountInCents = 500000; // $5.000 COP

    // Comprobar si el widget oficial de Wompi está cargado
    if (typeof WidgetCheckout !== 'undefined') {
      try {
        const checkout = new WidgetCheckout({
          currency: 'COP',
          amountInCents: amountInCents,
          reference: reference,
          publicKey: this.publicKey
        });

        checkout.open((result) => {
          const transaction = result.transaction;
          console.log('[WOMPI TRANSACTION]:', transaction);
          if (transaction && (transaction.status === 'APPROVED' || transaction.status === 'PENDING')) {
            this.activateVip('wompi_gateway');
          } else {
            alert('Transacción no completada o cancelada.');
          }
        });
      } catch (err) {
        console.warn('Wompi Widget error, using fallback:', err);
        this.activateVip('fallback_prompt');
      }
    } else {
      // Fallback si no hay conexión externa inmediata a checkout.wompi.co
      const confirmBuy = confirm('Wompi Checkout: ¿Deseas activar el Pase VIP Arsenal por $5.000 COP ahora mismo?');
      if (confirmBuy) {
        this.activateVip('direct_confirm');
      }
    }
  }

  activateVip(source = 'manual') {
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

    // 3. Persistir estado VIP en el dispositivo
    try {
      localStorage.setItem('apocalipsis_vip_unlocked', 'true');
    } catch (e) {}

    // 4. Actualizar slots visuales de armas en el HUD
    if (this.game.ui) {
      this.game.ui.refreshWeaponLocks();
      this.game.ui.showToast('⭐ ¡ARSENAL VIP ACTIVADO! Las 11 armas están desbloqueadas en tu dispositivo.');
    }

    if (window.soundManager && typeof window.soundManager.playWeaponUnlocked === 'function') {
      window.soundManager.playWeaponUnlocked();
    }

    this.closeModal();
  }
}

window.WompiManager = WompiManager;
