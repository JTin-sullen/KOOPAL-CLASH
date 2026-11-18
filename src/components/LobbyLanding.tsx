import React, { useState } from 'react';
import { Film, Gamepad2, Swords, Users } from 'lucide-react';
import { soundEngine } from '../game/soundEngine.ts';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';
import { FullscreenControls } from './FullscreenControls.tsx';

interface LobbyLandingProps {
  initialRoomCode: string;
  initialName: string;
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  pingMs: number | null;
  errorMessage: string | null;
  onCreateRoom: (name: string, opts?: { isSoloPractice?: boolean; isTrainingMode?: boolean }) => void;
  onJoinRoom: (roomCode: string, name: string) => void;
  onOpenCinemaCut: () => void;
}

export const LobbyLanding: React.FC<LobbyLandingProps> = ({
  initialRoomCode,
  initialName,
  connectionStatus,
  pingMs,
  errorMessage,
  onCreateRoom,
  onJoinRoom,
  onOpenCinemaCut,
}) => {
  const [name, setName] = useState(initialName || 'Fighter');
  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const { enterFullscreen } = usePWAInstall();

  const handleAction = (fn: () => void, tryFs = false) => {
    soundEngine.unlock();
    if (tryFs && window.matchMedia('(pointer: coarse)').matches) {
      void enterFullscreen(false);
    }
    fn();
  };

  return (
    <div className="relative h-[100dvh] w-full bg-[#070b14] text-slate-100 flex flex-col items-center justify-start md:justify-center px-3 pt-4 pb-12 sm:px-6 sm:py-8 overflow-y-auto overscroll-y-contain safe-area-pad">
      <div
        className="pointer-events-none fixed inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(circle at 20% 18%, rgba(245, 158, 11, 0.16), transparent 44%), radial-gradient(circle at 82% 76%, rgba(56, 189, 248, 0.14), transparent 48%)',
        }}
      />

      <div className="relative z-10 w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-stretch">
        {/* Left Hero Identity */}
        <div className="lg:col-span-7 flex flex-col justify-between rounded-2xl bg-slate-900/85 border border-slate-800 p-4 sm:p-7 shadow-2xl">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
              <div className="flex items-center gap-2 text-[11px] sm:text-xs text-amber-400 font-semibold tracking-wider uppercase">
                <Swords className="w-4 h-4 shrink-0" />
                <span>2–5 Player Global Arena</span>
              </div>
              <FullscreenControls compact />
            </div>

            <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-white leading-tight [text-wrap:balance]">
              KOOPAL CLASH
            </h1>
            <p className="mt-2 sm:mt-3 text-xs sm:text-base text-slate-300 leading-relaxed max-w-xl">
              Challenge up to 5 friends anywhere in the world in tactical 3D Free-For-All combat. Chain 3-hit combos, break guards with Grabs, counter Ultimates in Clash QTEs, and adapt to shifting battlefield events.
            </p>
          </div>

          <div className="mt-4 sm:mt-6 grid grid-cols-3 gap-2 sm:gap-3 text-center">
            <div className="rounded-xl bg-slate-950/70 border border-slate-800/80 p-2.5 sm:p-3">
              <div className="font-display text-xl sm:text-2xl font-bold text-amber-400 font-mono-num">2–5</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Live Players</div>
            </div>
            <div className="rounded-xl bg-slate-950/70 border border-slate-800/80 p-2.5 sm:p-3">
              <div className="font-display text-xl sm:text-2xl font-bold text-sky-400 font-mono-num">RPS</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Strike · Grab · Parry</div>
            </div>
            <div className="rounded-xl bg-slate-950/70 border border-slate-800/80 p-2.5 sm:p-3">
              <div className="font-display text-xl sm:text-2xl font-bold text-emerald-400 font-mono-num">CLASH</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Combos &amp; Events</div>
            </div>
          </div>

          <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  connectionStatus === 'connected'
                    ? 'bg-emerald-400'
                    : connectionStatus === 'connecting'
                    ? 'bg-amber-400'
                    : 'bg-rose-500'
                }`}
              />
              <span>
                {connectionStatus === 'connected'
                  ? `Global Sync Ready${pingMs !== null ? ` · ${pingMs} ms` : ''}`
                  : connectionStatus === 'connecting'
                  ? 'Connecting to Server...'
                  : 'Reconnecting...'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => handleAction(onOpenCinemaCut)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-200 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 transition whitespace-nowrap cursor-pointer"
            >
              <Film className="w-3.5 h-3.5 text-amber-400" />
              <span>120s Cinema Cut</span>
            </button>
          </div>
        </div>

        {/* Right Room Entry Card */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl bg-slate-900/90 border border-slate-800 p-4 sm:p-7 shadow-2xl">
          <div className="space-y-3 sm:space-y-4">
            <div>
              <label htmlFor="player-name" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Your Fighter Tag
              </label>
              <input
                id="player-name"
                type="text"
                maxLength={14}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter nickname"
                className="w-full h-11 px-3.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            {errorMessage && (
              <div className="rounded-xl bg-rose-950/70 border border-rose-500/40 px-3.5 py-2 text-xs text-rose-200">
                {errorMessage}
              </div>
            )}

            <button
              type="button"
              disabled={connectionStatus !== 'connected'}
              onClick={() => handleAction(() => onCreateRoom(name, {}), true)}
              className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-display font-bold text-base tracking-wide flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
            >
              <Users className="w-4 h-4" />
              <span>CREATE FRIEND ROOM</span>
            </button>

            <div className="relative flex items-center py-0.5">
              <div className="flex-grow border-t border-slate-800" />
              <span className="px-3 text-[11px] font-semibold text-slate-500">OR JOIN CODE</span>
              <div className="flex-grow border-t border-slate-800" />
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                maxLength={4}
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="CODE"
                className="w-24 sm:w-28 h-12 px-2 rounded-xl bg-slate-950 border border-slate-700 text-center font-mono-num text-lg font-bold tracking-widest text-amber-300 placeholder-slate-600 focus:outline-none focus:border-sky-400 uppercase"
              />
              <button
                type="button"
                disabled={connectionStatus !== 'connected' || roomCode.length < 4}
                onClick={() => handleAction(() => onJoinRoom(roomCode, name), true)}
                className="flex-1 min-h-[46px] px-4 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 font-display font-bold text-base tracking-wide flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <span>JOIN ROOM</span>
              </button>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              disabled={connectionStatus !== 'connected'}
              onClick={() => handleAction(() => onCreateRoom(name, { isSoloPractice: true }), true)}
              className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-100 font-semibold text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition cursor-pointer"
            >
              <Swords className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Vs. Bot (1v1)</span>
            </button>
            <button
              type="button"
              disabled={connectionStatus !== 'connected'}
              onClick={() => handleAction(() => onCreateRoom(name, { isTrainingMode: true }), true)}
              className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-emerald-950/75 hover:bg-emerald-900/75 disabled:opacity-50 text-emerald-100 font-semibold text-xs flex items-center justify-center gap-1.5 border border-emerald-500/40 transition cursor-pointer"
            >
              <Gamepad2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Training Area</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
