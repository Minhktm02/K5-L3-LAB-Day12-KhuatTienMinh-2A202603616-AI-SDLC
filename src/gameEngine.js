function round3(n) {
  return Math.round(n * 1000) / 1000;
}

function polarToXZ(radius, deg, cx = 0, cz = 0) {
  const rad = (deg * Math.PI) / 180.0;
  return [round3(cx + radius * Math.cos(rad)), round3(cz + radius * Math.sin(rad))];
}

class GameEngine {
  constructor(contract, seed = 42, night = 1) {
    this.contract = contract;
    this.tuning = contract.tuning;
    this.seed = seed >>> 0;
    this.rng_state = seed >>> 0;
    this.night = night || 1;

    this.tick = 0;
    this.sim_tick = 0;
    this.state = 'playing'; // playing, paused, won, lost
    this.is_paused = false;
    this.reason = null;
    this.score = 0;

    // Night duration
    const durationMap = {
      1: this.tuning.night1_duration_s || 300,
      2: this.tuning.night2_duration_s || 330,
      3: this.tuning.night3_duration_s || 360
    };
    this.time_left_s = durationMap[this.night] || 300;
    this.time_ticks_left = Math.round(this.time_left_s * 60);

    // Player state
    this.player = {
      pos: [0.0, 0.0, 0.0],
      vel: [0.0, 0.0, 0.0],
      facing: [0.0, 1.0], // Facing +Z initially
      grounded: true,
      flames: this.tuning.flames || 3,
      carried: 0,
      invuln_ticks: 0,
      dash_ticks: 0,
      dash_dir: [0.0, 1.0],
      dash_cd_ticks: 0,
      pulse_cd_ticks: 0,
      charm_ticks: 0,
      respawn_ticks: 0,
      launching: false,
      launch_vel: [0.0, 0.0]
    };

    // Wind state (Night 3)
    this.wind_enabled = this.night === 3;
    this.wind = {
      active: false,
      dir_deg: 0,
      warning: false
    };

    // Spawning flags
    this.random_motes = true;
    this.random_shades = true;
    this.random_drifters = this.night >= 2;

    this.mote_seq = 1;
    this.shade_seq = 1;
    this.drifter_seq = 1;

    this.lanterns = [];
    this.motes = [];
    this.shades = [];
    this.drifters = [];
    this.charms = [];
    this.jump_pads = [];
    this.mote_spawn_points = [];
    this.shade_spawn_points = [];

    this.events = [];
    this.night_started_emitted = false;

    // Contract v1.2: lantern fuel is tracked in integer units of 1/60 fuel (1 unit/tick = 1 fuel/s)
    const t = this.tuning;
    this.FUEL_MAX_U = Math.round((t.fuel_max !== undefined ? t.fuel_max : 100) * 60);
    this.LOW_FUEL_U = Math.round((t.low_fuel_threshold !== undefined ? t.low_fuel_threshold : 30) * 60);
    this.DECAY_U = Math.round((t.fuel_decay_per_s !== undefined ? t.fuel_decay_per_s : 1.0) * 60 / 60);
    this.DRAIN_U = Math.round((t.drain_per_s !== undefined ? t.drain_per_s : 5) * 60 / 60);
    this.FUEL_PER_MOTE_U = Math.round((t.fuel_per_mote !== undefined ? t.fuel_per_mote : 10) * 60);
    this.successful_lights = 0;

    this.setupMapForNight(this.night);
  }

  getCapacity() {
    const cap = (this.tuning.carry_capacity || 10) + 2 * this.successful_lights;
    return Math.min(this.tuning.capacity_max || 20, cap);
  }

  isSafeLantern(l) {
    return l.lit && l.fuel_u >= this.LOW_FUEL_U;
  }

