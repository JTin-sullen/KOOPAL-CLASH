import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AbilitySlot,
  ArenaSnapshot,
  ClientMessage,
  CombatEvent,
  CombatMoveType,
  FighterId,
  MapId,
  RoomState,
  ServerMessage,
  TrainingConfig,
} from './shared/gameData.ts';
import { LobbyLanding } from './components/LobbyLanding.tsx';
import { TekkenPickScreen } from './components/TekkenPickScreen.tsx';
import {
  ArenaViewport,
  DamagePopup,
  HitFlashInfo,
  LocalControlState,
} from './components/ArenaViewport.tsx';
import { MobileCombatHUD } from './components/MobileCombatHUD.tsx';
import { soundEngine } from './game/soundEngine.ts';
import type { AimPreviewState } from './game/vfxManager.ts';

export default function App() {
  const [viewMode, setViewMode] = useState<'game' | 'cinema'>('game');
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [pingMs, setPingMs] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [playerId, setPlayerId] = useState<string>('');
  const [snapshot, setSnapshot] = useState<ArenaSnapshot | null>(null);
  const [pendingEvents, setPendingEvents] = useState<CombatEvent[]>([]);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [lockOnEnabled, setLockOnEnabled] = useState<boolean>(true);
  const [cancelAimTriggerSeq, setCancelAimTriggerSeq] = useState<number>(0);
  const [damagePopups, setDamagePopups] = useState<DamagePopup[]>([]);
  const [hitFlash, setHitFlash] = useState<HitFlashInfo | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const cameraYawRef = useRef<number>(Math.PI);
  const aimPitchRef = useRef<number>(-0.45);
  const targetIdRef = useRef<string | null>(null);
  targetIdRef.current = targetId;

  // Latency compensation clock-sync & local prediction refs
  const clockOffsetMsRef = useRef<number>(0);
  const jitterMsRef = useRef<number>(15);
  const rttSamplesRef = useRef<number[]>([]);
  const inputSeqRef = useRef<number>(0);
  const localControlRef = useRef<LocalControlState>({
    moveX: 0,
    moveZ: 0,
    blockHeld: false,
    jumpTriggerSeq: 0,
  });
  const aimPreviewRef = useRef<AimPreviewState>({
    active: false,
    cancelled: false,
    aimKind: 'none',
    originX: 0,
    originZ: 0,
    aimX: 0,
    aimZ: 0,
    radius: 3,
    range: 8,
    colorHex: 0x38bdf8,
  });

  const urlParams = new URLSearchParams(window.location.search);
  const initialRoomCode = (urlParams.get('room') || '').toUpperCase().slice(0, 4);
  const savedName = sessionStorage.getItem('sc3d_name') || 'Player';

  const sendMsg = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    let closedByUnmount = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;

    const sendPing = (ws: WebSocket) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'net:ping', clientSendTime: Date.now() } satisfies ClientMessage));
      }
    };

    const connect = () => {
      setConnectionStatus('connecting');
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus('connected');
        setErrorMessage(null);

        sendPing(ws);
        setTimeout(() => sendPing(ws), 220);
        setTimeout(() => sendPing(ws), 500);
        if (pingTimer) clearInterval(pingTimer);
        pingTimer = setInterval(() => sendPing(ws), 2000);

        const savedRoom = sessionStorage.getItem('sc3d_room');
        const savedToken = sessionStorage.getItem('sc3d_token');
        const name = sessionStorage.getItem('sc3d_name') || 'Player';
        if (savedRoom && savedToken) {
          ws.send(
            JSON.stringify({
              type: 'room:join',
              roomCode: savedRoom,
              playerName: name,
              reconnectToken: savedToken,
            } satisfies ClientMessage)
          );
        }
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as ServerMessage;
          if (msg.type === 'net:pong') {
            const clientRecvTime = Date.now();
            const rtt = Math.max(1, clientRecvTime - msg.clientSendTime);
            const sampleOffset = msg.serverTime - (msg.clientSendTime + rtt * 0.5);

            const samples = rttSamplesRef.current;
            samples.push(rtt);
            if (samples.length > 8) samples.shift();
            const minRtt = Math.min(...samples);
            const maxRtt = Math.max(...samples);
            jitterMsRef.current = jitterMsRef.current * 0.7 + (maxRtt - minRtt) * 0.3;

            if (clockOffsetMsRef.current === 0 || rtt <= minRtt * 1.35) {
              clockOffsetMsRef.current =
                clockOffsetMsRef.current === 0
                  ? sampleOffset
                  : clockOffsetMsRef.current * 0.75 + sampleOffset * 0.25;
            }
            setPingMs(Math.round(rtt));
            return;
          }

          if (msg.type === 'room:joined') {
            setPlayerId(msg.playerId);
            setRoom(msg.room);
            setErrorMessage(null);
            sessionStorage.setItem('sc3d_room', msg.room.roomCode);
            sessionStorage.setItem('sc3d_token', msg.reconnectToken);
          } else if (msg.type === 'room:state') {
            setRoom(msg.room);
            if (msg.room.phase === 'victory') {
              soundEngine.play('victory');
            }
            if (msg.room.phase === 'lobby' || msg.room.phase === 'roundEnd' || msg.room.phase === 'countdown') {
              if (msg.room.phase === 'lobby') {
                setSnapshot(null);
                setTargetId(null);
              }
              setDamagePopups([]);
              setHitFlash(null);
            }
          } else if (msg.type === 'room:exited') {
            sessionStorage.removeItem('sc3d_room');
            sessionStorage.removeItem('sc3d_token');
            setRoom(null);
            setSnapshot(null);
            setTargetId(null);
            setDamagePopups([]);
            setHitFlash(null);
            setPendingEvents([]);
            setErrorMessage(msg.reason || 'Returned to Lobby.');
          } else if (msg.type === 'room:error') {
            setErrorMessage(msg.message);
            if (msg.message.includes('not found')) {
              sessionStorage.removeItem('sc3d_room');
              sessionStorage.removeItem('sc3d_token');
            }
          } else if (msg.type === 'game:snapshot') {
            setSnapshot(msg.snapshot);
            if (msg.events.length > 0) {
              setPendingEvents((prev) => [...prev, ...msg.events]);
            }
          }
        } catch {
          // ignore malformed packet
        }
      };

      ws.onclose = () => {
        setConnectionStatus('disconnected');
        if (pingTimer) {
          clearInterval(pingTimer);
          pingTimer = null;
        }
        if (!closedByUnmount) {
          reconnectTimer = setTimeout(connect, 1500);
        }
      };
    };

    connect();
    return () => {
      closedByUnmount = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pingTimer) clearInterval(pingTimer);
      wsRef.current?.close();
    };
  }, []);

  const handleCreateRoom = (
    name: string,
    opts?: { isSoloPractice?: boolean; isTrainingMode?: boolean }
  ) => {
    setErrorMessage(null);
    sessionStorage.setItem('sc3d_name', name);
    sendMsg({
      type: 'room:create',
      playerName: name,
      isSoloPractice: Boolean(opts?.isSoloPractice),
      isTrainingMode: Boolean(opts?.isTrainingMode),
    });
  };

  const handleJoinRoom = (code: string, name: string) => {
    setErrorMessage(null);
    sessionStorage.setItem('sc3d_name', name);
    sendMsg({ type: 'room:join', roomCode: code, playerName: name });
  };

  const handleLeave = () => {
    sessionStorage.removeItem('sc3d_room');
    sessionStorage.removeItem('sc3d_token');
    sendMsg({ type: 'room:leave' });
    setRoom(null);
    setSnapshot(null);
    setTargetId(null);
    setDamagePopups([]);
    setHitFlash(null);
  };

  const handleMoveInput = useCallback(
    (moveX: number, moveZ: number) => {
      inputSeqRef.current += 1;
      localControlRef.current.moveX = moveX;
      localControlRef.current.moveZ = moveZ;
      sendMsg({
        type: 'game:input',
        seq: inputSeqRef.current,
        moveX,
        moveZ,
        aimYaw: cameraYawRef.current,
        aimPitch: aimPitchRef.current,
        targetId: targetIdRef.current,
        blockHeld: localControlRef.current.blockHeld,
      });
    },
    [sendMsg]
  );

  const handleJump = useCallback(() => {
    inputSeqRef.current += 1;
    localControlRef.current.jumpTriggerSeq += 1;
    sendMsg({
      type: 'game:jump',
      seq: inputSeqRef.current,
    });
  }, [sendMsg]);

  const handleToggleFlight = useCallback(() => {
    inputSeqRef.current += 1;
    sendMsg({
      type: 'game:toggleFlight',
      seq: inputSeqRef.current,
    });
  }, [sendMsg]);

  const handleDash = useCallback(() => {
    inputSeqRef.current += 1;
    sendMsg({
      type: 'game:dash',
      seq: inputSeqRef.current,
      moveX: localControlRef.current.moveX,
      moveZ: localControlRef.current.moveZ,
      aimYaw: cameraYawRef.current,
    });
  }, [sendMsg]);

  const handleGrab = useCallback(() => {
    inputSeqRef.current += 1;
    sendMsg({
      type: 'game:grab',
      seq: inputSeqRef.current,
      aimYaw: cameraYawRef.current,
      targetId: targetIdRef.current,
    });
  }, [sendMsg]);

  const handleClashPick = useCallback(
    (clashId: string, choice: CombatMoveType) => {
      sendMsg({
        type: 'game:clashPick',
        clashId,
        choice,
      });
    },
    [sendMsg]
  );

  const handleBlockHoldChange = useCallback(
    (held: boolean) => {
      inputSeqRef.current += 1;
      localControlRef.current.blockHeld = held;
      sendMsg({
        type: 'game:input',
        seq: inputSeqRef.current,
        moveX: localControlRef.current.moveX,
        moveZ: localControlRef.current.moveZ,
        aimYaw: cameraYawRef.current,
        aimPitch: aimPitchRef.current,
        targetId: targetIdRef.current,
        blockHeld: held,
      });
    },
    [sendMsg]
  );

  const handleCastAbility = useCallback(
    (
      slot: AbilitySlot,
      holdHeavy?: boolean,
      aimPayload?: { aimX?: number; aimZ?: number; isHoldVariant?: boolean }
    ) => {
      inputSeqRef.current += 1;
      sendMsg({
        type: 'game:ability',
        seq: inputSeqRef.current,
        slot,
        holdHeavy,
        aimYaw: cameraYawRef.current,
        aimPitch: aimPitchRef.current,
        targetId: targetIdRef.current,
        aimX: aimPayload?.aimX,
        aimZ: aimPayload?.aimZ,
        isHoldVariant: aimPayload?.isHoldVariant,
      });
    },
    [sendMsg]
  );

  const handleAimUpdate = useCallback(
    (aimX: number, aimZ: number) => {
      sendMsg({
        type: 'game:aimUpdate',
        aimX,
        aimZ,
      });
    },
    [sendMsg]
  );

  const handleTrainingConfig = useCallback(
    (cfg: Partial<TrainingConfig>) => {
      sendMsg({
        type: 'game:trainingConfig',
        ...cfg,
      });
    },
    [sendMsg]
  );

  const handleConsumeEvents = useCallback(() => {
    setPendingEvents([]);
  }, []);

  const handleSpawnDamagePopup = useCallback((popup: DamagePopup) => {
    setDamagePopups((prev) => [...prev.slice(-9), popup]);
    setTimeout(() => {
      setDamagePopups((prev) => prev.filter((p) => p.id !== popup.id));
    }, 560);
  }, []);

  const handleHitFlash = useCallback((flash: HitFlashInfo) => {
    setHitFlash(flash);
    setTimeout(() => {
      setHitFlash((cur) => (cur?.id === flash.id ? null : cur));
    }, 340);
  }, []);

  return (
    <main className="relative w-full h-[100dvh] overflow-hidden bg-[#070b14]">
      {viewMode === 'cinema' ? (
        <div className="fixed inset-0 w-full h-[100dvh] overflow-hidden">
          <button
            type="button"
            onClick={() => setViewMode('game')}
            className="fixed top-3 left-3 z-50 px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-white shadow-lg cursor-pointer"
          >
            ← Back to Multiplayer Game
          </button>
          <iframe
            src="/squad_clash_3d_golden_meadow_edition.html"
            title="KOOPAL CLASH Cinema Cut"
            className="w-full h-full border-0 block"
            allow="autoplay; fullscreen"
          />
        </div>
      ) : !room ? (
        <LobbyLanding
          initialRoomCode={initialRoomCode}
          initialName={savedName}
          connectionStatus={connectionStatus}
          pingMs={pingMs}
          errorMessage={errorMessage}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onOpenCinemaCut={() => setViewMode('cinema')}
        />
      ) : room.phase === 'lobby' ? (
        <TekkenPickScreen
          room={room}
          playerId={playerId}
          pingMs={pingMs}
          errorMessage={errorMessage}
          onSelectFighter={(fighterId: FighterId) => sendMsg({ type: 'room:selectFighter', fighterId })}
          onSelectMap={(mapId: MapId) => sendMsg({ type: 'room:selectMap', mapId })}
          onToggleReady={(ready: boolean) => sendMsg({ type: 'room:setReady', ready })}
          onStartNow={() => sendMsg({ type: 'room:startNow' })}
          onLeave={handleLeave}
        />
      ) : (
        <div className="fixed inset-0 w-full h-[100dvh] overflow-hidden">
          <ArenaViewport
            mapId={room.mapId}
            playerId={playerId}
            targetId={targetId}
            lockOnEnabled={lockOnEnabled}
            snapshot={snapshot}
            pendingEvents={pendingEvents}
            onConsumeEvents={handleConsumeEvents}
            cameraYawRef={cameraYawRef}
            aimPitchRef={aimPitchRef}
            clockOffsetMsRef={clockOffsetMsRef}
            jitterMsRef={jitterMsRef}
            localControlRef={localControlRef}
            aimPreviewRef={aimPreviewRef}
            onCanvasAttack={(shiftHeld) => handleCastAbility(0, shiftHeld)}
            onCancelAim={() => setCancelAimTriggerSeq((v) => v + 1)}
            onSpawnDamagePopup={handleSpawnDamagePopup}
            onHitFlash={handleHitFlash}
          />
          <MobileCombatHUD
            room={room}
            playerId={playerId}
            pingMs={pingMs}
            snapshot={snapshot}
            targetId={targetId}
            lockOnEnabled={lockOnEnabled}
            cameraYawRef={cameraYawRef}
            aimPreviewRef={aimPreviewRef}
            cancelAimTriggerSeq={cancelAimTriggerSeq}
            damagePopups={damagePopups}
            hitFlash={hitFlash}
            onSelectTarget={setTargetId}
            onToggleLockOn={() => setLockOnEnabled((v) => !v)}
            onMoveInput={handleMoveInput}
            onJump={handleJump}
            onToggleFlight={handleToggleFlight}
            onDash={handleDash}
            onGrab={handleGrab}
            onClashPick={handleClashPick}
            onBlockHoldChange={handleBlockHoldChange}
            onCastAbility={handleCastAbility}
            onAimUpdate={handleAimUpdate}
            onTrainingConfig={handleTrainingConfig}
            onRematch={() => sendMsg({ type: 'room:rematch' })}
            onLeave={handleLeave}
          />
        </div>
      )}

      {/* Persistent bottom-left Version indicator */}
      <div className="fixed bottom-1.5 left-2.5 z-50 pointer-events-none text-[11px] font-mono-num font-semibold text-slate-400/80">
        Version 13
      </div>
    </main>
  );
}
