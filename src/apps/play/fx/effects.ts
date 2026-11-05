import raw from '../../../config/effects-config.json'
import './fx.css'

// Efectos de src/config/effects-config.json: sonido sintetizado con Web Audio (con vibrato y eco), vibración
// (con feature-detection) y keyframes CSS. Cada evento sale de la config; no se inventan efectos.

interface Note {
  wave: string // sine | triangle | square | sawtooth | noise
  freqFrom?: number
  freqTo?: number
  at: number
  ms: number
  gain: number
  filter?: number
  vibrato?: { rate: number; depth: number }
  echo?: { ms: number; feedback: number; mix: number }
}

interface EventFx {
  animation: { preset: string; durationMs: number; easing: string; barMs?: number }
  sound: { preset: string; notes: Note[] }
  vibrate: { preset: string; pattern: number[] }
}

export type FxEvent = 'cursor' | 'submenuEnter' | 'actionExecute' | 'back' | 'resourceSpend' | 'hpChange' | 'rest' | 'sheetPageChange' | 'start' | 'sheetEnter' | 'cardOpen' | 'tabChange'
export type HpSide = 'damage' | 'heal'

interface EffectsConfig {
  masterVolume: number
  synth: { attackMs: number }
  events: Record<Exclude<FxEvent, 'hpChange'>, EventFx> & { hpChange: Record<HpSide, EventFx> }
}

const config = raw as EffectsConfig

export function eventFx(ev: FxEvent, side: HpSide = 'damage'): EventFx {
  return ev === 'hpChange' ? config.events.hpChange[side] : config.events[ev]
}

// --- Audio (Web Audio). Se desbloquea con el primer toque ("Tocá para empezar"). ---
const MUTE_KEY = 'sat.muted'
let ac: AudioContext | null = null
let master: GainNode | null = null
let noiseBuf: AudioBuffer | null = null
let muted = readMuted()

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export const isMuted = () => muted

export function setMuted(value: boolean) {
  muted = value
  if (master) master.gain.value = muted ? 0 : config.masterVolume
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
  } catch {
    // sin storage: el mute dura la sesión
  }
}

export function unlockAudio() {
  if (!ac) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    ac = new AC()
    master = ac.createGain()
    master.gain.value = muted ? 0 : config.masterVolume
    master.connect(ac.destination)
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  if (ac.state === 'suspended') void ac.resume()
}

function playSound(notes: readonly Note[]) {
  if (!notes.length || muted || !ac || !master || !noiseBuf) return
  const out = master
  const t0 = ac.currentTime + 0.01
  for (const n of notes) {
    const start = t0 + n.at / 1000
    const end = start + n.ms / 1000
    const g = ac.createGain()
    g.gain.setValueAtTime(0.0001, start)
    g.gain.linearRampToValueAtTime(n.gain, start + config.synth.attackMs / 1000)
    g.gain.exponentialRampToValueAtTime(0.0001, end)
    let src: AudioBufferSourceNode | OscillatorNode
    if (n.wave === 'noise') {
      const b = ac.createBufferSource()
      b.buffer = noiseBuf
      src = b
    } else {
      const o = ac.createOscillator()
      o.type = n.wave as OscillatorType
      const from = n.freqFrom ?? 440
      const to = n.freqTo ?? from
      o.frequency.setValueAtTime(from, start)
      if (to !== from) o.frequency.exponentialRampToValueAtTime(to, end)
      if (n.vibrato) {
        const lfo = ac.createOscillator()
        const depth = ac.createGain()
        lfo.frequency.value = n.vibrato.rate
        depth.gain.value = n.vibrato.depth
        lfo.connect(depth)
        depth.connect(o.detune)
        lfo.start(start)
        lfo.stop(end + 0.02)
      }
      src = o
    }
    let node: AudioNode = src
    if (n.filter) {
      const f = ac.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.value = n.filter
      src.connect(f)
      node = f
    }
    node.connect(g)
    g.connect(out)
    if (n.echo) echo(ac, out, g, n.echo, end)
    src.start(start)
    src.stop(end + 0.02)
  }
}

// Eco: delay con realimentación; se desconecta cuando la cola cae a ~−60 dB.
function echo(ctx: AudioContext, out: AudioNode, input: AudioNode, e: NonNullable<Note['echo']>, end: number) {
  const d = ctx.createDelay(1)
  const fb = ctx.createGain()
  const wet = ctx.createGain()
  d.delayTime.value = e.ms / 1000
  fb.gain.value = e.feedback
  wet.gain.value = e.mix
  input.connect(d)
  d.connect(fb)
  fb.connect(d)
  d.connect(wet)
  wet.connect(out)
  const tailMs = Math.min(4000, (e.ms * Math.log(0.001)) / Math.log(e.feedback))
  setTimeout(() => {
    d.disconnect()
    fb.disconnect()
    wet.disconnect()
  }, (end - ctx.currentTime) * 1000 + tailMs)
}