  random() {
    let t = (this.rng_state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  setupMapForNight(night) {
    this.lanterns = [];
    this.mote_spawn_points = [];
    this.shade_spawn_points = [];
    this.jump_pads = [];
    this.charms = [];

    if (night === 1) {
      // Night 1 — Đảo Bến
      const lCoords = [
        [0, 0, 25],
        [23.8, 0, 7.7],
        [14.7, 0, -20.2],
        [-14.7, 0, -20.2],
        [-23.8, 0, 7.7]
      ];
      lCoords.forEach((pos, idx) => {
        this.lanterns.push({ id: `L${idx + 1}`, pos: [...pos], lit: false, deposited: 0, fuel_u: 0, ever_lit: false, relit_count: 0 });
      });

      // Mote spawn points: 8 on r=12 (every 45°), 16 on r=33 (every 22.5°)
      for (let i = 0; i < 8; i++) {
        const [x, z] = polarToXZ(12, i * 45);
        this.mote_spawn_points.push([x, 0, z]);
      }
      for (let i = 0; i < 16; i++) {
        const [x, z] = polarToXZ(33, i * 22.5);
        this.mote_spawn_points.push([x, 0, z]);
      }

      // Shade spawn points: 12 on r=37 (15°, 45°, ...)
      for (let i = 0; i < 12; i++) {
        const [x, z] = polarToXZ(37, 15 + i * 30);
        this.shade_spawn_points.push([x, 0, z]);
      }

      this.shade_spawn_interval = 480; // 8s
      this.shade_max = 6;
      this.shade_speed_night = 4.0;
    } else if (night === 2) {
      // Night 2 — Đảo Cau
      const lCoords = [
        [0, 0, 20],
        [17, 0, -10],
        [-17, 0, -10],
        [70, 0, 20],
        [87, 0, -10],
        [53, 0, -10]
      ];
      lCoords.forEach((pos, idx) => {
        this.lanterns.push({ id: `L${idx + 1}`, pos: [...pos], lit: false, deposited: 0, fuel_u: 0, ever_lit: false, relit_count: 0 });
      });

      // Jump pads
      this.jump_pads.push({
        pos: [20, 0, 18],
        radius: 1.0,
        vel_y: 14.0,
        horiz_speed: 24.0,
        target_center: [70, 0, 0]
      });
      this.jump_pads.push({
        pos: [50, 0, -18],
        radius: 1.0,
        vel_y: 14.0,
        horiz_speed: 24.0,
        target_center: [0, 0, 0]
      });

      // Mote & Shade spawn points for Island A (0,0) and Island B (70,0)
      for (const [cx, cz] of [[0, 0], [70, 0]]) {
        for (let i = 0; i < 4; i++) {
          const [x, z] = polarToXZ(10, i * 90, cx, cz);
          this.mote_spawn_points.push([x, 0, z]);
        }
        for (let i = 0; i < 8; i++) {
          const [x, z] = polarToXZ(22, i * 45, cx, cz);
          this.mote_spawn_points.push([x, 0, z]);
        }
        for (let i = 0; i < 8; i++) {
          const [x, z] = polarToXZ(26, 22.5 + i * 45, cx, cz);
          this.shade_spawn_points.push([x, 0, z]);
        }
      }

      this.charms.push({
        id: 'C1',
        pos: [35, 0, 0],
        available: true,
        respawn_ticks: 0
      });

      this.shade_spawn_interval = 420; // 7s
      this.shade_max = 8;
      this.shade_speed_night = 4.0;
    } else if (night === 3) {
      // Night 3 — Đảo Chuông
      const lCoords = [
        [0, 6, 6],
        [18, 3, 10],
        [-18, 3, 10],
        [35, 0, -10],
        [-35, 0, -10],
        [20, 0, -35],
        [-20, 0, -35]
      ];
      lCoords.forEach((pos, idx) => {
        this.lanterns.push({ id: `L${idx + 1}`, pos: [...pos], lit: false, deposited: 0, fuel_u: 0, ever_lit: false, relit_count: 0 });
      });

      // Jump pad on Tier 1 -> Tier 2
      this.jump_pads.push({
        pos: [0, 3, 13],
        radius: 1.0,
        vel_y: 12.0,
        horiz_speed: 8.0,
        fixed_dir: [0, -1]
      });

      // Mote spawn points (30):
      // Tier 0: 18 points on r=34 (every 20° from 0°)
      for (let i = 0; i < 18; i++) {
        const [x, z] = polarToXZ(34, i * 20);
        this.mote_spawn_points.push([x, 0, z]);
      }
      // Tier 1: 8 points on r=18 (20°, 40°, ..., 160°)
      for (let i = 1; i <= 8; i++) {
        const [x, z] = polarToXZ(18, i * 20);
        this.mote_spawn_points.push([x, 3, z]);
      }
      // Tier 2: 4 points on r=5 (45°, 135°, 225°, 315°)
      for (let i = 0; i < 4; i++) {
        const [x, z] = polarToXZ(5, 45 + i * 90);
        this.mote_spawn_points.push([x, 6, z]);
      }

      // Shade spawn points: 16 on r=43 (every 22.5°)
      for (let i = 0; i < 16; i++) {
        const [x, z] = polarToXZ(43, i * 22.5);
        this.shade_spawn_points.push([x, 0, z]);
      }

      this.charms.push(
        { id: 'C1', pos: [30, 0, 25], available: true, respawn_ticks: 0 },
        { id: 'C2', pos: [-30, 0, 25], available: true, respawn_ticks: 0 }
      );

      this.shade_spawn_interval = 360; // 6s
      this.shade_max = 10;
      this.shade_speed_night = 4.5;
    }
  }

  getSurfaceHeightAt(x, z) {
    if (this.night === 1) {
      const r = Math.hypot(x, z);
      return r <= 40.0 ? 0.0 : -Infinity;
    } else if (this.night === 2) {
      const rA = Math.hypot(x, z);
      const rB = Math.hypot(x - 70.0, z);
      const onBridge = x >= 26.0 && x <= 44.0 && z >= -2.0 && z <= 2.0;
      if (rA <= 28.0 || rB <= 28.0 || onBridge) {
        return 0.0;
      }
      return -Infinity;
    } else if (this.night === 3) {
      const r = Math.hypot(x, z);
      if (r > 45.0) return -Infinity;
      if (r <= 8.0) return 6.0;
      if (r >= 12.0 && r <= 24.0 && z > 0) return 3.0;
      // Check the 2 ramps at 30° and 150°, width 3m (half-width 1.5m), r from 24 to 30
      for (const deg of [30, 150]) {
        const rad = (deg * Math.PI) / 180.0;
        const cosA = Math.cos(rad);
        const sinA = Math.sin(rad);
        const projR = x * cosA + z * sinA;
        const lat = Math.abs(-x * sinA + z * cosA);
        if (lat <= 1.5 && projR >= 24.0 && projR <= 30.0) {
          return 3.0 * ((30.0 - projR) / 6.0);
        }
      }
      return 0.0;
    }
    return 0.0;
  }

  isBlockedByWall(oldX, oldY, oldZ, newX, newY, newZ) {
    if (this.night === 3) {
      // Bell tower at center of Tier 2: radius 2m, height 8m (Y from 6 to 14)
      const newR = Math.hypot(newX, newZ);
      if (newR < 2.0 && newY < 14.0) {
        return true;
      }
      const targetSurfaceY = this.getSurfaceHeightAt(newX, newZ);
      if (targetSurfaceY !== -Infinity && targetSurfaceY > newY + 0.6) {
        // Attempting to walk through a vertical cliff face
        return true;
      }
    }
    return false;
  }

  initDefaultWorld() {
    if (this.random_motes) {
      // Spawn 20 initial motes at 20 distinct spawn points
      const availableIndices = this.mote_spawn_points.map((_, idx) => idx);
      const count = Math.min(20, availableIndices.length);
      for (let i = 0; i < count; i++) {
        const pickIdx = Math.floor(this.random() * availableIndices.length);
        const ptIdx = availableIndices.splice(pickIdx, 1)[0];
        const pt = this.mote_spawn_points[ptIdx];
        this.motes.push({
          id: `M${this.mote_seq++}`,
          pos: [...pt],
          kind: 'random',
          ttl_ticks: null,
          active_from_tick: 0
        });
      }
    }
    // Note: Under Ticket-02 standard schedule, shades spawn at tick 300 (5s), not tick 0.
  }

  spawnScheduledMote() {
    if (this.motes.length >= 30) return null;
    const emptyPoints = this.mote_spawn_points.filter(pt => {
      return !this.motes.some(m => Math.hypot(m.pos[0] - pt[0], m.pos[2] - pt[2]) < 0.2 && Math.abs(m.pos[1] - pt[1]) < 0.5);
    });
    if (emptyPoints.length === 0) return null;
    const pt = emptyPoints[Math.floor(this.random() * emptyPoints.length)];
    const mote = {
      id: `M${this.mote_seq++}`,
      pos: [...pt],
      kind: 'random',
      ttl_ticks: null,
      active_from_tick: this.tick + 1
    };
    this.motes.push(mote);
    return mote;
  }

  spawnScheduledShade() {
    if (this.shades.length >= this.shade_max) return null;
    const validPoints = this.shade_spawn_points.filter(pt => {
      const distToPlayer = Math.hypot(pt[0] - this.player.pos[0], pt[2] - this.player.pos[2]);
      return distToPlayer >= 15.0;
    });
    if (validPoints.length === 0) return null;
    const pt = validPoints[Math.floor(this.random() * validPoints.length)];
    const id = `S${this.shade_seq++}`;
    const shade = {
      id,
      pos: [...pt],
      state: 'spawning',
      state_ticks_left: 1,
      push_ticks_left: 0,
      push_dir: [0, 0],
      recoil_dir: [0, 0],
      wander_angle: this.random() * 2 * Math.PI,
      active_from_tick: this.tick + 1
    };
    this.shades.push(shade);
    this.events.push({
      type: 'event',
      tick: this.tick,
      name: 'shade_spawned',
      data: { id }
    });
    return shade;
  }

  spawnScheduledDrifter() {
    if (this.drifters.length >= 2 || this.shade_spawn_points.length === 0) return null;
    const pt = this.shade_spawn_points[Math.floor(this.random() * this.shade_spawn_points.length)];
    const id = `D${this.drifter_seq++}`;
    const drifter = {
      id,
      pos: [...pt],
      state: 'idle',
      stolen: 0,
      has_stolen: false,
      flee_ticks: 0,
      wander_angle: this.random() * 2 * Math.PI,
      active_from_tick: this.tick + 1
    };
    this.drifters.push(drifter);
    return drifter;
  }

  applyScenario(scenario) {
    if (!scenario) {
      this.initDefaultWorld();
      return;
    }

    if (scenario.time_left_s !== undefined) {
      this.time_left_s = scenario.time_left_s;
      this.time_ticks_left = Math.round(this.time_left_s * 60);
    }

    if (scenario.wind_enabled !== undefined) {
      this.wind_enabled = !!scenario.wind_enabled;
    }

    if (scenario.player) {
      const sp = scenario.player;
      if (sp.pos) {
        this.player.pos = [...sp.pos];
        const surfY = this.getSurfaceHeightAt(this.player.pos[0], this.player.pos[2]);
        this.player.grounded = surfY !== -Infinity && Math.abs(this.player.pos[1] - surfY) < 0.05;
      }
      if (sp.vel) this.player.vel = [...sp.vel];
      if (sp.grounded !== undefined) this.player.grounded = !!sp.grounded;
      if (sp.flames !== undefined) this.player.flames = sp.flames;
      if (sp.carried !== undefined) this.player.carried = sp.carried;
      if (sp.invuln_ticks !== undefined) this.player.invuln_ticks = sp.invuln_ticks;
      if (sp.dash_cd_ticks !== undefined) this.player.dash_cd_ticks = sp.dash_cd_ticks;
      if (sp.pulse_cd_ticks !== undefined) this.player.pulse_cd_ticks = sp.pulse_cd_ticks;
      if (sp.charm_ticks !== undefined) this.player.charm_ticks = sp.charm_ticks;
      if (sp.successful_lights !== undefined) this.successful_lights = sp.successful_lights;
    }

    if (scenario.lanterns) {
      for (const sl of scenario.lanterns) {
        let l = this.lanterns.find(item => item.id === sl.id);
        if (!l) {
          l = {
            id: sl.id,
            pos: sl.pos ? [...sl.pos] : [0, 0, 0],
            lit: false,
            deposited: 0,
            fuel_u: 0,
            ever_lit: false,
            relit_count: 0
          };
          this.lanterns.push(l);
        }
        if (sl.pos) l.pos = [...sl.pos];
        if (sl.lit !== undefined) l.lit = !!sl.lit;
        if (sl.deposited !== undefined) l.deposited = sl.deposited;
        if (l.lit) {
          if (sl.deposited === undefined) l.deposited = this.tuning.lantern_cost;
          l.fuel_u = sl.fuel !== undefined ? Math.round(sl.fuel * 60) : this.FUEL_MAX_U;
          l.ever_lit = true;
        } else {
          l.fuel_u = 0;
        }
        if (sl.ever_lit !== undefined) l.ever_lit = !!sl.ever_lit;
        if (sl.relit_count !== undefined) l.relit_count = sl.relit_count;
      }
    }

    if (scenario.random_motes !== undefined) this.random_motes = !!scenario.random_motes;
    if (scenario.random_shades !== undefined) this.random_shades = !!scenario.random_shades;
    if (scenario.random_drifters !== undefined) this.random_drifters = !!scenario.random_drifters;

    if (scenario.motes !== undefined) {
      this.motes = [];
      for (const m of scenario.motes) {
        if (Array.isArray(m)) {
          this.motes.push({
            id: `M${this.mote_seq++}`,
            pos: [...m],
            kind: 'random',
            ttl_ticks: null,
            active_from_tick: 0
          });
        } else if (m && m.pos) {
          const ttl_ticks = m.ttl_ticks !== undefined ? m.ttl_ticks : (m.ttl_s != null ? Math.round(m.ttl_s * 60) : null);
          this.motes.push({
            id: m.id || `M${this.mote_seq++}`,
            pos: [...m.pos],
            kind: m.kind || (ttl_ticks != null ? 'dropped' : 'random'),
            ttl_ticks,
            active_from_tick: 0
          });
        }
      }
    } else if (this.random_motes) {
      this.initDefaultWorld();
    }

    if (scenario.shades !== undefined) {
      this.shades = [];
      for (const s of scenario.shades) {
        const id = s.id || `S${this.shade_seq++}`;
        const numId = parseInt(id.replace(/\D/g, ''), 10);
        if (!isNaN(numId) && numId >= this.shade_seq) this.shade_seq = numId + 1;
        const dPlayer = Math.hypot(s.pos[0] - this.player.pos[0], s.pos[2] - this.player.pos[2]);
        const defaultState = dPlayer <= 12.0 ? 'chase' : 'wander';
        const st = s.state || defaultState;
        const stTicks = s.state_ticks_left !== undefined ? s.state_ticks_left : (st === 'stunned' ? 120 : (st === 'recoil' ? 60 : 0));
        this.shades.push({
          id,
          pos: [...s.pos],
          state: st,
          state_ticks_left: stTicks,
          push_ticks_left: 0,
          push_dir: [1, 0],
          recoil_dir: [-1, 0],
          wander_angle: 0,
          active_from_tick: 0,
          target_lantern_id: s.target_lantern_id || null,
          drain_count: 0
        });
      }
    }

    if (scenario.drifters !== undefined) {
      this.drifters = [];
      for (const d of scenario.drifters) {
        const id = d.id || `D${this.drifter_seq++}`;
        const numId = parseInt(id.replace(/\D/g, ''), 10);
        if (!isNaN(numId) && numId >= this.drifter_seq) this.drifter_seq = numId + 1;
        const st = d.state || 'idle';
        this.drifters.push({
          id,
          pos: [...d.pos],
          state: st,
          stolen: d.stolen || 0,
          has_stolen: (d.stolen || 0) > 0 || st === 'flee',
          flee_ticks: d.flee_ticks !== undefined ? d.flee_ticks : (d.state_ticks_left !== undefined ? d.state_ticks_left : (st === 'flee' ? 240 : 0)),
          wander_angle: 0,
          active_from_tick: 0
        });
      }
    }

    if (scenario.charms !== undefined) {
      this.charms = [];
      for (const c of scenario.charms) {
        const respTicks = c.respawn_ticks !== undefined ? c.respawn_ticks : (c.respawn_s != null ? Math.round(c.respawn_s * 60) : 0);
        this.charms.push({
          id: c.id || `C${this.charms.length + 1}`,
          pos: c.pos ? [...c.pos] : [35, 0, 0],
          available: c.available !== undefined ? !!c.available : respTicks <= 0,
          respawn_ticks: respTicks
        });
      }
    }
  }

  step(input = {}) {
    if (this.state === 'won' || this.state === 'lost') return [];

    this.events = [];
    this.tick += 1;

    // 1. Read input (process pause first; if just paused or currently paused, stop step here)
    if (input.pause) {
      if (!this.is_paused) {
        this.is_paused = true;
        this.state = 'paused';
        this.events.push({
          type: 'event',
          tick: this.tick,
          name: 'paused',
          data: {}
        });
        return this.events;
      } else {
        this.is_paused = false;
        this.state = 'playing';
        this.events.push({
          type: 'event',
          tick: this.tick,
          name: 'resumed',
          data: {}
        });
      }
    } else if (this.is_paused) {
      return this.events;
    }

    this.sim_tick += 1;

    if (!this.night_started_emitted) {
      this.night_started_emitted = true;
      this.events.push({
        type: 'event',
        tick: this.tick,
        name: 'night_start',
        data: { night: this.night }
      });
    }

    // 2. Decrement counters: time, cooldowns, invuln, stun, charm, dropped mote TTL, charm respawn
    this.time_ticks_left = Math.max(0, this.time_ticks_left - 1);
    this.time_left_s = this.time_ticks_left / 60.0;

    if (this.player.invuln_ticks > 0) this.player.invuln_ticks--;
    if (this.player.dash_cd_ticks > 0) this.player.dash_cd_ticks--;
    if (this.player.pulse_cd_ticks > 0) this.player.pulse_cd_ticks--;
    if (this.player.charm_ticks > 0) {
      this.player.charm_ticks--;
      this.player.dash_cd_ticks = 0; // No dash cooldown while charm active
    }
    if (this.player.dash_ticks > 0) this.player.dash_ticks--;

    // Respawn waiting counter after falling
    let justRespawned = false;
    if (this.player.respawn_ticks > 0) {
      this.player.respawn_ticks--;
      if (this.player.respawn_ticks === 0) {
        this.player.pos = [0.0, 0.0, 0.0];
        this.player.vel = [0.0, 0.0, 0.0];
        this.player.facing = [0.0, 1.0];
        this.player.grounded = true;
        this.player.launching = false;
        this.player.invuln_ticks = 90;
        justRespawned = true;
      }
    }

    // Shades state counters
    for (const shade of this.shades) {
      if (shade.state_ticks_left > 0) {
        shade.state_ticks_left--;
        if (shade.state_ticks_left <= 0) {
          if (shade.state === 'stunned') {
            shade.state = 'wander'; // Contract v1.2: stun ends -> wander
            shade.target_lantern_id = null;
          } else if (shade.state === 'spawning') {
            const dP = Math.hypot(shade.pos[0] - this.player.pos[0], shade.pos[2] - this.player.pos[2]);
            shade.state = dP <= 12.0 ? 'chase' : 'wander';
          }
        }
      }
      if (shade.safe_push_ticks > 0) {
        shade.safe_push_ticks--;
      }
    }

    // Lantern fuel: natural decay (1/s) and drain by Shades (5/s each), then lanterns at fuel <= 0 go out
    for (const l of this.lanterns) {
      if (l.lit) l.fuel_u -= this.DECAY_U;
    }
    for (const shade of this.shades) {
      if (shade.state !== 'drain') continue;
      const tl = this.lanterns.find(l => l.id === shade.target_lantern_id);
      if (tl && tl.lit) {
        tl.fuel_u -= this.DRAIN_U;
        shade.drain_count = (shade.drain_count || 0) + 1;
        if (shade.drain_count % 60 === 0) {
          this.events.push({
            type: 'event',
            tick: this.tick,
            name: 'fuel_drain',
            data: { lantern_id: tl.id, shade_id: shade.id, fuel: Math.round(Math.max(0, tl.fuel_u) / 6) / 10 }
          });
        }
      }
    }
    for (const l of this.lanterns) {
      if (l.lit && l.fuel_u <= 0) {
        l.lit = false;
        l.fuel_u = 0;
        l.deposited = 0;
        l.ever_lit = true;
        l.just_lit = false;
        this.events.push({
          type: 'event',
          tick: this.tick,
          name: 'lantern_out',
          data: { lantern_id: l.id }
        });
      }
    }

    // Drifter flee counters
    for (let i = this.drifters.length - 1; i >= 0; i--) {
      const d = this.drifters[i];
      if (d.state === 'flee' && d.flee_ticks > 0) {
        d.flee_ticks--;
        if (d.flee_ticks <= 0) {
          this.drifters.splice(i, 1);
        }
      }
    }

    // Dropped mote TTL
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i];
      if (m.ttl_ticks !== null && m.ttl_ticks !== undefined) {
        m.ttl_ticks--;
        if (m.ttl_ticks <= 0) {
          this.motes.splice(i, 1);
        }
      }
    }

    // Charm respawn counters
    for (const c of this.charms) {
      if (!c.available && c.respawn_ticks > 0) {
        c.respawn_ticks--;
        if (c.respawn_ticks <= 0) {
          c.available = true;
          c.respawn_ticks = 0;
        }
      }
    }

    // Wind schedule on Night 3: every 30s (1800 ticks) lasts 5s (300 ticks)
    if (this.wind_enabled) {
      const cycle = this.sim_tick % 1800;
      if (this.sim_tick >= 1800 && cycle === 0) {
        this.wind.active = true;
        this.wind.dir_deg = round3(this.random() * 360.0);
      } else if (this.wind.active && cycle >= 300) {
        this.wind.active = false;
        this.wind.dir_deg = 0;
      }
    } else {
      this.wind.active = false;
      this.wind.dir_deg = 0;
    }

    // 3. Move Mây (jump, dash, jump pads, wind) and check falling off island
    if (this.player.respawn_ticks === 0 && !justRespawned) {
      const move = input.move || [0, 0];
      const camYawDeg = input.cam_yaw_deg || 0;
      let mx = move[0];
      let mz = move[1];
      const len = Math.hypot(mx, mz);
      if (len > 1.0) {
        mx /= len;
        mz /= len;
      }
      const theta = (camYawDeg * Math.PI) / 180.0;
      const worldDx = mx * Math.cos(theta) + mz * Math.sin(theta);
      const worldDz = -mx * Math.sin(theta) + mz * Math.cos(theta);
      const worldLen = Math.hypot(worldDx, worldDz);

      if (worldLen > 0.001) {
        this.player.facing = [worldDx / worldLen, worldDz / worldLen];
      }

      // Trigger Dash
      const canDash = this.player.dash_ticks === 0 && (this.player.dash_cd_ticks === 0 || this.player.charm_ticks > 0);
      if (input.dash && canDash) {
        this.player.dash_ticks = Math.round(this.tuning.dash_duration_s * 60); // 12 ticks
        this.player.dash_cd_ticks = this.player.charm_ticks > 0 ? 0 : Math.round(this.tuning.dash_cooldown_s * 60); // 90 ticks
        if (worldLen > 0.001) {
          this.player.dash_dir = [worldDx / worldLen, worldDz / worldLen];
        } else {
          this.player.dash_dir = [...this.player.facing];
        }
        this.player.launching = false;
        this.player.vel[1] = 0;
        this.events.push({
          type: 'event',
          tick: this.tick,
          name: 'dash',
          data: {}
        });
      }

      // Trigger Jump (only when grounded and not dashing)
      if (input.jump && this.player.grounded && this.player.dash_ticks === 0) {
        this.player.vel[1] = 7.0;
        this.player.grounded = false;
      }

      // Compute horizontal velocity
      const runSpeed = this.player.charm_ticks > 0 ? 7.2 : this.tuning.player_speed;
      if (this.player.dash_ticks > 0) {
        this.player.vel[0] = this.player.dash_dir[0] * this.tuning.dash_speed;
        this.player.vel[2] = this.player.dash_dir[1] * this.tuning.dash_speed;
        this.player.vel[1] = 0.0; // Dash in air keeps height constant
      } else if (this.player.launching) {
        this.player.vel[0] = this.player.launch_vel[0];
        this.player.vel[2] = this.player.launch_vel[1];
      } else {
        this.player.vel[0] = worldDx * runSpeed;
        this.player.vel[2] = worldDz * runSpeed;
        if (this.wind.active) {
          const wRad = (this.wind.dir_deg * Math.PI) / 180.0;
          this.player.vel[0] += Math.cos(wRad) * 2.0;
          this.player.vel[2] += Math.sin(wRad) * 2.0;
        }
      }

      // Apply horizontal displacement
      const dt = 1.0 / 60.0;
      const oldX = this.player.pos[0];
      const oldY = this.player.pos[1];
      const oldZ = this.player.pos[2];
      let nextX = oldX + this.player.vel[0] * dt;
      let nextZ = oldZ + this.player.vel[2] * dt;

      if (!this.isBlockedByWall(oldX, oldY, oldZ, nextX, oldY, nextZ)) {
        this.player.pos[0] = nextX;
        this.player.pos[2] = nextZ;
      } else if (this.night === 3 && Math.hypot(nextX, nextZ) < 2.0) {
        // Push out to radius 2.0 around Bell Tower
        const r = Math.hypot(nextX, nextZ) || 0.001;
        this.player.pos[0] = (nextX / r) * 2.0;
        this.player.pos[2] = (nextZ / r) * 2.0;
      }

      // Check surface below new XZ
      const surfY = this.getSurfaceHeightAt(this.player.pos[0], this.player.pos[2]);

      if (this.player.dash_ticks > 0) {
        // Keep height constant during dash; if dashed over a higher ramp/ground, clamp to surface
        if (surfY !== -Infinity && Math.abs(surfY - this.player.pos[1]) <= 0.6) {
          this.player.pos[1] = surfY;
          this.player.grounded = true;
        } else if (surfY === -Infinity || this.player.pos[1] > surfY + 0.05) {
          this.player.grounded = false;
        }
      } else {
        if (this.player.grounded) {
          if (surfY !== -Infinity && Math.abs(surfY - oldY) <= 0.6) {
            this.player.pos[1] = surfY;
            this.player.vel[1] = 0.0;
          } else {
            // Stepped off island or cliff edge
            this.player.grounded = false;
          }
        }

        if (!this.player.grounded) {
          const prevY = this.player.pos[1];
          this.player.pos[1] += this.player.vel[1] * dt;
          this.player.vel[1] -= 20.0 * dt; // Gravity -20 m/s^2
          if (this.player.vel[1] <= 0 && surfY !== -Infinity && this.player.pos[1] <= surfY && prevY >= surfY - 0.5) {
            this.player.pos[1] = surfY;
            this.player.vel[1] = 0.0;
            this.player.grounded = true;
            this.player.launching = false;
          }
        }
      }

      // Check Jump Pads
      for (const pad of this.jump_pads) {
        const dPad = Math.hypot(this.player.pos[0] - pad.pos[0], this.player.pos[2] - pad.pos[2]);
        if (dPad <= pad.radius && Math.abs(this.player.pos[1] - pad.pos[1]) <= 0.5) {
          let dirX = 0;
          let dirZ = 0;
          if (pad.fixed_dir) {
            dirX = pad.fixed_dir[0];
            dirZ = pad.fixed_dir[1];
          } else if (pad.target_center) {
            const dx = pad.target_center[0] - this.player.pos[0];
            const dz = pad.target_center[2] - this.player.pos[2];
            const d = Math.hypot(dx, dz) || 1.0;
            dirX = dx / d;
            dirZ = dz / d;
          }
          this.player.vel[1] = pad.vel_y;
          this.player.launch_vel = [dirX * pad.horiz_speed, dirZ * pad.horiz_speed];
          this.player.vel[0] = this.player.launch_vel[0];
          this.player.vel[2] = this.player.launch_vel[1];
          this.player.grounded = false;
          this.player.launching = true;
          this.player.dash_ticks = 0;
          break;
        }
      }

      // Check falling off island (Y < -10)
      if (this.player.pos[1] < -10.0) {
        this.player.flames -= 1;
        const lost = this.player.carried;
        this.player.carried = 0;
        this.player.vel = [0.0, 0.0, 0.0];
        this.player.launching = false;
        this.player.dash_ticks = 0;
        this.events.push({
          type: 'event',
          tick: this.tick,
          name: 'player_hit',
          data: {
            by: 'fall',
            flames: this.player.flames,
            dropped: 0,
            lost: lost
          }
        });
        if (this.player.flames > 0) {
          this.player.respawn_ticks = 60;
        }
      }
    }

    const canPlayerInteract = this.player.respawn_ticks === 0 && this.player.flames > 0;

    // 4. Pick up Motes and Charms
    if (canPlayerInteract) {
      for (let i = 0; i < this.motes.length; i++) {
        const mote = this.motes[i];
        if (mote.active_from_tick > this.tick) continue;
        const dXZ = Math.hypot(mote.pos[0] - this.player.pos[0], mote.pos[2] - this.player.pos[2]);
        const dY = Math.abs(this.player.pos[1] - mote.pos[1]);
        if (dXZ <= this.tuning.pickup_radius && dY <= 1.5) {
          if (this.player.carried < this.getCapacity()) {
            this.player.carried += 1;
            this.motes.splice(i, 1);
            i--;
            this.events.push({
              type: 'event',
              tick: this.tick,
              name: 'mote_picked',
              data: { carried: this.player.carried }
            });
          }
        }
      }

      for (const charm of this.charms) {
        if (charm.available) {
          const dXZ = Math.hypot(charm.pos[0] - this.player.pos[0], charm.pos[2] - this.player.pos[2]);
          const dY = Math.abs(this.player.pos[1] - charm.pos[1]);
          if (dXZ <= this.tuning.pickup_radius && dY <= 1.5) {
            charm.available = false;
            charm.respawn_ticks = 2700;
            this.player.charm_ticks = 600;
            this.player.dash_cd_ticks = 0;
            this.events.push({
              type: 'event',
              tick: this.tick,
              name: 'charm_picked',
              data: { charm_id: charm.id, charm_ticks: 600 }
            });
          }
        }
      }
    }

    // 5. Interact with Lantern (light / relight / refuel)
    if (canPlayerInteract && input.interact && this.player.carried > 0) {
      let bestLantern = null;
      let bestDist = Infinity;

      for (const lantern of this.lanterns) {
        // Only lanterns that can receive: unlit, or lit but not full of fuel
        const receivable = !lantern.lit || lantern.fuel_u < this.FUEL_MAX_U;
        if (!receivable) continue;
        const dXZ = Math.hypot(lantern.pos[0] - this.player.pos[0], lantern.pos[2] - this.player.pos[2]);
        const dY = Math.abs(lantern.pos[1] - this.player.pos[1]);
        if (dXZ <= this.tuning.interact_radius && dY <= 2.0) {
          if (dXZ < bestDist - 1e-9 || (Math.abs(dXZ - bestDist) <= 1e-9 && (!bestLantern || lantern.id < bestLantern.id))) {
            bestDist = dXZ;
            bestLantern = lantern;
          }
        }
      }

      if (bestLantern) {
        const sc = this.tuning.score;
        if (bestLantern.lit) {
          // Refuel: used = min(carried, ceil((100 - fuel) / 10))
          const neededMotes = Math.ceil((this.FUEL_MAX_U - bestLantern.fuel_u) / this.FUEL_PER_MOTE_U);
          const used = Math.min(this.player.carried, neededMotes);
          if (used > 0) {
            const wasLow = bestLantern.fuel_u < this.LOW_FUEL_U;
            this.player.carried -= used;
            bestLantern.fuel_u = Math.min(this.FUEL_MAX_U, bestLantern.fuel_u + this.FUEL_PER_MOTE_U * used);
            this.score += used * sc.per_mote;
            this.events.push({
              type: 'event',
              tick: this.tick,
              name: 'refuel',
              data: {
                lantern_id: bestLantern.id,
                amount: used,
                fuel: Math.round(bestLantern.fuel_u / 6) / 10
              }
            });
            if (wasLow && bestLantern.fuel_u >= this.LOW_FUEL_U) {
              bestLantern.just_lit = true; // regain safe zone: push Shades out for up to 30 ticks
            }
          }
        } else {
          const cost = bestLantern.ever_lit ? this.tuning.relight_cost : this.tuning.lantern_cost;
          const needed = cost - bestLantern.deposited;
          const amount = Math.min(this.player.carried, needed);
          if (amount > 0) {
            this.player.carried -= amount;
            bestLantern.deposited += amount;
            this.score += amount * sc.per_mote;
            this.events.push({
              type: 'event',
              tick: this.tick,
              name: 'deposit',
              data: {
                lantern_id: bestLantern.id,
                amount: amount,
                deposited: bestLantern.deposited
              }
            });
            if (bestLantern.deposited >= cost) {
              const relight = bestLantern.ever_lit;
              bestLantern.lit = true;
              bestLantern.fuel_u = this.FUEL_MAX_U;
              bestLantern.ever_lit = true;
              bestLantern.just_lit = true;
              this.successful_lights += 1;
              if (relight) {
                bestLantern.relit_count += 1;
                this.score += sc.per_relight;
              } else {
                this.score += sc.per_lantern;
              }
              this.events.push({
                type: 'event',
                tick: this.tick,
                name: 'lantern_lit',
                data: { lantern_id: bestLantern.id, relight: relight }
              });
            }
          }
        }
      }
    }

    // 6. Update Safe Zones (only lit lanterns with fuel >= 30 keep a safe zone)
    const litLanterns = this.lanterns.filter(l => this.isSafeLantern(l));
    for (const l of litLanterns) {
      if (l.just_lit) {
        for (const shade of this.shades) {
          const d = Math.hypot(shade.pos[0] - l.pos[0], shade.pos[2] - l.pos[2]);
          if (d < this.tuning.safe_radius) {
            shade.safe_push_lantern = l;
            shade.safe_push_ticks = 30;
          }
        }
        l.just_lit = false;
      }
    }

    for (const shade of this.shades) {
      if (shade.safe_push_lantern && shade.safe_push_ticks > 0) {
        const l = shade.safe_push_lantern;
        const dx = shade.pos[0] - l.pos[0];
        const dz = shade.pos[2] - l.pos[2];
        const d = Math.hypot(dx, dz);
        if (d < this.tuning.safe_radius) {
          const remainingDist = this.tuning.safe_radius - d;
          const stepOut = remainingDist / Math.max(1, shade.safe_push_ticks);
          const dirX = d > 0.0001 ? dx / d : 1.0;
          const dirZ = d > 0.0001 ? dz / d : 0.0;
          shade.pos[0] += dirX * stepOut;
          shade.pos[2] += dirZ * stepOut;
        } else {
          shade.safe_push_lantern = null;
          shade.safe_push_ticks = 0;
        }
      }
    }

    // 7. Pulse (Tỏa Sáng)
    if (canPlayerInteract && input.pulse && this.player.pulse_cd_ticks <= 0 && this.player.carried >= this.tuning.pulse_cost) {
      this.player.carried -= this.tuning.pulse_cost;
      this.player.pulse_cd_ticks = Math.round(this.tuning.pulse_cooldown_s * 60); // 180 ticks
      const pulseCenterY = this.player.pos[1] + 0.8;
      const stunned_ids = [];

      for (const shade of this.shades) {
        if (shade.active_from_tick > this.tick) continue;
        const dx = shade.pos[0] - this.player.pos[0];
        const dz = shade.pos[2] - this.player.pos[2];
        const dist3DRaw = Math.hypot(dx, shade.pos[1] - pulseCenterY, dz);
        const dist3DLevel = Math.hypot(dx, shade.pos[1] - this.player.pos[1], dz);
        if (Math.min(dist3DRaw, dist3DLevel) <= this.tuning.pulse_radius + 1e-6) {
          const wasDrain = shade.state === 'drain';
          shade.state = 'stunned';
          shade.target_lantern_id = null;
          shade.state_ticks_left = Math.round(this.tuning.pulse_stun_s * 60); // 120 ticks
          shade.push_ticks_left = 15;
          const dXZ = Math.hypot(dx, dz);
          if (dXZ > 0.0001) {
            shade.push_dir = [dx / dXZ, dz / dXZ];
          } else {
            shade.push_dir = [1.0, 0.0];
          }
          stunned_ids.push(shade.id);
          this.score += wasDrain ? this.tuning.score.per_stun_drain : this.tuning.score.per_stun;
        }
      }

      // Check Drifters hit by Pulse
      for (const drifter of this.drifters) {
        if (drifter.active_from_tick > this.tick) continue;
        const dx = drifter.pos[0] - this.player.pos[0];
        const dz = drifter.pos[2] - this.player.pos[2];
        const dist3DRaw = Math.hypot(dx, drifter.pos[1] - pulseCenterY, dz);
        const dist3DLevel = Math.hypot(dx, drifter.pos[1] - this.player.pos[1], dz);
        if (Math.min(dist3DRaw, dist3DLevel) <= this.tuning.pulse_radius + 1e-6) {
          if (drifter.state === 'chase') {
            drifter.state = 'flee';
            drifter.flee_ticks = 240;
          } else if (drifter.state === 'flee' && drifter.stolen > 0) {
            const amount = drifter.stolen;
            for (let m = 0; m < amount; m++) {
              const angle = (m * 2 * Math.PI) / amount;
              const r = amount > 1 ? 0.4 : 0.0;
              this.motes.push({
                id: `M${this.mote_seq++}`,
                pos: [round3(drifter.pos[0] + Math.cos(angle) * r), drifter.pos[1], round3(drifter.pos[2] + Math.sin(angle) * r)],
                kind: 'dropped',
                ttl_ticks: 480,
                active_from_tick: this.tick + 1
              });
            }
            drifter.stolen = 0;
            drifter.flee_ticks = 120;
            this.events.push({
              type: 'event',
              tick: this.tick,
              name: 'drifter_drop',
              data: { drifter_id: drifter.id, amount: amount }
            });
          }
        }
      }

      this.events.push({
        type: 'event',
        tick: this.tick,
        name: 'pulse',
        data: { stunned_ids }
      });
    }

    // 8. Move Shades and Drifters
    const shadeSpd = (this.shade_speed_night || this.tuning.shade_speed) / 60.0;
    const playerInSafeZone = litLanterns.some(l =>
      Math.hypot(this.player.pos[0] - l.pos[0], this.player.pos[2] - l.pos[2]) < this.tuning.safe_radius
    );

    for (const shade of this.shades) {
      if (shade.active_from_tick > this.tick) continue;
      if (shade.state === 'spawning') continue;

      if (shade.state === 'stunned') {
        if (shade.push_ticks_left > 0) {
          const stepDist = this.tuning.pulse_push_m / 15.0;
          const nx = shade.pos[0] + shade.push_dir[0] * stepDist;
          const nz = shade.pos[2] + shade.push_dir[1] * stepDist;
          const surfY = this.getSurfaceHeightAt(nx, nz);
          if (surfY !== -Infinity && !this.isBlockedByWall(shade.pos[0], shade.pos[1], shade.pos[2], nx, shade.pos[1], nz)) {
            shade.pos[0] = nx;
            shade.pos[2] = nz;
            shade.push_ticks_left--;
          } else {
            shade.push_ticks_left = 0;
          }
        }
        continue;
      }

      if (shade.state === 'recoil') {
        const recoilStep = 2.0 / 60.0;
        const nx = shade.pos[0] + shade.recoil_dir[0] * recoilStep;
        const nz = shade.pos[2] + shade.recoil_dir[1] * recoilStep;
        if (this.getSurfaceHeightAt(nx, nz) !== -Infinity) {
          shade.pos[0] = nx;
          shade.pos[2] = nz;
        }
        if (shade.state_ticks_left <= 0) {
          const dP = Math.hypot(shade.pos[0] - this.player.pos[0], shade.pos[2] - this.player.pos[2]);
          shade.state = dP <= 12.0 ? 'chase' : 'wander';
        }
        continue;
      }

      const dxP = this.player.pos[0] - shade.pos[0];
      const dzP = this.player.pos[2] - shade.pos[2];
      const distP = Math.hypot(dxP, dzP);

      if (shade.state === 'drain') {
        const tl = this.lanterns.find(l => l.id === shade.target_lantern_id);
        const dT = tl ? Math.hypot(tl.pos[0] - shade.pos[0], tl.pos[2] - shade.pos[2]) : Infinity;
        if (canPlayerInteract && distP <= 6.0) {
          shade.state = 'chase';
          shade.target_lantern_id = null;
        } else if (!tl || !tl.lit || tl.fuel_u >= this.LOW_FUEL_U || dT > 2.0) {
          shade.state = 'wander';
          shade.target_lantern_id = null;
        }
      }

      if (shade.state === 'wander') {
        if (distP <= 12.0 && !playerInSafeZone && canPlayerInteract) {
          shade.state = 'chase';
          shade.target_lantern_id = null;
        }
      } else if (shade.state === 'chase') {
        if (distP > 18.0 || playerInSafeZone || !canPlayerInteract) {
          shade.state = 'wander';
        }
      }

      if (shade.state === 'chase') {
        if (distP > 0.0001) {
          let nx = shade.pos[0] + (dxP / distP) * shadeSpd;
          let nz = shade.pos[2] + (dzP / distP) * shadeSpd;
          // Blocked at 6m boundary of lit lanterns
          for (const l of litLanterns) {
            const dL = Math.hypot(nx - l.pos[0], nz - l.pos[2]);
            if (dL < this.tuning.safe_radius && shade.safe_push_ticks <= 0) {
              const dirLX = dL > 0.0001 ? (nx - l.pos[0]) / dL : 1.0;
              const dirLZ = dL > 0.0001 ? (nz - l.pos[2]) / dL : 0.0;
              nx = l.pos[0] + dirLX * this.tuning.safe_radius;
              nz = l.pos[2] + dirLZ * this.tuning.safe_radius;
            }
          }
          shade.pos[0] = nx;
          shade.pos[2] = nz;
        }
      } else if (shade.state === 'wander') {
        // Contract v1.2: wanderers hunt the nearest weak lit lantern (fuel < 30), else the nearest unlit lantern
        const distTo = l => Math.hypot(l.pos[0] - shade.pos[0], l.pos[2] - shade.pos[2]);
        const pickNearest = list => {
          let best = null;
          let bestD = Infinity;
          for (const l of list) {
            const d = distTo(l);
            if (d < bestD - 1e-9 || (Math.abs(d - bestD) <= 1e-9 && best && l.id < best.id)) {
              best = l;
              bestD = d;
            }
          }
          return best;
        };
        const weak = pickNearest(this.lanterns.filter(l => l.lit && l.fuel_u < this.LOW_FUEL_U));
        const target = weak || pickNearest(this.lanterns.filter(l => !l.lit));

        if (target) {
          const dT = distTo(target);
          if (weak && dT <= 2.0) {
            shade.state = 'drain';
            shade.target_lantern_id = target.id;
            shade.drain_count = 0;
          } else if (dT > 2.0) {
            const tx = (target.pos[0] - shade.pos[0]) / dT;
            const tz = (target.pos[2] - shade.pos[2]) / dT;
            const nx = shade.pos[0] + tx * shadeSpd;
            const nz = shade.pos[2] + tz * shadeSpd;
            const blockedBySafe = litLanterns.some(l => l !== target && Math.hypot(nx - l.pos[0], nz - l.pos[2]) < this.tuning.safe_radius);
            if (this.getSurfaceHeightAt(nx, nz) !== -Infinity && !blockedBySafe) {
              shade.pos[0] = nx;
              shade.pos[2] = nz;
            }
          }
        } else {
          const wanderSpd = 1.5 / 60.0;
          let nx = shade.pos[0] + Math.cos(shade.wander_angle) * wanderSpd;
          let nz = shade.pos[2] + Math.sin(shade.wander_angle) * wanderSpd;
          const blockedBySafe = litLanterns.some(l => Math.hypot(nx - l.pos[0], nz - l.pos[2]) < this.tuning.safe_radius);
          if (this.getSurfaceHeightAt(nx, nz) === -Infinity || blockedBySafe) {
            shade.wander_angle += Math.PI * 0.75;
          } else {
            shade.pos[0] = nx;
            shade.pos[2] = nz;
          }
        }
      }
    }

    // Move Drifters
    for (const drifter of this.drifters) {
      if (drifter.active_from_tick > this.tick) continue;
      const dxP = this.player.pos[0] - drifter.pos[0];
      const dzP = this.player.pos[2] - drifter.pos[2];
      const distP = Math.hypot(dxP, dzP);

      if (drifter.state !== 'flee') {
        if (canPlayerInteract && this.player.carried >= 5 && distP <= 15.0) {
          drifter.state = 'chase';
        } else {
          drifter.state = 'idle';
        }
      }

      if (drifter.state === 'chase') {
        const spd = 7.0 / 60.0;
        if (distP > 0.0001) {
          drifter.pos[0] += (dxP / distP) * spd;
          drifter.pos[2] += (dzP / distP) * spd;
        }
      } else if (drifter.state === 'flee') {
        const spd = 7.0 / 60.0;
        const dirX = distP > 0.0001 ? -dxP / distP : 1.0;
        const dirZ = distP > 0.0001 ? -dzP / distP : 0.0;
        drifter.pos[0] += dirX * spd;
        drifter.pos[2] += dirZ * spd;
      } else if (drifter.state === 'idle') {
        const spd = 2.0 / 60.0;
        const nx = drifter.pos[0] + Math.cos(drifter.wander_angle) * spd;
        const nz = drifter.pos[2] + Math.sin(drifter.wander_angle) * spd;
        if (this.getSurfaceHeightAt(nx, nz) === -Infinity) {
          drifter.wander_angle += Math.PI * 0.8;
        } else {
          drifter.pos[0] = nx;
          drifter.pos[2] = nz;
        }
      }
    }

    // 9. Contact: Drifters steal first, then Shades hit (sorted by ID ascending)
    if (canPlayerInteract) {
      const compareIds = (a, b) => {
        const na = parseInt(a.id.replace(/\D/g, ''), 10);
        const nb = parseInt(b.id.replace(/\D/g, ''), 10);
        if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
        return a.id.localeCompare(b.id);
      };

      const sortedDrifters = [...this.drifters].sort(compareIds);
      for (const drifter of sortedDrifters) {
        if (drifter.active_from_tick > this.tick) continue;
        if (drifter.state !== 'flee' && !drifter.has_stolen) {
          const dXZ = Math.hypot(drifter.pos[0] - this.player.pos[0], drifter.pos[2] - this.player.pos[2]);
          if (dXZ <= 1.2 && this.player.carried > 0) {
            const amount = Math.min(3, this.player.carried);
            this.player.carried -= amount;
            drifter.stolen = amount;
            drifter.has_stolen = true;
            drifter.state = 'flee';
            drifter.flee_ticks = 240;
            this.events.push({
              type: 'event',
              tick: this.tick,
              name: 'drifter_steal',
              data: {
                drifter_id: drifter.id,
                amount: amount,
                carried: this.player.carried
              }
            });
          }
        }
      }

      const sortedShades = [...this.shades].sort(compareIds);
      for (const shade of sortedShades) {
        if (shade.active_from_tick > this.tick) continue;
        if (shade.state === 'stunned' || shade.state === 'recoil' || shade.state === 'spawning') continue;
        if (shade.safe_push_ticks > 0) continue;

        const dXZ = Math.hypot(shade.pos[0] - this.player.pos[0], shade.pos[2] - this.player.pos[2]);
        const dY = Math.abs(shade.pos[1] - this.player.pos[1]);
        if (dXZ <= this.tuning.shade_hit_radius && dY <= 1.5) {
          if (this.player.invuln_ticks <= 0) {
            const dropped = Math.floor(this.player.carried / 2);
            this.player.carried -= dropped;
            this.player.flames -= 1;
            this.player.invuln_ticks = Math.round(this.tuning.invuln_s * 60); // 90 ticks

            // Drop motes in 1.5 - 2.5m ring around Mây
            const dropY = this.getSurfaceHeightAt(this.player.pos[0], this.player.pos[2]);
            const moteY = dropY !== -Infinity ? dropY : this.player.pos[1];
            for (let m = 0; m < dropped; m++) {
              const r = 1.5 + this.random() * 1.0;
              const angle = this.random() * 2 * Math.PI;
              this.motes.push({
                id: `M${this.mote_seq++}`,
                pos: [round3(this.player.pos[0] + Math.cos(angle) * r), moteY, round3(this.player.pos[2] + Math.sin(angle) * r)],
                kind: 'dropped',
                ttl_ticks: 480,
                active_from_tick: this.tick + 1
              });
            }

            // Shade enters recoil (back 2m over 60 ticks)
            shade.state = 'recoil';
            shade.state_ticks_left = 60;
            const dx = shade.pos[0] - this.player.pos[0];
            const dz = shade.pos[2] - this.player.pos[2];
            const d = Math.hypot(dx, dz);
            shade.recoil_dir = d > 0.0001 ? [dx / d, dz / d] : [-1.0, 0.0];

            this.events.push({
              type: 'event',
              tick: this.tick,
              name: 'player_hit',
              data: {
                by: 'shade',
                flames: this.player.flames,
                dropped: dropped
              }
            });
          }
        }
      }
    }

    // 10. Spawn Motes, Shades, Drifters on schedule (interactable from next tick)
    if (this.random_motes && this.sim_tick > 0 && this.sim_tick % 240 === 0) {
      this.spawnScheduledMote();
    }

    if (this.random_shades && this.sim_tick >= 300) {
      if (this.sim_tick === 300) {
        this.spawnScheduledShade();
        this.spawnScheduledShade();
      } else if ((this.sim_tick - 300) % this.shade_spawn_interval === 0) {
        this.spawnScheduledShade();
      }
    }

    if (this.random_drifters && this.night >= 2 && this.sim_tick >= 1200 && this.sim_tick % 1200 === 0) {
      this.spawnScheduledDrifter();
    }

    // 11. Check Win / Lose (Contract v1.2: survive until dawn with enough lanterns lit)
    if (this.player.flames <= 0) {
      this.endGame('lost', 'no_flames');
    } else if (this.time_ticks_left <= 0) {
      const total = this.lanterns.length;
      const needed = Math.ceil((this.tuning.win_ratio !== undefined ? this.tuning.win_ratio : 0.6) * total - 1e-9);
      const litNow = this.lanterns.filter(l => l.lit).length;
      if (litNow >= needed) {
        this.endGame('won', 'dawn_survived');
      } else {
        this.endGame('lost', 'dawn');
      }
    }

    return this.events;
  }

