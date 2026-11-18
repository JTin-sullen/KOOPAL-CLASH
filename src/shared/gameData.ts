export type FighterId = 'marjohn' | 'prime' | 'damen' | 'khen' | 'jm';
export type MapId = 'meadow' | 'temple' | 'obsidian';
export type DamagePhase = 'NORMAL' | 'DAMAGED' | 'SEVERELY DAMAGED' | 'CRITICAL' | 'DEFEATED';
export type AbilitySlot = 0 | 1 | 2 | 3 | 4 | 5;
export type RoomPhase = 'lobby' | 'countdown' | 'combat' | 'roundEnd' | 'victory';
export type CombatMoveType = 'strike' | 'grab' | 'parry';
export type ActorActionState =
  | 'idle'
  | 'move'
  | 'jump'
  | 'attack'
  | 'grab'
  | 'headlock'
  | 'guard'
  | 'dash'
  | 'skill'
  | 'ultimate'
  | 'whiff'
  | 'clash'
  | 'stagger'
  | 'ko';
export type EliminationStyle = 'collapse' | 'launch' | 'shatter' | 'dissolve';
export type KoCause = 'normal' | 'parry' | 'combo' | 'ultimate' | 'clash' | 'grab' | 'ring';
export type BattlefieldEventKind = 'frenzy' | 'gravity' | 'hazard' | 'surge';

export type AbilityAimKind = 'none' | 'point' | 'line' | 'cone';
export type ArenaZoneKind =
  | 'galeSnare'
  | 'moltenFissure'
  | 'solarTripwire'
  | 'voidAnchor'
  | 'voidDecoy'
  | 'solarSanctuary';
export type TelegraphKind = 'circle' | 'line' | 'cone';

export interface AbilitySpec {
  slot: AbilitySlot;
  name: string;
  role: 'Attack' | 'Guard' | 'Dash' | 'Skill' | 'Ultimate';
  shortDesc: string;
  cooldown: number; // seconds
  manaCost: number; // Chi cost
  staminaCost: number; // Tactical Stamina cost
  duration: number; // seconds
  windup: number; // seconds before hit triggers
  whiffRecovery: number; // extra vulnerability duration if missed
  damage: number;
  staggerDamage: number;
  range: number;
  arcCos: number; // dot product threshold for directional hit (-1 = 360°)
  knockback: number;
  keyHint: string;
  aimKind?: AbilityAimKind;
  aimRange?: number;
  aimRadius?: number;
  stage2Label?: string;
  holdAimLabel?: string;
  actionTag?: string;
}

export interface PassiveSpec {
  name: string;
  shortDesc: string;
  frenzyBonus: string;
}

export interface M1ComboSpec {
  stepNames: string[];
  heavyFinisherName: string;
  aerialName?: string;
  rangeIdentity: 'Close Brawler' | 'Mid Duelist' | 'Long Marksman' | 'Blink Assassin' | 'Counter Striker';
}

export interface ComboLinkSpec {
  triggerName: string;
  hint: string;
  bonusDamage: number;
  bonusStagger: number;
}

export interface FighterSpec {
  id: FighterId;
  name: string;
  title: string;
  role: string;
  color: string;
  hex: number;
  moveSpeed: number;
  maxHp: number;
  maxMana: number;
  maxStamina: number;
  stats: {
    power: number; // 1-10
    speed: number; // 1-10
    defense: number; // 1-10
  };
  koStyle: EliminationStyle;
  passive: PassiveSpec;
  m1Combo: M1ComboSpec;
  comboLink: ComboLinkSpec;
  abilities: [AbilitySpec, AbilitySpec, AbilitySpec, AbilitySpec, AbilitySpec];
}

export interface MapObstacle {
  id: string;
  kind: 'building' | 'pillar' | 'bridge' | 'wall' | 'platform';
  x: number;
  z: number;
  halfW: number;
  halfD: number;
  topY: number;
  colorHex: number;
  roofColorHex: number;
}

export interface PickupSpawn {
  id: string;
  kind: 'health' | 'mana';
  x: number;
  z: number;
}

export interface MapSpec {
  id: MapId;
  name: string;
  subtitle: string;
  accentColor: string;
  skyHex: number;
  fogHex: number;
  arenaRadius: number;
  description: string;
}

