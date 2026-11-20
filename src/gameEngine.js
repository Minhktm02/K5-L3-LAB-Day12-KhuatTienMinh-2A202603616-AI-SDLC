class GameEngine {
  constructor(contract, seed = 42) {
    this.contract = contract;
    this.tuning = contract.tuning;
    this.seed = seed;
    this.sim_tick = 0;
    this.tick = 0;
    this.state = 'playing'; // playing, won, lost
    this.reason = null;
    this.score = 0;
    this.island_radius = 40.0; // Island radius in meters
    
    // Mulberry32 PRNG for deterministic randomness
    this.rng_state = seed >>> 0;
    
    // Player
    this.player = {
      pos: [0.0, 0.0, 0.0],
      velocity_y: 0.0,
      is_grounded: true,
      flames: this.tuning.flames,
      carried: 0,
      invuln_ticks: 0,
      pulse_cd_ticks: 0
    };

    // Lanterns L1..L5
    this.lanterns = [];
    const count = this.tuning.lantern_count_night1 || 5;
    const lRadius = 25.0;
    for (let i = 0; i < count; i++) {
      const angle = (i * 2 * Math.PI) / count;
      const lx = Math.round(Math.cos(angle) * lRadius * 1000) / 1000;
      const lz = Math.round(Math.sin(angle) * lRadius * 1000) / 1000;
      this.lanterns.push({
        id: `L${i + 1}`,
        pos: [lx, 0.0, lz],
        lit: false,
        deposited: 0
      });
    }

    this.shades = [];
    this.motes = [];
    this.shade_seq = 1;
    this.mote_seq = 1;
    this.time_left_s = this.tuning.night1_duration_s;
    this.events = [];
    
    // Spawning defaults if not overridden by scenario
    this.random_motes = true;
    this.random_shades = true;
  }

  random() {
    let t = (this.rng_state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  initDefaultWorld() {
    if (this.random_motes) {
      // Spawn 20 initial motes
      for (let i = 0; i < 20; i++) {
        this.spawnRandomMote();
      }
    }
    if (this.random_shades) {
      // Spawn 3 initial shades
      for (let i = 0; i < 3; i++) {
        this.spawnRandomShade();
      }
    }
  }

  spawnRandomMote() {
    const angle = this.random() * 2 * Math.PI;
    const dist = Math.sqrt(this.random()) * (this.island_radius - 2.0);
    const x = Math.round(Math.cos(angle) * dist * 1000) / 1000;
    const z = Math.round(Math.sin(angle) * dist * 1000) / 1000;
    const mote = {
      id: `M${this.mote_seq++}`,
      pos: [x, 0.0, z]
    };
    this.motes.push(mote);
    return mote;
  }

  spawnRandomShade() {
    const angle = this.random() * 2 * Math.PI;
    const dist = 15.0 + this.random() * (this.island_radius - 17.0);
    const x = Math.round(Math.cos(angle) * dist * 1000) / 1000;
    const z = Math.round(Math.sin(angle) * dist * 1000) / 1000;
    const id = `S${this.shade_seq++}`;
    const shade = {
      id: id,
      pos: [x, 0.0, z],
      state: 'chase',
      stun_ticks: 0
    };
    this.shades.push(shade);
    this.events.push({
      type: 'event',
      tick: this.tick,
      name: 'shade_spawned',
      data: { id: id }
    });
    return shade;
  }

  applyScenario(scenario) {
    if (!scenario) {
      this.initDefaultWorld();
      return;
    }
    if (scenario.time_left_s !== undefined) {
      this.time_left_s = scenario.time_left_s;
    }
    if (scenario.player) {
      if (scenario.player.pos) this.player.pos = [...scenario.player.pos];
      if (scenario.player.flames !== undefined) this.player.flames = scenario.player.flames;
      if (scenario.player.carried !== undefined) this.player.carried = scenario.player.carried;
    }
    if (scenario.lanterns) {
      for (const sl of scenario.lanterns) {
        let l = this.lanterns.find(item => item.id === sl.id);
        if (l) {
          if (sl.pos) l.pos = [...sl.pos];
          if (sl.lit !== undefined) l.lit = sl.lit;
          if (sl.deposited !== undefined) l.deposited = sl.deposited;
        } else {
          this.lanterns.push({
            id: sl.id,
            pos: sl.pos ? [...sl.pos] : [0, 0, 0],
            lit: !!sl.lit,
            deposited: sl.deposited || 0
          });
        }
      }
    }
    if (scenario.random_motes !== undefined) this.random_motes = scenario.random_motes;
    if (scenario.random_shades !== undefined) this.random_shades = scenario.random_shades;

    if (scenario.motes !== undefined) {
      this.motes = [];
      for (const m of scenario.motes) {
        if (Array.isArray(m)) {
          this.motes.push({ id: `M${this.mote_seq++}`, pos: [...m] });
        } else if (m.pos) {
          this.motes.push({ id: m.id || `M${this.mote_seq++}`, pos: [...m.pos] });
        }
      }
    } else if (this.random_motes) {
      for (let i = 0; i < 20; i++) this.spawnRandomMote();
    }

    if (scenario.shades !== undefined) {
      this.shades = [];
      for (const s of scenario.shades) {
        const id = s.id || `S${this.shade_seq++}`;
        this.shades.push({
          id: id,
          pos: [...s.pos],
          state: s.state || 'chase',
          stun_ticks: 0
        });
      }
    } else if (this.random_shades) {
      for (let i = 0; i < 3; i++) this.spawnRandomShade();
    }
  }

  step(input = {}) {
    if (this.state !== 'playing') return [];
    
    this.events = [];
    this.sim_tick += 1;
    this.tick += 1;
    
    // Decrement time_left_s
    this.time_left_s = Math.max(0, this.time_left_s - 1.0 / 60.0);

    // Player cooldowns
    if (this.player.invuln_ticks > 0) this.player.invuln_ticks--;
    if (this.player.pulse_cd_ticks > 0) this.player.pulse_cd_ticks--;

    // 1. Process Player Movement
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
    // x' = x*cos(theta) + z*sin(theta), z' = -x*sin(theta) + z*cos(theta)
    const worldDx = mx * Math.cos(theta) + mz * Math.sin(theta);
    const worldDz = -mx * Math.sin(theta) + mz * Math.cos(theta);

    const speed = this.tuning.player_speed / 60.0;
    this.player.pos[0] += worldDx * speed;
    this.player.pos[2] += worldDz * speed;

    // Jump / Physics if fall_enabled or jump triggered
    if (input.jump && this.player.is_grounded) {
      this.player.velocity_y = 5.0; // Jump velocity
      this.player.is_grounded = false;
    }
    if (!this.player.is_grounded) {
      this.player.pos[1] += this.player.velocity_y / 60.0;
      this.player.velocity_y -= 9.8 / 60.0;
      if (this.player.pos[1] <= 0) {
        this.player.pos[1] = 0;
        this.player.velocity_y = 0;
        this.player.is_grounded = true;
      }
    }

    // Check Island boundary / Fall
    const pDistFromCenter = Math.hypot(this.player.pos[0], this.player.pos[2]);
    if (pDistFromCenter > this.island_radius) {
      if (this.tuning.fall_enabled) {
        const dropped = Math.floor(this.player.carried * this.tuning.hit_drop_ratio);
        this.player.carried -= dropped;
        this.player.flames -= 1;
        this.player.pos = [0.0, 0.0, 0.0];
        this.player.velocity_y = 0.0;
        this.player.is_grounded = true;
        this.player.invuln_ticks = Math.round(this.tuning.invuln_s * 60);
        this.events.push({
          type: 'event',
          tick: this.tick,
          name: 'player_hit',
          data: { by: 'fall', flames: this.player.flames, dropped: dropped }
        });
        if (this.player.flames <= 0) {
          this.endGame('lost', 'no_flames');
          return this.events;
        }
      } else {
        // Clamp to island boundary
        const factor = this.island_radius / pDistFromCenter;
        this.player.pos[0] *= factor;
        this.player.pos[2] *= factor;
      }
    }

    // 2. Pulse action
    if (input.pulse && this.player.pulse_cd_ticks <= 0 && this.player.carried >= this.tuning.pulse_cost) {
      this.player.carried -= this.tuning.pulse_cost;
      this.player.pulse_cd_ticks = Math.round(this.tuning.pulse_cooldown_s * 60);
      const stunned_ids = [];
      for (const shade of this.shades) {
        const d = Math.hypot(shade.pos[0] - this.player.pos[0], shade.pos[2] - this.player.pos[2]);
        if (d <= this.tuning.pulse_radius) {
          shade.state = 'stunned';
          shade.stun_ticks = Math.round(this.tuning.pulse_stun_s * 60);
          stunned_ids.push(shade.id);
          this.score += this.tuning.score.per_stun;
          // Push shade away
          if (d > 0.001) {
            const pushDirX = (shade.pos[0] - this.player.pos[0]) / d;
            const pushDirZ = (shade.pos[2] - this.player.pos[2]) / d;
            shade.pos[0] += pushDirX * this.tuning.pulse_push_m;
            shade.pos[2] += pushDirZ * this.tuning.pulse_push_m;
          }
        }
      }
      this.events.push({
        type: 'event',
        tick: this.tick,
        name: 'pulse',
        data: { stunned_ids: stunned_ids }
      });
    }

    // 3. Interact (Deposit motes into Lantern)
    if (input.interact) {
      for (const lantern of this.lanterns) {
        if (!lantern.lit) {
          const d = Math.hypot(lantern.pos[0] - this.player.pos[0], lantern.pos[2] - this.player.pos[2]);
          if (d <= this.tuning.interact_radius && this.player.carried > 0) {
            const needed = this.tuning.lantern_cost - lantern.deposited;
            const depositAmount = Math.min(this.player.carried, needed);
            this.player.carried -= depositAmount;
            lantern.deposited += depositAmount;
            this.events.push({
              type: 'event',
              tick: this.tick,
              name: 'deposit',
              data: { lantern_id: lantern.id, amount: depositAmount, deposited: lantern.deposited }
            });
            if (lantern.deposited >= this.tuning.lantern_cost) {
              lantern.lit = true;
              this.score += this.tuning.score.per_lantern;
              this.events.push({
                type: 'event',
                tick: this.tick,
                name: 'lantern_lit',
                data: { lantern_id: lantern.id }
              });
            }
          }
        }
      }
      // Check win condition
      if (this.lanterns.every(l => l.lit)) {
        this.endGame('won', 'all_lit');
        return this.events;
      }
    }

    // 4. Pickup Motes
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const mote = this.motes[i];
      const d = Math.hypot(mote.pos[0] - this.player.pos[0], mote.pos[2] - this.player.pos[2]);
      if (d <= this.tuning.pickup_radius) {
        if (this.player.carried < this.tuning.carry_capacity) {
          this.player.carried += 1;
          this.score += this.tuning.score.per_mote;
          this.motes.splice(i, 1);
          this.events.push({
            type: 'event',
            tick: this.tick,
            name: 'mote_picked',
            data: { carried: this.player.carried }
          });
        }
      }
    }

    // 5. Update Shades (Chasing & Stun logic & Lit Lantern avoidance)
    const litLanterns = this.lanterns.filter(l => l.lit);
    const shadeSpeed = this.tuning.shade_speed / 60.0;

    for (const shade of this.shades) {
      if (shade.state === 'stunned') {
        shade.stun_ticks--;
        if (shade.stun_ticks <= 0) {
          shade.state = 'chase';
        }
        continue;
      }

      // Safe zone near lit lanterns: shade cannot enter safe_radius
      let isNearSafeZone = false;
      for (const l of litLanterns) {
        const dL = Math.hypot(shade.pos[0] - l.pos[0], shade.pos[2] - l.pos[2]);
        if (dL < this.tuning.safe_radius) {
          isNearSafeZone = true;
          // Push shade out of safe zone
          if (dL > 0.001) {
            const pushDirX = (shade.pos[0] - l.pos[0]) / dL;
            const pushDirZ = (shade.pos[2] - l.pos[2]) / dL;
            shade.pos[0] = l.pos[0] + pushDirX * this.tuning.safe_radius;
            shade.pos[2] = l.pos[2] + pushDirZ * this.tuning.safe_radius;
          }
        }
      }

      // Player in safe zone? If player is within safe_radius of any lit lantern, shades hesitate / don't chase
      const playerInSafeZone = litLanterns.some(l => 
        Math.hypot(this.player.pos[0] - l.pos[0], this.player.pos[2] - l.pos[2]) <= this.tuning.safe_radius
      );

      if (!playerInSafeZone) {
        const dx = this.player.pos[0] - shade.pos[0];
        const dz = this.player.pos[2] - shade.pos[2];
        const dist = Math.hypot(dx, dz);
        if (dist > 0.001) {
          shade.pos[0] += (dx / dist) * shadeSpeed;
          shade.pos[2] += (dz / dist) * shadeSpeed;
        }
      }

      // Check collision with player
      const dPlayer = Math.hypot(shade.pos[0] - this.player.pos[0], shade.pos[2] - this.player.pos[2]);
      if (dPlayer <= this.tuning.shade_hit_radius && this.player.invuln_ticks <= 0) {
        const dropped = Math.floor(this.player.carried * this.tuning.hit_drop_ratio);
        this.player.carried -= dropped;
        this.player.flames -= 1;
        this.player.invuln_ticks = Math.round(this.tuning.invuln_s * 60);
        this.events.push({
          type: 'event',
          tick: this.tick,
          name: 'player_hit',
          data: { by: 'shade', flames: this.player.flames, dropped: dropped }
        });
        if (this.player.flames <= 0) {
          this.endGame('lost', 'no_flames');
          return this.events;
        }
      }
    }

    // 6. Check Time out
    if (this.time_left_s <= 0) {
      this.endGame('lost', 'dawn');
      return this.events;
    }

    return this.events;
  }

  endGame(result, reason) {
    this.state = result;
    this.reason = reason;
    if (result === 'won') {
      this.score += Math.floor(this.time_left_s) * this.tuning.score.per_second_left;
      this.score += this.player.flames * this.tuning.score.per_flame_left;
    }
    this.events.push({
      type: 'event',
      tick: this.tick,
      name: 'game_over',
      data: { result: result, reason: reason }
    });
  }

  getSnapshot() {
    const round3 = n => Math.round(n * 1000) / 1000;
    return {
      type: 'snapshot',
      tick: this.tick,
      sim_tick: this.sim_tick,
      state: this.state,
      time_left_s: round3(this.time_left_s),
      score: this.score,
      player: {
        pos: [round3(this.player.pos[0]), round3(this.player.pos[1]), round3(this.player.pos[2])],
        flames: this.player.flames,
        carried: this.player.carried
      },
      lanterns: this.lanterns.map(l => ({
        id: l.id,
        pos: [round3(l.pos[0]), round3(l.pos[1]), round3(l.pos[2])],
        lit: l.lit,
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
        pos: [round3(m.pos[0]), round3(m.pos[1]), round3(m.pos[2])]
      }))
    };
  }
}

module.exports = GameEngine;
