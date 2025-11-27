export interface Config {
    CYCLE_INTERVAL: number;
    UNIFIED_DRAW_SPEED: number;
    UNIFIED_TAIL_DELAY: number;
    COLORS: number[];
}

export const CONFIG: Config = {
    CYCLE_INTERVAL: 1.2,
    UNIFIED_DRAW_SPEED: 1.0,
    UNIFIED_TAIL_DELAY: 2 * Math.PI * 0.85,
    COLORS: [
        0x3b2e2a, // Dark brown close to black
        0x1a261c, // Greenish black (Deep Greenish Black)
        0x8f826b  // Darker Beige (Darkened Pepper Beige)
    ]
};
