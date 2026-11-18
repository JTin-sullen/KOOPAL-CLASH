import React, { useState } from 'react';
import {
  Check,
  Copy,
  Flame,
  Link2,
  LogOut,
  MapPin,
  Play,
  Shield,
  Sparkles,
  Swords,
  Zap,
} from 'lucide-react';
import {
  FIGHTER_BY_ID,
  FIGHTERS,
  FighterId,
  MAPS,
  MapId,
  RoomState,
} from '../shared/gameData.ts';
import { TekkenStagePreview } from './TekkenStagePreview.tsx';
import { FullscreenControls } from './FullscreenControls.tsx';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';
import { soundEngine } from '../game/soundEngine.ts';

interface TekkenPickScreenProps {
  room: RoomState;
  playerId: string;
  pingMs: number | null;
  errorMessage: string | null;
  onSelectFighter: (fighterId: FighterId) => void;
  onSelectMap: (mapId: MapId) => void;
  onToggleReady: (ready: boolean) => void;
  onStartNow: () => void;
  onLeave: () => void;
}

export const TekkenPickScreen: React.FC<TekkenPickScreenProps> = ({
  room,
  playerId,
  pingMs,
  errorMessage,
  onSelectFighter,
  onSelectMap,
  onToggleReady,
  onStartNow,
  onLeave,
}) => {
  const [copied, setCopied] = useState(false);
  const { enterFullscreen } = usePWAInstall();

  const me = room.players.find((p) => p.playerId === playerId);
  const myFighterId: FighterId = me?.fighterId ?? 'jm';
  const mySpec = FIGHTER_BY_ID[myFighterId];
  const isHost = room.hostId === playerId;
  const canStart = room.isSoloPractice || room.isTrainingMode || room.players.length >= 2;

  const copyInvite = async () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('room', room.roomCode);
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const triggerMobileFs = () => {
    if (window.matchMedia('(pointer: coarse)').matches) {
      void enterFullscreen(true);
    }
  };

  return (
    <div className="h-[100dvh] w-full bg-[#070b14] text-slate-100 flex flex-col justify-between px-2.5 pt-2.5 pb-12 sm:px-6 sm:py-4 overflow-y-auto overscroll-y-contain safe-area-pad">
      {/* Top Bar: Squad Clash Room Header & P1-P5 Slots */}
      <div className="w-full max-w-7xl mx-auto flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2">
          <div className="flex items-center gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {room.isTrainingMode
                  ? 'Training Area'
                  : room.isSoloPractice
                  ? 'Vs. Bot Arena'
                  : 'Squad Room Code'}
              </div>
              <div className="font-mono-num text-lg sm:text-xl font-bold tracking-widest text-amber-400 leading-none">
                {room.roomCode}
              </div>
            </div>

            {!room.isSoloPractice && !room.isTrainingMode && (
              <button
                type="button"
                onClick={copyInvite}
                className="min-h-[36px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] sm:text-xs font-semibold text-slate-100 flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-sky-400" />}
                <span>{copied ? 'Copied' : 'Invite Link'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {pingMs !== null && (
              <span className="hidden sm:inline text-[11px] font-mono-num text-emerald-400">
                {pingMs} ms
              </span>
            )}
            <span className="text-[11px] sm:text-xs text-slate-400 font-mono-num">
              {room.isTrainingMode
                ? 'Free Practice · Dummy & Zero CD Toggles'
                : room.isSoloPractice
                ? '1P vs Smart Bot · Loss Exits'
                : `${room.players.length}/5 Joined · First to 3 Wins`}
            </span>
            <FullscreenControls compact lockLandscape />
            <button
              type="button"
              onClick={onLeave}
              className="min-h-[36px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-950/80 border border-slate-700 hover:border-rose-500/40 text-xs font-semibold text-slate-200 flex items-center gap-1 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Leave</span>
            </button>
          </div>
        </div>

        {/* Tekken-style P1–P5 Player Slots Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 sm:gap-2">
          {[0, 1, 2, 3, 4].map((slotIdx) => {
            const p = room.players.find((pl) => pl.slotIndex === slotIdx);
            const fSpec = p ? FIGHTER_BY_ID[p.fighterId] : null;
            const isSelf = p?.playerId === playerId;
            return (
              <div
                key={slotIdx}
                className={`rounded-xl px-2.5 py-1.5 border transition ${
                  p
                    ? isSelf
                      ? 'bg-slate-900 border-amber-400/75'
                      : 'bg-slate-900/80 border-slate-700'
                    : 'bg-slate-950/60 border-slate-800/70 opacity-55'
                }`}
              >
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-mono-num font-bold text-slate-400">
                    P{slotIdx + 1} {isSelf ? '(You)' : ''}
                  </span>
                  {p ? (
                    <span className={`font-semibold ${p.ready ? 'text-emerald-400' : 'text-amber-300'}`}>
                      {p.ready ? 'LOCKED' : 'SELECTING'}
                    </span>
                  ) : (
                    <span className="text-slate-600">OPEN</span>
                  )}
                </div>
                {p && fSpec ? (
                  <div className="mt-0.5 flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-white truncate">{p.name}</span>
                    <span className="text-[10px] font-display font-bold truncate" style={{ color: fSpec.color }}>
                      {fSpec.name}
                    </span>
                  </div>
                ) : (
                  <div className="mt-0.5 text-[10px] text-slate-600 truncate">Waiting for friend...</div>
                )}
              </div>
            );
          })}
        </div>

        {errorMessage && (
          <div className="rounded-xl bg-rose-950/75 border border-rose-500/40 px-3.5 py-2 text-xs text-rose-200">
            {errorMessage}
          </div>
        )}
      </div>

      {/* Center Stage: 3D Fighter Spotlight + Identity Passive / M1 Chain / Combo Link / 5 Skills + Stage */}
      <div className="w-full max-w-7xl mx-auto my-2 grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch flex-1">
        {/* 3D Spotlight Pedestal */}
        <div className="lg:col-span-5 relative rounded-2xl bg-slate-900/85 border border-slate-800 overflow-hidden flex flex-col justify-between">
          <div className="absolute top-2.5 left-3.5 right-3.5 z-10 pointer-events-none flex items-start justify-between gap-2">
            <div>
              <div className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider" style={{ color: mySpec.color }}>
                {mySpec.title} · {mySpec.m1Combo.rangeIdentity}
              </div>
              <h2 className="font-display text-2xl sm:text-4xl font-bold text-white tracking-tight leading-none mt-0.5">
                {mySpec.name}
              </h2>
            </div>
            <div className="text-right text-[10px] sm:text-[11px] font-mono-num text-slate-200 bg-slate-950/85 px-2 py-1 rounded-lg border border-slate-800 shrink-0">
              <div>HP {mySpec.maxHp}</div>
              <div className="text-amber-300">STM {mySpec.maxStamina}</div>
            </div>
          </div>

          <div className="w-full h-[185px] sm:h-[235px] lg:h-[295px] relative">
            <TekkenStagePreview fighterId={myFighterId} />
          </div>

          {/* Power / Speed / Defense bars */}
          <div className="relative z-10 px-3.5 py-2 bg-slate-950/90 border-t border-slate-800 grid grid-cols-3 gap-2.5 text-[10px] sm:text-[11px]">
            {[
              { label: 'Power', val: mySpec.stats.power, color: '#f43f5e' },
              { label: 'Speed', val: mySpec.stats.speed, color: '#38bdf8' },
              { label: 'Defense', val: mySpec.stats.defense, color: '#facc15' },
            ].map((st) => (
              <div key={st.label}>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>{st.label}</span>
                  <span className="font-mono-num font-bold">{st.val}/10</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${st.val * 10}%`, backgroundColor: st.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Passive + M1 Chain + Combo Link + 5 Strategic Abilities + Stage Picker */}
        <div className="lg:col-span-7 flex flex-col justify-between gap-2">
          {/* Identity Passive + Special M1 + Combo Link */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-2.5">
              <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                <Flame className="w-3.5 h-3.5" />
                <span>Passive · {mySpec.passive.name}</span>
              </div>
              <p className="text-[11px] text-slate-300 mt-1 leading-snug">{mySpec.passive.shortDesc}</p>
              <p className="text-[10px] text-amber-200/80 mt-1 leading-snug">{mySpec.passive.frenzyBonus}</p>
            </div>

            <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-2.5">
              <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                <Swords className="w-3.5 h-3.5" />
                <span>
                  {mySpec.m1Combo.stepNames.length > 1
                    ? `${mySpec.m1Combo.stepNames.length}-Hit M1 Combo`
                    : 'Signature Basic M1'}
                </span>
              </div>
              <p className="text-[11px] text-white font-semibold mt-1 leading-snug">
                {mySpec.m1Combo.stepNames.join(' → ')}
              </p>
              <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                Finisher: <span className="text-amber-300 font-semibold">{mySpec.m1Combo.heavyFinisherName}</span>
              </p>
            </div>

            <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-2.5">
              <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                <Link2 className="w-3.5 h-3.5" />
                <span>{mySpec.comboLink.triggerName}</span>
              </div>
              <p className="text-[11px] text-slate-200 mt-1 leading-snug">{mySpec.comboLink.hint}</p>
              <p className="text-[10px] text-emerald-300/90 mt-1">
                +{mySpec.comboLink.bonusDamage} Bonus DMG · +{mySpec.comboLink.bonusStagger} Stagger
              </p>
            </div>
          </div>

          {/* 5 Strategic Abilities */}
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-3">
            <div className="flex flex-wrap items-center justify-between gap-1 mb-2">
              <h3 className="font-display text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-100">
                {mySpec.name}&apos;s Kit · Tap = Quick Cast · Hold = Aim · Shift = Dash · R = Flight (JM) · Tab = Lock-On
              </h3>
              <span className="text-[10px] text-slate-400">KO Style: {mySpec.koStyle}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {mySpec.abilities.map((ab) => {
                const icon =
                  ab.slot === 0 ? <Swords className="w-3.5 h-3.5" /> :
                  ab.slot === 1 ? <Shield className="w-3.5 h-3.5" /> :
                  ab.slot === 2 ? <Zap className="w-3.5 h-3.5" /> :
                  ab.slot === 3 ? <Sparkles className="w-3.5 h-3.5" /> :
                  <Play className="w-3.5 h-3.5" />;
                return (
                  <div
                    key={ab.slot}
                    className="rounded-xl bg-slate-950/85 border border-slate-800 p-2 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[9px] mb-1">
                        <span className="font-bold uppercase" style={{ color: mySpec.color }}>
                          {ab.role}
                        </span>
                        <span className="font-mono-num text-amber-300">
                          {ab.manaCost > 0 ? `${ab.manaCost}C ` : ''}{ab.staminaCost}S
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] font-bold text-white">
                        <span style={{ color: mySpec.color }}>{icon}</span>
                        <span className="truncate">{ab.name}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 leading-snug">{ab.shortDesc}</p>
                    </div>
                    <div className="mt-1.5 text-[9px] font-mono-num text-slate-500">
                      CD {ab.cooldown}s
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stage Selector */}
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-amber-400" />
                <h3 className="font-display text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-100">
                  Select Stage
                </h3>
              </div>
              <span className="text-[10px] text-slate-400">
                {isHost ? 'Host picks arena' : 'Synced to Host'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {MAPS.map((m) => {
                const selected = room.mapId === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={!isHost}
                    onClick={() => {
                      soundEngine.unlock();
                      soundEngine.play('tick');
                      onSelectMap(m.id);
                    }}
                    className={`text-left rounded-xl p-2 border transition ${
                      selected
                        ? 'bg-slate-800/95 border-amber-400 shadow-md'
                        : 'bg-slate-950/75 border-slate-800 hover:border-slate-600'
                    } ${isHost ? 'cursor-pointer' : 'cursor-default opacity-90'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display font-bold text-xs text-white">{m.name}</span>
                      {selected && <span className="text-[9px] font-bold text-amber-400 uppercase">ACTIVE</span>}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{m.subtitle}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Tekken Roster Bar + Ready / Start Controls */}
      <div className="w-full max-w-7xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 sm:p-3">
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2 flex-1">
          {FIGHTERS.map((f) => {
            const isSelected = myFighterId === f.id;
            const pickedBy = room.players.filter((p) => p.fighterId === f.id);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  soundEngine.unlock();
                  soundEngine.play('tick');
                  onSelectFighter(f.id);
                }}
                className={`min-h-[48px] sm:min-h-[54px] rounded-xl px-1.5 sm:px-2 py-1.5 border text-left transition cursor-pointer relative ${
                  isSelected
                    ? 'bg-slate-800 border-white shadow-lg scale-[1.02]'
                    : 'bg-slate-950/85 border-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="w-full h-1 rounded-full mb-1" style={{ backgroundColor: f.color }} />
                <div className="font-display font-bold text-[10px] sm:text-sm text-white truncate">{f.name}</div>
                <div className="text-[10px] text-slate-400 truncate hidden sm:block">{f.m1Combo.rangeIdentity}</div>
                {pickedBy.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-0.5">
                    {pickedBy.map((p) => (
                      <span
                        key={p.playerId}
                        className="text-[8px] sm:text-[9px] font-mono-num font-bold text-slate-950 px-1 rounded"
                        style={{ backgroundColor: f.color }}
                      >
                        P{p.slotIndex + 1}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              soundEngine.unlock();
              soundEngine.play('tick');
              triggerMobileFs();
              onToggleReady(!me?.ready);
            }}
            className={`flex-1 sm:flex-none min-h-[46px] sm:min-h-[54px] px-4 sm:px-5 rounded-xl font-display font-bold text-sm sm:text-base tracking-wide transition cursor-pointer ${
              me?.ready
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
            }`}
          >
            {me?.ready ? 'LOCKED IN ✓' : 'LOCK IN'}
          </button>

          {isHost && (
            <button
              type="button"
              disabled={!canStart}
              onClick={() => {
                soundEngine.unlock();
                triggerMobileFs();
                onStartNow();
              }}
              className="min-h-[46px] sm:min-h-[54px] px-4 sm:px-5 rounded-xl bg-sky-400 hover:bg-sky-300 disabled:opacity-40 text-slate-950 font-display font-bold text-sm sm:text-base tracking-wide transition cursor-pointer whitespace-nowrap"
            >
              {room.isTrainingMode ? 'START TRAINING' : 'START FIGHT'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
