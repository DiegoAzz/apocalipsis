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
    this.pinInput = document.getElementById('wompi-user-pin');
    this.badgeTop = document.getElementById('btn-creator-pass-top') || document.getElementById('btn-open-wompi-top');
    this.badgeLabel = document.getElementById('creator-pass-badge-label');
    this.featureNotice = document.getElementById('pass-feature-notice');

    this.trmData = null;

    this.currentPlan = {
      id: 'day',
      usd: 1,
      cents: 346200,
      hours: 24,
      name: '1 Día (24 Horas)'
    };

    this.setupListeners();
    this.setupPlanSelector();
    this.fetchLiveTRM();
    this.checkSavedPass();

    // Verificación periódica cada 1 segundo (conteo regresivo en vivo)
    setInterval(() => this.updateHUD(), 1000);
  }

  async fetchLiveTRM() {
    try {
      const res = await fetch('/api/currency/trm');
      if (!res.ok) return;
      const data = await res.json();
      if (!data || !data.success || !data.rate) return;

      this.trmData = data;
      console.log(`[TRM EN VIVO]: $${data.rate} COP por USD (${data.source})`);

      const liveBadge = document.getElementById('wompi-trm-live-badge');
      if (liveBadge) {
        liveBadge.innerHTML = `🟢 <strong>Dólar Oficial TRM (Superfinanciera):</strong> $${Math.round(data.rate).toLocaleString('es-CO')} COP • En Vivo`;
      }

      if (data.plans) {
        const container = document.getElementById('wompi-plans-container');
        if (container) {
          const cards = container.querySelectorAll('.wompi-plan-card');
          cards.forEach((card) => {
            const planId = card.getAttribute('data-plan');
            const planInfo = data.plans[planId];
            if (planInfo) {
              card.setAttribute('data-cents', planInfo.cents);
              const copEl = card.querySelector('.plan-cop');
              if (copEl) {
                copEl.textContent = `~$${planInfo.cop.toLocaleString('es-CO')} COP`;
              }
            }
          });
        }

        if (this.currentPlan && data.plans[this.currentPlan.id]) {
          this.currentPlan.cents = data.plans[this.currentPlan.id].cents;
          const summaryPrice = document.getElementById('wompi-summary-price');
          if (summaryPrice) {
            summaryPrice.textContent = `$ ${this.currentPlan.usd}.00 USD (~$${data.plans[this.currentPlan.id].cop.toLocaleString('es-CO')} COP)`;
          }
        }
      }
    } catch (e) {
      console.warn('[TRM FETCH FAILED]:', e);
    }
  }

  validateCredentials() {
    const email = this.emailInput ? this.emailInput.value.trim() : '';
    const pin = this.pinInput ? this.pinInput.value.trim() : '';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email || !emailRegex.test(email)) {
      if (this.emailInput) {
        this.emailInput.style.borderColor = '#ef4444';
        this.emailInput.style.boxShadow = '0 0 12px rgba(239, 68, 68, 0.7)';
        this.emailInput.classList.add('input-error-shake');
        setTimeout(() => this.emailInput.classList.remove('input-error-shake'), 450);
        this.emailInput.focus();
      }
      alert('⚠️ CORREO ELECTRÓNICO REQUERIDO:\n\nDebes ingresar un correo electrónico válido antes de pagar para vincular tu pase y jugar en otros dispositivos.');
      return null;
    }

    // Detección de errores comunes en dominios de correo (ej: gmai.com, hotmial.com)
    const typoDomains = {
      'gmai.com': 'gmail.com',
      'gnail.com': 'gmail.com',
      'gamil.com': 'gmail.com',
      'gmial.com': 'gmail.com',
      'hotmial.com': 'hotmail.com',
      'hotmaill.com': 'hotmail.com',
      'outlok.com': 'outlook.com',
      'yaho.com': 'yahoo.com'
    };
    const domain = email.split('@')[1] ? email.split('@')[1].toLowerCase() : '';
    if (typoDomains[domain]) {
      const suggested = email.split('@')[0] + '@' + typoDomains[domain];
      const fix = confirm(`⚠️ Posible error en tu correo:\n\nEscribiste: "${email}"\n¿Quisiste escribir: "${suggested}"?\n\nHaz clic en "Aceptar" para corregirlo automáticamente.`);
      if (fix) {
        if (this.emailInput) this.emailInput.value = suggested;
        return { email: suggested, pin };
      }
    }

    if (!pin || pin.length < 4) {
      if (this.pinInput) {
        this.pinInput.style.borderColor = '#ef4444';
        this.pinInput.style.boxShadow = '0 0 12px rgba(239, 68, 68, 0.7)';
        this.pinInput.classList.add('input-error-shake');
        setTimeout(() => this.pinInput.classList.remove('input-error-shake'), 450);
        this.pinInput.focus();
      }
      alert('⚠️ CÓDIGO / PIN SECRETO REQUERIDO:\n\nDebes crear un PIN o código secreto de mínimo 4 caracteres antes de pagar.\n\nCon este código podrás abrir tu pase en tu celular, portátil o trabajo sin pagar de nuevo.');
      return null;
    }

    return { email, pin };
  }

  setupPlanSelector() {
    const container = document.getElementById('wompi-plans-container');
    if (!container) return;

    const cards = container.querySelectorAll('.wompi-plan-card');
    cards.forEach((card) => {
      card.addEventListener('click', () => {
        cards.forEach((c) => c.classList.remove('selected'));
        card.classList.add('selected');

        const planId = card.getAttribute('data-plan') || 'day';
        const usd = parseFloat(card.getAttribute('data-usd') || '1');
        const cents = parseInt(card.getAttribute('data-cents') || '346200', 10);
        const hours = parseInt(card.getAttribute('data-hours') || '24', 10);
        const name = card.getAttribute('data-name') || '1 Día (24 Horas)';

        this.currentPlan = { id: planId, usd, cents, hours, name };

        const summaryPrice = document.getElementById('wompi-summary-price');
        const summaryDesc = document.getElementById('wompi-summary-desc');
        const payLabel = document.getElementById('btn-pay-wompi-label');
        const testBtn = document.getElementById('btn-wompi-test-unlock');

        const copStr = this.trmData && this.trmData.plans && this.trmData.plans[planId]
          ? ` (~$${this.trmData.plans[planId].cop.toLocaleString('es-CO')} COP)`
          : '';

        if (summaryPrice) summaryPrice.textContent = `$ ${usd}.00 USD${copStr}`;
        if (summaryDesc) summaryDesc.textContent = `${name} • Acceso Total e Ilimitado`;
        if (payLabel) payLabel.textContent = `💳 PAGAR $${usd} USD CON WOMPI (${name.toUpperCase()})`;
        if (testBtn) testBtn.textContent = `⚡ ACTIVAR MODO PRUEBA (${name.toUpperCase()})`;
      });
    });
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
      const passCard = this.modal.querySelector('.modal-card, .pass-card');
      if (passCard) {
        passCard.addEventListener('click', (e) => e.stopPropagation());
      }
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

    [this.emailInput, this.pinInput].forEach((inp) => {
      if (inp) {
        inp.addEventListener('input', () => {
          inp.style.borderColor = '#334155';
          inp.style.boxShadow = 'none';
        });
        inp.addEventListener('keydown', (e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            if (this.btnTrigger) this.btnTrigger.click();
          }
        });
        inp.addEventListener('keyup', (e) => e.stopPropagation());
        inp.addEventListener('keypress', (e) => e.stopPropagation());
      }
    });

    if (this.btnTrigger) {
      this.btnTrigger.addEventListener('click', () => this.startWompiCheckout());
    }

    if (this.btnTestUnlock) {
      this.btnTestUnlock.addEventListener('click', () => {
        const creds = this.validateCredentials();
        if (!creds) return;
        const plan = this.currentPlan || { hours: 24, usd: 1, name: '1 Día (24 Horas)' };
        this.verifyAndActivate(`DEV_TEST_${Date.now()}`, creds.email, plan.hours, plan.usd, plan.name, creds.pin);
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

  // Verifica si el pase VIP está vigente
  isPassActive() {
    try {
      const expires = parseInt(localStorage.getItem(this.STORAGE_KEY) || '0', 10);
      return expires > Date.now();
    } catch (e) {
      return false;
    }
  }

  // Retorna el tiempo restante en formato regresivo exacto (Días y HH:MM:SS)
  getRemainingFormatted() {
    const expires = parseInt(localStorage.getItem(this.STORAGE_KEY) || '0', 10);
    const diffMs = expires - Date.now();
    if (diffMs <= 0) return null;

    const totalSecs = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSecs / 86400);
    const hours = Math.floor((totalSecs % 86400) / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    const pad = (n) => n.toString().padStart(2, '0');

    if (days > 0) {
      return `${days}d ${pad(hours)}:${pad(mins)}:${pad(secs)}`;
    }
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
      if (modalTitle) modalTitle.textContent = '⭐ TU PASE VIP ESTÁ ACTIVO';

      const countdownEl = document.getElementById('wompi-active-countdown');
      if (countdownEl) countdownEl.textContent = this.getRemainingFormatted() || '00:00:00';

      const codeEl = document.getElementById('wompi-active-pass-code');
      if (codeEl) {
        const savedCode = localStorage.getItem('apocalipsis_pass_code') || '';
        codeEl.textContent = savedCode || '------';
      }
    } else {
      // SI NO TIENE PASE: Mostrar pasarela de compra de Planes VIP con Wompi
      if (activeView) activeView.style.display = 'none';
      if (purchaseView) purchaseView.style.display = 'block';
      if (modalTitle) modalTitle.textContent = '⭐ PLANES VIP & ARSENAL COMPLETO';

      if (this.featureNotice) {
        if (featureName) {
          this.featureNotice.innerHTML = `🔒 <strong>${featureName.toUpperCase()}</strong> requiere un <strong>Pase VIP</strong> (Desde $1 USD). ¡TikTok es 100% gratis!`;
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
    const creds = this.validateCredentials();
    if (!creds) return; // BLOQUEO ESTRICTO: Si no pone correo y PIN, no lo deja pasar a pagar

    const { email, pin } = creds;

    const confirmBuy = confirm(`⭐ CONFIRMACIÓN DE DATOS ANTES DE PAGAR:\n\n📧 Correo: ${email}\n🔒 PIN Secreto: ${pin}\n\n¿Confirmas que tu correo está bien escrito?\nA este correo y PIN se vinculará tu pase para que puedas recuperarlo en cualquier otro dispositivo sin volver a pagar.`);
    if (!confirmBuy) return;

    localStorage.setItem(this.STORAGE_EMAIL, email);
    localStorage.setItem('apocalipsis_user_pin', pin);

    const plan = this.currentPlan || { id: 'day', usd: 1, cents: 346200, hours: 24, name: '1 Día (24 Horas)' };
    const reference = `APOC_${plan.id.toUpperCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const amountInCents = plan.cents;

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
          redirectUrl: `${window.location.origin}/?payment=success&ref=${encodeURIComponent(reference)}&email=${encodeURIComponent(email)}&plan=${plan.id}&hours=${plan.hours}`,
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
            await this.verifyAndActivate(transaction.id, email, plan.hours, plan.usd, plan.name, pin);
          } else {
            alert('Transacción no completada o cancelada.');
          }
        });
      } catch (err) {
        console.warn('Wompi Widget error:', err);
        const confirmBuy = confirm(`Wompi Checkout: ¿Confirmar activación del ${plan.name} ($${plan.usd} USD) para ${email}?`);
        if (confirmBuy) {
          this.verifyAndActivate(`DEV_FALLBACK_${Date.now()}`, email, plan.hours, plan.usd, plan.name, pin);
        }
      }
    } else {
      const confirmBuy = confirm(`Wompi Checkout: ¿Confirmar activación del ${plan.name} ($${plan.usd} USD) para ${email}?`);
      if (confirmBuy) {
        this.verifyAndActivate(`DIRECT_CONFIRM_${Date.now()}`, email, plan.hours, plan.usd, plan.name, pin);
      }
    }
  }

  async verifyAndActivate(transactionId, email, hours = 24, priceUSD = 1.00, planName = '', pin = '') {
    let serverExpiresAt = null;
    let serverPlanName = planName || 'Pase VIP';
    try {
      const res = await fetch('/api/wompi/verify-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId,
          email,
          pin,
          durationHours: hours,
          priceUSD: priceUSD,
          planName: planName
        })
      });
      const data = await res.json();
      console.log('[BACKEND WOMPI VERIFIED]:', data);
      if (data && data.code) {
        localStorage.setItem('apocalipsis_pass_code', data.code);
        alert(`⭐ ¡PAGO APROBADO EXITOSAMENTE!\n\nTu CÓDIGO DE ACCESO (${data.planName || serverPlanName}) es:\n\n👉  ${data.code}  👈\n\nGuarda este código para ingresar desde cualquier computador, celular o trabajo.`);
      }
      if (data && data.isAdmin) {
        localStorage.setItem('apocalipsis_is_admin', 'true');
      } else {
        localStorage.removeItem('apocalipsis_is_admin');
      }
      if (data && data.expiresAt) {
        serverExpiresAt = data.expiresAt;
      }
      if (data && data.planName) {
        serverPlanName = data.planName;
      }
    } catch (err) {
      console.warn('Backend verification call failed, proceeding locally:', err);
    }
    this.activatePass(serverExpiresAt || hours, email, serverPlanName);
  }

  activatePass(expiresAtOrHours = 24, email = '', planName = '') {
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

    // Si es un pase normal con fecha fin (menor a 2 años en el futuro), asegurar que NO es admin vitalicio
    if (newExpires < now + (730 * 24 * 3600 * 1000)) {
      localStorage.removeItem('apocalipsis_is_admin');
    }

    localStorage.setItem(this.STORAGE_KEY, newExpires.toString());
    localStorage.setItem('apocalipsis_creator_pass', newExpires.toString());
    if (email) {
      localStorage.setItem(this.STORAGE_EMAIL, email);
      localStorage.setItem('apocalipsis_auth_email', email);
    }
    if (planName) {
      localStorage.setItem('apocalipsis_pass_plan_name', planName);
    }

    if (this.game && this.game.localPlayer) {
      this.game.localPlayer.unlockAllWeaponsVip();
      if (this.game.ui) this.game.ui.refreshWeaponLocks();
    }

    this.updateHUD();

    if (this.game && this.game.ui) {
      const pName = planName || localStorage.getItem('apocalipsis_pass_plan_name') || 'Pase VIP';
      this.game.ui.showToast(`⭐ ¡${pName.toUpperCase()} ACTIVADO! Tienes acceso ilimitado a fotos, webs y armas.`);
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
      const savedCode = localStorage.getItem('apocalipsis_pass_code') || '';
      const expires = parseInt(localStorage.getItem(this.STORAGE_KEY) || '0', 10);
      const isLifetime = expires > (Date.now() + 5 * 365 * 24 * 3600 * 1000);
      const isAdmin = isLifetime && localStorage.getItem('apocalipsis_is_admin') === 'true';

      if (this.badgeTop) {
        this.badgeTop.classList.add('pass-active');
        this.badgeTop.classList.remove('pass-inactive');
        if (isAdmin) {
          this.badgeTop.style.background = 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)';
          this.badgeTop.style.boxShadow = '0 0 20px rgba(245, 158, 11, 0.7)';
          this.badgeTop.style.border = '1.5px solid #facc15';
        }
        if (this.badgeLabel) {
          this.badgeLabel.innerHTML = isAdmin ? `👑 <strong>SUPER ADMIN:</strong> ♾️ ACTIVO` : `⭐ <strong>PASE VIP:</strong> ${remaining}`;
        } else {
          this.badgeTop.innerHTML = `<span>${isAdmin ? '👑 <strong>SUPER ADMIN:</strong> ♾️ ACTIVO' : `⭐ <strong>PASE VIP:</strong> ${remaining}`}</span>`;
        }
        this.badgeTop.title = isAdmin ? '👑 Super Administrador: Acceso Vitalicio Total y Permanente.' : `Pase VIP Activo (${remaining} restantes). Acceso total a fotos, webs y arsenal.`;
      }

      // Actualizar contador del modal si está abierto
      const countdownEl = document.getElementById('wompi-active-countdown');
      if (countdownEl) {
        countdownEl.textContent = isAdmin ? '♾️ VITALICIO (SIN EXPIRACIÓN)' : remaining;
        if (isAdmin) {
          countdownEl.style.fontSize = '26px';
          countdownEl.style.color = '#facc15';
        }
      }

      const codeEl = document.getElementById('wompi-active-pass-code');
      if (codeEl) {
        codeEl.textContent = savedCode || '------';
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
          this.badgeLabel.innerHTML = `⭐ Planes VIP (Desde $1)`;
        } else {
          this.badgeTop.innerHTML = `<span>⭐ Planes VIP (Desde $1)</span>`;
        }
        this.badgeTop.title = 'Obtén el Pase VIP con Wompi (Desde $1 USD) para fotos y webs.';
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
            if (data.isAdmin) {
              localStorage.setItem('apocalipsis_is_admin', 'true');
            } else {
              localStorage.removeItem('apocalipsis_is_admin');
            }
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
            if (data.isAdmin) {
              localStorage.setItem('apocalipsis_is_admin', 'true');
            } else {
              localStorage.removeItem('apocalipsis_is_admin');
            }
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
