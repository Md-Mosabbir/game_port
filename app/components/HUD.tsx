'use client';

import { useEffect, useState } from 'react';
import { GAME_STATE } from '@/app/systems/game-state';

// Polls the mutable game state instead of subscribing to it. The driving code
// updates 60 times a second; re-rendering React that often would be silly, and
// nobody can read a number that changes faster than this anyway.
const POLL_MS = 90;
const FLASH_MS = 900;

export const HUD = () => {
	const [state, setState] = useState(() => ({ ...GAME_STATE, flashFade: 0 }));

	useEffect(() => {
		const id = setInterval(() => {
			// Flash age is resolved here rather than during render — reading the
			// clock while rendering is not a pure render.
			const age = performance.now() - GAME_STATE.flashAt;
			setState({ ...GAME_STATE, flashFade: Math.max(0, 1 - age / FLASH_MS) });
		}, POLL_MS);
		return () => clearInterval(id);
	}, []);

	const showFlash = state.flash !== '' && state.flashFade > 0;

	const panel: React.CSSProperties = {
		background: 'rgba(0,0,0,0.35)',
		backdropFilter: 'blur(6px)',
		border: '1px solid rgba(255,255,255,0.15)',
		borderRadius: 12,
		padding: '10px 14px',
		color: 'white',
		fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
		lineHeight: 1.25,
	};

	return (
		<div
			style={{
				position: 'fixed',
				inset: 0,
				pointerEvents: 'none',
				zIndex: 90,
				userSelect: 'none',
			}}
		>
			{/* Speed + boost, bottom left above the joystick */}
			<div style={{ ...panel, position: 'absolute', left: 24, bottom: 180, minWidth: 150 }}>
				<div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -1 }}>
					{Math.round(state.speed)}
					<span style={{ fontSize: 13, opacity: 0.65, marginLeft: 4 }}>km/h</span>
				</div>

				<div style={{ fontSize: 10, opacity: 0.6, marginTop: 6, letterSpacing: 1 }}>BOOST · SHIFT</div>
				<div
					style={{
						height: 7,
						borderRadius: 4,
						background: 'rgba(255,255,255,0.18)',
						overflow: 'hidden',
						marginTop: 3,
					}}
				>
					<div
						style={{
							height: '100%',
							width: `${Math.max(0, Math.min(1, state.boost)) * 100}%`,
							background: state.boost > 0.25 ? 'linear-gradient(90deg,#ffd34d,#ff7ae0)' : '#ff5566',
							transition: 'width 90ms linear',
						}}
					/>
				</div>

				{state.inWater && (
					<div style={{ fontSize: 11, marginTop: 7, color: '#7fd6ff' }}>● in water</div>
				)}
			</div>

			{/* Score, top right */}
			<div style={{ ...panel, position: 'absolute', right: 24, top: 24, textAlign: 'right', minWidth: 140 }}>
				<div style={{ fontSize: 10, opacity: 0.6, letterSpacing: 1 }}>SCORE</div>
				<div style={{ fontSize: 26, fontWeight: 700 }}>{state.score.toLocaleString()}</div>
				<div style={{ fontSize: 11, opacity: 0.75, marginTop: 4 }}>rings {state.collected}</div>
				<div style={{ fontSize: 11, opacity: 0.75 }}>best air {state.bestAir.toFixed(1)}s</div>
			</div>

			{/* Centre flash for pickups and big air */}
			{showFlash && (
				<div
					style={{
						position: 'absolute',
						left: '50%',
						top: '32%',
						transform: `translate(-50%,-50%) scale(${1 + state.flashFade * 0.25})`,
						fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
						fontSize: 34,
						fontWeight: 800,
						color: '#ffd34d',
						textShadow: '0 2px 18px rgba(0,0,0,0.55)',
						opacity: state.flashFade,
					}}
				>
					{state.flash}
				</div>
			)}

			{/* Controls hint, fades out after the first few seconds */}
			<div
				style={{
					...panel,
					position: 'absolute',
					left: '50%',
					bottom: 24,
					transform: 'translateX(-50%)',
					fontSize: 11,
					opacity: 0.6,
					padding: '6px 12px',
				}}
			>
				WASD drive · SHIFT boost · SPACE brake · R reset
			</div>
		</div>
	);
};