  endGame(result, reason) {
    this.state = result;
    this.reason = reason;
    if (result === 'won') {
      for (const l of this.lanterns) {
        if (l.lit) {
          this.score += this.tuning.score.per_lit_lantern_dawn + Math.floor(l.fuel_u / 60);
        }
      }
      this.score += this.player.flames * this.tuning.score.per_flame_left;
    }
    this.events.push({
      type: 'event',
      tick: this.tick,
      name: 'game_over',
      data: { result, reason }
    });
  }

  getSnapshot() {
    return {
      type: 'snapshot',
      tick: this.tick,
      sim_tick: this.sim_tick,
      night: this.night,
      state: this.state,
      time_left_s: round3(this.time_left_s),
      score: this.score,
      wind: {
        active: this.wind.active,
        dir_deg: round3(this.wind.dir_deg)
      },
      player: {
        pos: [round3(this.player.pos[0]), round3(this.player.pos[1]), round3(this.player.pos[2])],
        vel: [round3(this.player.vel[0]), round3(this.player.vel[1]), round3(this.player.vel[2])],
        grounded: this.player.grounded,
        flames: this.player.flames,
        carried: this.player.carried,
        capacity: this.getCapacity(),
        invuln: this.player.invuln_ticks > 0,
        dash_cd_s: round3(this.player.dash_cd_ticks / 60.0),
        pulse_cd_s: round3(this.player.pulse_cd_ticks / 60.0),
        charm_s: round3(this.player.charm_ticks / 60.0)
      },
      lanterns: this.lanterns.map(l => ({
        id: l.id,
        pos: [round3(l.pos[0]), round3(l.pos[1]), round3(l.pos[2])],
        lit: l.lit,
        fuel: Math.round(Math.max(0, l.fuel_u) / 6) / 10,
        ever_lit: l.ever_lit,
        relit_count: l.relit_count,
        deposited: l.deposited
      })),
      shades: this.shades.map(s => ({
        id: s.id,
        pos: [round3(s.pos[0]), round3(s.pos[1]), round3(s.pos[2])],
        state: s.state
      })),
      motes_active: this.motes.length,
      motes: this.motes.map(m => ({
        id: m.id,
        pos: [round3(m.pos[0]), round3(m.pos[1]), round3(m.pos[2])],
        kind: m.kind || 'random',
        ttl_s: m.ttl_ticks != null ? round3(m.ttl_ticks / 60.0) : null
      })),
      drifters: this.drifters.map(d => ({
        id: d.id,
        pos: [round3(d.pos[0]), round3(d.pos[1]), round3(d.pos[2])],
        state: d.state,
        stolen: d.stolen
      })),
      charms: this.charms.map(c => ({
        id: c.id,
        pos: [round3(c.pos[0]), round3(c.pos[1]), round3(c.pos[2])],
        available: c.available,
        respawn_s: round3(c.respawn_ticks / 60.0)
      }))
    };
  }