// --- Vibración (no existe en iOS: siempre con feature-detection) ---
function vibrate(pattern: readonly number[]) {
  if (typeof navigator.vibrate !== 'function' || !pattern.length) return
  try {
    navigator.vibrate([...pattern])
  } catch {
    // bloqueada por el navegador
  }
}

// --- Animaciones ---
// Capas globales (destello, tajo) que registra <FxLayer>.
const layers: { overlay: HTMLElement | null; slash: HTMLElement | null } = { overlay: null, slash: null }
export function registerLayer(name: keyof typeof layers, el: HTMLElement | null) {
  layers[name] = el
}

// Sin la limpieza en animationend, el último keyframe queda aplicado inline (la fila quedaba corrida o transparente).
export function playAnim(el: HTMLElement | null | undefined, name: string, ms: number, easing: string, delay = 0) {
  if (!el || !ms) return
  el.style.animation = 'none'
  void el.offsetWidth
  el.style.animation = `${name} ${ms}ms ${easing} ${delay}ms both`
  // animationend burbujea: solo cuenta el del propio elemento, no el de una fila hija
  const done = (e: AnimationEvent) => {
    if (e.target !== el) return
    el.style.animation = ''
    el.removeEventListener('animationend', done)
  }
  el.addEventListener('animationend', done)
}

function transition(el: HTMLElement | null | undefined, name: string, dir: number, ms: number, easing: string) {
  if (!el) return
  el.style.setProperty('--dir', String(dir))
  playAnim(el, `fx-tr-${name}`, ms, easing)
}

function overlay(color: string, name: string, ms: number, easing: string) {
  layers.overlay?.style.setProperty('--fx-color', color)
  playAnim(layers.overlay, name, ms, easing)
}

// Cómo se mueve el cursor: 'snap' salta, 'slide' se desliza.
export function cursorTransition(): string {
  const a = eventFx('cursor').animation
  return a.preset === 'snap' ? 'none' : `transform ${a.durationMs}ms ${a.easing}`
}

export const hpBarMs = (side: HpSide) => eventFx('hpChange', side).animation.barMs ?? 0

export interface FireCtx {
  silent?: boolean // anima y vibra sin sonar (Regla A)
  noAnim?: boolean
  noVibrate?: boolean
  side?: HpSide
  target?: HTMLElement | null // fila, badge o vista según el evento
  dir?: number
}

function runAnim(ev: FxEvent, a: EventFx['animation'], ctx: FireCtx) {
  const name = a.preset
  const { durationMs: ms, easing: ez } = a
  if (name === 'none') return
  switch (ev) {
    case 'cursor':
      if (name === 'glow') playAnim(ctx.target, 'fx-rowglow', ms, ez)
      if (name === 'snap') playAnim(ctx.target, 'fx-rowflash', ms, ez)
      break
    case 'submenuEnter':
    case 'back':
      transition(ctx.target, name, ev === 'back' ? -1 : 1, ms, ez)
      break
    case 'actionExecute':
      if (name === 'slash') playAnim(layers.slash, 'fx-slash', ms, ez)
      else if (name === 'flash') overlay('#dff1ff', 'fx-flash', ms, ez)
      else playAnim(ctx.target, 'fx-pulse', ms, ez)
      break
    case 'resourceSpend':
      playAnim(ctx.target, `fx-spend-${name}`, ms, ez)
      break
    case 'hpChange':
      if (name === 'flash') overlay(ctx.side === 'heal' ? 'var(--heal)' : 'var(--hp)', 'fx-flash', ms, ez)
      else if (name === 'shake') playAnim(ctx.target, 'fx-damage-shake', ms, ez)
      else if (name === 'glow') playAnim(ctx.target, 'fx-heal-glow', ms, ez)
      break
    case 'rest':
      if (name === 'dim') overlay('#000', 'fx-dim', ms, ez)
      break
    case 'sheetPageChange':
    case 'sheetEnter':
    case 'cardOpen':
    case 'tabChange':
    case 'start':
      transition(ctx.target, name, ctx.dir ?? 1, ms, ez)
      break
  }
}

export function fire(ev: FxEvent, ctx: FireCtx = {}) {
  const fx = eventFx(ev, ctx.side)
  if (!ctx.silent) playSound(fx.sound.notes)
  if (!ctx.noVibrate) vibrate(fx.vibrate.pattern)
  if (!ctx.noAnim) runAnim(ev, fx.animation, ctx)
}