export const FIGHTERS: FighterSpec[] = [
  {
    id: 'marjohn',
    name: 'MARJOHN',
    title: 'Azure Wind',
    role: 'Wind Staff Duelist',
    color: '#38bdf8',
    hex: 0x38bdf8,
    moveSpeed: 8.2,
    maxHp: 120,
    maxMana: 100,
    maxStamina: 100,
    stats: { power: 7, speed: 9, defense: 7 },
    koStyle: 'collapse',
    passive: {
      name: 'Gale Drift',
      shortDesc: 'Faster strafe speed, agile mid-air steering, and slower falling while spacing tornadoes.',
      frenzyBonus: 'Doubles Tailwind stack rate inside Frenzy Zones.',
    },
    m1Combo: {
      stepNames: ['Tornado Poke'],
      heavyFinisherName: 'Tornado Poke',
      rangeIdentity: 'Mid Duelist',
    },
    comboLink: {
      triggerName: 'GALE TYPHOON LINK',
      hint: 'Cloud Vault (Skill 1) → Cyclone Vortex (Skill 2)',
      bonusDamage: 12,
      bonusStagger: 20,
    },
    abilities: [
      {
        slot: 0,
        name: 'Tornado Poke',
        role: 'Attack',
        shortDesc: 'Fires a spinning mini-tornado to mid-range every 0.3s with brief recovery end-lag.',
        cooldown: 0.3,
        manaCost: 0,
        staminaCost: 8,
        duration: 0.24,
        windup: 0.08,
        whiffRecovery: 0.22,
        damage: 11,
        staggerDamage: 15,
        range: 7.6,
        arcCos: 0.5,
        knockback: 4.5,
        keyHint: 'J / 1',
      },
      {
        slot: 1,
        name: 'Zephyr Parry',
        role: 'Guard',
        shortDesc: 'Parry beats Strikes (0.26s window) for +28 Chi & Stamina. Weak to Grab!',
        cooldown: 1.2,
        manaCost: 0,
        staminaCost: 12,
        duration: 0.58,
        windup: 0.0,
        whiffRecovery: 0.2,
        damage: 0,
        staggerDamage: 0,
        range: 2.8,
        arcCos: -1,
        knockback: 7.5,
        keyHint: 'K / 2',
      },
      {
        slot: 2,
        name: 'Cloud Vault',
        role: 'Skill',
        shortDesc: 'Vault skyward and slam down with a cyclone shockwave. Hold-Drag to aim landing!',
        cooldown: 5.5,
        manaCost: 20,
        staminaCost: 18,
        duration: 0.46,
        windup: 0.26,
        whiffRecovery: 0.42,
        damage: 17,
        staggerDamage: 24,
        range: 3.8,
        arcCos: -1,
        knockback: 8.5,
        keyHint: 'Q / 3',
        aimKind: 'point',
        aimRange: 8.5,
        aimRadius: 3.4,
        holdAimLabel: 'Vault Slam',
        actionTag: 'Vault · Wind Slam',
      },
      {
        slot: 3,
        name: 'Cyclone Vortex',
        role: 'Skill',
        shortDesc: 'Tap: 360° vortex. Hold-Drag: Plant Gale Snare Trap -> Stage 2 Skyburst Launch!',
        cooldown: 5.8,
        manaCost: 26,
        staminaCost: 20,
        duration: 0.52,
        windup: 0.3,
        whiffRecovery: 0.52,
        damage: 20,
        staggerDamage: 28,
        range: 4.6,
        arcCos: -1,
        knockback: 9.0,
        keyHint: 'U / 4',
        aimKind: 'point',
        aimRange: 9.5,
        aimRadius: 3.4,
        stage2Label: 'SKYBURST',
        holdAimLabel: 'Gale Snare',
        actionTag: '360° Pull · Trap',
      },
      {
        slot: 4,
        name: 'Tempest Typhoon',
        role: 'Ultimate',
        shortDesc: 'Hold-Drag aims telegraphed storm funnel before wind-shear typhoon. Clash-able!',
        cooldown: 12.0,
        manaCost: 58,
        staminaCost: 28,
        duration: 0.78,
        windup: 0.46,
        whiffRecovery: 0.65,
        damage: 34,
        staggerDamage: 46,
        range: 5.6,
        arcCos: -1,
        knockback: 14.5,
        keyHint: 'I / 5',
        aimKind: 'point',
        aimRange: 8.5,
        aimRadius: 4.8,
        holdAimLabel: 'Storm Eye',
        actionTag: 'Storm Funnel · AoE',
      },
    ],
  },
  {
    id: 'prime',
    name: 'PRIME',
    title: 'Crimson Blaze',
    role: 'Heavy Brawler',
    color: '#f43f5e',
    hex: 0xf43f5e,
    moveSpeed: 6.5,
    maxHp: 132,
    maxMana: 100,
    maxStamina: 100,
    stats: { power: 9, speed: 5, defense: 9 },
    koStyle: 'launch',
    passive: {
      name: 'Juggernaut Armor',
      shortDesc: 'Super Armor during 4th-hit Ground Slam wind-up + 15% reduced knockback taken.',
      frenzyBonus: 'Gains armored flame pulse inside Frenzy Zones.',
    },
    m1Combo: {
      stepNames: ['Heavy Punch', 'Heavy Cross', 'Magma Hook', 'Ground Slam'],
      heavyFinisherName: 'AoE Ground Slam',
      rangeIdentity: 'Close Brawler',
    },
    comboLink: {
      triggerName: 'METEOR DETONATION',
      hint: 'Crater Slam (Skill 2) → Meteor Charge (Skill 1)',
      bonusDamage: 11,
      bonusStagger: 20,
    },
    abilities: [
      {
        slot: 0,
        name: 'Juggernaut 4-Hit',
        role: 'Attack',
        shortDesc: '0.3s per hit: 3 Heavy Punches into an armored AoE Ground Slam shockwave.',
        cooldown: 0.3,
        manaCost: 0,
        staminaCost: 9,
        duration: 0.24,
        windup: 0.08,
        whiffRecovery: 0.24,
        damage: 10,
        staggerDamage: 14,
        range: 3.0,
        arcCos: 0.2,
        knockback: 4.6,
        keyHint: 'J / 1',
      },
      {
        slot: 1,
        name: 'Iron Guard',
        role: 'Guard',
        shortDesc: 'Braced crimson guard & 0.26s Parry counter. Weak to Grab!',
        cooldown: 1.4,
        manaCost: 0,
        staminaCost: 13,
        duration: 0.6,
        windup: 0.0,
        whiffRecovery: 0.24,
        damage: 0,
        staggerDamage: 0,
        range: 2.6,
        arcCos: -1,
        knockback: 6.5,
        keyHint: 'K / 2',
      },
      {
        slot: 2,
        name: 'Meteor Charge',
        role: 'Skill',
        shortDesc: 'Blazing bull-rush shoulder tackle. Crossing Molten Fissure triggers Steam Blast!',
        cooldown: 6.0,
        manaCost: 20,
        staminaCost: 20,
        duration: 0.58,
        windup: 0.3,
        whiffRecovery: 0.44,
        damage: 18,
        staggerDamage: 26,
        range: 3.0,
        arcCos: 0.2,
        knockback: 10.5,
        keyHint: 'Q / 3',
        aimKind: 'line',
        aimRange: 7.5,
        aimRadius: 2.0,
        holdAimLabel: 'Charge Lane',
        actionTag: 'Blaze · Bull Rush',
      },
      {
        slot: 3,
        name: 'Crater Slam',
        role: 'Skill',
        shortDesc: 'Stage 1: Magma Uppercut. Stage 2 / Hold-Drag: Aimed Slam leaving Molten Fissure!',
        cooldown: 6.5,
        manaCost: 26,
        staminaCost: 22,
        duration: 0.62,
        windup: 0.32,
        whiffRecovery: 0.68,
        damage: 19,
        staggerDamage: 26,
        range: 4.6,
        arcCos: -1,
        knockback: 10.0,
        keyHint: 'U / 4',
        aimKind: 'point',
        aimRange: 8.0,
        aimRadius: 3.6,
        stage2Label: 'SLAM',
        holdAimLabel: 'Molten Pool',
        actionTag: 'Leap · Lava Zone',
      },
      {
        slot: 4,
        name: 'Avalanche Blow',
        role: 'Ultimate',
        shortDesc: 'Hold-Drag aims telegraphed Meteor Impact circle before crushing down!',
        cooldown: 13.5,
        manaCost: 58,
        staminaCost: 30,
        duration: 0.88,
        windup: 0.52,
        whiffRecovery: 0.78,
        damage: 32,
        staggerDamage: 44,
        range: 4.4,
        arcCos: -1,
        knockback: 16.5,
        keyHint: 'I / 5',
        aimKind: 'point',
        aimRange: 7.5,
        aimRadius: 4.2,
        holdAimLabel: 'Meteor Zone',
        actionTag: 'Meteor · Impact',
      },
    ],
  },
  {
    id: 'damen',
    name: 'DAMEN',
    title: 'Golden Outlaw',
    role: 'Gunslinger & Shield',
    color: '#f59e0b',
    hex: 0xf59e0b,
    moveSpeed: 7.6,
    maxHp: 124,
    maxMana: 100,
    maxStamina: 100,
    stats: { power: 8, speed: 8, defense: 8 },
    koStyle: 'shatter',
    passive: {
      name: 'Quick-Draw Step',
      shortDesc: 'Gun hits grant 1.5s speed boost and reduce Dash cooldown by 0.5s.',
      frenzyBonus: 'Shotgun & Deadeye crits gain extra range inside Frenzy Zones.',
    },
    m1Combo: {
      stepNames: ['Quickdraw Shot'],
      heavyFinisherName: 'Quickdraw Shot',
      rangeIdentity: 'Mid Duelist',
    },
    comboLink: {
      triggerName: 'BOUNTY EXECUTE',
      hint: 'Solar Lasso (Skill 2) → Outlaw Roll (Skill 1)',
      bonusDamage: 14,
      bonusStagger: 24,
    },
    abilities: [
      {
        slot: 0,
        name: 'Outlaw Revolver',
        role: 'Attack',
        shortDesc: 'Short-to-mid range gunshot (max ~10m) with a 0.6s cooldown. Triggers Quick-Draw Step!',
        cooldown: 0.6,
        manaCost: 0,
        staminaCost: 8,
        duration: 0.26,
        windup: 0.08,
        whiffRecovery: 0.24,
        damage: 15,
        staggerDamage: 18,
        range: 10.2,
        arcCos: 0.85,
        knockback: 4.0,
        keyHint: 'J / 1',
      },
      {
        slot: 1,
        name: 'Golden Aegis',
        role: 'Guard',
        shortDesc: 'Hold golden shield or time 0.26s Parry. Weak to Grab!',
        cooldown: 1.2,
        manaCost: 0,
        staminaCost: 11,
        duration: 0.65,
        windup: 0.0,
        whiffRecovery: 0.2,
        damage: 0,
        staggerDamage: 0,
        range: 2.8,
        arcCos: -1,
        knockback: 7.2,
        keyHint: 'K / 2',
      },
      {
        slot: 2,
        name: 'Outlaw Roll',
        role: 'Skill',
        shortDesc: 'Tactical evasive roll into a piercing Deadeye Fan Shot. Hold-Drag to aim shot!',
        cooldown: 5.5,
        manaCost: 20,
        staminaCost: 16,
        duration: 0.48,
        windup: 0.3,
        whiffRecovery: 0.36,
        damage: 18,
        staggerDamage: 24,
        range: 11.5,
        arcCos: 0.75,
        knockback: 7.5,
        keyHint: 'Q / 3',
        aimKind: 'line',
        aimRange: 10.5,
        aimRadius: 1.8,
        holdAimLabel: 'Deadeye Shot',
        actionTag: 'Roll · Deadeye Shot',
      },
      {
        slot: 3,
        name: 'Solar Lasso',
        role: 'Skill',
        shortDesc: 'Tap: Fast pull lasso. Hold-Drag: Plant an electrified Solar Tripwire Trap!',
        cooldown: 5.2,
        manaCost: 24,
        staminaCost: 18,
        duration: 0.48,
        windup: 0.28,
        whiffRecovery: 0.46,
        damage: 20,
        staggerDamage: 28,
        range: 13.0,
        arcCos: 0.8,
        knockback: -11.0,
        keyHint: 'U / 4',
        aimKind: 'point',
        aimRange: 11.5,
        aimRadius: 2.8,
        holdAimLabel: 'Tripwire',
        actionTag: 'Pull · Tripwire',
      },
      {
        slot: 4,
        name: 'High Noon Fan',
        role: 'Ultimate',
        shortDesc: 'Hold-Drag aims telegraphed High Noon lock-on cone before piercing shots!',
        cooldown: 11.0,
        manaCost: 54,
        staminaCost: 26,
        duration: 0.74,
        windup: 0.42,
        whiffRecovery: 0.58,
        damage: 18,
        staggerDamage: 22,
        range: 15.0,
        arcCos: 0.5,
        knockback: 10.5,
        keyHint: 'I / 5',
        aimKind: 'cone',
        aimRange: 14.5,
        aimRadius: 0.32,
        holdAimLabel: 'Noon Cone',
        actionTag: 'Cone Barrage · AoE',
      },
    ],
  },
  {
    id: 'khen',
    name: 'KHEN',
    title: 'Arcane Violet',
    role: 'Void Assassin',
    color: '#a855f7',
    hex: 0xa855f7,
    moveSpeed: 8.1,
    maxHp: 114,
    maxMana: 100,
    maxStamina: 100,
    stats: { power: 8, speed: 10, defense: 6 },
    koStyle: 'dissolve',
    passive: {
      name: 'Shadow Backstab',
      shortDesc: '+20% bonus damage from behind; 4th-hit Dash Lunge grants a burst of speed.',
      frenzyBonus: 'Void skill cooldowns tick 25% faster during Frenzy.',
    },
    m1Combo: {
      stepNames: ['Dagger Slash', 'Twin Rend', 'Rift Slice', 'Dash Lunge'],
      heavyFinisherName: 'Void Dash Lunge',
      rangeIdentity: 'Blink Assassin',
    },
    comboLink: {
      triggerName: 'VOID MIRAGE LINK',
      hint: 'Shadow Blink (Skill 1) → Crescent Wave (Skill 2)',
      bonusDamage: 13,
      bonusStagger: 22,
    },
    abilities: [
      {
        slot: 0,
        name: 'Void 4-Hit Daggers',
        role: 'Attack',
        shortDesc: '0.3s per hit: 3 Dagger Slashes into a Damaging Dash Lunge that slices straight through.',
        cooldown: 0.3,
        manaCost: 0,
        staminaCost: 8,
        duration: 0.24,
        windup: 0.08,
        whiffRecovery: 0.22,
        damage: 9,
        staggerDamage: 13,
        range: 3.1,
        arcCos: 0.2,
        knockback: 3.6,
        keyHint: 'J / 1',
      },
      {
        slot: 1,
        name: 'Arcane X-Parry',
        role: 'Guard',
        shortDesc: 'Cross-dagger guard & 0.26s Parry counter. Weak to Grab!',
        cooldown: 1.2,
        manaCost: 0,
        staminaCost: 12,
        duration: 0.56,
        windup: 0.0,
        whiffRecovery: 0.2,
        damage: 0,
        staggerDamage: 0,
        range: 2.7,
        arcCos: -1,
        knockback: 8.5,
        keyHint: 'K / 2',
      },
      {
        slot: 2,
        name: 'Shadow Blink',
        role: 'Skill',
        shortDesc: 'Void warp leaving an explosive Void Decoy and slicing arrival point. Hold-Drag aims!',
        cooldown: 5.5,
        manaCost: 20,
        staminaCost: 16,
        duration: 0.46,
        windup: 0.3,
        whiffRecovery: 0.36,
        damage: 16,
        staggerDamage: 22,
        range: 3.2,
        arcCos: -1,
        knockback: 7.0,
        keyHint: 'Q / 3',
        aimKind: 'point',
        aimRange: 8.5,
        aimRadius: 2.8,
        holdAimLabel: 'Void Warp',
        actionTag: 'Warp · Void Decoy',
      },
      {
        slot: 3,
        name: 'Crescent Wave',
        role: 'Skill',
        shortDesc: 'Stage 1: Fires blade leaving Void Anchor. Stage 2: Shadow Swap! Hold-Drag: Silence Trap.',
        cooldown: 5.4,
        manaCost: 26,
        staminaCost: 18,
        duration: 0.48,
        windup: 0.3,
        whiffRecovery: 0.48,
        damage: 20,
        staggerDamage: 24,
        range: 13.5,
        arcCos: 0.8,
        knockback: 6.5,
        keyHint: 'U / 4',
        aimKind: 'point',
        aimRange: 11.5,
        aimRadius: 2.8,
        stage2Label: 'SWAP',
        holdAimLabel: 'Void Trap',
        actionTag: 'Blade · Void Swap',
      },
      {
        slot: 4,
        name: 'Phantom Blitz',
        role: 'Ultimate',
        shortDesc: 'Hold-Drag aims telegraphed Void X-Corridor before high-speed void flurry!',
        cooldown: 11.5,
        manaCost: 58,
        staminaCost: 28,
        duration: 0.78,
        windup: 0.44,
        whiffRecovery: 0.65,
        damage: 36,
        staggerDamage: 48,
        range: 9.5,
        arcCos: 0.1,
        knockback: 12.5,
        keyHint: 'I / 5',
        aimKind: 'line',
        aimRange: 9.5,
        aimRadius: 2.2,
        holdAimLabel: 'Void Lane',
        actionTag: 'Void Corridor · Slash',
      },
    ],
  },
  {
    id: 'jm',
    name: 'JM',
    title: 'Golden Sovereign',
    role: 'Solar Martial Artist',
    color: '#facc15',
    hex: 0xfacc15,
    moveSpeed: 7.6,
    maxHp: 126,
    maxMana: 100,
    maxStamina: 100,
    stats: { power: 9, speed: 9, defense: 7 },
    koStyle: 'collapse',
    passive: {
      name: 'Sky Flight',
      shortDesc: 'Press R to toggle Sky Flight up to 7s (10s CD). Aim skills down & fire 0.3s golden bolts!',
      frenzyBonus: 'Auto-regenerates 3 HP/sec below 40% HP inside Frenzy Zones.',
    },
    m1Combo: {
      stepNames: ['Solar Strike', 'Cross Kick', 'Mini Kamehameha', 'Dash Launch'],
      heavyFinisherName: 'High-Speed Dash Punch',
      aerialName: 'Solar Air Bolt',
      rangeIdentity: 'Counter Striker',
    },
    comboLink: {
      triggerName: 'SOVEREIGN METEOR',
      hint: 'Flash Step (Skill 1) → Heel Drop (Skill 2)',
      bonusDamage: 14,
      bonusStagger: 28,
    },
    abilities: [
      {
        slot: 0,
        name: 'Sovereign 4-Hit',
        role: 'Attack',
        shortDesc: '0.3s per hit: Strike -> Strike -> Mini Beam -> Dash Punch! Air M1 fires 0.3s bolts.',
        cooldown: 0.3,
        manaCost: 0,
        staminaCost: 8,
        duration: 0.24,
        windup: 0.08,
        whiffRecovery: 0.24,
        damage: 10,
        staggerDamage: 14,
        range: 3.3,
        arcCos: 0.2,
        knockback: 4.5,
        keyHint: 'J / 1',
      },
      {
        slot: 1,
        name: 'Dragon Counter',
        role: 'Guard',
        shortDesc: '0.26s Parry counters attackers with uppercut DMG & Counter-Flow!',
        cooldown: 1.2,
        manaCost: 0,
        staminaCost: 12,
        duration: 0.6,
        windup: 0.0,
        whiffRecovery: 0.2,
        damage: 12,
        staggerDamage: 24,
        range: 3.1,
        arcCos: -1,
        knockback: 9.5,
        keyHint: 'K / 2',
      },
      {
        slot: 2,
        name: 'Flash Step',
        role: 'Skill',
        shortDesc: 'High-speed golden afterimage palm burst through foes. Hold-Drag aims corridor!',
        cooldown: 5.5,
        manaCost: 20,
        staminaCost: 18,
        duration: 0.46,
        windup: 0.3,
        whiffRecovery: 0.38,
        damage: 17,
        staggerDamage: 24,
        range: 7.5,
        arcCos: 0.2,
        knockback: 8.5,
        keyHint: 'Q / 3',
        aimKind: 'line',
        aimRange: 7.5,
        aimRadius: 2.2,
        holdAimLabel: 'Flash Lane',
        actionTag: 'Blink · Solar Palm',
      },
      {
        slot: 3,
        name: 'Heel Drop',
        role: 'Skill',
        shortDesc: 'Tap: Radial burst slam. Hold-Drag: Plant Solar Sanctuary Ward that repulses rushers!',
        cooldown: 5.5,
        manaCost: 26,
        staminaCost: 20,
        duration: 0.54,
        windup: 0.3,
        whiffRecovery: 0.54,
        damage: 23,
        staggerDamage: 30,
        range: 4.4,
        arcCos: -1,
        knockback: 11.5,
        keyHint: 'U / 4',
        aimKind: 'point',
        aimRange: 8.5,
        aimRadius: 3.5,
        holdAimLabel: 'Sanctuary',
        actionTag: 'Slam · Solar Ward',
      },
      {
        slot: 4,
        name: 'Solar Dragon Beam',
        role: 'Ultimate',
        shortDesc: 'Hold-Drag aims telegraphed golden beam corridor before firing twin-spiral beam!',
        cooldown: 12.5,
        manaCost: 58,
        staminaCost: 30,
        duration: 0.94,
        windup: 0.48,
        whiffRecovery: 0.72,
        damage: 38,
        staggerDamage: 46,
        range: 16.0,
        arcCos: 0.75,
        knockback: 15.5,
        keyHint: 'I / 5',
        aimKind: 'line',
        aimRange: 14.5,
        aimRadius: 2.3,
        holdAimLabel: 'Beam Lane',
        actionTag: 'Golden Beam · Line',
      },
    ],
  },
];

