export interface Config {
    CYCLE_INTERVAL: number;
    UNIFIED_DRAW_SPEED: number;
    UNIFIED_TAIL_DELAY: number;
    COLORS: number[];
    Z_SPACING: number;
    ROTATION_JITTER: number;
    ORIGIN_Z: number;
    DEFAULT_ORIGIN_SCALE: number;
    PAGE1_OPACITY_MULT: number;
    PAGE2_OPACITY_MULT: number;
}

export const CONFIG: Config = {
    CYCLE_INTERVAL: 1.2,
    UNIFIED_DRAW_SPEED: 1.0,
    UNIFIED_TAIL_DELAY: 2 * Math.PI * 0.85,
    COLORS: [
        0x3b2e2a, // Dark brown close to black
        0x8f826b  // Darker Beige (Darkened Pepper Beige)
    ],
    Z_SPACING: 0.002,
    ROTATION_JITTER: 0.05,
    ORIGIN_Z: 0.02,
    DEFAULT_ORIGIN_SCALE: 0.13,
    PAGE1_OPACITY_MULT: 2.0,
    PAGE2_OPACITY_MULT: 5.0
};
