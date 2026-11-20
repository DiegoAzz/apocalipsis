// Level Generator and Destructible Terrain Engine
class LevelEngine {
  constructor(width = 1500, height = 2600, cellSize = 5) {
    this.width = width;
    this.height = height;
    this.cellSize = cellSize;
    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);

    // Visual offscreen canvas where webpage is drawn and craters carved
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

    // Grid tracking solid cells: 1 = solid, 0 = air
    this.grid = new Uint8Array(this.cols * this.rows);
    this.initialSolidCount = 0;
    this.destroyedCount = 0;
    this.presetName = 'wikipedia';
    this.pageUrl = 'https://en.wikipedia.org/wiki/Stick_figure';
  }

  resize(width, height) {
    this.width = Math.round(width);
    this.height = Math.round(height);
    this.cols = Math.ceil(this.width / this.cellSize);
    this.rows = Math.ceil(this.height / this.cellSize);
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.grid = new Uint8Array(this.cols * this.rows);
    this.initialSolidCount = 0;
    this.destroyedCount = 0;
  }

  isSolid(worldX, worldY) {
    if (worldX < 0 || worldX >= this.width || worldY < 0 || worldY >= this.height) {
      return false;
    }
    const col = Math.floor(worldX / this.cellSize);
    const row = Math.floor(worldY / this.cellSize);
    return this.grid[row * this.cols + col] === 1;
  }

  setSolid(col, row, solid) {
    if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
      this.grid[row * this.cols + col] = solid ? 1 : 0;
    }
  }

  getDestructionPercentage() {
    if (this.initialSolidCount === 0) return 0;
    const pct = (this.destroyedCount / this.initialSolidCount) * 100;
    return Math.min(100, Math.max(0, pct));
  }

  // Carve circular crater into terrain with Sprite Fusion Bayer pixel dithering
  carveHole(x, y, radius, weapon = 'bullet') {
    const debris = [];
    const minCol = Math.max(0, Math.floor((x - radius) / this.cellSize));
    const maxCol = Math.min(this.cols - 1, Math.ceil((x + radius) / this.cellSize));
    const minRow = Math.max(0, Math.floor((y - radius) / this.cellSize));
    const maxRow = Math.min(this.rows - 1, Math.ceil((y + radius) / this.cellSize));

    const rInner = radius * 0.78;
    const rInner2 = rInner * rInner;
    const rOuter2 = radius * radius;
    let newlyDestroyed = 0;

    // 4x4 Bayer Dithering Matrix matching Sprite Fusion's ditherDisc
    const bayer = [
      0/16, 8/16, 2/16, 10/16,
      12/16, 4/16, 14/16, 6/16,
      3/16, 11/16, 1/16, 9/16,
      15/16, 7/16, 13/16, 5/16
    ];

    // Sample a few pixels for flying debris chunks
    const sampleCount = Math.min(25, Math.floor(radius / 2));
    for (let i = 0; i < sampleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * (radius * 0.85);
      const sx = Math.floor(x + Math.cos(angle) * dist);
      const sy = Math.floor(y + Math.sin(angle) * dist);
      if (sx >= 0 && sx < this.width && sy >= 0 && sy < this.height && this.isSolid(sx, sy)) {
        const p = this.ctx.getImageData(sx, sy, 1, 1).data;
        if (p[3] > 30) {
          debris.push({
            x: sx,
            y: sy,
            vx: (Math.cos(angle) * (1.5 + Math.random() * 4)),
            vy: (Math.sin(angle) * (1.5 + Math.random() * 4) - 2),
            color: `rgb(${p[0]},${p[1]},${p[2]})`,
            size: 2 + Math.random() * 3
          });
        }
      }
    }

    // Carve out visuals on canvas with dithered jagged pixel chunks
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'destination-out';
    this.ctx.beginPath();
    this.ctx.arc(x, y, rInner, 0, Math.PI * 2);
    this.ctx.fill();

    // Dithered outer rim
    for (let r = minRow; r <= maxRow; r++) {
      const cy = (r + 0.5) * this.cellSize;
      const dy = cy - y;
      const dy2 = dy * dy;

      for (let c = minCol; c <= maxCol; c++) {
        const cx = (c + 0.5) * this.cellSize;
        const dx = cx - x;
        const d2 = dx * dx + dy2;

        if (d2 <= rOuter2 && d2 > rInner2) {
          const d = Math.sqrt(d2);
          const ratio = (d - rInner) / (radius - rInner);
          const threshold = bayer[(r & 3) * 4 + (c & 3)];
          if (ratio < threshold) {
            this.ctx.fillRect(c * this.cellSize, r * this.cellSize, this.cellSize, this.cellSize);
            const idx = r * this.cols + c;
            if (this.grid[idx] === 1) {
              this.grid[idx] = 0;
              newlyDestroyed++;
            }
          }
        }
      }
    }
    this.ctx.restore();

    // Update collision grid for inner hole
    for (let r = minRow; r <= maxRow; r++) {
      const cy = (r + 0.5) * this.cellSize;
      const dy = cy - y;
      const dy2 = dy * dy;
      if (dy2 > rInner2) continue;

      for (let c = minCol; c <= maxCol; c++) {
        const cx = (c + 0.5) * this.cellSize;
        const dx = cx - x;
        if (dx * dx + dy2 <= rInner2) {
          const idx = r * this.cols + c;
          if (this.grid[idx] === 1) {
            this.grid[idx] = 0;
            newlyDestroyed++;
          }
        }
      }
    }

    this.destroyedCount += newlyDestroyed;
    return debris;
  }

  // Carve trench line (for Railgun)
  carveLine(x1, y1, x2, y2, thickness = 16) {
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'destination-out';
    this.ctx.lineWidth = thickness;
    this.ctx.lineCap = 'round';
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
    this.ctx.restore();

    // Carve along line points in collision grid
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.ceil(dist / (thickness * 0.4));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = x1 + (x2 - x1) * t;
      const py = y1 + (y2 - y1) * t;
      this.carveHole(px, py, thickness / 2, 'railgun');
    }
  }

  // Build grid from rendered canvas alpha
  syncGridFromCanvas() {
    this.grid.fill(0);
    this.initialSolidCount = 0;
    this.destroyedCount = 0;

    const imgData = this.ctx.getImageData(0, 0, this.width, this.height);
    const data = imgData.data;

    for (let r = 0; r < this.rows; r++) {
      const py = Math.min(this.height - 1, Math.floor((r + 0.5) * this.cellSize));
      const rowOffset = py * this.width * 4;

      for (let c = 0; c < this.cols; c++) {
        const px = Math.min(this.width - 1, Math.floor((c + 0.5) * this.cellSize));
        const alpha = data[rowOffset + px * 4 + 3];
        if (alpha > 40) {
          this.grid[r * this.cols + c] = 1;
          this.initialSolidCount++;
        }
      }
    }
  }

  // Generate Wikipedia Stick Figure Level (Exact Match to screenshot)
  generateWikipedia() {
    if (this.width !== 1500 || this.height !== 2600) this.resize(1500, 2600);
    this.presetName = 'wikipedia';
    this.pageUrl = 'https://en.wikipedia.org/wiki/Stick_figure';
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(80, 40, this.width - 160, this.height - 80);

    // Border around page body
    ctx.strokeStyle = '#c8ccd1';
    ctx.lineWidth = 1;
    ctx.strokeRect(80, 40, this.width - 160, this.height - 80);

    // Top Navigation Bar
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(80, 40, this.width - 160, 50);
    ctx.strokeStyle = '#a2a9b1';
    ctx.strokeRect(80, 40, this.width - 160, 50);

    // Wikipedia Logo icon & Header text
    ctx.fillStyle = '#202122';
    ctx.font = 'bold 20px Georgia, serif';
    ctx.fillText('WIKIPEDIA', 110, 72);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#54595d';
    ctx.fillText('The Free Encyclopedia', 110, 85);

    // Search input bar
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(this.width - 480, 52, 240, 26);
    ctx.strokeStyle = '#72777d';
    ctx.strokeRect(this.width - 480, 52, 240, 26);
    ctx.fillStyle = '#72777d';
    ctx.fillText('Search Wikipedia', this.width - 465, 70);

    // User links
    ctx.fillStyle = '#3366cc';
    ctx.fillText('Create account   Log in', this.width - 220, 70);

    // Sub-header tabs
    const startY = 110;
    ctx.fillStyle = '#202122';
    ctx.font = '14px sans-serif';
    ctx.fillText('Article', 110, startY);
    ctx.fillText('Talk', 170, startY);
    ctx.fillStyle = '#3366cc';
    ctx.fillText('Read', this.width - 320, startY);
    ctx.fillText('Edit', this.width - 270, startY);
    ctx.fillText('View history', this.width - 230, startY);

    // Underline
    ctx.strokeStyle = '#a2a9b1';
    ctx.beginPath();
    ctx.moveTo(110, startY + 8);
    ctx.lineTo(this.width - 110, startY + 8);
    ctx.stroke();

    // Main Article Title
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 36px Georgia, serif';
    ctx.fillText('Stick figure', 110, 165);

    // Subtitle
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#54595d';
    ctx.fillText('From Wikipedia, the free encyclopedia', 110, 185);

    // Disambiguation line
    ctx.font = 'italic 13px Georgia, serif';
    ctx.fillStyle = '#202122';
    ctx.fillText('This article is about the graphic. For the American reggae group, see Stick Figure.', 110, 210);

    // Maintenance Banner (Orange / Yellow alert box)
    ctx.fillStyle = '#fef6e7';
    ctx.fillRect(110, 230, 800, 75);
    ctx.strokeStyle = '#a2a9b1';
    ctx.lineWidth = 1;
    ctx.strokeRect(110, 230, 800, 75);
    // Orange left bar
    ctx.fillStyle = '#e69f00';
    ctx.fillRect(110, 230, 6, 75);

    // Banner Book icon
    ctx.fillStyle = '#996633';
    ctx.fillRect(130, 250, 20, 24);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(133, 253, 14, 18);

    // Banner Text
    ctx.fillStyle = '#202122';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('This article needs more citations. Please help improve this article by', 165, 255);
    ctx.font = '12px sans-serif';
    ctx.fillText('adding citations to reliable sources. Unsourced material may be challenged and removed.', 165, 272);
    ctx.fillStyle = '#3366cc';
    ctx.fillText('Find sources: "Stick figure" – news · newspapers · books · scholar · JSTOR (March 2014)', 165, 290);

    // Left Navigation / Contents Box
    const tocX = 110;
    const tocY = 325;
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(tocX, tocY, 210, 280);
    ctx.strokeStyle = '#a2a9b1';
    ctx.strokeRect(tocX, tocY, 210, 280);

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('Contents', tocX + 15, tocY + 28);
    ctx.fillStyle = '#3366cc';
    ctx.font = '12px sans-serif';
    ctx.fillText('[hide]', tocX + 160, tocY + 28);

    const tocItems = [
      '(Top)',
      '1 History',
      '2 Internet culture',
      '    2.1 "Xiao Xiao"',
      '    2.2 Animator vs. Animation',
      '    2.3 Pivot Animator',
      '3 In film',
      '4 Other notable events',
      '5 Unicode',
      '6 See also',
      '7 References'
    ];
    tocItems.forEach((item, idx) => {
      ctx.fillStyle = item.includes('Top') ? '#000000' : '#3366cc';
      ctx.fillText(item, tocX + 15, tocY + 55 + idx * 20);
    });

    // Right Side: Stick Figure Infobox (Matching Screenshot!)
    const infoX = this.width - 440;
    const infoY = 220;
    const infoW = 320;
    const infoH = 500;
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(infoX, infoY, infoW, infoH);
    ctx.strokeStyle = '#a2a9b1';
    ctx.strokeRect(infoX, infoY, infoW, infoH);

    // Infobox Header
    ctx.fillStyle = '#202122';
    ctx.font = 'bold 15px Georgia, serif';
    ctx.fillText('Stick figure', infoX + 110, infoY + 30);

    // Infobox Image Box
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(infoX + 20, infoY + 50, infoW - 40, 260);
    ctx.strokeStyle = '#c8ccd1';
    ctx.strokeRect(infoX + 20, infoY + 50, infoW - 40, 260);

    // DRAW THE CLASSIC STICK FIGURE!
    const figCenterX = infoX + infoW / 2;
    const figCenterY = infoY + 115;

    ctx.strokeStyle = '#101010';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';

    // Head circle
    ctx.beginPath();
    ctx.arc(figCenterX, figCenterY, 26, 0, Math.PI * 2);
    ctx.stroke();

    // Torso spine
    ctx.beginPath();
    ctx.moveTo(figCenterX, figCenterY + 26);
    ctx.lineTo(figCenterX, figCenterY + 110);
    ctx.stroke();

    // Arms
    ctx.beginPath();
    ctx.moveTo(figCenterX - 45, figCenterY + 80);
    ctx.lineTo(figCenterX, figCenterY + 55);
    ctx.lineTo(figCenterX + 45, figCenterY + 80);
    ctx.stroke();

    // Legs
    ctx.beginPath();
    ctx.moveTo(figCenterX - 45, figCenterY + 175);
    ctx.lineTo(figCenterX, figCenterY + 110);
    ctx.lineTo(figCenterX + 45, figCenterY + 175);
    ctx.stroke();

    // Infobox Caption
    ctx.fillStyle = '#202122';
    ctx.font = '12px sans-serif';
    ctx.fillText('Basic stick figure, with an unfilled', infoX + 25, infoY + 330);
    ctx.fillText('circle for the head and lines for the', infoX + 25, infoY + 348);
    ctx.fillText('torso, arms, and legs.', infoX + 25, infoY + 366);

    // Top Right Appearance Box (Matching Screenshot)
    const appX = this.width - 440;
    const appY = 740;
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(appX, appY, infoW, 200);
    ctx.strokeStyle = '#a2a9b1';
    ctx.strokeRect(appX, appY, infoW, 200);
    ctx.fillStyle = '#202122';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('Appearance [hide]', appX + 15, appY + 25);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#54595d';
    ctx.fillText('Text:  ○ Small   ● Standard   ○ Large', appX + 15, appY + 55);
    ctx.fillText('Width: ● Standard   ○ Wide', appX + 15, appY + 85);
    ctx.fillText('Color: ● Automatic  ○ Light   ○ Dark', appX + 15, appY + 115);

    // Main Article Text Paragraphs (between Table of contents and infobox)
    const bodyX = 350;
    let textY = 330;
    const maxTextW = 600;

    const paragraphs = [
      'A stick figure (also known as a stick man, stick woman, or stick person) is a very simple drawing of a human or other animal, in which the limbs (arms and legs) and torso are represented using straight lines. The head is most often represented by a circle, which can be filled or unfilled.',
      'Details such as hands, feet, and a neck may be present or absent, and the head is sometimes embellished with details such as facial features or hair. Simpler stick figures often display disproportionate physical features and ambiguous emotion.',
      'The stick figure is a widely recognizable symbol. Drawings of stick figures are recognized across many languages, locations and demographics, and the stick figure roots can be traced back to over 30,000 years ago. Stick figures are often drawn by children, and their simplicity and versatility have led to their use in infographics, signage, animations, storyboards, and other kinds of visual media.',
      'Following the advent of the World Wide Web, the stick figure saw widespread use in early online flash games and viral web animations, including iconic series such as Xiao Xiao, Animator vs. Animation, and stick figure fighting engines.'
    ];

    ctx.fillStyle = '#202122';
    ctx.font = '15px/1.6 "Liberation Serif", serif';

    paragraphs.forEach((pText) => {
      textY = this.renderWrappedText(ctx, pText, bodyX, textY, maxTextW, 22) + 20;
    });

    // History Section
    textY += 15;
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 22px Georgia, serif';
    ctx.fillText('History', 110, textY);
    ctx.strokeStyle = '#a2a9b1';
    ctx.beginPath();
    ctx.moveTo(110, textY + 8);
    ctx.lineTo(this.width - 110, textY + 8);
    ctx.stroke();

    textY += 35;
    const historyText1 = 'The stick figure earliest precedents are in prehistoric art. Tens of thousands of years later, pictograms that use simplified human forms began to be used for writing systems such as Egyptian hieroglyphs, Sumerian cuneiform, and Chinese characters.';
    const historyText2 = 'In 1920, the sociologist Otto Neurath and illustrator Gerd Arntz developed the Isotype (International System of Typographic Picture Education) pictorial language, which relied on standardized stick and silhouette figures to communicate social and economic facts visually.';
    const historyText3 = 'The modern commercial stick figure emerged in the 1970s through international transportation symbols designed by AIGA and the United States Department of Transportation, creating the universally recognized pedestrian and restroom icons.';

    textY = this.renderWrappedText(ctx, historyText1, 110, textY, this.width - 220, 22) + 20;
    textY = this.renderWrappedText(ctx, historyText2, 110, textY, this.width - 220, 22) + 20;
    textY = this.renderWrappedText(ctx, historyText3, 110, textY, this.width - 220, 22) + 30;

    // Internet Culture Section
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 22px Georgia, serif';
    ctx.fillText('Internet culture and video games', 110, textY);
    ctx.strokeStyle = '#a2a9b1';
    ctx.beginPath();
    ctx.moveTo(110, textY + 8);
    ctx.lineTo(this.width - 110, textY + 8);
    ctx.stroke();

    textY += 35;
    const netText = 'Stick figures became a mainstay of Adobe Flash animation in the early 2000s due to their low computational overhead and ease of animation. In 2001, Beijing animator Zhu Zhiqiang created Xiao Xiao, a series of high-octane martial arts kung-fu stick animations that swept the internet.';
    textY = this.renderWrappedText(ctx, netText, 110, textY, this.width - 220, 22) + 25;

    // Feature Cards for Internet Culture
    const cardY = textY;
    const cardW = 380;
    const cardH = 180;

    // Card 1
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(110, cardY, cardW, cardH);
    ctx.strokeStyle = '#a2a9b1';
    ctx.strokeRect(110, cardY, cardW, cardH);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('Xiao Xiao series (2001)', 130, cardY + 30);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#54595d';
    this.renderWrappedText(ctx, 'Pioneered dynamic stick martial arts fighting animations with sound effects and bullet-time slow motion sequences.', 130, cardY + 55, cardW - 40, 18);

    // Card 2
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(520, cardY, cardW, cardH);
    ctx.strokeStyle = '#a2a9b1';
    ctx.strokeRect(520, cardY, cardW, cardH);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('Animator vs. Animation (2006)', 540, cardY + 30);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#54595d';
    this.renderWrappedText(ctx, 'Alan Becker viral sensation featuring a stick figure fighting back against its creator inside Adobe Flash and desktop icons.', 540, cardY + 55, cardW - 40, 18);

    // Card 3
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(930, cardY, cardW, cardH);
    ctx.strokeStyle = '#a2a9b1';
    ctx.strokeRect(930, cardY, cardW, cardH);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('Destroy Any Website (2026)', 950, cardY + 30);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#54595d';
    this.renderWrappedText(ctx, 'Indie multiplayer sandbox game where players grab jetpacks and heavy weapons to shred entire web pages into dust.', 950, cardY + 55, cardW - 40, 18);

    // Footer
    ctx.fillStyle = '#e9ecef';
    ctx.fillRect(80, this.height - 120, this.width - 160, 60);
    ctx.strokeStyle = '#c8ccd1';
    ctx.strokeRect(80, this.height - 120, this.width - 160, 60);
    ctx.fillStyle = '#72777d';
    ctx.font = '12px sans-serif';
    ctx.fillText('This page was last edited on 20 November 2026, at 11:42 (UTC). Text is available under the Creative Commons Attribution-ShareAlike License.', 100, this.height - 85);

    // Sync collision grid
    this.syncGridFromCanvas();
  }

  // Generate Google Search Results Level
  generateGoogle(query = 'how to destroy any website') {
    if (this.width !== 1500 || this.height !== 2600) this.resize(1500, 2600);
    this.presetName = 'google';
    this.pageUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(80, 40, this.width - 160, this.height - 80);
    ctx.strokeStyle = '#dfe1e5';
    ctx.strokeRect(80, 40, this.width - 160, this.height - 80);

    // Google Header
    ctx.font = 'bold 36px Arial, sans-serif';
    const letters = [
      { l: 'G', c: '#4285f4' },
      { l: 'o', c: '#ea4335' },
      { l: 'o', c: '#fbbc05' },
      { l: 'g', c: '#4285f4' },
      { l: 'l', c: '#34a853' },
      { l: 'e', c: '#ea4335' }
    ];
    let lx = 120;
    letters.forEach(item => {
      ctx.fillStyle = item.c;
      ctx.fillText(item.l, lx, 95);
      lx += ctx.measureText(item.l).width + 2;
    });

    // Search bar input box
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(270, 65, 650, 44);
    ctx.strokeStyle = '#dfe1e5';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(270, 65, 650, 44);
    ctx.fillStyle = '#202124';
    ctx.font = '16px Arial, sans-serif';
    ctx.fillText(query, 300, 93);

    // Search stats
    ctx.fillStyle = '#70757a';
    ctx.font = '13px Arial, sans-serif';
    ctx.fillText('About 842,000,000 results (0.38 seconds)', 120, 150);

    // Featured Answer Card / Knowledge box
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(120, 175, 780, 220);
    ctx.strokeStyle = '#dadce0';
    ctx.strokeRect(120, 175, 780, 220);
    ctx.fillStyle = '#202124';
    ctx.font = 'bold 20px Arial, sans-serif';
    ctx.fillText('Featured snippet from the web', 150, 215);
    ctx.font = '15px/1.5 Arial, sans-serif';
    this.renderWrappedText(ctx, 'To destroy any website, type its URL into Sprite Fusion "Destroy Any Website", equip your rocket launcher, shotgun or railgun, fire away, and watch the HTML structure blast into thousands of flying pixel-art physics particles!', 150, 250, 720, 24);

    // Knowledge Graph Sidebar
    const sideX = this.width - 500;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(sideX, 175, 380, 620);
    ctx.strokeStyle = '#dadce0';
    ctx.strokeRect(sideX, 175, 380, 620);
    ctx.fillStyle = '#202124';
    ctx.font = 'bold 22px Arial, sans-serif';
    ctx.fillText('Sprite Fusion', sideX + 25, 220);
    ctx.font = '14px Arial, sans-serif';
    ctx.fillStyle = '#70757a';
    ctx.fillText('Video game and 2D pixel editor platform', sideX + 25, 245);

    // Sidebar divider
    ctx.strokeStyle = '#dadce0';
    ctx.beginPath();
    ctx.moveTo(sideX + 25, 265);
    ctx.lineTo(sideX + 355, 265);
    ctx.stroke();

    ctx.fillStyle = '#3c4043';
    this.renderWrappedText(ctx, 'Sprite Fusion is an innovative, browser-based 2D level design tool created by Hugo Duprez. It features the viral game "Destroy Any Website" where pages are parsed into destructible platformer levels.', sideX + 25, 295, 330, 22);

    // Results List
    let resY = 430;
    const results = [
      {
        site: 'https://destroy.spritefusion.com',
        title: 'Destroy Any Website - Play free in your browser',
        desc: 'Type any website address and fight your way through it: its text, images and boxes become a destructible pixel-art level. Play solo or with friends online.'
      },
      {
        site: 'https://www.spritefusion.com/games',
        title: 'Curated Games published by Sprite Fusion',
        desc: 'Play featured indie titles made with Sprite Fusion. Action, Shooter, Sandbox, and Multiplayer real-time games directly in modern web browsers.'
      },
      {
        site: 'https://en.wikipedia.org/wiki/Stick_figure',
        title: 'Stick figure - Wikipedia',
        desc: 'A stick figure is a very simple drawing of a human or animal, in which the limbs and torso are represented by straight lines, popularized in Flash animations.'
      },
      {
        site: 'https://news.ycombinator.com',
        title: 'Show HN: Destroy Any Website in real-time multiplayer',
        desc: 'Discussion on Hacker News: architecture of destructible canvas voxel carving, web audio sound synthesizers, and WebSocket room multiplayer synchronization.'
      }
    ];

    results.forEach((res) => {
      ctx.fillStyle = '#202124';
      ctx.font = '12px Arial, sans-serif';
      ctx.fillText(res.site, 120, resY);
      ctx.fillStyle = '#1a0dab';
      ctx.font = '20px Arial, sans-serif';
      ctx.fillText(res.title, 120, resY + 26);
      ctx.fillStyle = '#4d5156';
      ctx.font = '14px/1.5 Arial, sans-serif';
      resY = this.renderWrappedText(ctx, res.desc, 120, resY + 52, 780, 20) + 40;
    });

    this.syncGridFromCanvas();
  }

  // Load ANY User-Uploaded Image to occupy the level and be destroyed seamlessly
  async loadImageAsLevel(imageSource) {
    this.presetName = 'image';
    this.pageUrl = 'Imagen Personalizada';

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // Adapt arena dimensions dynamically to match the mobile screen or desktop!
        const isMobileScreen = (typeof window !== 'undefined') && (window.innerWidth <= 900 || ('ontouchstart' in window));
        let targetW, targetH;

        if (isMobileScreen) {
          // On mobile: take the exact aspect ratio and dimensions of the mobile phone!
          const screenAspect = (window.innerHeight && window.innerWidth) ? (window.innerHeight / window.innerWidth) : 2.0;
          targetW = 800; // Crisp base width
          targetH = Math.round(targetW * Math.max(1.5, Math.min(2.4, screenAspect)));
        } else {
          // Desktop / PC
          const aspect = img.height / img.width;
          if (aspect >= 1.35) {
            targetW = Math.min(800, Math.max(500, img.width));
            targetH = Math.round(targetW * aspect);
            if (targetH > 2400) {
              targetH = 2400;
              targetW = Math.round(targetH / aspect);
            }
          } else {
            targetW = Math.min(1350, Math.max(800, img.width));
            targetH = Math.round(targetW * aspect);
            if (targetH > 2400) {
              targetH = 2400;
              targetW = Math.round(targetH / aspect);
            }
          }
        }

        this.resize(targetW, targetH);

        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        // Draw image covering 100% of the mobile screen without distortion
        const imgRatio = img.width / img.height;
        const canvasRatio = this.width / this.height;
        let sWidth, sHeight, sx, sy;

        if (imgRatio > canvasRatio) {
          sHeight = img.height;
          sWidth = img.height * canvasRatio;
          sx = (img.width - sWidth) / 2;
          sy = 0;
        } else {
          sWidth = img.width;
          sHeight = img.width / canvasRatio;
          sx = 0;
          sy = (img.height - sHeight) / 2;
        }

        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, this.width, this.height);

        // Sync solid collision grid so every pixel of the uploaded image is destructible!
        this.syncGridFromCanvas();
        resolve();
      };
      img.onerror = (err) => {
        console.error('Error loading image level:', err);
        resolve();
      };
      img.src = imageSource;
    });
  }

  // Authentic Real Facebook Page (Matches the iconic Facebook desktop login & landing)
  generateFacebook() {
    if (this.width !== 1500 || this.height !== 2600) this.resize(1500, 2600);
    this.presetName = 'facebook';
    this.pageUrl = 'https://www.facebook.com/';
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Facebook Light Gray Background
    ctx.fillStyle = '#f0f2f5';
    ctx.fillRect(80, 40, this.width - 160, this.height - 80);
    ctx.strokeStyle = '#ccd0d5';
    ctx.lineWidth = 1;
    ctx.strokeRect(80, 40, this.width - 160, this.height - 80);

    // Left Column: Facebook Branding & Tagline
    const leftX = 160;
    const leftY = 220;

    // Iconic Blue Logo
    ctx.fillStyle = '#1877f2';
    ctx.font = 'bold 64px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('facebook', leftX, leftY);

    // Tagline in dark slate
    ctx.fillStyle = '#1c1e21';
    ctx.font = '24px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    this.renderWrappedText(ctx, 'Facebook te ayuda a comunicarte y compartir con las personas que forman parte de tu vida.', leftX, leftY + 50, 480, 34);

    // Recent Logins / Friends preview cards
    ctx.fillStyle = '#65676b';
    ctx.font = '14px sans-serif';
    ctx.fillText('Inicios de sesión recientes', leftX, leftY + 180);

    for (let i = 0; i < 2; i++) {
      const rx = leftX + i * 160;
      const ry = leftY + 205;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(rx, ry, 140, 160);
      ctx.strokeStyle = '#dddfe2';
      ctx.strokeRect(rx, ry, 140, 160);

      // Avatar circle
      ctx.fillStyle = i === 0 ? '#1877f2' : '#e4e6eb';
      ctx.beginPath();
      ctx.arc(rx + 70, ry + 60, 35, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = i === 0 ? '#ffffff' : '#65676b';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(i === 0 ? 'F' : '+', rx + 70, ry + 67);
      ctx.textAlign = 'left';

      ctx.fillStyle = '#1c1e21';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(i === 0 ? 'Usuario' : 'Añadir cuenta', rx + 15, ry + 135);
    }

    // Right Column: Iconic White Login Card
    const cardX = this.width - 560;
    const cardY = 160;
    const cardW = 420;
    const cardH = 380;

    // Card drop shadow & background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cardX, cardY, cardW, cardH);
    ctx.strokeStyle = '#dddfe2';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cardX, cardY, cardW, cardH);

    // Email Input Box
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cardX + 25, cardY + 30, cardW - 50, 52);
    ctx.strokeStyle = '#ccd0d5';
    ctx.lineWidth = 1;
    ctx.strokeRect(cardX + 25, cardY + 30, cardW - 50, 52);
    ctx.fillStyle = '#8d949e';
    ctx.font = '15px sans-serif';
    ctx.fillText('Correo electrónico o número de teléfono', cardX + 40, cardY + 62);

    // Password Input Box
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cardX + 25, cardY + 95, cardW - 50, 52);
    ctx.strokeStyle = '#ccd0d5';
    ctx.strokeRect(cardX + 25, cardY + 95, cardW - 50, 52);
    ctx.fillStyle = '#8d949e';
    ctx.fillText('Contraseña', cardX + 40, cardY + 127);

    // Big Blue "Iniciar sesión" Button
    ctx.fillStyle = '#1877f2';
    ctx.fillRect(cardX + 25, cardY + 160, cardW - 50, 50);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Iniciar sesión', cardX + cardW / 2, cardY + 192);

    // "¿Olvidaste tu contraseña?" Link
    ctx.fillStyle = '#1877f2';
    ctx.font = '14px sans-serif';
    ctx.fillText('¿Olvidaste tu contraseña?', cardX + cardW / 2, cardY + 236);

    // Divider Line
    ctx.strokeStyle = '#dadde1';
    ctx.beginPath();
    ctx.moveTo(cardX + 25, cardY + 258);
    ctx.lineTo(cardX + cardW - 25, cardY + 258);
    ctx.stroke();

    // Green "Crear cuenta nueva" Button
    ctx.fillStyle = '#42b72a';
    ctx.fillRect(cardX + 70, cardY + 280, cardW - 140, 50);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('Crear cuenta nueva', cardX + cardW / 2, cardY + 312);
    ctx.textAlign = 'left';

    // Subtitle below card
    ctx.fillStyle = '#1c1e21';
    ctx.font = '13px sans-serif';
    ctx.fillText('Crea una página para un famoso, una marca o un negocio.', cardX + 20, cardY + cardH + 30);

    // Language Footer
    const footY = this.height - 180;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(80, footY, this.width - 160, 120);
    ctx.strokeStyle = '#ccd0d5';
    ctx.strokeRect(80, footY, this.width - 160, 120);

    ctx.fillStyle = '#8a8d91';
    ctx.font = '12px sans-serif';
    ctx.fillText('Español    English (US)    Français (France)    Português (Brasil)    Italiano    Deutsch    العربية    हिन्दी    中文(简体)    日本語', 120, footY + 35);

    ctx.strokeStyle = '#dddfe2';
    ctx.beginPath();
    ctx.moveTo(120, footY + 52);
    ctx.lineTo(this.width - 120, footY + 52);
    ctx.stroke();

    ctx.fillText('Registrarte   Iniciar sesión   Messenger   Facebook Lite   Video   Lugares   Juegos   Marketplace   Meta Pay   Meta Store   Meta Quest   Instagram', 120, footY + 75);
    ctx.fillText('Meta © 2026 · Destructible Canvas Edition', 120, footY + 100);

    this.syncGridFromCanvas();
  }

  // Authentic Real Amazon Page (Matches the iconic Amazon desktop store layout)
  generateAmazon() {
    if (this.width !== 1500 || this.height !== 2600) this.resize(1500, 2600);
    this.presetName = 'amazon';
    this.pageUrl = 'https://www.amazon.com/';
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Amazon light-gray background
    ctx.fillStyle = '#eaeded';
    ctx.fillRect(80, 40, this.width - 160, this.height - 80);
    ctx.strokeStyle = '#d5d9d9';
    ctx.lineWidth = 1;
    ctx.strokeRect(80, 40, this.width - 160, this.height - 80);

    // 1. Primary Amazon Header (#131921)
    const navY = 40;
    const navH = 72;
    ctx.fillStyle = '#131921';
    ctx.fillRect(80, navY, this.width - 160, navH);

    // Amazon Logo with iconic smile arrow
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('amazon', 120, navY + 44);
    ctx.fillStyle = '#ff9900';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('.com', 230, navY + 44);

    // Smile arrow curve
    ctx.strokeStyle = '#ff9900';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(175, navY + 46, 36, 0.25 * Math.PI, 0.75 * Math.PI);
    ctx.stroke();
    // Smile arrowhead
    ctx.beginPath();
    ctx.moveTo(202, navY + 68);
    ctx.lineTo(210, navY + 65);
    ctx.lineTo(206, navY + 74);
    ctx.fillStyle = '#ff9900';
    ctx.fill();

    // Deliver to Location
    ctx.fillStyle = '#cccccc';
    ctx.font = '11px sans-serif';
    ctx.fillText('Enviar a', 285, navY + 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('📍 Colombia / Destino', 285, navY + 48);

    // Search Bar
    const searchX = 460;
    const searchW = this.width - 920;
    const searchH = 42;
    const searchY = navY + 15;

    // "Todos" dropdown
    ctx.fillStyle = '#f3f3f3';
    ctx.fillRect(searchX, searchY, 65, searchH);
    ctx.fillStyle = '#333333';
    ctx.font = '12px sans-serif';
    ctx.fillText('Todos ▾', searchX + 10, searchY + 26);

    // Input box
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(searchX + 65, searchY, searchW - 120, searchH);
    ctx.fillStyle = '#757575';
    ctx.font = '14px sans-serif';
    ctx.fillText('Buscar en Amazon (ej: Laptops, Videojuegos, Ofertas)...', searchX + 80, searchY + 26);

    // Orange Magnifying Glass Button (#febd69)
    ctx.fillStyle = '#febd69';
    ctx.fillRect(searchX + searchW - 55, searchY, 55, searchH);
    ctx.fillStyle = '#111111';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('🔍', searchX + searchW - 38, searchY + 27);

    // Right Nav Items
    const rightX = searchX + searchW + 25;
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px sans-serif';
    ctx.fillText('Hola, Identifícate', rightX, navY + 30);
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('Cuenta y Listas ▾', rightX, navY + 48);

    ctx.font = '12px sans-serif';
    ctx.fillText('Devoluciones', rightX + 130, navY + 30);
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('& Pedidos', rightX + 130, navY + 48);

    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('🛒 0', rightX + 225, navY + 44);

    // 2. Sub-Navigation Bar (#232f3e)
    const subNavY = navY + navH;
    const subNavH = 40;
    ctx.fillStyle = '#232f3e';
    ctx.fillRect(80, subNavY, this.width - 160, subNavH);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('☰ Todo    Ofertas del Día    Servicio al Cliente    Listas de Deseos    Tarjetas de Regalo    Vender    Electrónicos    Amazon Prime', 110, subNavY + 25);

    // 3. Hero Promo Banner
    const bannerY = subNavY + subNavH;
    const bannerH = 220;
    const grad = ctx.createLinearGradient(80, bannerY, this.width - 80, bannerY + bannerH);
    grad.addColorStop(0, '#007185');
    grad.addColorStop(0.5, '#232f3e');
    grad.addColorStop(1, '#ff9900');
    ctx.fillStyle = grad;
    ctx.fillRect(80, bannerY, this.width - 160, bannerH);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('Grandes Ofertas de Temporada en Amazon', 130, bannerY + 70);
    ctx.font = '18px sans-serif';
    ctx.fillText('Aprovecha hasta un 50% de descuento en electrónica, computadoras y videojuegos.', 130, bannerY + 110);
    ctx.fillText('Envíos rápidos con Prime y garantía oficial de devolución.', 130, bannerY + 140);

    // Prime badge button
    ctx.fillStyle = '#ffd814';
    ctx.fillRect(130, bannerY + 160, 200, 42);
    ctx.fillStyle = '#0f1111';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('Explorar Ofertas Prime', 150, bannerY + 186);

    // 4. Product Card Grid (4 Big Solid Platform Cards)
    const gridY = bannerY + bannerH + 25;
    const cardW = 320;
    const cardH = 340;
    const gap = 30;
    const startX = 110;

    const cards = [
      {
        title: 'Computadoras & PC Gamer',
        sub: 'Laptops RTX 4080, Teclados Mecánicos',
        price: 'Desde US $899.99',
        rating: '⭐⭐⭐⭐⭐ (4.8)',
        tag: 'Más vendido'
      },
      {
        title: 'Consolas & Videojuegos',
        sub: 'PlayStation 5 Pro, Mandos & VR Headset',
        price: 'Desde US $499.99',
        rating: '⭐⭐⭐⭐⭐ (4.9)',
        tag: 'Elección de Amazon'
      },
      {
        title: 'Ofertas Relámpago ⚡',
        sub: 'Auriculares Noise Cancelling & Relojes Smart',
        price: 'US $79.99 (50% Descuento)',
        rating: '⭐⭐⭐⭐☆ (4.6)',
        tag: 'Oferta del Día'
      },
      {
        title: 'Dispositivos Amazon Alexa',
        sub: 'Echo Dot 5ª Gen con Sonido Envolvente',
        price: 'US $49.99',
        rating: '⭐⭐⭐⭐⭐ (4.7)',
        tag: 'Prime Exclusivo'
      }
    ];

    cards.forEach((card, idx) => {
      const cx = startX + idx * (cardW + gap);
      if (cx + cardW > this.width - 80) return;

      // Card Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx, gridY, cardW, cardH);
      ctx.strokeStyle = '#d5d9d9';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx, gridY, cardW, cardH);

      // Tag pill
      ctx.fillStyle = '#cc0c39';
      ctx.fillRect(cx + 18, gridY + 18, 120, 24);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(card.tag, cx + 26, gridY + 34);

      // Card Title
      ctx.fillStyle = '#0f1111';
      ctx.font = 'bold 19px sans-serif';
      ctx.fillText(card.title, cx + 18, gridY + 70);

      // Inner Product Visual Box
      ctx.fillStyle = '#f7f8f8';
      ctx.fillRect(cx + 18, gridY + 85, cardW - 36, 120);
      ctx.strokeStyle = '#e7e7e7';
      ctx.strokeRect(cx + 18, gridY + 85, cardW - 36, 120);

      ctx.fillStyle = '#565959';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(card.sub, cx + 28, gridY + 140);
      ctx.fillStyle = '#007185';
      ctx.font = '12px sans-serif';
      ctx.fillText('Ver detalles del producto ➔', cx + 28, gridY + 175);

      // Price & Rating
      ctx.fillStyle = '#b12704';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(card.price, cx + 18, gridY + 235);

      ctx.fillStyle = '#ffa41c';
      ctx.font = '14px sans-serif';
      ctx.fillText(card.rating, cx + 18, gridY + 260);

      // Yellow "Añadir a la cesta" Button (#ffd814)
      ctx.fillStyle = '#ffd814';
      ctx.fillRect(cx + 18, gridY + 280, cardW - 36, 40);
      ctx.strokeStyle = '#fcd200';
      ctx.strokeRect(cx + 18, gridY + 280, cardW - 36, 40);
      ctx.fillStyle = '#0f1111';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Añadir a la cesta', cx + cardW / 2, gridY + 305);
      ctx.textAlign = 'left';
    });

    // 5. Amazon Footer (#232f3e)
    const footY = this.height - 130;
    ctx.fillStyle = '#37475a';
    ctx.fillRect(80, footY, this.width - 160, 40);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('▲ Inicio de página', this.width / 2, footY + 25);

    ctx.fillStyle = '#232f3e';
    ctx.fillRect(80, footY + 40, this.width - 160, 90);
    ctx.fillStyle = '#dddddd';
    ctx.font = '12px sans-serif';
    ctx.fillText('Conócenos · Trabaja en Amazon · Ayuda · Envío y Devoluciones · Condiciones de Uso · Destructible Canvas Edition', this.width / 2, footY + 70);
    ctx.fillStyle = '#999999';
    ctx.fillText('© 1996-2026, Amazon.com, Inc. o sus afiliados. All elements fully destructible.', this.width / 2, footY + 95);
    ctx.textAlign = 'left';

    this.syncGridFromCanvas();
  }

  // Render ANY Real Webpage parsed from URL
  async renderFetchedPage(pageData) {
    this.presetName = 'custom';
    this.pageUrl = pageData.url;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Modern Webpage Background (White or Light Gray)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(80, 40, this.width - 160, this.height - 80);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(80, 40, this.width - 160, this.height - 80);

    // 1. Navigation Bar
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(80, 40, this.width - 160, 64);

    ctx.fillStyle = '#f97316';
    ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`🌐 ${pageData.domain.toUpperCase()}`, 110, 78);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('Home    Articles    Trending    Categories    About    Contact', this.width - 560, 78);

    // 2. URL Breadcrumbs
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(80, 104, this.width - 160, 36);
    ctx.strokeStyle = '#e2e8f0';
    ctx.strokeRect(80, 104, this.width - 160, 36);
    ctx.fillStyle = '#64748b';
    ctx.font = '12px sans-serif';
    ctx.fillText(`Home > Web > ${pageData.domain} > ${pageData.title.slice(0, 40)}...`, 110, 126);

    let currY = 180;

    // 3. Main Page Title
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 36px Georgia, serif';
    currY = this.renderWrappedText(ctx, pageData.title || pageData.domain, 120, currY, this.width - 240, 44) + 10;

    // Subtitle / domain tag
    ctx.fillStyle = '#64748b';
    ctx.font = 'italic 14px sans-serif';
    ctx.fillText(`Source: ${pageData.url} · Extracted for Real-Time Obliteration`, 120, currY);
    currY += 20;

    // Divider line
    ctx.strokeStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.moveTo(120, currY);
    ctx.lineTo(this.width - 120, currY);
    ctx.stroke();
    currY += 35;

    // 4. Hero Banner / Alert Notice
    if (pageData.description) {
      ctx.fillStyle = '#eff6ff';
      ctx.fillRect(120, currY, this.width - 240, 75);
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(120, currY, this.width - 240, 75);

      ctx.fillStyle = '#1d4ed8';
      ctx.fillRect(120, currY, 6, 75); // blue accent bar

      ctx.fillStyle = '#1e3a8a';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('PAGE SUMMARY & OVERVIEW:', 140, currY + 25);
      ctx.fillStyle = '#1e293b';
      ctx.font = '14px sans-serif';
      this.renderWrappedText(ctx, pageData.description, 140, currY + 46, this.width - 280, 20);
      currY += 105;
    }

    // 5. Render Headings & Paragraphs in 2 Columns
    const col1X = 120;
    const col1W = 820;
    const col2X = 980;
    const col2W = this.width - 1100;

    // Right Column Sidebar Box
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(col2X, currY, col2W, 680);
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(col2X, currY, col2W, 680);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`ABOUT ${pageData.domain.toUpperCase()}`, col2X + 20, currY + 35);

    ctx.strokeStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.moveTo(col2X + 20, currY + 48);
    ctx.lineTo(col2X + col2W - 20, currY + 48);
    ctx.stroke();

    ctx.fillStyle = '#475569';
    ctx.font = '13px/1.5 sans-serif';
    this.renderWrappedText(ctx, `You are playing on a live rendered copy of ${pageData.url}. Every paragraph, button, and image block has been mapped into a destructible voxel grid.`, col2X + 20, currY + 75, col2W - 40, 20);

    // Sidebar quick links
    const sidebarItems = ['Popular Topics', 'Archived Stories', 'Community Guidelines', 'Media Kit', 'API Access', 'Privacy Policy'];
    sidebarItems.forEach((item, idx) => {
      ctx.fillStyle = '#2563eb';
      ctx.fillText(`• ${item}`, col2X + 20, currY + 200 + idx * 30);
    });

    // Left Column Body Content
    let pIdx = 0;
    const maxParagraphs = pageData.paragraphs.length;

    for (let h of (pageData.headings || [])) {
      if (currY > this.height - 350) break;

      // Heading
      ctx.fillStyle = '#0f172a';
      ctx.font = h.level === 1 ? 'bold 26px Georgia, serif' : 'bold 20px Georgia, serif';
      ctx.fillText(h.text, col1X, currY);
      currY += 10;

      ctx.strokeStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(col1X, currY);
      ctx.lineTo(col1X + col1W, currY);
      ctx.stroke();
      currY += 25;

      // Follow up with 1-2 paragraphs
      if (pIdx < maxParagraphs) {
        ctx.fillStyle = '#334155';
        ctx.font = '15px/1.6 "Liberation Serif", serif';
        currY = this.renderWrappedText(ctx, pageData.paragraphs[pIdx], col1X, currY, col1W, 23) + 20;
        pIdx++;
      }
      if (pIdx < maxParagraphs && Math.random() > 0.4) {
        ctx.fillStyle = '#334155';
        ctx.font = '15px/1.6 "Liberation Serif", serif';
        currY = this.renderWrappedText(ctx, pageData.paragraphs[pIdx], col1X, currY, col1W, 23) + 20;
        pIdx++;
      }
    }

    // Remaining paragraphs
    while (pIdx < maxParagraphs && currY < this.height - 300) {
      ctx.fillStyle = '#334155';
      ctx.font = '15px/1.6 "Liberation Serif", serif';
      currY = this.renderWrappedText(ctx, pageData.paragraphs[pIdx], col1X, currY, col1W, 23) + 20;
      pIdx++;
    }

    // Footer
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(80, this.height - 120, this.width - 160, 60);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText(`© 2026 ${pageData.domain} · Level generated dynamically for Destroy Any Website`, 110, this.height - 85);

    // Sync Collision Grid
    this.syncGridFromCanvas();
  }

  // Generate Custom URL Layout based on any domain or prompt
  generateCustom(urlInput) {
    if (this.width !== 1500 || this.height !== 2600) this.resize(1500, 2600);
    this.presetName = 'custom';
    this.pageUrl = urlInput.startsWith('http') ? urlInput : `https://${urlInput}`;
    let domain = 'Website';
    try {
      domain = new URL(this.pageUrl).hostname;
    } catch (e) {
      domain = urlInput;
    }

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.fillStyle = '#18181b';
    ctx.fillRect(80, 40, this.width - 160, this.height - 80);
    ctx.strokeStyle = '#3f3f46';
    ctx.strokeRect(80, 40, this.width - 160, this.height - 80);

    // Hero Header
    ctx.fillStyle = '#27272a';
    ctx.fillRect(80, 40, this.width - 160, 70);
    ctx.fillStyle = '#f97316';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(`⚡ ${domain.toUpperCase()}`, 120, 85);

    ctx.fillStyle = '#a1a1aa';
    ctx.font = '14px sans-serif';
    ctx.fillText('Features    Docs    Blog    Showcase    Pricing    Login', this.width - 550, 85);

    // Big Hero Banner
    ctx.fillStyle = '#09090b';
    ctx.fillRect(110, 140, this.width - 220, 320);
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2;
    ctx.strokeRect(110, 140, this.width - 220, 320);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText(`WELCOME TO ${domain.toUpperCase()}`, 150, 220);

    ctx.fillStyle = '#f97316';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('Fully Destructible Web Environment Ready for Battle', 150, 270);

    ctx.fillStyle = '#d4d4d8';
    ctx.font = '16px/1.6 sans-serif';
    this.renderWrappedText(ctx, `You have loaded "${this.pageUrl}". Every header, navigation bar, card, and paragraph on this page has been compiled into a solid physical terrain. Pick your weapon and obliterate it!`, 150, 310, this.width - 320, 24);

    // 4 Content Cards Grid
    const cardY = 500;
    const cw = (this.width - 300) / 3;
    const ch = 280;

    for (let i = 0; i < 3; i++) {
      const cx = 110 + i * (cw + 40);
      ctx.fillStyle = '#27272a';
      ctx.fillRect(cx, cardY, cw, ch);
      ctx.strokeStyle = '#52525b';
      ctx.strokeRect(cx, cardY, cw, ch);

      ctx.fillStyle = '#f97316';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(`SECTOR 0${i + 1}`, cx + 25, cardY + 45);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(`Data Node #${i + 42}`, cx + 25, cardY + 80);

      ctx.fillStyle = '#a1a1aa';
      ctx.font = '14px/1.5 sans-serif';
      this.renderWrappedText(ctx, `High density server block containing DOM nodes and stylesheet cascade rules. Shoot here to trigger explosive debris cascades across the network.`, cx + 25, cardY + 115, cw - 50, 20);
    }

    // Lower section with code block
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(110, 830, this.width - 220, 260);
    ctx.strokeStyle = '#38bdf8';
    ctx.strokeRect(110, 830, this.width - 220, 260);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('// TERMINAL LOGS & NETWORK PACKETS', 140, 870);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '14px monospace';
    ctx.fillText('> connecting to WebSocket room ... OK', 140, 910);
    ctx.fillText('> synchronizing voxel collision grid (1500 x 2600) ... 100%', 140, 940);
    ctx.fillText('> players connected: online deathmatch active', 140, 970);
    ctx.fillText('> WARNING: Heavy artillery detected. Protect the server racks!', 140, 1000);

    this.syncGridFromCanvas();
  }

  // Helper to wrap text cleanly
  renderWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let currY = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, currY);
        line = words[n] + ' ';
        currY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, currY);
    return currY + lineHeight;
  }
}

window.LevelEngine = LevelEngine;