export const JM_SECRET_ABILITY: AbilitySpec = {
  slot: 5,
  name: 'Solar Meteor',
  role: 'Ultimate',
  shortDesc: 'Ascend into the sky, charge a giant yellow fireball, aim the blast zone & rain detonation!',
  cooldown: 16.0,
  manaCost: 48,
  staminaCost: 22,
  duration: 1.65,
  windup: 1.28,
  whiffRecovery: 0.6,
  damage: 44,
  staggerDamage: 58,
  range: 6.2,
  arcCos: -1,
  knockback: 17.5,
  keyHint: 'O / 6',
  aimKind: 'point',
  aimRange: 17.5,
  aimRadius: 6.2,
  holdAimLabel: 'Solar Meteor',
  actionTag: 'Sky Meteor · Aim',
};

export function isJtinsullenTag(name: string | undefined | null): boolean {
  return (name ?? '').trim().toLowerCase() === 'jtinsullen';
}

export const FIGHTER_BY_ID: Record<FighterId, FighterSpec> = Object.fromEntries(
  FIGHTERS.map((f) => [f.id, f])
) as Record<FighterId, FighterSpec>;

export const MAPS: MapSpec[] = [
  {
    id: 'meadow',
    name: 'Golden Meadow',
    subtitle: 'Open Flagstone Courtyard · Perimeter Pillars',
    accentColor: '#facc15',
    skyHex: 0x7dd3fc,
    fogHex: 0xcbe7fb,
    arenaRadius: 20.5,
    description: 'Smooth open golden courtyard surrounded by temple columns, perimeter river moat, and cypress groves.',
  },
  {
    id: 'temple',
    name: 'Sunset Temple Courtyard',
    subtitle: 'Crimson Lacquer Arena · Torii Lanterns',
    accentColor: '#fb923c',
    skyHex: 0x3b1d36,
    fogHex: 0x5c243a,
    arenaRadius: 20.5,
    description: 'Flat crimson-and-gold slate martial courtyard ringed by glowing sunset torii lantern pillars.',
  },
  {
    id: 'obsidian',
    name: 'Obsidian Storm Peak',
    subtitle: 'Volcanic Hex Dais · Crystal Spires',
    accentColor: '#a855f7',
    skyHex: 0x0f172a,
    fogHex: 0x1e1b4b,
    arenaRadius: 20.0,
    description: 'Obsidian stone battle dais ringed by jagged basalt monoliths and glowing violet crystal spires.',
  },
];