  // Contract v1.3 Benchmark Scene (Night 1: 200 wandering Shades, 100 Motes, L1-L3 lit @ 100 fuel)
  initBenchWorld() {
    this.random_motes = false;
    this.random_shades = false;
    this.random_drifters = false;
    this.motes = [];
    this.shades = [];
    this.drifters = [];
    this.player.pos = [0.0, 0.0, 0.0];
    this.player.vel = [0.0, 0.0, 0.0];

    // Light L1-L3 with fuel 100
    for (const l of this.lanterns) {
      if (l.id === 'L1' || l.id === 'L2' || l.id === 'L3') {
        l.lit = true;
        l.fuel_u = this.FUEL_MAX_U;
        l.ever_lit = true;
        l.deposited = this.tuning.lantern_cost || 10;
      } else {
        l.lit = false;
        l.fuel_u = 0;
        l.deposited = 0;
      }
    }

    const safeLanterns = this.lanterns.filter(l => this.isSafeLantern(l));

    // Spawn 200 Shades evenly spread on Night 1 island (r <= 38m), outside safe zones
    for (let i = 0; i < 200; i++) {
      let x = 0, z = 0;
      for (let attempt = 0; attempt < 20; attempt++) {
        const r = Math.sqrt(this.random()) * 37.5;
        const theta = this.random() * Math.PI * 2;
        x = round3(r * Math.cos(theta));
        z = round3(r * Math.sin(theta));
        const inSafe = safeLanterns.some(l => Math.hypot(x - l.pos[0], z - l.pos[2]) < this.tuning.safe_radius + 0.5);
        if (!inSafe) break;
      }
      this.shades.push({
        id: `S${this.shade_seq++}`,
        pos: [x, 0.0, z],
        state: 'wander',
        state_ticks_left: 0,
        push_ticks_left: 0,
        push_dir: [1, 0],
        recoil_dir: [-1, 0],
        wander_angle: this.random() * Math.PI * 2,
        active_from_tick: 0,
        target_lantern_id: null,
        drain_count: 0
      });
    }

    // Spawn 100 Motes spread on Night 1 island (bench allowed to exceed gameplay cap)
    for (let i = 0; i < 100; i++) {
      const r = Math.sqrt(this.random()) * 37.5;
      const theta = this.random() * Math.PI * 2;
      this.motes.push({
        id: `M${this.mote_seq++}`,
        pos: [round3(r * Math.cos(theta)), 0.0, round3(r * Math.sin(theta))],
        kind: 'random',
        ttl_ticks: null,
        active_from_tick: 0
      });
    }
  }

