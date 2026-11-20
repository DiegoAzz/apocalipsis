# ⚡ Apocalipsis - Destroy Any Website Clone

Clon multijugador retro 2D pixel-art inspirado en **Destroy Any Website** de Sprite Fusion (creado por Hugo Duprez).

## 🚀 Características Principales
- **Destruye cualquier web**: Escribe cualquier URL pública (ej. `facebook.com`, `wikipedia.org`, `news.ycombinator.com`, etc.) o sube cualquier imagen propia para convertirla en un nivel 2D destructible.
- **Física de Vóxeles y Dithering**: Cráteres con matriz de Bayer de 4x4 (`ditherDisc`) para lograr los bordes dentados y retro pixelados exactos.
- **Stickman Articulado con Jetpack**: Vuela manteniendo `Espacio`, haz volteretas ninja con doble salto y rebota por las paredes.
- **10 Armas Brutales**:
  1. Pistola
  2. Subfusil SMG
  3. Escopeta de doble cañón
  4. Lanzacohetes (RPG) con cráteres masivos
  5. Railgun perforante
  6. Lanzallamas continuo
  7. Bomba de racimo en paracaídas (Too Much)
  8. La Varita Mágica (pilar de luz)
  9. PSR B0531+21 (estrella de neutrones con chorros giratorios)
  10. Granada (Clic derecho)
- **Modos de Juego**:
  - **Modo Solitario**: Destruye la web tú solo sin enemigos ni interrupciones.
  - **Modo Online**: Partidas multijugador sincronizadas mediante WebSockets en tiempo real.
  - **Bots de IA**: Añade rivales inteligentes con el botón `+ Añadir Bot 🤖`.
- **Subida de Imágenes**: Sube cualquier foto o meme para que ocupe la pantalla completa y destruirla al 100%.

## 🛠️ Tecnologías Utilizadas
- **Producción Web / Coolify**: Node.js 20 + Express + Socket.io en el backend con Dockerfile listo para despliegue en un clic.
- **Frontend**: HTML5 Canvas Offscreen de alta resolución, aceleración por hardware y Web Audio API procedural sin dependencias pesadas.
- **Motor en Rust (`rust-engine/`)**: Implementación alternativa en Rust con Tokio y Axum para procesamiento de colisiones y salas multijugador de ultra-alto rendimiento.

## 📦 Despliegue en Coolify
Este repositorio incluye un `Dockerfile` optimizado. En Coolify simplemente conecta este repositorio GitHub y se desplegará automáticamente.

```bash
# Desarrollo local:
npm install
npm start
# Abre http://localhost:3000
```