export const MAP_BY_ID: Record<MapId, MapSpec> = Object.fromEntries(
  MAPS.map((m) => [m.id, m])
) as Record<MapId, MapSpec>;

// Keep playable battleground completely flat and obstacle-free so dashes, knockbacks & aim outlines never snag
const MAP_OBSTACLES: Record<MapId, MapObstacle[]> = {
  meadow: [],
  temple: [],
  obsidian: [],
};

const MAP_PICKUPS: Record<MapId, PickupSpawn[]> = {
  meadow: [
    { id: 'pk-hp-1', kind: 'health', x: -10.5, z: 0 },
    { id: 'pk-hp-2', kind: 'health', x: 10.5, z: 0 },
    { id: 'pk-hp-3', kind: 'health', x: 0, z: 10.5 },
    { id: 'pk-mp-1', kind: 'mana', x: 0, z: -10.5 },
    { id: 'pk-mp-2', kind: 'mana', x: -7.4, z: 7.4 },
    { id: 'pk-mp-3', kind: 'mana', x: 7.4, z: -7.4 },
  ],
  temple: [
    { id: 'pk-hp-1', kind: 'health', x: -10.5, z: -3.0 },
    { id: 'pk-hp-2', kind: 'health', x: 10.5, z: 3.0 },
    { id: 'pk-hp-3', kind: 'health', x: 0, z: 10.5 },
    { id: 'pk-mp-1', kind: 'mana', x: 0, z: -10.5 },
    { id: 'pk-mp-2', kind: 'mana', x: 7.5, z: -7.5 },
    { id: 'pk-mp-3', kind: 'mana', x: -7.5, z: 7.5 },
  ],
  obsidian: [
    { id: 'pk-hp-1', kind: 'health', x: 0, z: -10.5 },
    { id: 'pk-hp-2', kind: 'health', x: -10.5, z: 0 },
    { id: 'pk-hp-3', kind: 'health', x: 10.5, z: 0 },
    { id: 'pk-mp-1', kind: 'mana', x: -7.2, z: -7.2 },
    { id: 'pk-mp-2', kind: 'mana', x: 7.2, z: 7.2 },
    { id: 'pk-mp-3', kind: 'mana', x: 0, z: 10.5 },
  ],
};

