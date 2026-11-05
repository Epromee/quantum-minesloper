/** Звуки игры. */
export interface GameSound {
  /** Две ноты в квинту при установке флажка. */
  flagPlaced(): void
  /** Короткий взлётный писк при открытии клетки. */
  cellOpened(): void
  /** Два «пиу-пиу» на квантовый ход. */
  quantumMove(): void
  /** Восходящее арпеджио на победу. */
  win(): void
  /** Нисходящий мотив на проигрыш. */
  lose(): void
}

interface Engine {
  readonly audio: AudioContext
  readonly input: GainNode
}

interface BlipOptions {
  readonly freq: number
  readonly start: number
  readonly duration: number
  /** Громкость пика. */
  readonly gain?: number
  /** Конечная частота для пиу-пиу, если нужен скользящий тон. */
  readonly glideTo?: number
}

/** Ноты, Гц. */
const C4 = 261.63
const E4 = 329.63
const G4 = 392.0
const C5 = 523.25
const E5 = 659.25
const G5 = 783.99
const C6 = 1046.5

const MASTER_GAIN = 0.5
/** Доля сухого сигнала в ревербератор. */
const WET_GAIN = 0.3
const IMPULSE_SECONDS = 1.4
/** Срез фильтра: квадрат звучит мягче, без песка. */
const FILTER_HZ = 1700
const ATTACK_SECONDS = 0.008
/** Рампа не может идти в ноль, глушим до очень малого значения. */
const SILENCE = 0.0001

/** Звук синтезируется осцилляторами и ревером, без сэмплов и файлов. */
export function createGameSound(): GameSound {
  let engine: Engine | null = null

  const getEngine = (): Engine => {
    if (engine === null) {
      engine = buildEngine()
    }
    if (engine.audio.state === 'suspended') {
      void engine.audio.resume()
    }
    return engine
  }

  const flagPlaced = (): void => {
    const current = getEngine()
    const start = current.audio.currentTime
    blip(current, { freq: C5, start, duration: 0.09, gain: 0.42 })
    blip(current, { freq: G5, start: start + 0.09, duration: 0.16, gain: 0.42 })
  }

  const cellOpened = (): void => {
    const current = getEngine()
    const start = current.audio.currentTime
    blip(current, { freq: 900, glideTo: 1600, start, duration: 0.09, gain: 0.22 })
  }

  const quantumMove = (): void => {
    const current = getEngine()
    const start = current.audio.currentTime
    blip(current, { freq: 1700, glideTo: 420, start, duration: 0.12, gain: 0.34 })
    blip(current, { freq: 1950, glideTo: 480, start: start + 0.14, duration: 0.12, gain: 0.34 })
  }

  const win = (): void => {
    const current = getEngine()
    const start = current.audio.currentTime
    const notes = [C5, E5, G5, C6]
    for (let i = 0; i < notes.length; i++) {
      const last = i === notes.length - 1
      blip(current, {
        freq: notes[i],
        start: start + i * 0.12,
        duration: last ? 0.5 : 0.22,
        gain: 0.36,
      })
    }
  }

  const lose = (): void => {
    const current = getEngine()
    const start = current.audio.currentTime
    blip(current, { freq: G4, start, duration: 0.2, gain: 0.34 })
    blip(current, { freq: E4, start: start + 0.18, duration: 0.24, gain: 0.34 })
    blip(current, { freq: C4, start: start + 0.4, duration: 0.6, gain: 0.34 })
  }

  return { flagPlaced, cellOpened, quantumMove, win, lose }
}

function buildEngine(): Engine {
  const audio = new AudioContext()

  const master = audio.createGain()
  master.gain.value = MASTER_GAIN
  master.connect(audio.destination)

  const input = audio.createGain()

  const dry = audio.createGain()
  dry.connect(master)
  input.connect(dry)

  const convolver = audio.createConvolver()
  convolver.buffer = createImpulse(audio, IMPULSE_SECONDS)
  const wet = audio.createGain()
  wet.gain.value = WET_GAIN
  convolver.connect(wet)
  wet.connect(master)
  input.connect(convolver)

  return { audio, input }
}

function blip(engine: Engine, options: BlipOptions): void {
  const { audio } = engine
  const oscillator = audio.createOscillator()
  oscillator.type = 'square'
  oscillator.frequency.setValueAtTime(options.freq, options.start)
  if (options.glideTo !== undefined) {
    oscillator.frequency.exponentialRampToValueAtTime(options.glideTo, options.start + options.duration)
  }

  const filter = audio.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = FILTER_HZ
  filter.Q.value = 4

  const gain = audio.createGain()
  gain.gain.setValueAtTime(SILENCE, options.start)
  gain.gain.exponentialRampToValueAtTime(options.gain ?? 0.4, options.start + ATTACK_SECONDS)
  gain.gain.exponentialRampToValueAtTime(SILENCE, options.start + options.duration)

  oscillator.connect(filter)
  filter.connect(gain)
  gain.connect(engine.input)
  oscillator.start(options.start)
  oscillator.stop(options.start + options.duration + 0.02)
}

/** Шумовой импульс с затуханием — простой ревер без внешних файлов. */
function createImpulse(audio: AudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(audio.sampleRate * seconds)
  const buffer = audio.createBuffer(2, length, audio.sampleRate)
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < length; i++) {
      const decay = Math.pow(1 - i / length, 2.6)
      data[i] = (Math.random() * 2 - 1) * decay
    }
  }
  return buffer
}
