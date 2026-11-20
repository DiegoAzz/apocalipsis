// Voxel Terrain and Destructible Bitmask Engine with 4x4 Bayer Dithering
pub struct VoxelTerrain {
    pub width: usize,
    pub height: usize,
    pub cell_size: usize,
    pub cols: usize,
    pub rows: usize,
    pub grid: Vec<u8>,
    pub initial_solid_count: usize,
    pub destroyed_count: usize,
}

const BAYER_4X4: [f32; 16] = [
    0.0 / 16.0,  8.0 / 16.0,  2.0 / 16.0, 10.0 / 16.0,
   12.0 / 16.0,  4.0 / 16.0, 14.0 / 16.0,  6.0 / 16.0,
    3.0 / 16.0, 11.0 / 16.0,  1.0 / 16.0,  9.0 / 16.0,
   15.0 / 16.0,  7.0 / 16.0, 13.0 / 16.0,  5.0 / 16.0,
];

impl VoxelTerrain {
    pub fn new(width: usize, height: usize, cell_size: usize) -> Self {
        let cols = (width + cell_size - 1) / cell_size;
        let rows = (height + cell_size - 1) / cell_size;
        let total_cells = cols * rows;

        // Default fill: solid webpage
        let grid = vec![1u8; total_cells];

        Self {
            width,
            height,
            cell_size,
            cols,
            rows,
            grid,
            initial_solid_count: total_cells,
            destroyed_count: 0,
        }
    }

    #[inline]
    pub fn is_solid(&self, world_x: f32, world_y: f32) -> bool {
        if world_x < 0.0 || world_y < 0.0 {
            return false;
        }
        let c = (world_x as usize) / self.cell_size;
        let r = (world_y as usize) / self.cell_size;
        if c >= self.cols || r >= self.rows {
            return false;
        }
        self.grid[r * self.cols + c] == 1
    }

    // Carve circular crater with optional Bayer ragged dither edge
    pub fn carve_circle(&mut self, center_x: f32, center_y: f32, radius: f32, dither: bool) -> usize {
        let r_inner = if dither { radius * 0.8 } else { radius };
        let r_inner2 = r_inner * r_inner;
        let r_outer2 = radius * radius;

        let min_c = (center_x - radius).max(0.0) as usize / self.cell_size;
        let max_c = ((center_x + radius).min(self.width as f32) as usize / self.cell_size).min(self.cols - 1);
        let min_r = (center_y - radius).max(0.0) as usize / self.cell_size;
        let max_r = ((center_y + radius).min(self.height as f32) as usize / self.cell_size).min(self.rows - 1);

        let mut newly_destroyed = 0;

        for r in min_r..=max_r {
            let cy = (r as f32 + 0.5) * self.cell_size as f32;
            let dy = cy - center_y;
            let dy2 = dy * dy;

            for c in min_c..=max_c {
                let cx = (c as f32 + 0.5) * self.cell_size as f32;
                let dx = cx - center_x;
                let d2 = dx * dx + dy2;

                if d2 <= r_inner2 {
                    let idx = r * self.cols + c;
                    if self.grid[idx] == 1 {
                        self.grid[idx] = 0;
                        newly_destroyed += 1;
                    }
                } else if dither && d2 <= r_outer2 {
                    // Bayer dither factor
                    let bayer_val = BAYER_4X4[(r & 3) * 4 + (c & 3)];
                    let dist_ratio = (d2.sqrt() - r_inner) / (radius - r_inner);
                    if dist_ratio < bayer_val {
                        let idx = r * self.cols + c;
                        if self.grid[idx] == 1 {
                            self.grid[idx] = 0;
                            newly_destroyed += 1;
                        }
                    }
                }
            }
        }

        self.destroyed_count += newly_destroyed;
        newly_destroyed
    }

    // Carve a straight trench along a line (for Railgun)
    pub fn carve_line(&mut self, x1: f32, y1: f32, x2: f32, y2: f32, thickness: f32) {
        let dist = ((x2 - x1).powi(2) + (y2 - y1).powi(2)).sqrt();
        let step = (thickness * 0.4).max(2.0);
        let steps = (dist / step).ceil() as usize;

        for i in 0..=steps {
            let t = i as f32 / steps as f32;
            let px = x1 + (x2 - x1) * t;
            let py = y1 + (y2 - y1) * t;
            self.carve_circle(px, py, thickness / 2.0, false);
        }
    }

    pub fn destruction_percent(&self) -> f32 {
        if self.initial_solid_count == 0 {
            return 0.0;
        }
        (self.destroyed_count as f32 / self.initial_solid_count as f32) * 100.0
    }
}