export function getMapObstacles(mapId: MapId): MapObstacle[] {
  return MAP_OBSTACLES[mapId];
}

export function getMapPickupSpawns(mapId: MapId): PickupSpawn[] {
  return MAP_PICKUPS[mapId];
}

export function getDamagePhase(hp: number, maxHp: number, isKO: boolean): DamagePhase {
  if (isKO || hp <= 0) return 'DEFEATED';
  const pct = (hp / Math.max(1, maxHp)) * 100;
  if (pct <= 22) return 'CRITICAL';
  if (pct <= 48) return 'SEVERELY DAMAGED';
  if (pct <= 74) return 'DAMAGED';
  return 'NORMAL';
}

export function getMeadowStreamZ(x: number): number {
  return Math.sin(x * 0.11) * 3.8 - 1.2;
}

export function getMapTerrainHeight(mapId: MapId, x: number, z: number): number {
  const arenaR = MAP_BY_ID[mapId].arenaRadius;
  const r = Math.hypot(x, z);
  // Playable arena floor is 100% flat for clean 60fps ground previews, dashes, and knockbacks
  if (r <= arenaR + 1.8) {
    return 0;
  }
  const outer = r - (arenaR + 1.8);
  if (mapId === 'meadow') {
    return outer * 0.16 + Math.sin(x * 0.12) * Math.cos(z * 0.12) * 0.25;
  }
  if (mapId === 'temple') {
    return outer * 0.12;
  }
  return outer * 0.18 + Math.sin(x * 0.14) * Math.cos(z * 0.14) * 0.18;
}

