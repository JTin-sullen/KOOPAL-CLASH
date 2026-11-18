import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Crosshair,
  Feather,
  Flame,
  Hand,
  Lock,
  LockOpen,
  RotateCcw,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Volume2,
  VolumeX,
  Wind,
  Zap,
} from 'lucide-react';
import {
  AbilitySlot,
  ArenaActorState,
  ArenaSnapshot,
  CombatMoveType,
  FIGHTER_BY_ID,
  FighterId,
  JM_SECRET_ABILITY,
  KoCause,
  MAP_BY_ID,
  RoomState,
  TrainingConfig,
  isJtinsullenTag,
} from '../shared/gameData.ts';
import { soundEngine } from '../game/soundEngine.ts';
import { FullscreenControls } from './FullscreenControls.tsx';
import type { DamagePopup, HitFlashInfo } from './ArenaViewport.tsx';
import type { AimPreviewState } from '../game/vfxManager.ts';

interface MobileCombatHUDProps {
  room: RoomState;
  playerId: string;
  pingMs: number | null;
  snapshot: ArenaSnapshot | null;
  targetId: string | null;
  lockOnEnabled: boolean;
  cameraYawRef: React.MutableRefObject<number>;
  aimPreviewRef?: React.MutableRefObject<AimPreviewState>;
  cancelAimTriggerSeq?: number;
  damagePopups: DamagePopup[];
  hitFlash: HitFlashInfo | null;
  onSelectTarget: (targetId: string | null) => void;
  onToggleLockOn: () => void;
  onMoveInput: (moveX: number, moveZ: number) => void;
  onJump: () => void;
  onToggleFlight: () => void;
  onDash: () => void;
  onGrab: () => void;
  onClashPick: (clashId: string, choice: CombatMoveType) => void;
  onBlockHoldChange: (held: boolean) => void;
  onCastAbility: (
    slot: AbilitySlot,
    holdHeavy?: boolean,
    aimPayload?: { aimX?: number; aimZ?: number; isHoldVariant?: boolean }
  ) => void;
  onAimUpdate?: (aimX: number, aimZ: number) => void;
  onTrainingConfig?: (cfg: Partial<TrainingConfig>) => void;
  onRematch: () => void;
  onLeave: () => void;
}

const KO_CAUSE_LABELS: Record<KoCause, string> = {
  parry: 'Counter Execution',
  ultimate: 'Ultimate Finish',
  combo: 'Combo Obliteration',
  clash: 'Clash Breaker KO',
  grab: 'Grab Slam KO',
  ring: 'Storm Ring KO',
  normal: 'Arena KO',
};

function getAbilitySpec(fighterId: FighterId, slot: AbilitySlot) {
  return slot === 5 ? JM_SECRET_ABILITY : FIGHTER_BY_ID[fighterId].abilities[slot];
}

function getPassiveSummary(actor: ArenaActorState): { label: string; active: boolean } {
  if (actor.fighterId === 'jm') {
    if (actor.isFlying) {
      return { label: `SKY FLIGHT ${(actor.flightRemaining ?? 0).toFixed(1)}s`, active: true };
    }
    if ((actor.flightCooldown ?? 0) > 0.05) {
      return { label: `FLIGHT CD ${(actor.flightCooldown ?? 0).toFixed(1)}s`, active: false };
    }
    return { label: 'SKY FLIGHT READY', active: true };
  }
  if (actor.fighterId === 'damen') {
    if ((actor.speedBoostTimer ?? 0) > 0.05) {
      return { label: `QUICK-DRAW ${(actor.speedBoostTimer ?? 0).toFixed(1)}s`, active: true };
    }
    return { label: 'QUICK-DRAW STEP', active: false };
  }
  if (actor.fighterId === 'marjohn') {
    return {
      label: actor.passiveStacks > 0 ? `GALE DRIFT ×${actor.passiveStacks}` : 'GALE DRIFT',
      active: !actor.grounded || actor.passiveStacks > 0,
    };
  }
  if (actor.fighterId === 'prime') {
    if (actor.superArmor) {
      return { label: 'SUPER ARMOR!', active: true };
    }
    return { label: 'JUGGERNAUT -15% KB', active: false };
  }
  if ((actor.speedBoostTimer ?? 0) > 0.05) {
    return { label: `SHADOW SPD ${(actor.speedBoostTimer ?? 0).toFixed(1)}s`, active: true };
  }
  return { label: 'BACKSTAB +20%', active: true };
}

