/**
 * Asistente Especializado & Buzón de Soporte - Apocalipsis VI
 * Responde exclusivamente sobre el sistema (controles, vuelo con jetpack, 11 armas,
 * pases Wompi, canje de código y PIN, subida de fotos/webs, multijugador y video).
 * Gestiona el envío de tickets directos al correo del desarrollador (diego.zuniga.plazas@gmail.com).
 */

(function () {
  'use strict';

  // Base de conocimiento exhaustiva y cerrada del sistema Apocalipsis VI
  const KNOWLEDGE_BASE = [
    {
      id: 'jetpack_flight',
      keywords: ['volar', 'vuelo', 'jetpack', 'saltar', 'salto', 'aire', 'propulsion', 'elevarse', 'caer', 'arriba'],
      title: '🚀 ¿Cómo volar con el Jetpack?',
      response: `En **Apocalipsis VI**, el Jetpack tiene **combustible infinito**:
- **En PC / Teclado:** Mantén presionada la tecla **ESPACIO**, la tecla **W** o la **Flecha Arriba (↑)**. Tu operativo activará las turbinas y podrás volar libremente por toda la pantalla. Si tocas Espacio dos veces rápido harás una voltereta acrobática.
- **En Celular / Móvil:** Mantén presionado el botón táctil derecho **🚀 SALTAR / VOLAR** o empuja el joystick virtual hacia arriba.`,
      quickActions: [
        { label: '🎮 Ver Controles de Disparo', query: '¿Cómo apunto y disparo?' },
        { label: '💣 Ver Arsenal de Armas', query: '¿Cuáles son las armas?' }
      ]
    },
    {
      id: 'controls_combat',
      keywords: ['controles', 'apuntar', 'disparar', 'disparo', 'mira', 'mouse', 'raton', 'teclas', 'granada', 'reloj', 'movimiento'],
      title: '🎯 Controles de Combate y Movimiento',
      response: `Los controles de combate son:
- **Movimiento:** Teclas **A** (izquierda) y **D** (derecha) en PC, o Joystick táctil en móvil.
- **Apuntar y Disparar:** Mueve el **ratón** para dirigir la mira roja/naranja. **Mantén presionado el Clic Izquierdo** para disparar ráfagas automáticas sin parar. En móvil, toca la pantalla o el botón de disparo.
- **Granada Devastadora:** **Clic Derecho** o tecla **G** (en móvil: botón táctil 💣 GRANADA).
- **Cambiar de Arma:** Teclas del **1 al 9 y 0**, o rueda del ratón.
- **Cámara y Pantalla:** Tecla **C** para centrar cámara en tu personaje; tecla **H** para ocultar/mostrar la interfaz; tecla **L** para activar cámara lenta cinematográfica.`,
      quickActions: [
        { label: '🚀 ¿Cómo volar con Jetpack?', query: '¿Cómo volar con el Jetpack?' },
        { label: '💣 Armas VIP', query: '¿Cuáles son las armas del juego?' }
      ]
    },
    {
      id: 'weapons_arsenal',
      keywords: ['armas', 'arsenal', 'tsar', 'bomba', 'nuke', 'nuclear', 'too much', 'wand', 'varita', 'railgun', 'cohete', 'rpg', 'lanzacohetes', 'escopeta', 'pistola', 'smg', 'lanzallamas', 'neutron', 'pulsar', 'granadas'],
      title: '💣 Arsenal y Armas del Sistema',
      response: `El arsenal consta de **11 armas tácticas con físicas 2D**:
1. **Pistola Plasma (Slot 1):** Rápida, munición ilimitada, 100% gratuita.
2. **Subfusil SMG (Slot 2):** Ráfaga veloz para demoler bloques finos.
3. **Escopeta Devastadora (Slot 3):** Abanico de perdigones cinéticos de alto impacto.
4. **Lanzacohetes RPG (Slot 4):** Cohete explosivo con gran onda expansiva.
5. **Railgun / Cañón de Riel (Slot 5):** Haz penetrante instantáneo que perfora todo.
6. **Lanzallamas (Slot 6):** Fuego destructivo continuo que funde la pantalla.
7. **Too Much (Slot 7):** Lluvia balística de múltiples misiles en racimo.
8. **Varita Mágica (Slot 8):** Ráfagas místicas teledirigidas de colores.
9. **PSR B0531+21 / Púlsar Cuántico (Slot 9):** Agujero gravitatorio que desgarra píxeles.
10. **☢️ Tsar Bomba / Nuke (Slot 0):** Detonación nuclear que sacude la pantalla y aniquila todo a su paso.
11. **Granada de Fragmentación (Tecla G / Clic Derecho):** Rebota en plataformas antes de estallar.`,
      quickActions: [
        { label: '⭐ Desbloquear Armas con Pase VIP', action: 'open_wompi' },
        { label: '🔑 Ingresar Código de Pase', action: 'open_auth' }
      ]
    },
    {
      id: 'wompi_plans',
      keywords: ['wompi', 'precio', 'precios', 'costo', 'pagar', 'pago', 'planes', 'plan', 'dolar', 'usd', 'comprar', 'nequi', 'bancolombia', 'pse', 'tarjeta', 'cuanto cuesta', 'vip', 'pase'],
      title: '⭐ Planes VIP y Pasarela Wompi',
      response: `La arena de **TikTok es 100% gratuita** con munición y vuelo ilimitado. Si deseas destruir cualquier página web del mundo, subir tus propias fotos o usar el arsenal legendario, dispones de 4 planes oficiales vía Wompi (Nequi, Bancolombia, PSE, Tarjetas):
- **1 Día (24 Horas):** $1 USD (~$3.460 COP).
- **1 Semana (7 Días):** $3 USD (~$10.380 COP) • Ahorra 57%.
- **15 Días:** $5 USD (~$17.310 COP) • Ahorra 66%.
- **1 Mes VIP (30 Días):** $10 USD (~$34.610 COP) • Mejor valor.

**Beneficios VIP:**
✅ Las 11 armas desbloqueadas (Tsar Bomba, Too Much, Railgun...)
✅ Destrucción ilimitada de cualquier URL del mundo (Wikipedia, noticias, portales)
✅ Subida de fotos, capturas y memes ilimitada
✅ Salas multijugador online para jugar con amigos en vivo
✅ Invocación de bots demoledores y modo cámara lenta para directos.`,
      quickActions: [
        { label: '💳 Ver y Pagar Planes VIP', action: 'open_wompi' },
        { label: '🔑 Canjear Código o PIN', action: 'open_auth' }
      ]
    },
    {
      id: 'code_and_pin',
      keywords: ['codigo', 'pin', '1580', 'canjear', 'donde ingreso', 'activar', 'clave', 'multidispositivo', 'celular', 'acceso'],
      title: '🔑 Códigos de Acceso y PIN Multidispositivo',
      response: `Tu compra de Pase VIP te permite jugar en **computador, celular o tablet** sin pagar doble:
1. Al pagar, se genera un **Código de 6 dígitos** (ej: 829415) y se asocia tu PIN personal (o el PIN maestro **1580**).
2. Para activarlo en cualquier dispositivo, haz clic en el botón superior **🔑 Código de Pase** (o en Opciones > Canjear / Vincular PIN).
3. Puedes ingresar cualquiera de estas opciones:
   - Tu **Código de 6 dígitos**.
   - Tu **PIN de 4 dígitos** (o 1580).
   - Tu **correo electrónico registrado**.
   - La **referencia de transacción de Wompi**.
4. Haz clic en **🚀 ACTIVAR EN ESTE NAVEGADOR** y tu pase quedará activo de inmediato.`,
      quickActions: [
        { label: '🔑 Abrir Ventana para Ingresar Código', action: 'open_auth' },
        { label: '📬 No me funciona mi código (Escribir a Soporte)', action: 'open_mailbox' }
      ]
    },
    {
      id: 'payment_issue_troubleshoot',
      keywords: ['pague y no', 'no entra', 'no entra el codigo', 'no llego', 'no salio', 'error de pago', 'rechazado', 'no me salio el codigo', 'problema', 'pague', 'pague aparte', 'invalido', 'expirado', 'wompi fallo'],
      title: '⚠️ ¿Qué hacer si pagaste y no te cargó el código?',
      response: `Si pagaste a través de Wompi pero no viste el código o cerraste la ventana:
1. **Revisa tu correo:** El sistema envía automáticamente un correo con tu **Código de 6 dígitos** y un botón directo para jugar con 1 clic. (Revisa también la carpeta de Spam / Correo No Deseado).
2. **Restaura con tu correo o PIN:** Haz clic en **🔑 Código de Pase**, pulsa "Restaurar ingresando correo electrónico" y escribe el mismo correo que usaste en Wompi.
3. **Prueba con tu PIN o 1580:** Si ingresaste un PIN al comprar, escríbelo en la casilla de código.
4. **Comunícate con Diego (Soporte Directo):** Si Wompi descontó el dinero pero no se activó, abre la pestaña **📬 Buzón de Soporte** de esta misma ventana, indícanos tu correo y referencia de pago. Diego recibirá la notificación directa en su correo y te activará el pase de inmediato.`,
      quickActions: [
        { label: '🔄 Restaurar Pase con Correo', action: 'open_auth' },
        { label: '📬 Abrir Buzón para enviar comprobante a Diego', action: 'open_mailbox' }
      ]
    },
    {
      id: 'upload_images_and_memes',
      keywords: ['subir', 'foto', 'fotos', 'imagen', 'imagenes', 'meme', 'memes', 'personalizada', 'captura', 'png', 'jpg'],
      title: '🖼️ ¿Cómo subir Fotos y Memes para destruirlos?',
      response: `Puedes colocar cualquier fotografía, meme o captura en pantalla completa para desintegrarla:
1. Abre el menú lateral de **Opciones (⚙️)** o haz clic en el bloque inferior derecho del póster inicial **🖼️ SUBIR FOTO**.
2. Pulsa en **🖼️ Subir Imagen**.
3. Selecciona cualquier archivo de tu dispositivo (.PNG, .JPG o .WEBP).
4. El motor convertirá la imagen en un escenario de batalla 2D interactivo con gravedad y colisiones por píxel.
*(Nota: Requiere Pase VIP de Wompi)*.`,
      quickActions: [
        { label: '⭐ Obtener Pase VIP para Subir Fotos', action: 'open_wompi' }
      ]
    },
    {
      id: 'destroy_any_url',
      keywords: ['url', 'pagina', 'paginas', 'web', 'sitio', 'sitios', 'destruir url', 'wikipedia', 'google', 'youtube', 'enlace', 'link'],
      title: '🌐 ¿Cómo destruir cualquier Página Web?',
      response: `Para destruir una página web:
1. En la barra superior, escribe o pega la dirección URL (por ejemplo: \`wikipedia.org\`, \`bbc.com\`, \`google.com\`).
2. Pulsa el botón **⚡ DESTRUIR** o presiona Enter.
3. El sistema preparará el terreno físico en un conteo de 3 segundos y creará la arena de combate interactiva con los textos e imágenes del sitio.
- **TikTok** es 100% gratis ilimitado.
- Otras páginas web públicas requieren Pase VIP de Wompi. No se requieren contraseñas de las páginas.`,
      quickActions: [
        { label: '⭐ Desbloquear Cualquier URL con Pase', action: 'open_wompi' }
      ]
    },
    {
      id: 'video_recording',
      keywords: ['grabar', 'video', 'grabacion', 'rec', 'tiktok', 'shorts', 'reels', 'youtube', 'clip', 'peso', 'pesado', 'descargar'],
      title: '🎬 Grabación de Vídeo para Shorts / TikTok / Reels',
      response: `El juego cuenta con un grabador nativo ultra optimizado:
- **Iniciar/Detener Grabación:** Pulsa el botón flotante **🔴 REC (TikTok/Reels)** o presiona la tecla **R** en tu teclado.
- **Formato Optimizado:** Graba clips nítidos a 60 FPS (en PC) y optimizados a 30 FPS / 2.5 Mbps en móviles para que los videos pesen menos de 10 MB y se puedan compartir al instante en TikTok, Instagram Reels o YouTube Shorts sin ralentizar tu dispositivo.
- Al terminar, se abrirá automáticamente la ventana de vista previa para descargar el archivo .webm / .mp4 o compartirlo directamente.`,
      quickActions: [
        { label: '❓ ¿Cómo Jugar?', query: '¿Cómo se juega y cuáles son los controles?' }
      ]
    },
    {
      id: 'multiplayer_rooms',
      keywords: ['multijugador', 'online', 'amigos', 'sala', 'salas', 'invitar', 'whatsapp', 'jugar juntos', 'amigo', 'lobby'],
      title: '👥 Modo Multijugador y Salas Online',
      response: `Puedes destruir la misma página web o foto en tiempo real con tus amigos:
1. Abre el menú **Salas Online (🏠)** en la esquina superior o en el menú de opciones.
2. Verás el nombre de tu sala actual (por defecto: \`LOBBY\`) y el enlace directo para invitar.
3. Pulsa **📋 Copiar Enlace** o **💬 Invitar por WhatsApp** para enviárselo a tu amigo.
4. Cuando tu amigo haga clic, entrará a la misma arena, verá tus disparos, tus explosiones y podrán competir por el puntaje más alto de destrucción en la tabla de bajas (Scoreboard con tecla TAB).`,
      quickActions: [
        { label: '⭐ Activar Multijugador VIP', action: 'open_wompi' }
      ]
    },
    {
      id: 'idle_and_prestige',
      keywords: ['idle', 'dinero', 'tienda', 'mejoras', 'prestigio', 'plutonio', 'nucleos', 'boost', 'ganancias', 'automático'],
      title: '💰 Economía Idle y Prestigio Atómico',
      response: `Mientras destruyes cualquier página ganas dinero de forma pasiva:
- **Tienda de Mejoras (🛒 MEJORAS):** Aumenta el valor por píxel destruido, la velocidad de perforación y las torretas automáticas.
- **Boost 2X (⚡ BOOST):** Duplica tus ingresos temporalmente.
- **Prestigio Atómico:** Cuando destruyas más del 45% del sitio actual, puedes pulsar Prestigio para reiniciar la arena a cambio de **Núcleos de Plutonio permanentes** que multiplican todo tu daño e ingresos futuros.`,
      quickActions: [
        { label: '🚀 ¿Cómo volar?', query: '¿Cómo volar con el Jetpack?' }
      ]
    },
    {
      id: 'human_support',
      keywords: ['soporte', 'humano', 'diego', 'correo', 'contacto', 'ayuda', 'administrador', 'desarrollador', 'telefono', 'whatsapp soporte', 'buzon'],
      title: '📬 Contacto y Soporte con Diego',
      response: `¡Estamos para ayudarte!
- Puedes escribirnos directamente a través de la pestaña **📬 Buzón de Soporte** de esta ventana. Tu reporte llegará de inmediato al correo del desarrollador (**diego.zuniga.plazas@gmail.com**) y te responderemos a tu correo en menos de 24 horas.
- También puedes escribir directamente a **diego.zuniga.plazas@gmail.com** o **soporte@appzplay.online**.
- Si tu consulta es sobre un pago de Wompi, incluye el número de referencia o captura de tu comprobante.`,
      quickActions: [
        { label: '📬 Abrir Formulario de Buzón Ahora', action: 'open_mailbox' },
        { label: '🔑 Restaurar Código o PIN', action: 'open_auth' }
      ]
    }
  ];

  // Respuesta predeterminada para consultas fuera de contexto
  const OUT_OF_SCOPE_RESPONSE = `🤖 **Soy el Asistente Especializado de Apocalipsis VI.**
Mi conocimiento está enfocado y restringido exclusivamente al funcionamiento del videojuego:
- 🚀 **Controles y Vuelo con Jetpack**
- 💣 **Arsenal y Armas Tácticas (Tsar Bomba, Cohetes, Railgun...)**
- ⭐ **Pases VIP Wompi ($1 USD, $3, $5, $10) y Medios de Pago**
- 🔑 **Canje de Códigos de Acceso, PINs multidispositivo y Restauración**
- 🖼️ **Destrucción de cualquier Página Web o Subida de Fotos**
- 👥 **Salas Multijugador Online y Grabación para TikTok/Shorts**
- 📬 **Buzón de Mensajes directo al correo de soporte técnico**

Si tienes alguna pregunta sobre el juego o necesitas asistencia con tu pase, con gusto te ayudo. ¿En qué puedo orientarte?`;

  class SupportAssistantManager {
    constructor() {
      this.modal = null;
      this.chatMessagesContainer = null;
      this.chatInput = null;
      this.activeTab = 'chat'; // 'chat' | 'mailbox'
      this.isSubmittingTicket = false;
      this.history = [];

      this.init();
    }

    init() {
      // Inyectar HTML del modal si no existe en el DOM
      this.injectModalHtml();
      this.bindTriggers();
      this.bindEvents();

      // Mensaje de bienvenida inicial
      this.addMessage('bot', `¡Hola, Operativo! 🤖 Soy el **Asistente Oficial de Apocalipsis VI**.
Estoy especializado para responder todas tus dudas sobre el juego: controles, jetpack, armas, planes de Wompi, activación de códigos multidispositivo o para enviarle un reporte directo a Diego a través de nuestro buzón.

Selecciona una opción rápida o escribe tu consulta abajo:`, [
        { label: '🚀 ¿Cómo volar con Jetpack?', query: '¿Cómo volar con el Jetpack?' },
        { label: '🔑 ¿Cómo activo mi código o PIN?', query: '¿Dónde ingreso mi código de acceso o PIN?' },
        { label: '⚠️ Pagué y no me abrió el juego', query: 'Pagué por Wompi y no me cargó el código o no entra' },
        { label: '💣 Ver 11 Armas VIP', query: '¿Cuáles son las armas del juego?' },
        { label: '⭐ Precios de Planes Wompi', query: '¿Cuáles son los precios de los planes VIP?' },
        { label: '📬 Enviar Mensaje a Soporte (Buzón)', action: 'open_mailbox' }
      ]);
    }

    injectModalHtml() {
      if (document.getElementById('assistant-modal')) return;

      const modalHtml = `
      <div id="assistant-modal" class="custom-modal assistant-modal-root" style="display:none;">
        <div class="modal-card assistant-card">
          <!-- CABECERA -->
          <div class="modal-head assistant-head">
            <div class="assistant-head-brand">
              <span class="assistant-avatar">🤖</span>
              <div>
                <h2 style="margin:0; font-size:17px; color:#f8fafc; font-weight:800; display:flex; align-items:center; gap:6px;">
                  ASISTENTE APOCALIPSIS VI
                  <span class="badge-online-dot">● EN VIVO</span>
                </h2>
                <span style="font-size:11px; color:#94a3b8;">Experto del juego & Buzón directo a diego.zuniga.plazas@gmail.com</span>
              </div>
            </div>
            <button class="close-btn" id="btn-close-assistant" title="Cerrar Asistente">✕</button>
          </div>

          <!-- SELECTOR DE PESTAÑAS -->
          <div class="assistant-tabs-bar">
            <button class="assistant-tab-btn active" id="tab-btn-assistant-chat">
              <span>💬 Asistente Virtual</span>
            </button>
            <button class="assistant-tab-btn" id="tab-btn-assistant-mailbox">
              <span>📬 Buzón de Soporte (Enviar Correo)</span>
            </button>
          </div>

          <!-- CONTENIDO: PESTAÑA 1 - CHAT ASISTENTE -->
          <div class="assistant-tab-panel" id="assistant-panel-chat">
            <!-- Contenedor del Historial de Conversación -->
            <div class="assistant-chat-stream" id="assistant-chat-stream"></div>

            <!-- Chips de Acceso Rápido -->
            <div class="assistant-chips-scroll" id="assistant-quick-chips">
              <button class="assistant-chip" data-query="¿Cómo volar con el Jetpack?">🚀 Volar Jetpack</button>
              <button class="assistant-chip" data-query="¿Dónde ingreso mi código o PIN 1580?">🔑 Ingresar Código/PIN</button>
              <button class="assistant-chip" data-query="Pagué en Wompi y no me cargó el código">⚠️ Problema de Pago</button>
              <button class="assistant-chip" data-query="¿Cuáles son las 11 armas?">💣 Lista de Armas</button>
              <button class="assistant-chip" data-query="¿Cómo subir fotos o memes?">🖼️ Subir Fotos</button>
              <button class="assistant-chip" data-action="open_mailbox">📬 Escribir a Diego</button>
            </div>

            <!-- Barra de Entrada de Texto -->
            <form id="assistant-chat-form" class="assistant-input-row" onsubmit="return false;">
              <input type="text" id="assistant-chat-input" placeholder="Pregunta sobre controles, jetpack, armas, pagos Wompi..." maxlength="200" autocomplete="off">
              <button type="submit" id="btn-send-assistant-msg" class="btn btn-primary" title="Enviar consulta">
                <span>➤</span>
              </button>
            </form>
          </div>

          <!-- CONTENIDO: PESTAÑA 2 - BUZÓN DE MENSAJES (SOPORTE AL CORREO) -->
          <div class="assistant-tab-panel" id="assistant-panel-mailbox" style="display:none;">
            <div class="mailbox-info-box">
              <div class="mailbox-icon">📧</div>
              <div>
                <strong style="color:#f8fafc; font-size:13px;">Buzón Oficial de Soporte y Notificaciones</strong>
                <p style="margin:2px 0 0 0; font-size:11px; color:#94a3b8; line-height:1.4;">
                  ¿Tienes un inconveniente con tu pago de Wompi, no te llegó tu código o encontraste un fallo? Tu mensaje se enviará directamente al correo de Diego Zúñiga (<strong>diego.zuniga.plazas@gmail.com</strong>).
                </p>
              </div>
            </div>

            <form id="mailbox-form" class="mailbox-form" onsubmit="return false;">
              <div class="mailbox-form-group">
                <label for="mailbox-email">📧 Tu Correo Electrónico (Para responderte): <span style="color:#ef4444;">*</span></label>
                <input type="email" id="mailbox-email" required placeholder="tu@correo.com" class="mailbox-input">
              </div>

              <div class="mailbox-form-row">
                <div class="mailbox-form-group" style="flex:1;">
                  <label for="mailbox-name">👤 Tu Nombre o Nick:</label>
                  <input type="text" id="mailbox-name" placeholder="Ej: Operativo 7" class="mailbox-input">
                </div>
                <div class="mailbox-form-group" style="flex:1;">
                  <label for="mailbox-category">🏷️ Tipo de Asunto: <span style="color:#ef4444;">*</span></label>
                  <select id="mailbox-category" class="mailbox-input mailbox-select">
                    <option value="Pago Wompi / Código no recibido">💳 Problema Pago Wompi (No recibí código)</option>
                    <option value="Error al Canjear Código o PIN">🔑 Error al ingresar Código o PIN</option>
                    <option value="Bug o Error en el Juego">🐛 Bug o Fallo en el Juego</option>
                    <option value="Duda sobre Armas o Jugabilidad">❓ Pregunta sobre el Juego</option>
                    <option value="Sugerencia o Propuesta">💡 Sugerencia de Mejora</option>
                    <option value="Otro">📝 Otro Asunto</option>
                  </select>
                </div>
              </div>

              <div class="mailbox-form-group">
                <label for="mailbox-ref">🔑 Código de Pase o Referencia Wompi (Si la tienes):</label>
                <input type="text" id="mailbox-ref" placeholder="Ej: 1580, código de 6 dígitos o ref. Nequi/Bancolombia" class="mailbox-input">
              </div>

              <div class="mailbox-form-group">
                <label for="mailbox-message">📝 Detalle de tu Mensaje o Inconveniente: <span style="color:#ef4444;">*</span></label>
                <textarea id="mailbox-message" required rows="4" placeholder="Explica detalladamente qué sucedió. Si realizaste un pago, dinos la hora aproximada y el correo utilizado..." class="mailbox-input mailbox-textarea"></textarea>
              </div>

              <div id="mailbox-status-msg" style="display:none; margin:10px 0; padding:10px; border-radius:8px; font-size:12px;"></div>

              <button type="submit" id="btn-submit-mailbox" class="btn btn-primary btn-block mailbox-submit-btn">
                <span id="mailbox-btn-spinner" style="display:none;">⏳ Enviando...</span>
                <span id="mailbox-btn-text">📨 ENVIAR MENSAJE DIRECTO AL CORREO</span>
              </button>
            </form>
          </div>
        </div>
      </div>
      `;

      document.body.insertAdjacentHTML('beforeend', modalHtml);
      this.modal = document.getElementById('assistant-modal');
      this.chatMessagesContainer = document.getElementById('assistant-chat-stream');
      this.chatInput = document.getElementById('assistant-chat-input');
    }

    bindTriggers() {
      // 1. Botón en Floating Pills Top (Desktop)
      const pillsContainer = document.querySelector('.floating-pills-top');
      if (pillsContainer && !document.getElementById('btn-open-assistant')) {
        const btnPill = document.createElement('button');
        btnPill.className = 'pill-btn pill-assistant';
        btnPill.id = 'btn-open-assistant';
        btnPill.title = 'Asistente Especializado & Buzón de Soporte';
        btnPill.innerHTML = `<span>🤖 <strong id="assistant-btn-label">Soporte & Ayuda</strong></span>`;
        btnPill.addEventListener('click', () => this.open('chat'));
        pillsContainer.appendChild(btnPill);
      }

      // 2. Botón en Nav Drawer (Opciones) bajo Ajustes y Ayuda
      const drawerCatHelp = document.querySelector('#nav-drawer .drawer-category:last-child .drawer-btn-grid');
      if (drawerCatHelp && !document.getElementById('btn-open-assistant-drawer')) {
        const btnDrawer = document.createElement('button');
        btnDrawer.className = 'btn btn-drawer-item btn-assistant';
        btnDrawer.id = 'btn-open-assistant-drawer';
        btnDrawer.title = 'Asistente Virtual y Buzón de Contacto';
        btnDrawer.innerHTML = `<span>🤖 Asistente & Buzón</span>`;
        btnDrawer.addEventListener('click', () => {
          // Cerrar el drawer primero
          const navDrawer = document.getElementById('nav-drawer');
          const backdrop = document.getElementById('nav-drawer-backdrop');
          if (navDrawer) navDrawer.classList.remove('open');
          if (backdrop) backdrop.classList.remove('open');
          this.open('chat');
        });
        drawerCatHelp.insertBefore(btnDrawer, drawerCatHelp.firstChild);
      }

      // 3. Botón flotante móvil adicional junto al chat
      const mobileChatBtn = document.getElementById('btn-mobile-chat-toggle');
      if (mobileChatBtn && !document.getElementById('btn-mobile-assistant-toggle')) {
        const mobileBtn = document.createElement('button');
        mobileBtn.id = 'btn-mobile-assistant-toggle';
        mobileBtn.className = 'btn-mobile-chat-toggle btn-mobile-assistant';
        mobileBtn.title = 'Abrir Asistente y Soporte';
        mobileBtn.style.left = 'auto';
        mobileBtn.style.right = '14px';
        mobileBtn.innerHTML = `<span>🤖 Ayuda</span>`;
        mobileBtn.addEventListener('click', () => this.open('chat'));
        document.body.appendChild(mobileBtn);
      }
    }

    bindEvents() {
      // Cerrar modal
      const closeBtn = document.getElementById('btn-close-assistant');
      if (closeBtn) closeBtn.addEventListener('click', () => this.close());

      // Pestañas
      const tabChat = document.getElementById('tab-btn-assistant-chat');
      const tabMail = document.getElementById('tab-btn-assistant-mailbox');
      if (tabChat) tabChat.addEventListener('click', () => this.switchTab('chat'));
      if (tabMail) tabMail.addEventListener('click', () => this.switchTab('mailbox'));

      // Envío de chat
      const chatForm = document.getElementById('assistant-chat-form');
      if (chatForm) {
        chatForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleChatSubmit();
        });
      }

      // Clics en Chips de Preguntas Rápidas
      const chipsContainer = document.getElementById('assistant-quick-chips');
      if (chipsContainer) {
        chipsContainer.addEventListener('click', (e) => {
          const btn = e.target.closest('button');
          if (!btn) return;
          const query = btn.getAttribute('data-query');
          const action = btn.getAttribute('data-action');
          if (query) {
            this.processUserQuery(query);
          } else if (action === 'open_mailbox') {
            this.switchTab('mailbox');
          }
        });
      }

      // Envío de Formulario de Buzón
      const mailboxForm = document.getElementById('mailbox-form');
      if (mailboxForm) {
        mailboxForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleMailboxSubmit();
        });
      }

      // Cerrar con Escape
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.modal && this.modal.classList.contains('open')) {
          this.close();
        }
      });
    }

    open(tab = 'chat') {
      if (!this.modal) this.modal = document.getElementById('assistant-modal');
      if (!this.modal) return;

      this.switchTab(tab);
      this.modal.classList.add('open');
      this.modal.style.display = 'flex';

      // Prellenar email si está guardado o en Wompi
      this.prefillUserData();

      // Enfocar input si es chat
      if (tab === 'chat' && this.chatInput) {
        setTimeout(() => this.chatInput.focus(), 150);
      }
    }

    close() {
      if (!this.modal) return;
      this.modal.classList.remove('open');
      this.modal.style.display = 'none';
    }

    switchTab(tab) {
      this.activeTab = tab;
      const tabChat = document.getElementById('tab-btn-assistant-chat');
      const tabMail = document.getElementById('tab-btn-assistant-mailbox');
      const panelChat = document.getElementById('assistant-panel-chat');
      const panelMail = document.getElementById('assistant-panel-mailbox');

      if (tab === 'chat') {
        if (tabChat) tabChat.classList.add('active');
        if (tabMail) tabMail.classList.remove('active');
        if (panelChat) panelChat.style.display = 'flex';
        if (panelMail) panelMail.style.display = 'none';
        this.scrollChatToBottom();
      } else {
        if (tabChat) tabChat.classList.remove('active');
        if (tabMail) tabMail.classList.add('active');
        if (panelChat) panelChat.style.display = 'none';
        if (panelMail) panelMail.style.display = 'block';
      }
    }

    prefillUserData() {
      try {
        const storedEmail = localStorage.getItem('apocalipsis_user_email') ||
                            localStorage.getItem('wompi_last_email') ||
                            localStorage.getItem('apocalipsis_support_email') || '';
        const emailInput = document.getElementById('mailbox-email');
        if (emailInput && !emailInput.value && storedEmail) {
          emailInput.value = storedEmail;
        }

        const nameInput = document.getElementById('mailbox-name');
        const playerNameInput = document.getElementById('player-name-input');
        if (nameInput && !nameInput.value && playerNameInput && playerNameInput.value) {
          nameInput.value = playerNameInput.value;
        }

        const refInput = document.getElementById('mailbox-ref');
        const activePassCode = localStorage.getItem('wompi_creator_pass_code') || '';
        if (refInput && !refInput.value && activePassCode) {
          refInput.value = activePassCode;
        }
      } catch (e) {
        // Ignorar fallos de localStorage
      }
    }

    handleChatSubmit() {
      if (!this.chatInput) return;
      const text = this.chatInput.value.trim();
      if (!text) return;
      this.chatInput.value = '';
      this.processUserQuery(text);
    }

    processUserQuery(query) {
      // 1. Mostrar mensaje del usuario
      this.addMessage('user', query);

      // 2. Simular tiempo de pensamiento breve y responder
      setTimeout(() => {
        const match = this.findBestMatch(query);
        if (match) {
          this.addMessage('bot', match.response, match.quickActions);
        } else {
          this.addMessage('bot', OUT_OF_SCOPE_RESPONSE, [
            { label: '🚀 ¿Cómo volar con Jetpack?', query: '¿Cómo volar con el Jetpack?' },
            { label: '🔑 ¿Dónde ingreso mi código o PIN?', query: '¿Dónde ingreso mi código de acceso o PIN?' },
            { label: '⭐ Precios de Planes VIP', query: '¿Cuáles son los precios de los planes VIP?' },
            { label: '📬 Escribir a Diego (Buzón)', action: 'open_mailbox' }
          ]);
        }
      }, 250);
    }

    findBestMatch(query) {
      const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      let bestItem = null;
      let highestScore = 0;

      for (const item of KNOWLEDGE_BASE) {
        let score = 0;
        for (const kw of item.keywords) {
          const normKw = kw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          if (q.includes(normKw)) {
            // Palabras completas o coincidencias exactas ponderan más
            score += normKw.length > 5 ? 3 : 2;
          }
        }
        if (score > highestScore && score >= 2) {
          highestScore = score;
          bestItem = item;
        }
      }

      return bestItem;
    }

    addMessage(sender, text, quickActions = []) {
      if (!this.chatMessagesContainer) return;

      const msgEl = document.createElement('div');
      msgEl.className = `assistant-msg ${sender === 'user' ? 'assistant-msg-user' : 'assistant-msg-bot'}`;

      // Formatear markdown básico (*, **, links)
      let formatted = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');

      let html = `
        <div class="msg-bubble">
          ${sender === 'bot' ? '<div class="bot-badge-tag">🤖 ASISTENTE APOCALIPSIS</div>' : ''}
          <div class="msg-text">${formatted}</div>
      `;

      if (quickActions && quickActions.length > 0) {
        html += `<div class="msg-actions-row">`;
        quickActions.forEach((act, idx) => {
          html += `<button type="button" class="btn-msg-action" data-act-idx="${idx}">${act.label}</button>`;
        });
        html += `</div>`;
      }

      html += `</div>`;
      msgEl.innerHTML = html;

      // Eventos para botones de acción dentro del mensaje
      if (quickActions && quickActions.length > 0) {
        const actionBtns = msgEl.querySelectorAll('.btn-msg-action');
        actionBtns.forEach((btn, idx) => {
          const act = quickActions[idx];
          btn.addEventListener('click', () => {
            if (act.query) {
              this.processUserQuery(act.query);
            } else if (act.action === 'open_mailbox') {
              this.switchTab('mailbox');
            } else if (act.action === 'open_wompi') {
              this.close();
              const wompiModal = document.getElementById('wompi-modal');
              if (wompiModal) {
                wompiModal.classList.add('open');
                wompiModal.style.display = 'flex';
              }
            } else if (act.action === 'open_auth') {
              this.close();
              const authModal = document.getElementById('auth-code-modal');
              if (authModal) {
                authModal.classList.add('open');
                authModal.style.display = 'flex';
              }
            }
          });
        });
      }

      this.chatMessagesContainer.appendChild(msgEl);
      this.scrollChatToBottom();
    }

    scrollChatToBottom() {
      if (this.chatMessagesContainer) {
        setTimeout(() => {
          this.chatMessagesContainer.scrollTop = this.chatMessagesContainer.scrollHeight;
        }, 50);
      }
    }

    async handleMailboxSubmit() {
      if (this.isSubmittingTicket) return;

      const emailEl = document.getElementById('mailbox-email');
      const nameEl = document.getElementById('mailbox-name');
      const catEl = document.getElementById('mailbox-category');
      const refEl = document.getElementById('mailbox-ref');
      const msgEl = document.getElementById('mailbox-message');
      const statusBox = document.getElementById('mailbox-status-msg');
      const btnSubmit = document.getElementById('btn-submit-mailbox');
      const spinner = document.getElementById('mailbox-btn-spinner');
      const btnText = document.getElementById('mailbox-btn-text');

      const email = emailEl ? emailEl.value.trim() : '';
      const name = nameEl ? nameEl.value.trim() : '';
      const category = catEl ? catEl.value : 'General';
      const codeOrRef = refEl ? refEl.value.trim() : '';
      const message = msgEl ? msgEl.value.trim() : '';

      if (!email || !email.includes('@')) {
        this.showMailboxStatus('error', '⚠️ Por favor ingresa un correo electrónico válido para poder responderte.');
        return;
      }
      if (!message || message.length < 5) {
        this.showMailboxStatus('error', '⚠️ Por favor detalla tu mensaje (mínimo 5 caracteres).');
        return;
      }

      try {
        localStorage.setItem('apocalipsis_support_email', email);
      } catch (e) {}

      this.isSubmittingTicket = true;
      if (btnSubmit) btnSubmit.disabled = true;
      if (spinner) spinner.style.display = 'inline';
      if (btnText) btnText.style.display = 'none';
      this.showMailboxStatus('info', '⏳ Enviando reporte al correo de soporte técnico...');

      try {
        const response = await fetch('/api/support/ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            name,
            category,
            codeOrRef,
            message
          })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          const mailtoSubject = encodeURIComponent(`[Apocalipsis Soporte] Ticket #${data.ticketId}: ${category}`);
          const mailtoBody = encodeURIComponent(`Hola Diego,\n\nEnvié el ticket #${data.ticketId} desde el juego con los siguientes datos:\n- Correo: ${email}\n- Asunto: ${category}\n- Referencia/Código: ${codeOrRef || 'N/A'}\n- Mensaje: ${message}\n\nQuedo atento a tu respuesta.`);
          const directMailto = `mailto:diego.zuniga.plazas@gmail.com?subject=${mailtoSubject}&body=${mailtoBody}`;

          this.showMailboxStatus('success', `
            <div style="font-size:14px; font-weight:bold; color:#4ade80; margin-bottom:4px;">
              🎉 ¡Ticket Registrado con Éxito en el Servidor!
            </div>
            <div>Ticket ID: <strong style="color:#facc15; font-family:monospace;">${data.ticketId}</strong></div>
            <div style="margin-top:6px; color:#cbd5e1; font-size:12px; line-height:1.5;">
              Tu reporte quedó guardado en el servidor para el desarrollador Diego Zúñiga (<strong>diego.zuniga.plazas@gmail.com</strong>).
            </div>
            <div style="margin-top:10px; padding-top:8px; border-top:1px dashed rgba(255,255,255,0.15); text-align:center;">
              <a href="${directMailto}" target="_blank" style="display:inline-block; background:#0284c7; color:#ffffff; font-weight:bold; padding:8px 14px; border-radius:8px; text-decoration:none; font-size:12px;">
                ✉️ Enviar copia directa a Diego desde tu correo
              </a>
            </div>
          `);

          // Limpiar mensaje
          if (msgEl) msgEl.value = '';

          // También agregar confirmación en el chat por si vuelve
          this.addMessage('bot', `📬 **Ticket de Soporte Registrado:**
Tu mensaje sobre *"${category}"* fue enviado exitosamente al correo de Diego con el ID **${data.ticketId}**.
Te responderemos a **${email}** a la mayor brevedad.`);
        } else {
          this.showMailboxStatus('error', `❌ ${data.error || 'No se pudo enviar el ticket. Intenta de nuevo.'}`);
        }
      } catch (err) {
        this.showMailboxStatus('error', `❌ Error de conexión al enviar el ticket: ${err.message}`);
      } finally {
        this.isSubmittingTicket = false;
        if (btnSubmit) btnSubmit.disabled = false;
        if (spinner) spinner.style.display = 'none';
        if (btnText) btnText.style.display = 'inline';
      }
    }

    showMailboxStatus(type, html) {
      const box = document.getElementById('mailbox-status-msg');
      if (!box) return;
      box.style.display = 'block';
      if (type === 'error') {
        box.style.background = 'rgba(239, 68, 68, 0.15)';
        box.style.border = '1px solid #ef4444';
        box.style.color = '#fca5a5';
      } else if (type === 'success') {
        box.style.background = 'rgba(34, 197, 94, 0.15)';
        box.style.border = '1px solid #22c55e';
        box.style.color = '#86efac';
      } else {
        box.style.background = 'rgba(56, 189, 248, 0.15)';
        box.style.border = '1px solid #38bdf8';
        box.style.color = '#bae6fd';
      }
      box.innerHTML = html;
    }
  }

  // Inicializar globalmente cuando cargue el DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.supportAssistant = new SupportAssistantManager();
    });
  } else {
    window.supportAssistant = new SupportAssistantManager();
  }
})();