export function getObstacleSupportY(
  mapId: MapId,
  x: number,
  currentRelY: number,
  z: number,
  actorRadius = 0.42
): number {
  let maxTop = 0;
  const obstacles = getMapObstacles(mapId);
  for (const obs of obstacles) {
    if (
      Math.abs(x - obs.x) <= obs.halfW + actorRadius * 0.6 &&
      Math.abs(z - obs.z) <= obs.halfD + actorRadius * 0.6 &&
      currentRelY >= obs.topY - 0.42
    ) {
      if (obs.topY > maxTop) maxTop = obs.topY;
    }
  }
  return maxTop;
}

export function resolveObstacleCollisions(
  mapId: MapId,
  x: number,
  relY: number,
  z: number,
  actorRadius = 0.48
): { x: number; z: number } {
  let nx = x;
  let nz = z;
  const obstacles = getMapObstacles(mapId);
  for (const obs of obstacles) {
    if (relY >= obs.topY - 0.42) continue;
    const expandW = obs.halfW + actorRadius;
    const expandD = obs.halfD + actorRadius;
    const dx = nx - obs.x;
    const dz = nz - obs.z;
    if (Math.abs(dx) < expandW && Math.abs(dz) < expandD) {
      const penX = expandW - Math.abs(dx);
      const penZ = expandD - Math.abs(dz);
      if (penX < penZ) {
        nx += dx >= 0 ? penX : -penX;
      } else {
        nz += dz >= 0 ? penZ : -penZ;
      }
    }
  }
  return { x: nx, z: nz };
}