  // Contract v1.3 Benchmark Step: Shades wander normally; spawning, damage, pickup, fuel decay & win/lose disabled
  stepBench(dtSeconds = 1 / 60) {
    this.tick += 1;
    this.sim_tick += 1;
    const shadeSpd = (this.shade_speed_night || this.tuning.shade_speed) * dtSeconds;
    const litLanterns = this.lanterns.filter(l => this.isSafeLantern(l));
    const unlitLanterns = this.lanterns.filter(l => !l.lit);

    for (const shade of this.shades) {
      let target = null;
      let bestD = Infinity;
      for (const l of unlitLanterns) {
        const d = Math.hypot(l.pos[0] - shade.pos[0], l.pos[2] - shade.pos[2]);
        if (d < bestD - 1e-9 || (Math.abs(d - bestD) <= 1e-9 && bestD < Infinity && target && l.id < target.id)) {
          target = l;
          bestD = d;
        }
      }

      if (target && bestD > 2.0) {
        const tx = (target.pos[0] - shade.pos[0]) / bestD;
        const tz = (target.pos[2] - shade.pos[2]) / bestD;
        const nx = shade.pos[0] + tx * shadeSpd;
        const nz = shade.pos[2] + tz * shadeSpd;
        const blockedBySafe = litLanterns.some(l => Math.hypot(nx - l.pos[0], nz - l.pos[2]) < this.tuning.safe_radius);
        if (this.getSurfaceHeightAt(nx, nz) !== -Infinity && !blockedBySafe) {
          shade.pos[0] = nx;
          shade.pos[2] = nz;
        }
      } else {
        // Orbit/wander smoothly around unlit lantern or island
        shade.wander_angle += 0.6 * dtSeconds;
        const wanderSpd = 1.5 * dtSeconds;
        const nx = shade.pos[0] + Math.cos(shade.wander_angle) * wanderSpd;
        const nz = shade.pos[2] + Math.sin(shade.wander_angle) * wanderSpd;
        const blockedBySafe = litLanterns.some(l => Math.hypot(nx - l.pos[0], nz - l.pos[2]) < this.tuning.safe_radius);
        if (this.getSurfaceHeightAt(nx, nz) !== -Infinity && !blockedBySafe) {
          shade.pos[0] = nx;
          shade.pos[2] = nz;
        } else {
          shade.wander_angle += Math.PI * 0.7;
        }
      }
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GameEngine;
}
if (typeof window !== 'undefined') {
  window.GameEngine = GameEngine;
}