export const MobileCombatHUD: React.FC<MobileCombatHUDProps> = ({
  room,
  playerId,
  pingMs,
  snapshot,
  targetId,
  lockOnEnabled,
  cameraYawRef,
  aimPreviewRef,
  cancelAimTriggerSeq = 0,
  damagePopups,
  hitFlash,
  onSelectTarget,
  onToggleLockOn,
  onMoveInput,
  onJump,
  onToggleFlight,
  onDash,
  onGrab,
  onClashPick,
  onBlockHoldChange,
  onCastAbility,
  onAimUpdate,
  onTrainingConfig,
  onRematch,
  onLeave,
}) => {
  const [muted, setMuted] = useState(soundEngine.muted);
  const [trailHp, setTrailHp] = useState<number>(100);
  const [hpShakeKey, setHpShakeKey] = useState<number>(0);
  const [isCompactScreen, setIsCompactScreen] = useState(false);
  const [isNarrowPortrait, setIsNarrowPortrait] = useState(false);
  const [aimOverlay, setAimOverlay] = useState<{
    slot: AbilitySlot;
    label: string;
    cancelled: boolean;
    cx: number;
    cy: number;
  } | null>(null);

  const prevHpRef = useRef<number | null>(null);
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const joyPointerId = useRef<number | null>(null);
  const joyCenter = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const joyVec = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const keysPressed = useRef<Set<string>>(new Set());
  const blockPointerId = useRef<number | null>(null);
  const jumpPointerId = useRef<number | null>(null);
  const attackPointerId = useRef<number | null>(null);

  // Tap vs Hold-Drag aiming controller for Skills & Ultimates
  const aimKnobRef = useRef<HTMLDivElement | null>(null);
  const aimGestureRef = useRef<{
    slot: AbilitySlot;
    pointerId: number;
    cx: number;
    cy: number;
    holdMode: boolean;
    maxDragDist: number;
    cancelled: boolean;
    aimX: number;
    aimZ: number;
    timer: ReturnType<typeof setTimeout> | null;
  } | null>(null);

  // Keyboard hold-to-aim tracking (hold skill key >= 150ms to project live 3D floor aim outline)
  const kbAimRef = useRef<{
    slot: AbilitySlot;
    code: string;
    holdMode: boolean;
    cancelled: boolean;
    aimX: number;
    aimZ: number;
    timer: ReturnType<typeof setTimeout> | null;
  } | null>(null);

  const myActor = snapshot?.actors.find((a) => a.playerId === playerId) ?? null;
  const mySpec = myActor ? FIGHTER_BY_ID[myActor.fighterId] : FIGHTER_BY_ID.jm;
  const showSecretSolar = Boolean(
    myActor && myActor.fighterId === 'jm' && isJtinsullenTag(myActor.name)
  );

  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const targetIdRef = useRef(targetId);
  targetIdRef.current = targetId;
  const lockOnEnabledRef = useRef(lockOnEnabled);
  lockOnEnabledRef.current = lockOnEnabled;
  const myActorRef = useRef(myActor);
  myActorRef.current = myActor;
  const showSecretSolarRef = useRef(showSecretSolar);
  showSecretSolarRef.current = showSecretSolar;
  const onCastAbilityRef = useRef(onCastAbility);
  onCastAbilityRef.current = onCastAbility;
  const onAimUpdateRef = useRef(onAimUpdate);
  onAimUpdateRef.current = onAimUpdate;
  const isHost = room.hostId === playerId;
  const activeClash = snapshot?.activeClash ?? null;
  const clashInvolvesMe =
    activeClash && (activeClash.playerAId === playerId || activeClash.playerBId === playerId);
  const myClashChoice =
    clashInvolvesMe && activeClash
      ? activeClash.playerAId === playerId
        ? activeClash.choiceA
        : activeClash.choiceB
      : null;
  const activeHeadlock = snapshot?.activeHeadlock ?? null;
  const headlockInvolvesMe =
    activeHeadlock && (activeHeadlock.grabberId === playerId || activeHeadlock.victimId === playerId);

  // Smooth delayed white HP damage trail + impact shake when taking a hit
  useEffect(() => {
    if (!myActor) return;
    if (prevHpRef.current !== null && myActor.hp < prevHpRef.current - 2) {
      setHpShakeKey((k) => k + 1);
    }
    prevHpRef.current = myActor.hp;

    if (myActor.hp > trailHp) {
      setTrailHp(myActor.hp);
      return;
    }
    if (myActor.hp < trailHp) {
      const t = setTimeout(() => {
        setTrailHp((prev) => Math.max(myActor.hp, prev - Math.max(1, (prev - myActor.hp) * 0.25)));
      }, 65);
      return () => clearTimeout(t);
    }
  }, [myActor?.hp, trailHp]);

  // Responsive viewport detection (including visualViewport for mobile keyboard/toolbar transitions)
  useEffect(() => {
    const check = () => {
      const vw = window.visualViewport?.width ?? window.innerWidth;
      const vh = window.visualViewport?.height ?? window.innerHeight;
      setIsCompactScreen(vw < 900 || vh < 540);
      setIsNarrowPortrait(vw < 430);
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    window.visualViewport?.addEventListener('resize', check);
    document.addEventListener('fullscreenchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
      window.visualViewport?.removeEventListener('resize', check);
      document.removeEventListener('fullscreenchange', check);
    };
  }, []);

  const computeKeyboardAimCoords = (slot: AbilitySlot) => {
    const actor = snapshotRef.current?.actors.find((a) => a.playerId === playerId);
    if (!actor) return null;
    const ab = getAbilitySpec(actor.fighterId, slot);
    const aimRange = ab.aimRange ?? 8.5;
    const yaw = cameraYawRef.current;
    const dirX = Math.sin(yaw);
    const dirZ = Math.cos(yaw);
    let reach = ab.aimKind === 'point' ? Math.min(aimRange, 6.2) : aimRange;

    if (ab.aimKind === 'point' && lockOnEnabledRef.current && targetIdRef.current) {
      const tgt = snapshotRef.current?.actors.find(
        (a) => a.playerId === targetIdRef.current && !a.isKO
      );
      if (tgt) {
        const dist = Math.hypot(tgt.x - actor.x, tgt.z - actor.z);
        reach = Math.max(1.5, Math.min(aimRange, dist));
      }
    }

    return {
      actor,
      ab,
      aimRange,
      aimX: actor.x + dirX * reach,
      aimZ: actor.z + dirZ * reach,
    };
  };

  const cancelActiveAim = () => {
    if (aimGestureRef.current) {
      if (aimGestureRef.current.timer) clearTimeout(aimGestureRef.current.timer);
      aimGestureRef.current = null;
      setAimOverlay(null);
    }
    if (kbAimRef.current) {
      if (kbAimRef.current.timer) clearTimeout(kbAimRef.current.timer);
      kbAimRef.current.cancelled = true;
      kbAimRef.current.holdMode = false;
    }
    if (aimPreviewRef) {
      aimPreviewRef.current.active = false;
      aimPreviewRef.current.cancelled = false;
    }
  };

  useEffect(() => {
    if (cancelAimTriggerSeq > 0) {
      cancelActiveAim();
    }
  }, [cancelAimTriggerSeq]);

  // Reset all active touch/keyboard holds on blur, visibility loss, KO, or leaving combat
  const releaseAllControlsRef = useRef<(sendNeutral?: boolean) => void>(() => {});
  releaseAllControlsRef.current = (sendNeutral = true) => {
    if (joyPointerId.current !== null || joyVec.current.x !== 0 || joyVec.current.y !== 0) {
      joyPointerId.current = null;
      joyVec.current = { x: 0, y: 0 };
      setKnobOffset({ x: 0, y: 0 });
    }
    keysPressed.current.clear();
    if (blockPointerId.current !== null) {
      blockPointerId.current = null;
      onBlockHoldChange(false);
    }
    jumpPointerId.current = null;
    attackPointerId.current = null;
    if (kbAimRef.current?.timer) clearTimeout(kbAimRef.current.timer);
    kbAimRef.current = null;
    cancelActiveAim();
    if (sendNeutral) {
      onMoveInput(0, 0);
      onBlockHoldChange(false);
    }
  };

  useEffect(() => {
    if (room.phase !== 'combat' || myActor?.isKO) {
      releaseAllControlsRef.current(true);
    }
  }, [room.phase, myActor?.isKO]);

  // Global pointerup/pointercancel/blur safety net so lost mobile touches NEVER stay stuck
  useEffect(() => {
    const onGlobalPointerEnd = (e: PointerEvent) => {
      if (joyPointerId.current === e.pointerId) {
        joyPointerId.current = null;
        joyVec.current = { x: 0, y: 0 };
        setKnobOffset({ x: 0, y: 0 });
        onMoveInput(0, 0);
      }
      if (blockPointerId.current === e.pointerId) {
        blockPointerId.current = null;
        onBlockHoldChange(false);
      }
      if (jumpPointerId.current === e.pointerId) {
        jumpPointerId.current = null;
      }
      if (attackPointerId.current === e.pointerId) {
        attackPointerId.current = null;
      }
      if (aimGestureRef.current?.pointerId === e.pointerId) {
        const g = aimGestureRef.current;
        if (g.timer) clearTimeout(g.timer);
        aimGestureRef.current = null;
        setAimOverlay(null);
        if (aimPreviewRef) aimPreviewRef.current.active = false;
        if (e.type !== 'pointercancel' && !g.cancelled) {
          if (g.holdMode) {
            onCastAbility(g.slot, false, { aimX: g.aimX, aimZ: g.aimZ, isHoldVariant: true });
          } else {
            onCastAbility(g.slot, false);
          }
        }
      }
    };
    const onWindowBlur = () => releaseAllControlsRef.current(true);
    const onVisChange = () => {
      if (document.hidden) releaseAllControlsRef.current(true);
    };

    window.addEventListener('pointerup', onGlobalPointerEnd);
    window.addEventListener('pointercancel', onGlobalPointerEnd);
    window.addEventListener('blur', onWindowBlur);
    document.addEventListener('visibilitychange', onVisChange);
    return () => {
      window.removeEventListener('pointerup', onGlobalPointerEnd);
      window.removeEventListener('pointercancel', onGlobalPointerEnd);
      window.removeEventListener('blur', onWindowBlur);
      document.removeEventListener('visibilitychange', onVisChange);
    };
  }, [aimPreviewRef, onBlockHoldChange, onCastAbility, onMoveInput]);

  // Stream movement vector at 25Hz
  useEffect(() => {
    const computeAndSend = () => {
      if (room.phase !== 'combat' || myActor?.isKO) return;
      let sx = joyVec.current.x;
      let sy = joyVec.current.y;

      const keys = keysPressed.current;
      let kx = 0;
      let ky = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) kx -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) kx += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) ky -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) ky += 1;
      if (kx !== 0 || ky !== 0) {
        const len = Math.hypot(kx, ky);
        sx = kx / len;
        sy = ky / len;
      }

      const yaw = cameraYawRef.current;
      const forward = -sy;
      const right = sx;
      const moveX = forward * Math.sin(yaw) + right * -Math.cos(yaw);
      const moveZ = forward * Math.cos(yaw) + right * Math.sin(yaw);
      onMoveInput(moveX, moveZ);

      const ka = kbAimRef.current;
      if (ka && ka.holdMode && !ka.cancelled) {
        const coords = computeKeyboardAimCoords(ka.slot);
        if (coords) {
          ka.aimX = coords.aimX;
          ka.aimZ = coords.aimZ;
          if (aimPreviewRef) {
            aimPreviewRef.current = {
              active: true,
              cancelled: false,
              aimKind: coords.ab.aimKind ?? 'point',
              originX: coords.actor.x,
              originY: coords.actor.y,
              originZ: coords.actor.z,
              aimX: coords.aimX,
              aimZ: coords.aimZ,
              radius: coords.ab.aimRadius ?? 3.0,
              range: coords.aimRange,
              colorHex: ka.slot === 5 ? 0xfacc15 : FIGHTER_BY_ID[coords.actor.fighterId].hex,
            };
          }
          if (
            ka.slot === 5 &&
            coords.actor.actionState === 'ultimate' &&
            coords.actor.abilitySlot === 5 &&
            onAimUpdateRef.current
          ) {
            onAimUpdateRef.current(coords.aimX, coords.aimZ);
          }
        }
      }
    };

    const id = setInterval(computeAndSend, 40);
    return () => clearInterval(id);
  }, [room.phase, myActor?.isKO, cameraYawRef, aimPreviewRef, onMoveInput]);

  const triggerM1 = (shiftHeld = false) => {
    if (!myActor || myActor.isKO) return;
    if (clashInvolvesMe && activeClash && !myClashChoice) {
      onClashPick(activeClash.id, 'strike');
      return;
    }
    onCastAbility(0, shiftHeld);
  };

  const triggerM1Ref = useRef(triggerM1);
  triggerM1Ref.current = triggerM1;

  // Keyboard shortcuts (WASD move, Space Jump, R JM Sky Flight, Shift/C Dash, Tab Lock-On, J/1 M1, F/E Grab+Headlock Mash, K/2 Guard, Q/3 Skill1, U/4/L Skill2, I/5 Ult, O/6 Secret)
  useEffect(() => {
    const startKeyboardAimOrCast = (slot: AbilitySlot, code: string) => {
      const actor = myActorRef.current;
      if (!actor || actor.isKO) return;
      const isStage2 = slot === 3 && actor.stage2Slot === 3 && (actor.stage2Timer ?? 0) > 0;
      const ab = getAbilitySpec(actor.fighterId, slot);
      const supportsAim = !isStage2 && Boolean(ab.aimKind && ab.aimKind !== 'none');
      if (!supportsAim) {
        onCastAbilityRef.current(slot);
        return;
      }

      if (kbAimRef.current?.timer) clearTimeout(kbAimRef.current.timer);
      const init = computeKeyboardAimCoords(slot);
      const initAimX = init?.aimX ?? actor.x + Math.sin(actor.rotY) * (ab.aimRange ?? 8.0);
      const initAimZ = init?.aimZ ?? actor.z + Math.cos(actor.rotY) * (ab.aimRange ?? 8.0);

      const timer = setTimeout(() => {
        const cur = kbAimRef.current;
        if (!cur || cur.code !== code || cur.cancelled) return;
        cur.holdMode = true;
        const fresh = computeKeyboardAimCoords(slot);
        if (fresh) {
          cur.aimX = fresh.aimX;
          cur.aimZ = fresh.aimZ;
          if (aimPreviewRef) {
            aimPreviewRef.current = {
              active: true,
              cancelled: false,
              aimKind: fresh.ab.aimKind ?? 'point',
              originX: fresh.actor.x,
              originY: fresh.actor.y,
              originZ: fresh.actor.z,
              aimX: fresh.aimX,
              aimZ: fresh.aimZ,
              radius: fresh.ab.aimRadius ?? 3.0,
              range: fresh.aimRange,
              colorHex: slot === 5 ? 0xfacc15 : FIGHTER_BY_ID[fresh.actor.fighterId].hex,
            };
          }
        }
      }, 150);

      kbAimRef.current = {
        slot,
        code,
        holdMode: false,
        cancelled: false,
        aimX: initAimX,
        aimZ: initAimZ,
        timer,
      };
    };

    const releaseKeyboardAim = (code: string) => {
      const cur = kbAimRef.current;
      if (!cur || cur.code !== code) return;
      if (cur.timer) clearTimeout(cur.timer);
      const slot = cur.slot;
      const holdMode = cur.holdMode;
      const cancelled = cur.cancelled;
      const aimX = cur.aimX;
      const aimZ = cur.aimZ;
      kbAimRef.current = null;
      if (aimPreviewRef) {
        aimPreviewRef.current.active = false;
        aimPreviewRef.current.cancelled = false;
      }
      if (cancelled) return;
      if (holdMode) {
        onCastAbilityRef.current(slot, false, { aimX, aimZ, isHoldVariant: true });
      } else {
        onCastAbilityRef.current(slot, false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      keysPressed.current.add(e.code);
      if (room.phase !== 'combat') return;

      if (clashInvolvesMe && activeClash && !myClashChoice) {
        if (e.code === 'KeyJ' || e.code === 'Digit1') {
          onClashPick(activeClash.id, 'strike');
          return;
        }
        if (e.code === 'KeyF' || e.code === 'KeyE') {
          onClashPick(activeClash.id, 'grab');
          return;
        }
        if (e.code === 'KeyK' || e.code === 'Digit2') {
          onClashPick(activeClash.id, 'parry');
          return;
        }
      }

      if (e.code === 'Escape') {
        cancelActiveAim();
      } else if (e.code === 'Tab') {
        e.preventDefault();
        onToggleLockOn();
      } else if (e.code === 'Space') {
        e.preventDefault();
        onJump();
      } else if (e.code === 'KeyR') {
        if (myActorRef.current?.fighterId === 'jm') {
          onToggleFlight();
        }
      } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyC') {
        e.preventDefault();
        cancelActiveAim();
        onDash();
      } else if (e.code === 'KeyJ' || e.code === 'Digit1') {
        triggerM1Ref.current(e.shiftKey);
      } else if (e.code === 'KeyF' || e.code === 'KeyE') {
        onGrab();
      } else if (e.code === 'KeyK' || e.code === 'Digit2') {
        onBlockHoldChange(true);
        onCastAbilityRef.current(1);
      } else if (e.code === 'KeyQ' || e.code === 'Digit3') {
        startKeyboardAimOrCast(2, e.code);
      } else if (e.code === 'KeyU' || e.code === 'Digit4' || e.code === 'KeyL') {
        startKeyboardAimOrCast(3, e.code);
      } else if (e.code === 'KeyI' || e.code === 'Digit5') {
        startKeyboardAimOrCast(4, e.code);
      } else if ((e.code === 'KeyO' || e.code === 'Digit6') && showSecretSolarRef.current) {
        startKeyboardAimOrCast(5, e.code);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.code);
      if (e.code === 'KeyK' || e.code === 'Digit2') {
        onBlockHoldChange(false);
      }
      if (
        e.code === 'KeyQ' ||
        e.code === 'Digit3' ||
        e.code === 'KeyU' ||
        e.code === 'Digit4' ||
        e.code === 'KeyL' ||
        e.code === 'KeyI' ||
        e.code === 'Digit5' ||
        e.code === 'KeyO' ||
        e.code === 'Digit6'
      ) {
        releaseKeyboardAim(e.code);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [
    room.phase,
    clashInvolvesMe,
    activeClash,
    myClashChoice,
    aimPreviewRef,
    onToggleLockOn,
    onJump,
    onToggleFlight,
    onDash,
    onGrab,
    onClashPick,
    onBlockHoldChange,
  ]);

  const maxJoyRadius = isNarrowPortrait ? 28 : isCompactScreen ? 34 : 46;

  const handleJoyDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (joyPointerId.current !== null) return;
    soundEngine.unlock();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore synthetic pointer
    }
    joyPointerId.current = e.pointerId;
    const rect = e.currentTarget.getBoundingClientRect();
    joyCenter.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    updateJoy(e.clientX, e.clientY);
  };

  const updateJoy = (cx: number, cy: number) => {
    const dx = cx - joyCenter.current.x;
    const dy = cy - joyCenter.current.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, maxJoyRadius);
    const nx = dist > 0.01 ? (dx / dist) * (clamped / maxJoyRadius) : 0;
    const ny = dist > 0.01 ? (dy / dist) * (clamped / maxJoyRadius) : 0;
    joyVec.current = { x: nx, y: ny };
    setKnobOffset({ x: nx * maxJoyRadius, y: ny * maxJoyRadius });
  };

  const handleJoyMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerId.current !== e.pointerId) return;
    updateJoy(e.clientX, e.clientY);
  };

  const handleJoyUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerId.current !== e.pointerId) return;
    joyPointerId.current = null;
    joyVec.current = { x: 0, y: 0 };
    setKnobOffset({ x: 0, y: 0 });
    onMoveInput(0, 0);
  };

  // Hold-Drag vs Tap aiming helpers for Slots 3, 4 & Secret Slot 5
  const lastAimUpdateSentRef = useRef<number>(0);
  const updateAimGestureCoords = (clientX: number, clientY: number) => {
    const g = aimGestureRef.current;
    const actor = snapshot?.actors.find((a) => a.playerId === playerId);
    if (!g || !actor) return;
    const ab = getAbilitySpec(actor.fighterId, g.slot);
    const maxR = 52;
    const dx = clientX - g.cx;
    const dy = clientY - g.cy;
    const dist = Math.hypot(dx, dy);
    g.maxDragDist = Math.max(g.maxDragDist, dist);

    const clampedDist = Math.min(dist, maxR);
    const kx = dist > 0.1 ? (dx / dist) * clampedDist : 0;
    const ky = dist > 0.1 ? (dy / dist) * clampedDist : 0;
    if (aimKnobRef.current) {
      aimKnobRef.current.style.transform = `translate(${kx}px, ${ky}px)`;
    }

    const nowCancelled = g.maxDragDist >= 24 && dist < 12;
    if (nowCancelled !== g.cancelled) {
      g.cancelled = nowCancelled;
      setAimOverlay((prev) => (prev ? { ...prev, cancelled: nowCancelled } : prev));
    }

    const aimRange = ab.aimRange ?? 8.5;
    if (dist >= 12) {
      const mag = Math.min(1, dist / maxR);
      const nx = dx / dist;
      const ny = dy / dist;
      const yaw = cameraYawRef.current;
      const forward = -ny;
      const right = nx;
      const wx = forward * Math.sin(yaw) + right * -Math.cos(yaw);
      const wz = forward * Math.cos(yaw) + right * Math.sin(yaw);
      const reach = ab.aimKind === 'point' ? aimRange * mag : aimRange;
      g.aimX = actor.x + wx * reach;
      g.aimZ = actor.z + wz * reach;
    } else {
      const defaultDist = ab.aimKind === 'point' ? 3.2 : aimRange;
      g.aimX = actor.x + Math.sin(actor.rotY) * defaultDist;
      g.aimZ = actor.z + Math.cos(actor.rotY) * defaultDist;
    }

    if (
      g.slot === 5 &&
      actor.actionState === 'ultimate' &&
      actor.abilitySlot === 5 &&
      onAimUpdate &&
      performance.now() - lastAimUpdateSentRef.current >= 45
    ) {
      lastAimUpdateSentRef.current = performance.now();
      onAimUpdate(g.aimX, g.aimZ);
    }

    if (aimPreviewRef) {
      aimPreviewRef.current = {
        active: g.holdMode,
        cancelled: g.cancelled,
        aimKind: ab.aimKind ?? 'point',
        originX: actor.x,
        originY: actor.y,
        originZ: actor.z,
        aimX: g.aimX,
        aimZ: g.aimZ,
        radius: ab.aimRadius ?? 3.0,
        range: aimRange,
        colorHex: g.slot === 5 ? 0xfacc15 : FIGHTER_BY_ID[actor.fighterId].hex,
      };
    }
  };

  const handleAbilityPointerDown = (slot: AbilitySlot, e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    soundEngine.unlock();
    const actor = snapshot?.actors.find((a) => a.playerId === playerId);
    const isStage2 = slot === 3 && actor?.stage2Slot === 3 && (actor?.stage2Timer ?? 0) > 0;
    const ab = actor ? getAbilitySpec(actor.fighterId, slot) : null;
    const supportsAim =
      !isStage2 && (slot === 2 || slot === 3 || slot === 4 || slot === 5) && ab?.aimKind && ab.aimKind !== 'none';

    if (!supportsAim || !actor) {
      onCastAbility(slot);
      return;
    }

    if (aimGestureRef.current?.timer) {
      clearTimeout(aimGestureRef.current.timer);
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore synthetic pointer
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const defaultDist = ab.aimKind === 'point' ? 3.2 : ab.aimRange ?? 9.0;
    const initAimX = actor.x + Math.sin(actor.rotY) * defaultDist;
    const initAimZ = actor.z + Math.cos(actor.rotY) * defaultDist;

    const enterHold = () => {
      const g = aimGestureRef.current;
      if (!g || g.holdMode) return;
      g.holdMode = true;
      setAimOverlay({
        slot,
        label: ab.holdAimLabel ?? ab.name,
        cancelled: g.cancelled,
        cx,
        cy,
      });
      if (aimPreviewRef) {
        aimPreviewRef.current = {
          active: true,
          cancelled: g.cancelled,
          aimKind: ab.aimKind ?? 'point',
          originX: actor.x,
          originY: actor.y,
          originZ: actor.z,
          aimX: g.aimX,
          aimZ: g.aimZ,
          radius: ab.aimRadius ?? 3.0,
          range: ab.aimRange ?? 8.5,
          colorHex: slot === 5 ? 0xfacc15 : FIGHTER_BY_ID[actor.fighterId].hex,
        };
      }
    };

    const timer = setTimeout(enterHold, 165);
    aimGestureRef.current = {
      slot,
      pointerId: e.pointerId,
      cx,
      cy,
      holdMode: false,
      maxDragDist: 0,
      cancelled: false,
      aimX: initAimX,
      aimZ: initAimZ,
      timer,
    };
  };

  const handleAbilityPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const g = aimGestureRef.current;
    if (!g || g.pointerId !== e.pointerId) return;
    const dist = Math.hypot(e.clientX - g.cx, e.clientY - g.cy);
    if (!g.holdMode && dist >= 12) {
      if (g.timer) {
        clearTimeout(g.timer);
        g.timer = null;
      }
      g.holdMode = true;
      const actor = snapshot?.actors.find((a) => a.playerId === playerId);
      const ab = actor ? getAbilitySpec(actor.fighterId, g.slot) : null;
      setAimOverlay({
        slot: g.slot,
        label: ab?.holdAimLabel ?? ab?.name ?? 'Aim',
        cancelled: g.cancelled,
        cx: g.cx,
        cy: g.cy,
      });
    }
    updateAimGestureCoords(e.clientX, e.clientY);
  };

  const handleAbilityPointerUp = (e: React.PointerEvent<HTMLButtonElement>, isCancel = false) => {
    const g = aimGestureRef.current;
    if (!g || g.pointerId !== e.pointerId) return;
    if (g.timer) {
      clearTimeout(g.timer);
      g.timer = null;
    }
    aimGestureRef.current = null;
    setAimOverlay(null);
    if (aimPreviewRef) {
      aimPreviewRef.current.active = false;
    }
    if (isCancel || g.cancelled) return;
    if (g.holdMode) {
      onCastAbility(g.slot, false, {
        aimX: g.aimX,
        aimZ: g.aimZ,
        isHoldVariant: true,
      });
    } else {
      onCastAbility(g.slot, false);
    }
  };

  const cycleTarget = () => {
    if (!snapshot) return;
    const enemies = snapshot.actors.filter((a) => a.playerId !== playerId && !a.isKO);
    if (enemies.length === 0) {
      onSelectTarget(null);
      return;
    }
    const idx = enemies.findIndex((e) => e.playerId === targetId);
    const next = enemies[(idx + 1) % enemies.length];
    onSelectTarget(next.playerId);
  };

  const actors = snapshot?.actors ?? [];
  const otherActors = actors.filter((a) => a.playerId !== playerId);
  const winnerActor = room.winnerId ? actors.find((a) => a.playerId === room.winnerId) : null;

  const myHpPct = myActor ? Math.max(0, Math.min(100, (myActor.hp / myActor.maxHp) * 100)) : 100;
  const myTrailPct = myActor ? Math.max(myHpPct, Math.min(100, (trailHp / myActor.maxHp) * 100)) : 100;
  const myMpPct = myActor ? Math.max(0, Math.min(100, (myActor.mana / myActor.maxMana) * 100)) : 100;
  const myStamPct = myActor ? Math.max(0, Math.min(100, (myActor.stamina / myActor.maxStamina) * 100)) : 100;
  const myStagPct = myActor ? Math.max(0, Math.min(100, myActor.stagger)) : 0;
  const passiveInfo = myActor ? getPassiveSummary(myActor) : null;
  const battleEvent = snapshot?.battleEvent ?? null;

  const isFourHitCombo =
    myActor?.fighterId === 'jm' || myActor?.fighterId === 'prime' || myActor?.fighterId === 'khen';
  const m1NextStep = myActor
    ? isFourHitCombo
      ? ((myActor.comboStep % 4) + 1) as 1 | 2 | 3 | 4
      : 1
    : 1;
  const m1ActiveName =
    myActor?.fighterId === 'jm' && myActor.isFlying
      ? 'BOLT'
      : mySpec.m1Combo.stepNames[(m1NextStep - 1) % mySpec.m1Combo.stepNames.length].split(' ')[0];
  const m1SubLabel =
    myActor?.fighterId === 'jm' && myActor.isFlying
      ? 'AIR SHOT'
      : myActor?.fighterId === 'marjohn'
      ? 'MID TORNADO'
      : myActor?.fighterId === 'damen'
      ? '0.6s SHOT'
      : m1NextStep === 4
      ? 'FINISHER 4/4'
      : `HIT ${m1NextStep}/4`;

  const comboHits = myActor?.comboCount ?? 0;
  const comboMultiplier = 1 + Math.min(1.5, comboHits * 0.1);
  const comboTimeLeft = myActor?.comboResetRemaining ?? 0;
  const comboTimerPct = comboHits > 0 ? Math.max(0, Math.min(100, (comboTimeLeft / 2.0) * 100)) : 0;
  const isFrenzyMode = Boolean(myActor?.frenzyInside || battleEvent?.kind === 'frenzy');
  const roundWinnerPlayer = room.roundWinnerId
    ? room.players.find((p) => p.playerId === room.roundWinnerId) ?? null
    : null;
  const nextMapSpec = MAP_BY_ID[room.mapId];
  const matchTime = snapshot?.matchTime ?? 0;
  const stormActive = Boolean(snapshot?.stormActive);
  const stormRadius = snapshot?.stormRadius ?? 22;
  const ringInSec = Math.max(0, Math.ceil(120 - matchTime));
  const ringCountdownLabel = `${Math.floor(ringInSec / 60)}:${String(ringInSec % 60).padStart(2, '0')}`;

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="fixed inset-0 w-full h-[100dvh] z-10 pointer-events-none select-none overflow-hidden flex flex-col justify-between p-1.5 sm:p-3 safe-area-pad"
    >
      {/* DIRECTIONAL HIT-FLASH VIGNETTE */}
      {hitFlash && (
        <div
          key={hitFlash.id}
          className="fixed inset-0 z-20 pointer-events-none animate-hit-flash"
          style={{
            background:
              hitFlash.direction === 'left'
                ? 'linear-gradient(90deg, rgba(244,63,94,0.68) 0%, transparent 32%)'
                : hitFlash.direction === 'right'
                ? 'linear-gradient(270deg, rgba(244,63,94,0.68) 0%, transparent 32%)'
                : hitFlash.direction === 'top'
                ? 'linear-gradient(180deg, rgba(244,63,94,0.62) 0%, transparent 30%)'
                : hitFlash.direction === 'bottom'
                ? 'linear-gradient(0deg, rgba(244,63,94,0.62) 0%, transparent 30%)'
                : 'radial-gradient(circle, transparent 52%, rgba(244,63,94,0.62) 100%)',
          }}
        />
      )}

      {/* COMPACT FLOATING DAMAGE NUMBERS (Small, Crisp, Fast-Fading, Offset) */}
      {damagePopups.map((p) => (
        <div
          key={p.id}
          className="fixed z-25 pointer-events-none animate-dmg-float flex flex-col items-center"
          style={{ left: `${p.xPct}%`, top: `${p.yPct}%` }}
        >
          {p.label && (
            <span
              className="font-display font-bold text-[8px] sm:text-[9px] tracking-wider px-1 py-0.2 rounded bg-slate-950/85 uppercase whitespace-nowrap"
              style={{ color: p.color }}
            >
              {p.label}
            </span>
          )}
          {p.amount > 0 && (
            <span
              className={`font-display font-bold font-mono-num drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] ${
                p.isBig ? 'text-sm sm:text-base text-amber-300' : 'text-xs sm:text-sm text-white'
              }`}
            >
              -{p.amount}
            </span>
          )}
        </div>
      ))}

      {/* TOP BAR: ANIME PLAYER VITALS + ENEMIES + QUICK CONTROLS */}
      <div className="w-full flex items-start justify-between gap-1.5 sm:gap-2 pointer-events-none">
        <div className="flex items-start gap-1.5 flex-1 min-w-0 pointer-events-auto">
          {/* Anime Player Vitals Card + Persistent Combo Counter */}
          {myActor && (
            <div className="flex flex-col gap-1.5 shrink-0">
              <div
                key={hpShakeKey}
                className={`rounded-xl bg-slate-950/90 border shadow-2xl ${
                  hpShakeKey > 0 ? 'animate-hp-shake' : ''
                } ${
                  myActor.isOverdrive
                    ? 'border-rose-500 ring-1 ring-rose-400/60'
                    : myActor.isStunned
                    ? 'border-amber-400 ring-1 ring-amber-300/60'
                    : 'border-slate-700/90'
                } ${isCompactScreen ? 'w-[168px] px-2 py-1' : 'w-[234px] sm:w-[264px] px-2.5 py-1.5'}`}
              >
                <div className="flex items-center justify-between gap-1 text-[10px] sm:text-xs">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="font-display font-bold tracking-wide truncate" style={{ color: mySpec.color }}>
                      {mySpec.name}
                    </span>
                    {!room.isSoloPractice && !room.isTrainingMode && (
                      <span
                        className="flex items-center gap-0.5 shrink-0"
                        title={`Round Wins: ${myActor.wins}/${room.winsToWin}`}
                      >
                        {Array.from({ length: room.winsToWin }).map((_, idx) => (
                          <span
                            key={idx}
                            className={`w-1.5 h-1.5 rounded-xs rotate-45 border ${
                              idx < myActor.wins
                                ? 'bg-amber-400 border-amber-200'
                                : 'bg-slate-800 border-slate-600'
                            }`}
                          />
                        ))}
                      </span>
                    )}
                    {myActor.isOverdrive && (
                      <span className="px-1 rounded bg-rose-500 text-white font-display font-bold text-[8px] flex items-center gap-0.5">
                        <Flame className="w-2.5 h-2.5" />
                        OD
                      </span>
                    )}
                    {myActor.isStunned && (
                      <span className="px-1 rounded bg-amber-300 text-slate-950 font-bold text-[8px]">STUN</span>
                    )}
                    {!myActor.isStunned && myActor.whiffTimer > 0 && (
                      <span className="px-1 rounded bg-orange-500 text-slate-950 font-bold text-[8px]">OPEN</span>
                    )}
                    {myActor.superArmor && (
                      <span className="px-1 rounded bg-orange-400 text-slate-950 font-bold text-[8px]">ARMOR</span>
                    )}
                    {myActor.isFlying && (
                      <span className="px-1 rounded bg-amber-300 text-slate-950 font-bold text-[8px]">FLY</span>
                    )}
                    {(myActor.perfectEvadeTimer ?? 0) > 0 && (
                      <span className="px-1 rounded bg-emerald-400 text-slate-950 font-bold text-[8px]">EVADE</span>
                    )}
                    {myActor.parryWindow && (
                      <span className="px-1 rounded bg-amber-300 text-slate-950 font-bold text-[8px]">PARRY</span>
                    )}
                    {!myActor.parryWindow && myActor.shieldActive && (
                      <span className="px-1 rounded bg-sky-400 text-slate-950 font-bold text-[8px]">GUARD</span>
                    )}
                  </div>
                  <span className="font-mono-num font-bold text-white shrink-0">
                    {myActor.hp}/{myActor.maxHp}
                  </span>
                </div>

                {/* Skewed Anime HP Bar + Delayed White Damage Trail */}
                <div className="relative h-2.5 sm:h-3 w-full bg-slate-800 rounded-sm overflow-hidden my-1 -skew-x-6 border border-slate-700/80">
                  <div
                    className="absolute inset-y-0 left-0 bg-white/85 transition-all duration-150"
                    style={{ width: `${myTrailPct}%` }}
                  />
                  <div
                    className="relative h-full transition-all duration-75"
                    style={{
                      width: `${myHpPct}%`,
                      backgroundColor:
                        myActor.isOverdrive
                          ? '#f43f5e'
                          : myHpPct > 55
                          ? '#22c55e'
                          : myHpPct > 28
                          ? '#f59e0b'
                          : '#f43f5e',
                    }}
                  />
                </div>

                {/* Stamina + Chi Dual Resource Bars */}
                <div className="grid grid-cols-2 gap-1.5 items-center">
                  <div className="flex items-center gap-1">
                    <div className="h-1.5 flex-1 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className="h-full transition-all duration-75"
                        style={{
                          width: `${myStamPct}%`,
                          backgroundColor: myStamPct < 20 ? '#f43f5e' : '#facc15',
                        }}
                      />
                    </div>
                    <span className="font-mono-num text-[8px] sm:text-[9px] font-bold text-amber-300 shrink-0">
                      {Math.round(myActor.stamina)}ST
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-1.5 flex-1 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className="h-full bg-sky-400 transition-all duration-75"
                        style={{ width: `${myMpPct}%` }}
                      />
                    </div>
                    <span className="font-mono-num text-[8px] sm:text-[9px] font-bold text-sky-300 shrink-0">
                      {Math.round(myActor.mana)}CHI
                    </span>
                  </div>
                </div>

                {/* Stagger Meter + Passive Readout */}
                <div className="mt-1 flex items-center justify-between gap-1.5 text-[8px] sm:text-[9px]">
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <span className="text-slate-400 font-semibold shrink-0">STAG</span>
                    <div className="h-1 flex-1 bg-slate-900 rounded-full overflow-hidden">
                      <div
                        className="h-full transition-all duration-75"
                        style={{
                          width: `${myStagPct}%`,
                          backgroundColor: myStagPct >= 75 ? '#f43f5e' : '#fb923c',
                        }}
                      />
                    </div>
                  </div>
                  {passiveInfo && (
                    <span
                      className={`font-semibold truncate ${
                        passiveInfo.active ? 'text-amber-300' : 'text-slate-400'
                      }`}
                    >
                      {passiveInfo.label}
                    </span>
                  )}
                </div>
              </div>

              {/* Persistent Combo Counter Widget (anchored below health bar during active combat) */}
              {room.phase === 'combat' && !myActor.isKO && (
                <div
                  className={`pointer-events-none rounded-xl border px-2.5 py-1.5 bg-slate-950/90 shadow-lg transition-colors ${
                    isCompactScreen ? 'w-[168px]' : 'w-[234px] sm:w-[264px]'
                  } ${
                    isFrenzyMode
                      ? 'border-rose-400/90 animate-frenzy-combo-pulse'
                      : comboHits >= 5
                      ? 'border-amber-400/85'
                      : comboHits >= 1
                      ? 'border-sky-400/75'
                      : 'border-slate-800/90'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <span
                        key={comboHits}
                        className={`font-display font-bold font-mono-num leading-none ${
                          comboHits > 0 ? 'animate-combo-pop' : ''
                        } ${
                          comboHits >= 8
                            ? 'text-lg sm:text-xl text-rose-400'
                            : comboHits >= 4
                            ? 'text-base sm:text-lg text-amber-300'
                            : comboHits >= 1
                            ? 'text-sm sm:text-base text-sky-300'
                            : 'text-xs sm:text-sm text-slate-400'
                        }`}
                      >
                        {comboMultiplier.toFixed(1)}×
                      </span>
                      <span className="font-display font-bold text-[10px] sm:text-xs text-white font-mono-num truncate">
                        {comboHits > 0 ? `${comboHits} HIT${comboHits > 1 ? 'S' : ''}` : 'COMBO'}
                      </span>
                    </div>
                    <span
                      className={`text-[9px] font-display font-bold uppercase tracking-wider shrink-0 ${
                        isFrenzyMode
                          ? 'text-rose-300'
                          : comboHits >= 8
                          ? 'text-rose-400'
                          : comboHits >= 4
                          ? 'text-amber-300'
                          : comboHits >= 1
                          ? 'text-sky-300'
                          : 'text-slate-500'
                      }`}
                    >
                      {isFrenzyMode
                        ? 'FRENZY PULSE'
                        : comboHits >= 8
                        ? 'MAX'
                        : comboHits >= 4
                        ? 'FURY'
                        : comboHits >= 1
                        ? `${comboTimeLeft.toFixed(1)}s`
                        : 'READY'}
                    </span>
                  </div>
                  <div className="mt-1 h-1 w-full bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all duration-75"
                      style={{
                        width: `${comboTimerPct}%`,
                        backgroundColor: isFrenzyMode
                          ? '#f43f5e'
                          : comboHits >= 5
                          ? '#facc15'
                          : '#38bdf8',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Opponent Compact Cards */}
          <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto no-scrollbar">
            {otherActors.map((a) => {
              const spec = FIGHTER_BY_ID[a.fighterId];
              const isTarget = a.playerId === targetId;
              const hpPct = Math.max(0, Math.round((a.hp / a.maxHp) * 100));
              const stagPct = Math.max(0, Math.min(100, a.stagger));
              return (
                <button
                  key={a.playerId}
                  type="button"
                  onClick={() => !a.isKO && onSelectTarget(a.playerId)}
                  className={`shrink-0 min-w-[84px] sm:min-w-[122px] max-w-[148px] rounded-lg px-2 py-1 border text-left transition cursor-pointer ${
                    a.isKO
                      ? 'bg-slate-950/60 border-slate-800 opacity-45'
                      : isTarget
                      ? 'bg-slate-950/90 border-rose-400 shadow-md'
                      : 'bg-slate-950/80 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 text-[9px] sm:text-[10px] leading-tight">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="font-bold text-white truncate">{a.name}</span>
                      {!room.isSoloPractice && !room.isTrainingMode && (
                        <span className="font-mono-num text-[8px] font-bold text-amber-300 shrink-0">
                          {a.wins}/{room.winsToWin}
                        </span>
                      )}
                    </div>
                    <span className="font-mono-num font-bold text-slate-200">{a.hp}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-sm overflow-hidden my-0.5">
                    <div
                      className="h-full transition-all duration-100"
                      style={{ width: `${hpPct}%`, backgroundColor: spec.color }}
                    />
                  </div>
                  <div className="h-0.5 w-full bg-slate-900 rounded-full overflow-hidden mb-0.5">
                    <div
                      className="h-full transition-all duration-100"
                      style={{
                        width: `${stagPct}%`,
                        backgroundColor: a.isStunned ? '#f43f5e' : '#facc15',
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[8px] leading-none">
                    <span className="font-display font-bold" style={{ color: spec.color }}>
                      {spec.name}
                    </span>
                    <span
                      className={`font-bold truncate ${
                        a.isStunned
                          ? 'text-amber-300'
                          : a.whiffTimer > 0
                          ? 'text-orange-400'
                          : a.isOverdrive
                          ? 'text-rose-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {a.isStunned
                        ? 'STUNNED!'
                        : a.whiffTimer > 0
                        ? 'OPEN!'
                        : a.isOverdrive
                        ? 'OVERDRIVE'
                        : a.damagePhase === 'SEVERELY DAMAGED'
                        ? 'SEV DMG'
                        : a.damagePhase}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Top-Right Quick Actions + Training Corner Toggles */}
        <div className="flex flex-col items-end gap-1.5 shrink-0 pointer-events-auto">
          <div className="flex items-center gap-1 sm:gap-1.5">
            {pingMs !== null && (
              <div className="hidden md:flex items-center px-2 py-1 rounded-lg bg-slate-950/85 border border-slate-800 font-mono-num text-[10px] font-bold text-emerald-400">
                {pingMs}ms
              </div>
            )}

            <FullscreenControls compact lockLandscape />

            <button
              type="button"
              onClick={onToggleLockOn}
              title="Toggle Camera Lock-On (Tab)"
              className={`min-h-[36px] min-w-[36px] px-2 rounded-lg border text-xs font-semibold flex items-center gap-1 cursor-pointer transition ${
                lockOnEnabled
                  ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                  : 'bg-slate-950/85 border-slate-700 text-slate-300'
              }`}
            >
              {lockOnEnabled ? <Lock className="w-3.5 h-3.5 text-sky-300" /> : <LockOpen className="w-3.5 h-3.5 text-slate-400" />}
              <span className="hidden sm:inline">{lockOnEnabled ? 'Lock' : 'Free'}</span>
            </button>

            <button
              type="button"
              onClick={cycleTarget}
              title="Switch Target"
              className="min-h-[36px] min-w-[36px] px-2 rounded-lg bg-slate-950/85 border border-slate-700 text-xs font-semibold text-slate-100 flex items-center gap-1 cursor-pointer"
            >
              <Crosshair className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">Target</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.unlock();
                setMuted(soundEngine.toggleMute());
              }}
              title="Toggle Audio"
              className="min-h-[36px] min-w-[36px] rounded-lg bg-slate-950/85 border border-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
            >
              {muted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
            </button>
          </div>

          {room.isTrainingMode && room.trainingConfig && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={!isHost}
                onClick={() => onTrainingConfig?.({ dummyEnabled: !room.trainingConfig?.dummyEnabled })}
                className={`px-2 py-1 rounded-lg border text-[10px] font-mono-num font-bold transition cursor-pointer ${
                  room.trainingConfig.dummyEnabled
                    ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                    : 'bg-slate-950/85 border-slate-700 text-slate-400'
                }`}
              >
                Dummy: {room.trainingConfig.dummyEnabled ? 'ON' : 'OFF'}
              </button>
              <button
                type="button"
                disabled={!isHost}
                onClick={() => onTrainingConfig?.({ zeroCooldowns: !room.trainingConfig?.zeroCooldowns })}
                className={`px-2 py-1 rounded-lg border text-[10px] font-mono-num font-bold transition cursor-pointer ${
                  room.trainingConfig.zeroCooldowns
                    ? 'bg-amber-400/25 border-amber-400 text-amber-200'
                    : 'bg-slate-950/85 border-slate-700 text-slate-400'
                }`}
              >
                Zero CD: {room.trainingConfig.zeroCooldowns ? 'ON' : 'OFF'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* TOP-EDGE RING TIMER & BATTLEFIELD EVENT BAR (Never Blocks Arena Center) */}
      {room.phase === 'combat' && (
        <div className="mx-auto pointer-events-none flex flex-col items-center gap-1">
          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            {room.isTrainingMode ? (
              <div className="px-2.5 py-0.5 rounded-lg border bg-emerald-950/85 border-emerald-500/60 font-mono-num text-[10px] sm:text-xs font-bold text-emerald-200 shadow">
                TRAINING AREA · {MAP_BY_ID[room.mapId].name.toUpperCase()}
              </div>
            ) : (
              <div
                className={`px-2.5 py-0.5 rounded-lg border font-mono-num text-[10px] sm:text-xs font-bold shadow ${
                  stormActive
                    ? 'bg-rose-950/92 border-rose-500 text-rose-200 animate-pulse'
                    : ringInSec <= 15
                    ? 'bg-amber-950/90 border-amber-400 text-amber-300'
                    : 'bg-slate-950/80 border-slate-800 text-slate-200'
                }`}
              >
                {stormActive
                  ? `STORM · ${Math.round(stormRadius)}m`
                  : `RING ${ringCountdownLabel}`}
              </div>
            )}

            {!room.isSoloPractice && !room.isTrainingMode && !battleEvent && (
              <div className="text-[10px] sm:text-xs font-mono-num font-semibold text-slate-200/90 bg-slate-950/75 border border-slate-800 px-2.5 py-0.5 rounded-lg">
                R{room.roundNumber} · {MAP_BY_ID[room.mapId].name} · FT{room.winsToWin}
              </div>
            )}
          </div>

          {battleEvent && (
            <div
              className="px-2.5 py-0.5 rounded-lg bg-slate-950/88 border text-center shadow-lg flex items-center gap-2"
              style={{ borderColor: `#${battleEvent.colorHex.toString(16).padStart(6, '0')}` }}
            >
              <span
                className="font-display font-bold text-[10px] tracking-wider uppercase"
                style={{ color: `#${battleEvent.colorHex.toString(16).padStart(6, '0')}` }}
              >
                {battleEvent.title}
              </span>
              <span className="font-mono-num text-[10px] font-bold text-white">
                {(battleEvent.telegraphRemaining > 0
                  ? battleEvent.telegraphRemaining
                  : battleEvent.remaining
                ).toFixed(1)}
                s
              </span>
            </div>
          )}
        </div>
      )}

      {/* COMPACT BOTTOM-CENTER 3-SECOND INTERACTIVE HEADLOCK STRUGGLE METER */}
      {room.phase === 'combat' && headlockInvolvesMe && activeHeadlock && (() => {
        const isGrabber = activeHeadlock.grabberId === playerId;
        const myMashes = isGrabber ? activeHeadlock.grabberMashes : activeHeadlock.victimMashes;
        const foeMashes = isGrabber ? activeHeadlock.victimMashes : activeHeadlock.grabberMashes;
        const pct = Math.max(0, Math.min(100, (activeHeadlock.remaining / Math.max(0.1, activeHeadlock.duration)) * 100));
        return (
          <div className="fixed bottom-24 sm:bottom-28 left-1/2 -translate-x-1/2 z-30 pointer-events-none w-[220px] sm:w-[270px] rounded-xl bg-slate-950/92 border border-amber-400 px-3 py-1.5 shadow-xl text-center">
            <div className="flex items-center justify-between text-[10px] font-display font-bold text-amber-300 uppercase">
              <span>{isGrabber ? 'HEADLOCK! MASH GRAB' : 'TRAPPED! MASH [F/E]'}</span>
              <span className="font-mono-num text-white">{activeHeadlock.remaining.toFixed(1)}s</span>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden my-1">
              <div className="h-full bg-amber-400 transition-all duration-75" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono-num font-bold">
              <span className={myMashes >= foeMashes ? 'text-emerald-300' : 'text-rose-300'}>YOU: {myMashes}</span>
              <span className="text-slate-400">VS</span>
              <span className="text-slate-200">FOE: {foeMashes}</span>
            </div>
          </div>
        );
      })()}

      {/* CLASH QTE SHOWDOWN OVERLAY */}
      {room.phase === 'combat' && clashInvolvesMe && activeClash && (
        <div className="fixed inset-0 z-40 pointer-events-auto bg-slate-950/55 flex items-center justify-center p-3">
          <div className="w-full max-w-md rounded-2xl bg-slate-950/95 border-2 border-amber-400 p-4 shadow-2xl text-center">
            <div className="font-display text-xs uppercase tracking-widest text-amber-300 font-bold">
              Ultimate Intercept · Rock-Paper-Scissors Clash
            </div>
            <h3 className="font-display text-2xl sm:text-3xl font-bold text-white mt-0.5">
              CLASH SHOWDOWN!
            </h3>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden my-2.5">
              <div
                className="h-full bg-amber-400 transition-all duration-75"
                style={{ width: `${Math.max(0, (activeClash.remaining / activeClash.maxTime) * 100)}%` }}
              />
            </div>

            {myClashChoice ? (
              <div className="py-3 font-display font-bold text-lg text-emerald-400">
                LOCKED IN: {myClashChoice.toUpperCase()} — RESOLVING...
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.unlock();
                    onClashPick(activeClash.id, 'strike');
                  }}
                  className="min-h-[60px] rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-display font-bold p-2 flex flex-col items-center justify-center cursor-pointer active:scale-95 transition"
                >
                  <Swords className="w-5 h-5 mb-0.5" />
                  <span className="text-xs sm:text-sm">STRIKE (J)</span>
                  <span className="text-[9px] text-rose-100">Beats Grab</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.unlock();
                    onClashPick(activeClash.id, 'grab');
                  }}
                  className="min-h-[60px] rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold p-2 flex flex-col items-center justify-center cursor-pointer active:scale-95 transition"
                >
                  <Hand className="w-5 h-5 mb-0.5" />
                  <span className="text-xs sm:text-sm">GRAB (F)</span>
                  <span className="text-[9px] text-slate-900">Beats Parry</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.unlock();
                    onClashPick(activeClash.id, 'parry');
                  }}
                  className="min-h-[60px] rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-display font-bold p-2 flex flex-col items-center justify-center cursor-pointer active:scale-95 transition"
                >
                  <Shield className="w-5 h-5 mb-0.5" />
                  <span className="text-xs sm:text-sm">PARRY (K)</span>
                  <span className="text-[9px] text-slate-900">Beats Strike</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* COUNTDOWN OVERLAY */}
      {room.phase === 'countdown' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center pointer-events-none bg-slate-950/35">
          <div className="text-center">
            <div className="text-xs font-semibold uppercase tracking-widest text-amber-300 mb-1">
              {room.isTrainingMode
                ? 'Training Area · Free Practice'
                : room.isSoloPractice
                ? 'Vs. Bot · Get Ready'
                : `Round ${room.roundNumber} · ${MAP_BY_ID[room.mapId].name} · First to ${room.winsToWin}`}
            </div>
            <div className="font-display text-6xl sm:text-8xl font-bold text-white drop-shadow-2xl font-mono-num">
              {Math.max(1, Math.ceil(room.countdown))}
            </div>
          </div>
        </div>
      )}

      {/* MULTIPLAYER ROUND END OVERLAY (ROTATING MAP, FIGHTER LOCKED) */}
      {room.phase === 'roundEnd' && (
        <div className="fixed inset-0 z-40 pointer-events-none bg-slate-950/75 flex items-center justify-center p-3">
          <div className="w-full max-w-md rounded-2xl bg-slate-900/95 border border-amber-400/60 p-4 sm:p-5 shadow-2xl text-center">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-amber-300">
              Round {Math.max(1, room.roundNumber - 1)} Complete
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mt-1">
              {roundWinnerPlayer
                ? `${roundWinnerPlayer.name} (${FIGHTER_BY_ID[roundWinnerPlayer.fighterId].name}) Scores!`
                : 'Round Draw'}
            </h2>
            <div className="mt-3 space-y-1.5 text-left">
              {[...room.players]
                .sort((a, b) => b.wins - a.wins)
                .map((p) => {
                  const sp = FIGHTER_BY_ID[p.fighterId];
                  return (
                    <div
                      key={p.playerId}
                      className="flex items-center justify-between rounded-xl bg-slate-950/85 border border-slate-800 px-3 py-1.5 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-white truncate">{p.name}</span>
                        <span className="font-display font-bold" style={{ color: sp.color }}>
                          {sp.name}
                        </span>
                      </div>
                      <span className="font-mono-num font-bold text-amber-300 shrink-0">
                        {p.wins} / {room.winsToWin} WINS
                      </span>
                    </div>
                  );
                })}
            </div>
            <div className="mt-3 text-xs text-sky-300 font-semibold">
              Next Arena: {nextMapSpec.name} · Fighters Locked · {Math.max(1, Math.ceil(room.countdown))}s
            </div>
          </div>
        </div>
      )}

      {/* SPECTATOR NOTICE */}
      {room.phase === 'combat' && myActor?.isKO && (
        <div className="mx-auto bg-slate-950/90 border border-rose-500/60 rounded-xl px-4 py-2 text-xs font-semibold text-rose-200 pointer-events-none">
          {myActor.koCause ? `${KO_CAUSE_LABELS[myActor.koCause]} — ` : ''}Spectating remaining fighters
        </div>
      )}

      {/* VICTORY OVERLAY */}
      {room.phase === 'victory' && (
        <div className="fixed inset-0 z-40 pointer-events-auto bg-slate-950/88 flex items-center justify-center p-3">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-amber-400/60 p-5 shadow-2xl text-center">
            <div className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-amber-400/15 text-amber-400 mb-2">
              <Trophy className="w-5 h-5" />
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-amber-400">
              {room.isTrainingMode
                ? 'Training Complete'
                : room.isSoloPractice
                ? 'Match Complete'
                : `Series Champion · First to ${room.winsToWin} Wins`}
            </div>
            <h2 className="font-display text-2xl sm:text-4xl font-bold text-white mt-1">
              {winnerActor
                ? `${winnerActor.name} (${FIGHTER_BY_ID[winnerActor.fighterId].name}) WINS!`
                : 'DRAW'}
            </h2>

            <div className="mt-3 space-y-1.5 text-left max-h-[40dvh] overflow-y-auto">
              {[...actors]
                .sort((a, b) => b.wins - a.wins || Number(a.isKO) - Number(b.isKO) || b.damageDealt - a.damageDealt)
                .map((a) => {
                  const sp = FIGHTER_BY_ID[a.fighterId];
                  return (
                    <div
                      key={a.playerId}
                      className="flex items-center justify-between rounded-xl bg-slate-950/85 border border-slate-800 px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white truncate">{a.name}</span>
                          <span className="font-display font-bold" style={{ color: sp.color }}>
                            {sp.name}
                          </span>
                        </div>
                        {a.isKO && a.koCause && (
                          <div className="text-[10px] text-rose-300 mt-0.5">
                            Defeated via {KO_CAUSE_LABELS[a.koCause]}
                          </div>
                        )}
                      </div>
                      <div className="font-mono-num text-slate-300 flex items-center gap-2.5 shrink-0">
                        {!room.isSoloPractice && !room.isTrainingMode && (
                          <span className="text-amber-300 font-bold">
                            {a.wins}/{room.winsToWin}W
                          </span>
                        )}
                        <span>{a.kills} KO</span>
                        <span>{a.parryCount} PRY</span>
                        <span>{a.damageDealt} DMG</span>
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="mt-4 flex items-center gap-2.5">
              {isHost && (
                <button
                  type="button"
                  onClick={onRematch}
                  className="flex-1 min-h-[44px] rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold text-sm sm:text-base flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>REMATCH</span>
                </button>
              )}
              <button
                type="button"
                onClick={onLeave}
                className="min-h-[44px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs sm:text-sm cursor-pointer"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM DUAL-THUMB CONTROLS */}
      {room.phase === 'combat' && myActor && !myActor.isKO && (
        <div className="w-full flex items-end justify-between gap-2 pb-1 sm:pb-2">
          {/* Left Thumb Zone: Virtual Analog Joystick */}
          <div className="pointer-events-auto pl-0.5 sm:pl-3">
            <div
              onPointerDown={handleJoyDown}
              onPointerMove={handleJoyMove}
              onPointerUp={handleJoyUp}
              onPointerCancel={handleJoyUp}
              onLostPointerCapture={handleJoyUp}
              onContextMenu={(e) => e.preventDefault()}
              className={`touch-none-select relative rounded-full bg-slate-950/55 border-2 border-slate-600/75 flex items-center justify-center shadow-lg ${
                isNarrowPortrait ? 'w-20 h-20' : isCompactScreen ? 'w-24 h-24' : 'w-32 h-32 sm:w-36 sm:h-36'
              }`}
            >
              <div
                className={`rounded-full border border-slate-700/60 pointer-events-none ${
                  isNarrowPortrait ? 'w-7 h-7' : isCompactScreen ? 'w-9 h-9' : 'w-12 h-12'
                }`}
              />
              <div
                className={`absolute rounded-full bg-amber-400/85 border-2 border-white shadow-xl pointer-events-none transition-transform duration-75 ${
                  isNarrowPortrait ? 'w-8 h-8' : isCompactScreen ? 'w-10 h-10' : 'w-14 h-14'
                }`}
                style={{
                  transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
                }}
              />
            </div>
          </div>

          {/* Right Thumb Zone: Skills/Ult + Grab/Guard/Jump + Branching M1 Attack */}
          <div className="pointer-events-auto pr-0.5 sm:pr-3 flex flex-col items-end gap-1.5 sm:gap-2">
            {/* Floating Hold-Drag Aim Ring around active Skill/Ult button */}
            {aimOverlay && (
              <div
                className="fixed z-40 pointer-events-none"
                style={{ left: aimOverlay.cx - 56, top: aimOverlay.cy - 56, width: 112, height: 112 }}
              >
                <div
                  className={`w-full h-full rounded-full border-2 flex items-center justify-center ${
                    aimOverlay.cancelled
                      ? 'bg-rose-950/60 border-rose-400'
                      : 'bg-slate-950/60 border-sky-400'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full border text-[7px] font-bold flex items-center justify-center ${
                      aimOverlay.cancelled
                        ? 'border-rose-400 text-rose-300 bg-rose-500/20'
                        : 'border-slate-500 text-slate-400'
                    }`}
                  >
                    ✕
                  </div>
                  <div
                    ref={aimKnobRef}
                    className={`absolute w-8 h-8 rounded-full border-2 border-white shadow-lg ${
                      aimOverlay.cancelled ? 'bg-rose-500' : 'bg-sky-400'
                    }`}
                  />
                </div>
                <div
                  className={`text-center text-[9px] font-display font-bold mt-1 px-1.5 py-0.5 rounded bg-slate-950/90 border whitespace-nowrap ${
                    aimOverlay.cancelled
                      ? 'text-rose-300 border-rose-500/60'
                      : 'text-sky-300 border-sky-400/60'
                  }`}
                >
                  {aimOverlay.cancelled ? 'RELEASE TO CANCEL' : `AIM: ${aimOverlay.label.toUpperCase()}`}
                </div>
              </div>
            )}

            {/* Secret Jtinsullen JM Ability: Solar Meteor (only visible to JM with tag Jtinsullen) */}
            {showSecretSolar && (() => {
              const ab = JM_SECRET_ABILITY;
              const cd = myActor.cooldowns[5] ?? 0;
              const notEnoughMana = myActor.mana < ab.manaCost;
              const notEnoughStamina = myActor.stamina < ab.staminaCost;
              const ready = cd <= 0.05 && !notEnoughMana && !notEnoughStamina;
              return (
                <button
                  type="button"
                  onPointerDown={(e) => handleAbilityPointerDown(5, e)}
                  onPointerMove={handleAbilityPointerMove}
                  onPointerUp={(e) => handleAbilityPointerUp(e, false)}
                  onPointerCancel={(e) => handleAbilityPointerUp(e, true)}
                  onLostPointerCapture={(e) => handleAbilityPointerUp(e, true)}
                  onContextMenu={(e) => e.preventDefault()}
                  className={`touch-none-select relative rounded-2xl border-2 flex items-center gap-1.5 px-2.5 py-1 transition active:scale-95 cursor-pointer ${
                    ready
                      ? 'bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-400 border-white text-slate-950 shadow-xl ring-2 ring-yellow-200/70'
                      : 'bg-slate-950/85 border-amber-500/40 text-amber-200/60 opacity-80'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <div className="flex flex-col items-start leading-none">
                    <span className="text-[9px] sm:text-[10px] font-display font-bold tracking-wider uppercase">
                      SOLAR METEOR
                    </span>
                    <span className="text-[7px] font-mono-num font-bold opacity-85 mt-0.5">
                      {cd > 0.05
                        ? `${cd.toFixed(1)}s`
                        : notEnoughStamina
                        ? 'LOW ST'
                        : notEnoughMana
                        ? `${ab.manaCost} CHI`
                        : 'HOLD AIM · O'}
                    </span>
                  </div>
                </button>
              );
            })()}

            {/* Upper Row: Restored Character Skills (Slot 2 & Slot 3) + Ultimate (Slot 4) */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {([2, 3, 4] as const).map((slot) => {
                const ab = mySpec.abilities[slot];
                const cd = myActor.cooldowns[slot] ?? 0;
                const isStage2 = slot === 3 && myActor.stage2Slot === 3 && (myActor.stage2Timer ?? 0) > 0;
                const effectiveManaCost = isStage2
                  ? 0
                  : slot === 3 && myActor.counterFlowActive
                  ? Math.floor(ab.manaCost * 0.5)
                  : ab.manaCost;
                const effectiveStamCost = isStage2 ? 10 : ab.staminaCost;
                const notEnoughMana = myActor.mana < effectiveManaCost;
                const notEnoughStamina = myActor.stamina < effectiveStamCost;
                const ready = cd <= 0.05 && !notEnoughMana && !notEnoughStamina;
                const icon =
                  slot === 2 ? (
                    <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  ) : slot === 3 ? (
                    <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  ) : (
                    <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  );
                const isJmCounterSkill =
                  myActor.fighterId === 'jm' && myActor.counterFlowActive && (slot === 3 || slot === 4);
                const displayName = isStage2
                  ? myActor.stage2Label || 'STAGE 2'
                  : ab.name;
                const tagLabel = isStage2
                  ? `${(myActor.stage2Timer ?? 0).toFixed(1)}s`
                  : notEnoughStamina
                  ? 'LOW ST'
                  : notEnoughMana
                  ? `${effectiveManaCost} CHI`
                  : ab.actionTag ?? (slot === 4 ? 'ULTIMATE' : 'SKILL');
                return (
                  <button
                    key={slot}
                    type="button"
                    onPointerDown={(e) => handleAbilityPointerDown(slot, e)}
                    onPointerMove={handleAbilityPointerMove}
                    onPointerUp={(e) => handleAbilityPointerUp(e, false)}
                    onPointerCancel={(e) => handleAbilityPointerUp(e, true)}
                    onLostPointerCapture={(e) => handleAbilityPointerUp(e, true)}
                    onContextMenu={(e) => e.preventDefault()}
                    className={`touch-none-select relative rounded-2xl border-2 flex flex-col items-center justify-center px-1.5 transition active:scale-95 cursor-pointer ${
                      isNarrowPortrait
                        ? 'min-w-[54px] h-12'
                        : isCompactScreen
                        ? 'min-w-[64px] h-13'
                        : 'min-w-[76px] h-14 sm:min-w-[88px] sm:h-16'
                    } ${
                      isStage2 && ready
                        ? 'bg-emerald-400 border-white text-slate-950 shadow-xl ring-2 ring-emerald-200'
                        : ready
                        ? slot === 4
                          ? `bg-amber-400/95 border-white text-slate-950 ${
                              isJmCounterSkill ? 'animate-counter-flow-glow ring-2 ring-amber-200' : 'animate-ready-glow'
                            }`
                          : isJmCounterSkill
                          ? 'bg-slate-900/95 border-amber-200 text-amber-100 animate-counter-flow-glow'
                          : 'bg-slate-900/95 border-amber-400/80 text-white shadow-lg'
                        : 'bg-slate-950/80 border-slate-800 text-slate-500 opacity-70'
                    }`}
                  >
                    {icon}
                    <span className="text-[8px] sm:text-[9px] font-bold leading-tight mt-0.5 truncate max-w-[82px]">
                      {displayName}
                    </span>
                    <span
                      className={`text-[7px] font-mono-num truncate max-w-[82px] ${
                        isStage2
                          ? 'text-slate-950 font-bold'
                          : notEnoughMana
                          ? 'text-sky-400'
                          : notEnoughStamina
                          ? 'text-rose-400'
                          : slot === 4 && ready
                          ? 'text-slate-950 font-bold'
                          : 'text-sky-300'
                      }`}
                    >
                      {tagLabel}
                    </span>
                    {cd > 0.05 && (
                      <span className="absolute inset-0 rounded-2xl bg-slate-950/85 flex items-center justify-center font-mono-num text-xs sm:text-sm font-bold text-amber-300">
                        {cd.toFixed(1)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Lower Row: Standalone Dash (1.5s CD) + Grab/Mash + Guard/Parry + Jump/Fly + Unique M1 Attack */}
            <div className="flex items-end gap-1 sm:gap-2">
              {/* Standalone Universal Dash Button (1.5s CD, cancels aiming cleanly) */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  soundEngine.unlock();
                  cancelActiveAim();
                  onDash();
                }}
                onContextMenu={(e) => e.preventDefault()}
                className={`touch-none-select relative rounded-2xl border-2 flex flex-col items-center justify-center px-1 transition active:scale-95 cursor-pointer ${
                  isNarrowPortrait ? 'w-10 h-10' : isCompactScreen ? 'w-11 h-11' : 'w-13 h-13 sm:w-14 sm:h-14'
                } ${
                  (myActor.dashCooldown ?? 0) <= 0.05 && myActor.stamina >= 14
                    ? 'bg-cyan-500/90 border-white text-slate-950 shadow-lg'
                    : 'bg-slate-950/80 border-slate-800 text-slate-500 opacity-70'
                }`}
              >
                <Wind className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="text-[8px] font-bold leading-tight mt-0.5">DASH</span>
                {(myActor.dashCooldown ?? 0) > 0.05 && (
                  <span className="absolute inset-0 rounded-2xl bg-slate-950/80 flex items-center justify-center font-mono-num text-[11px] font-bold text-cyan-300">
                    {myActor.dashCooldown.toFixed(1)}
                  </span>
                )}
              </button>

              {/* Grab / Headlock Mash Button */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  soundEngine.unlock();
                  onGrab();
                }}
                onContextMenu={(e) => e.preventDefault()}
                className={`touch-none-select relative rounded-2xl border-2 flex flex-col items-center justify-center px-1 transition active:scale-95 cursor-pointer ${
                  isNarrowPortrait ? 'w-10 h-10' : isCompactScreen ? 'w-11 h-11' : 'w-13 h-13 sm:w-14 sm:h-14'
                } ${
                  headlockInvolvesMe
                    ? 'bg-amber-400 border-white text-slate-950 shadow-xl animate-pulse'
                    : myActor.grabCooldown <= 0.05 && myActor.stamina >= 18
                    ? 'bg-orange-500/90 border-white text-slate-950 shadow-lg'
                    : 'bg-slate-950/80 border-slate-800 text-slate-500 opacity-70'
                }`}
              >
                <Hand className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="text-[8px] font-bold leading-tight mt-0.5">
                  {headlockInvolvesMe ? 'MASH!' : 'GRAB'}
                </span>
                {!headlockInvolvesMe && myActor.grabCooldown > 0.05 && (
                  <span className="absolute inset-0 rounded-2xl bg-slate-950/80 flex items-center justify-center font-mono-num text-[11px] font-bold text-orange-300">
                    {myActor.grabCooldown.toFixed(1)}
                  </span>
                )}
              </button>

              {/* Guard / Parry Button */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  if (blockPointerId.current !== null) return;
                  soundEngine.unlock();
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {
                    // ignore synthetic pointer
                  }
                  blockPointerId.current = e.pointerId;
                  onBlockHoldChange(true);
                  onCastAbility(1);
                }}
                onPointerUp={(e) => {
                  if (blockPointerId.current === e.pointerId) {
                    blockPointerId.current = null;
                    onBlockHoldChange(false);
                  }
                }}
                onPointerCancel={(e) => {
                  if (blockPointerId.current === e.pointerId) {
                    blockPointerId.current = null;
                    onBlockHoldChange(false);
                  }
                }}
                onLostPointerCapture={(e) => {
                  if (blockPointerId.current === e.pointerId) {
                    blockPointerId.current = null;
                    onBlockHoldChange(false);
                  }
                }}
                onContextMenu={(e) => e.preventDefault()}
                className={`touch-none-select relative rounded-2xl border-2 flex flex-col items-center justify-center px-1 transition active:scale-95 cursor-pointer ${
                  isNarrowPortrait ? 'w-10 h-10' : isCompactScreen ? 'w-11 h-11' : 'w-13 h-13 sm:w-14 sm:h-14'
                } ${
                  myActor.parryWindow
                    ? 'bg-amber-300 border-white text-slate-950 shadow-xl'
                    : myActor.shieldActive
                    ? 'bg-sky-500 border-white text-slate-950 shadow-lg'
                    : 'bg-slate-900/90 border-sky-400/75 text-sky-200 shadow-md'
                }`}
              >
                <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="text-[8px] font-bold leading-tight mt-0.5">
                  {myActor.parryWindow ? 'PARRY' : 'GUARD'}
                </span>
              </button>

              {/* Dedicated JM Sky Flight Toggle Button (R key / FLY button) */}
              {myActor.fighterId === 'jm' && (
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    soundEngine.unlock();
                    onToggleFlight();
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                  className={`touch-none-select relative rounded-2xl border-2 flex flex-col items-center justify-center px-1 shadow-lg active:scale-95 transition cursor-pointer ${
                    isNarrowPortrait ? 'w-10 h-10' : isCompactScreen ? 'w-11 h-11' : 'w-13 h-13 sm:w-14 sm:h-14'
                  } ${
                    myActor.isFlying
                      ? 'bg-yellow-300 border-white text-slate-950 ring-2 ring-amber-200'
                      : (myActor.flightCooldown ?? 0) <= 0.05
                      ? 'bg-amber-400/95 hover:bg-amber-300 border-white text-slate-950'
                      : 'bg-slate-950/80 border-slate-800 text-slate-500 opacity-75'
                  }`}
                >
                  <Feather className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="text-[8px] font-bold leading-tight mt-0.5">
                    {myActor.isFlying
                      ? `${(myActor.flightRemaining ?? 0).toFixed(1)}s`
                      : 'FLY (R)'}
                  </span>
                  {!myActor.isFlying && (myActor.flightCooldown ?? 0) > 0.05 && (
                    <span className="absolute inset-0 rounded-2xl bg-slate-950/80 flex items-center justify-center font-mono-num text-[11px] font-bold text-amber-300">
                      {(myActor.flightCooldown ?? 0).toFixed(1)}
                    </span>
                  )}
                </button>
              )}

              {/* Pure Jump Button */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  soundEngine.unlock();
                  jumpPointerId.current = e.pointerId;
                  onJump();
                }}
                onPointerUp={(e) => {
                  if (jumpPointerId.current === e.pointerId) {
                    jumpPointerId.current = null;
                  }
                }}
                onPointerCancel={(e) => {
                  if (jumpPointerId.current === e.pointerId) {
                    jumpPointerId.current = null;
                  }
                }}
                onContextMenu={(e) => e.preventDefault()}
                className={`touch-none-select relative rounded-2xl border-2 flex flex-col items-center justify-center px-1 shadow-lg active:scale-95 transition cursor-pointer bg-emerald-500/90 hover:bg-emerald-400 border-white text-slate-950 ${
                  isNarrowPortrait ? 'w-10 h-10' : isCompactScreen ? 'w-11 h-11' : 'w-13 h-13 sm:w-14 sm:h-14'
                }`}
              >
                <ArrowUp className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-[8px] font-bold leading-tight mt-0.5">JUMP</span>
              </button>

              {/* Unique M1 Primary Attack Button */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  soundEngine.unlock();
                  attackPointerId.current = e.pointerId;
                  triggerM1(e.shiftKey);
                }}
                onPointerUp={() => {
                  attackPointerId.current = null;
                }}
                onPointerCancel={() => {
                  attackPointerId.current = null;
                }}
                onContextMenu={(e) => e.preventDefault()}
                className={`touch-none-select relative rounded-full border-2 border-white flex flex-col items-center justify-center shadow-2xl active:scale-95 transition cursor-pointer ${
                  isNarrowPortrait ? 'w-14 h-14' : isCompactScreen ? 'w-16 h-16' : 'w-20 h-20 sm:w-24 sm:h-24'
                }`}
                style={{ backgroundColor: mySpec.color, color: '#090d16' }}
              >
                <Swords className={isNarrowPortrait || isCompactScreen ? 'w-5 h-5' : 'w-6 h-6 sm:w-7 sm:h-7'} />
                <span className="font-display font-bold text-[9px] sm:text-[11px] uppercase mt-0.5 leading-none">
                  {m1ActiveName}
                </span>
                <span className="font-mono-num text-[7px] sm:text-[8px] font-bold mt-0.5 opacity-90">
                  {m1SubLabel}
                </span>
                {myActor.cooldowns[0] > 0.05 && (
                  <span className="absolute inset-0 rounded-full bg-slate-950/65 flex items-center justify-center font-mono-num text-xs sm:text-sm font-bold text-white">
                    {myActor.cooldowns[0].toFixed(1)}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