export function pointHitsObstacle(mapId: MapId, x: number, relY: number, z: number): boolean {
  const obstacles = getMapObstacles(mapId);
  for (const obs of obstacles) {
    if (
      relY < obs.topY &&
      Math.abs(x - obs.x) <= obs.halfW &&
      Math.abs(z - obs.z) <= obs.halfD
    ) {
      return true;
    }
  }
  return false;
}

export interface RoomPlayer {
  playerId: string;
  slotIndex: number;
  name: string;
  fighterId: FighterId;
  ready: boolean;
  connected: boolean;
  wins: number;
  isBot?: boolean;
  isDummy?: boolean;
}

export interface ArenaPickup {
  id: string;
  kind: 'health' | 'mana';
  x: number;
  y: number;
  z: number;
  active: boolean;
}

export interface BattlefieldEventState {
  id: string;
  kind: BattlefieldEventKind;
  title: string;
  subtitle: string;
  x: number;
  z: number;
  radius: number;
  remaining: number;
  telegraphRemaining: number; // >0 before hazard detonates
  colorHex: number;
}

export interface ClashState {
  id: string;
  playerAId: string;
  playerBId: string;
  remaining: number; // QTE decision countdown
  maxTime: number;
  choiceA: CombatMoveType | null;
  choiceB: CombatMoveType | null;
  x: number;
  y: number;
  z: number;
}

export interface HeadlockState {
  id: string;
  grabberId: string;
  victimId: string;
  remaining: number;
  duration: number;
  grabberMashes: number;
  victimMashes: number;
  x: number;
  y: number;
  z: number;
}

export interface ArenaZoneState {
  id: string;
  ownerId: string;
  fighterId: FighterId;
  kind: ArenaZoneKind;
  x: number;
  y: number;
  z: number;
  endX?: number;
  endZ?: number;
  radius: number;
  remaining: number;
  maxDuration: number;
  colorHex: number;
  triggered?: boolean;
}

export interface TelegraphState {
  id: string;
  ownerId: string;
  fighterId: FighterId;
  kind: TelegraphKind;
  x: number;
  y: number;
  z: number;
  dirX: number;
  dirZ: number;
  radius: number;
  length: number;
  angleHalf: number;
  progress: number;
  colorHex: number;
}

export interface ArenaActorState {
  playerId: string;
  slotIndex: number;
  name: string;
  fighterId: FighterId;
  isBot?: boolean;
  isDummy?: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  yVel: number;
  vz: number;
  grounded: boolean;
  rotY: number;
  hp: number;
  maxHp: number;
  mana: number; // Chi / Energy
  maxMana: number;
  stamina: number; // Tactical stamina (slower regen, governs spam)
  maxStamina: number;
  stagger: number; // 0..100 -> 100 triggers STUNNED
  isStunned: boolean;
  isOverdrive: boolean; // Low-HP (<28%) comeback overdrive
  frenzyInside?: boolean; // Visual indicator when standing inside active Frenzy Zone
  passiveStacks: number; // Character passive counter / buff stack
  counterFlowActive: boolean; // JM Parry/Evade buff or general empowered skill buff
  stage2Slot?: AbilitySlot | null;
  stage2Timer?: number;
  stage2Label?: string;
  rushFatigue?: number;
  empoweredM1Ready?: boolean;
  perfectEvadeTimer?: number;
  comboCount: number; // Consecutive hits landed
  comboResetRemaining?: number; // Seconds remaining before combo resets (max 2.0s)
  comboStep: 0 | 1 | 2 | 3 | 4; // 4-hit M1 stage
  m1Variant: 'light' | 'heavy';
  grabCooldown: number;
  damagePhase: DamagePhase;
  actionState: ActorActionState;
  abilitySlot: AbilitySlot | null;
  actionTimer: number;
  actionDuration: number;
  whiffTimer: number; // >0 means missed big move -> extra vulnerability
  cooldowns: [number, number, number, number, number, number];
  dashCooldown: number;
  dashMaxCooldown: number;
  dashCharges: number;
  dashMaxCharges: number;
  dashRechargeRemaining: number;
  isFlying?: boolean;
  flightRemaining?: number;
  flightMax?: number;
  flightCooldown?: number;
  speedBoostTimer?: number;
  superArmor?: boolean;
  shieldActive: boolean;
  parryWindow: boolean;
  blockHeld: boolean;
  isKO: boolean;
  koTime: number | null;
  koStyle: EliminationStyle;
  koCause?: KoCause;
  koByFighterId?: FighterId;
  wins: number;
  kills: number;
  parryCount: number;
  damageDealt: number;
}

