// ─────────────────────────────────────────────────────────────────────────────
// Gameplay state
//
// Written from the frame loop, read by the HUD on a timer. Deliberately a plain
// mutable object rather than React state — the driving code must never trigger a
// re-render, it runs 60 times a second.
// ─────────────────────────────────────────────────────────────────────────────

export const GAME_STATE = {
	speed: 0, // km/h
	boost: 1, // 0..1
	score: 0,
	collected: 0,
	airTime: 0,
	bestAir: 0,
	inWater: false,
	// Set when something worth celebrating happens; the HUD shows it briefly.
	flash: '',
	flashAt: 0,
};

export const announce = (message: string) => {
	GAME_STATE.flash = message;
	GAME_STATE.flashAt = performance.now();
};

export const addScore = (points: number) => {
	GAME_STATE.score += Math.round(points);
};
