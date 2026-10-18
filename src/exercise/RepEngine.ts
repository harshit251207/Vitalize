import { EXERCISES, LM, MESSAGES } from './config';
import type { ExerciseConfig, ExerciseId, Level, Side } from './config';

export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface FrameInput {
  /** Normalized (0-1) image landmarks, 33 points. */
  landmarks: Landmark[];
  /** 3D world landmarks in metres (preferred for angles). Optional. */
  worldLandmarks?: Landmark[];
  /** Frame size, used only when worldLandmarks are missing. */
  size?: { width: number; height: number };
  /** ms, defaults to Date.now(). Pass your own for tests. */
  timestamp?: number;
}

/** waiting: not in start pose yet | start: ready | moving: rep in progress | end: target reached, returning */
export type Phase = 'waiting' | 'start' | 'moving' | 'end';

export interface EngineState {
  reps: number;
  /** Reps done without a form warning. */
  cleanReps: number;
  phase: Phase;
  angle: number | null;
  side: Side | null;
  poseVisible: boolean;
  feedback: string | null;
}

export interface EngineOptions {
  minVisibility: number;
  smoothingWindow: number;
  minRepMs: number;
  feedbackMs: number;
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const DEFAULTS: EngineOptions = {
  minVisibility: 0.25,
  smoothingWindow: 2,
  minRepMs: 300,
  feedbackMs: 2000,
};

/** Angle at point b (degrees) between segments b->a and b->c. */
export function angle3D(a: Vec3, b: Vec3, c: Vec3): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const v2 = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const n1 = Math.hypot(v1.x, v1.y, v1.z);
  const n2 = Math.hypot(v2.x, v2.y, v2.z);
  if (n1 === 0 || n2 === 0) return NaN;
  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const cos = Math.max(-1, Math.min(1, dot / (n1 * n2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

const vis = (l?: Landmark) => (l ? l.visibility ?? 1 : 0);

export class RepEngine {
  private cfg: ExerciseConfig;
  private level: Level;
  private opts: EngineOptions;

  private reps = 0;
  private cleanReps = 0;
  private phase: Phase = 'waiting';
  private angle: number | null = null;
  private side: Side | null = null;
  private poseVisible = false;
  private buf: number[] = [];
  private lastRepAt = -Infinity;
  private repFormOk = true;
  private now = 0;
  private fb: { text: string; until: number } | null = null;

  constructor(exercise: ExerciseId, level: Level = 'intermediate', opts: Partial<EngineOptions> = {}) {
    this.cfg = EXERCISES[exercise];
    this.level = level;
    this.opts = { ...DEFAULTS, ...opts };
  }

  /** Switch exercise/level. Resets the session. */
  configure(exercise: ExerciseId, level: Level) {
    this.cfg = EXERCISES[exercise];
    this.level = level;
    this.reset();
  }

  reset() {
    this.reps = 0;
    this.cleanReps = 0;
    this.phase = 'waiting';
    this.angle = null;
    this.side = null;
    this.poseVisible = false;
    this.buf = [];
    this.lastRepAt = -Infinity;
    this.repFormOk = true;
    this.fb = null;
  }

  snapshot(): EngineState {
    return {
      reps: this.reps,
      cleanReps: this.cleanReps,
      phase: this.phase,
      angle: this.angle,
      side: this.side,
      poseVisible: this.poseVisible,
      feedback: this.fb && this.now < this.fb.until ? this.fb.text : null,
    };
  }

  /** Feed one detection result (or null when no pose was found). */
  update(frame: FrameInput | null): EngineState {
    this.now = frame?.timestamp ?? Date.now();
    if (!frame || frame.landmarks.length < 33) return this.lose();

    const side = this.pickSide(frame.landmarks);
    if (!side) return this.lose();
    if (side !== this.side) {
      this.side = side;
      this.buf = [];
    }
    this.poseVisible = true;

    const pts = this.points(frame, side);
    const raw = angle3D(pts.shoulder, pts.elbow, pts.wrist);
    if (Number.isNaN(raw)) return this.snapshot();

    this.angle = this.smooth(raw);
    this.step(this.angle, frame, side, pts);
    return this.snapshot();
  }

  // ---------- internals ----------

  private lose(): EngineState {
    this.poseVisible = false;
    this.angle = null;
    this.side = null;
    this.buf = [];
    return this.snapshot();
  }

  private smooth(a: number): number {
    this.buf.push(a);
    if (this.buf.length > this.opts.smoothingWindow) this.buf.shift();
    return this.buf.reduce((s, v) => s + v, 0) / this.buf.length;
  }

  private sideVisibility(lms: Landmark[], side: Side): number {
    const ix = LM[side];
    return Math.min(vis(lms[ix.shoulder]), vis(lms[ix.elbow]), vis(lms[ix.wrist]));
  }

  /** Track whichever arm is better visible; stick to current arm unless the other is clearly better. */
  private pickSide(lms: Landmark[]): Side | null {
    const l = this.sideVisibility(lms, 'left');
    const r = this.sideVisibility(lms, 'right');
    const min = this.opts.minVisibility;
    if (this.side) {
      const cur = this.side === 'left' ? l : r;
      const other = this.side === 'left' ? r : l;
      if (cur >= min && other < cur + 0.15) return this.side;
    }
    if (Math.max(l, r) < min) return null;
    return l >= r ? 'left' : 'right';
  }

  private points(frame: FrameInput, side: Side) {
    const ix = LM[side];
    const useWorld = !!frame.worldLandmarks && frame.worldLandmarks.length >= 33;
    const src = useWorld ? frame.worldLandmarks! : frame.landmarks;
    const w = useWorld ? 1 : frame.size?.width ?? 1;
    const h = useWorld ? 1 : frame.size?.height ?? 1;
    const p = (i: number): Vec3 => ({ x: src[i].x * w, y: src[i].y * h, z: (src[i].z ?? 0) * w });
    return { shoulder: p(ix.shoulder), elbow: p(ix.elbow), wrist: p(ix.wrist), hip: p(ix.hip) };
  }

  private say(text: string) {
    this.fb = { text, until: this.now + this.opts.feedbackMs };
  }

  private step(a: number, frame: FrameInput, side: Side, pts: ReturnType<RepEngine['points']>) {
    const t = this.cfg.thresholds[this.level];
    const dir = Math.sign(t.end - t.start); // +1: angle grows during rep (press), -1: shrinks (curl)
    const inStart = dir > 0 ? a <= t.start : a >= t.start;
    const pastMid = dir > 0 ? a >= (t.start + t.end) / 2 : a <= (t.start + t.end) / 2;
    let atEnd = dir > 0 ? a >= t.end : a <= t.end;

    if (atEnd && this.cfg.wristAboveShoulderAtEnd) {
      const ix = LM[side];
      atEnd = frame.landmarks[ix.wrist].y < frame.landmarks[ix.shoulder].y; // image y grows downward
    }

    switch (this.phase) {
      case 'waiting':
        if (inStart) this.phase = 'start';
        break;

      case 'start':
        if (pastMid) {
          this.phase = 'moving';
          this.repFormOk = true;
        }
        break;

      case 'moving':
        if (atEnd) {
          this.completeRep();
        } else if (inStart) {
          this.say(MESSAGES.incomplete);
          this.phase = 'start';
        }
        break;

      case 'end':
        if (inStart) this.phase = 'start';
        break;
    }

    if ((this.phase === 'moving' || this.phase === 'end') && this.cfg.maxUpperArmDrift) {
      const ix = LM[side];
      if (vis(frame.landmarks[ix.hip]) >= this.opts.minVisibility) {
        const drift = angle3D(pts.hip, pts.shoulder, pts.elbow);
        if (drift > this.cfg.maxUpperArmDrift[this.level]) {
          this.repFormOk = false;
          this.say(MESSAGES.elbowDrift);
        }
      }
    }
  }

  private completeRep() {
    this.phase = 'end';
    if (this.now - this.lastRepAt < this.opts.minRepMs) return; // too fast = jitter
    this.lastRepAt = this.now;
    this.reps += 1;
    if (this.repFormOk) this.cleanReps += 1;
  }
}