export interface ProjectileState {
  id: string;
  ownerId: string;
  fighterId: FighterId;
  kind: 'bullet' | 'magnum' | 'lasso' | 'crescent' | 'solarFireball' | 'tornado' | 'jmBeam' | 'jmBolt';
  x: number;
  y: number;
  z: number;
  vx: number;
  vy?: number;
  vz: number;
  rotY: number;
  colorHex: number;
  originX?: number;
  originY?: number;
  originZ?: number;
  targetX?: number;
  targetY?: number;
  targetZ?: number;
  isComboLink?: boolean;
  isOverdrive?: boolean;
}

export type RpsOutcome =
  | 'strike_beats_grab'
  | 'grab_beats_parry'
  | 'parry_beats_strike'
  | 'weak_to_grab';

export interface CombatEvent {
  id: string;
  t: number;
  kind:
    | 'cast'
    | 'hit'
    | 'block'
    | 'parry'
    | 'evade'
    | 'trap'
    | 'trapTrigger'
    | 'grab'
    | 'headlockBreak'
    | 'whiff'
    | 'stun'
    | 'dash'
    | 'jump'
    | 'pickup'
    | 'shockwave'
    | 'beam'
    | 'lasso'
    | 'comboLink'
    | 'overdrive'
    | 'clashStart'
    | 'clashWin'
    | 'hazardHit'
    | 'fireballCharge'
    | 'fireballLaunch'
    | 'fireballImpact'
    | 'ko';
  attackerId?: string;
  targetId?: string;
  fighterId?: FighterId;
  x: number;
  y: number;
  z: number;
  dirX?: number;
  dirZ?: number;
  originX?: number;
  originY?: number;
  originZ?: number;
  colorHex: number;
  damage?: number;
  radius?: number;
  isCrit?: boolean;
  isBackstab?: boolean;
  isCounter?: boolean;
  comboHit?: number;
  hitStopMs?: number;
  callout?: string;
  koStyle?: EliminationStyle;
  koCause?: KoCause;
  abilitySlot?: AbilitySlot;
  comboStep?: 1 | 2 | 3 | 4;
  m1Variant?: 'light' | 'heavy';
  rpsOutcome?: RpsOutcome;
  frenzyInside?: boolean;
  counterFlow?: boolean;
  isComboLink?: boolean;
  staminaRefund?: number;
  whiffSlot?: AbilitySlot | null;
}

export interface TrainingConfig {
  dummyEnabled: boolean;
  zeroCooldowns: boolean;
}

export interface RoomState {
  roomCode: string;
  hostId: string;
  phase: RoomPhase;
  mapId: MapId;
  isSoloPractice: boolean;
  isTrainingMode: boolean;
  trainingConfig?: TrainingConfig;
  countdown: number;
  matchTime: number;
  roundNumber: number;
  winsToWin: number;
  roundWinnerId: string | null;
  winnerId: string | null;
  players: RoomPlayer[];
}

export interface ArenaSnapshot {
  serverTime: number;
  matchTime: number;
  lastInputSeq: Record<string, number>;
  actors: ArenaActorState[];
  projectiles: ProjectileState[];
  zones: ArenaZoneState[];
  telegraphs: TelegraphState[];
  pickups: ArenaPickup[];
  battleEvent: BattlefieldEventState | null;
  activeClash: ClashState | null;
  activeHeadlock: HeadlockState | null;
  stormActive: boolean;
  stormRadius: number;
  stormMaxRadius: number;
}

export type ClientMessage =
  | { type: 'net:ping'; clientSendTime: number }
  | { type: 'room:create'; playerName: string; isSoloPractice?: boolean; isTrainingMode?: boolean }
  | { type: 'room:join'; roomCode: string; playerName: string; reconnectToken?: string }
  | { type: 'room:selectFighter'; fighterId: FighterId }
  | { type: 'room:selectMap'; mapId: MapId }
  | { type: 'room:setReady'; ready: boolean }
  | { type: 'room:startNow' }
  | { type: 'room:rematch' }
  | { type: 'room:leave' }
  | {
      type: 'game:input';
      seq?: number;
      moveX: number;
      moveZ: number;
      aimYaw: number;
      aimPitch?: number;
      targetId?: string | null;
      blockHeld?: boolean;
      jumpHeld?: boolean;
    }
  | { type: 'game:jump'; seq?: number }
  | { type: 'game:toggleFlight'; seq?: number }
  | { type: 'game:dash'; seq?: number; moveX?: number; moveZ?: number; aimYaw?: number }
  | { type: 'game:grab'; seq?: number; aimYaw?: number; targetId?: string | null }
  | { type: 'game:clashPick'; clashId: string; choice: CombatMoveType }
  | { type: 'game:aimUpdate'; aimX: number; aimZ: number }
  | { type: 'game:trainingConfig'; dummyEnabled?: boolean; zeroCooldowns?: boolean }
  | {
      type: 'game:ability';
      seq?: number;
      slot: AbilitySlot;
      holdHeavy?: boolean;
      aimYaw?: number;
      aimPitch?: number;
      targetId?: string | null;
      aimX?: number;
      aimZ?: number;
      isHoldVariant?: boolean;
    };

export type ServerMessage =
  | { type: 'net:pong'; clientSendTime: number; serverTime: number }
  | { type: 'room:joined'; playerId: string; reconnectToken: string; room: RoomState }
  | { type: 'room:state'; room: RoomState }
  | { type: 'room:error'; message: string }
  | { type: 'room:exited'; reason: string }
  | { type: 'game:snapshot'; snapshot: ArenaSnapshot; events: CombatEvent[] };
