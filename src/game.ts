export interface SweeperConfig {
  readonly width: number
  readonly height: number
  readonly mines: number
}

/**
 * Фасад игры. UI работает только через эти методы и не лезет во внутренности.
 * Координаты: x — столбец, y — строка.
 */
export interface SweeperGame {
  /** Ширина поля в клетках. */
  getWidth(): number
  /** Высота поля в клетках. */
  getHeight(): number
  /** Сколько флагов поставлено. */
  getFlagsCount(): number
  /** Сколько мин на поле. */
  getMinesCount(): number
  /** Сколько флагов ещё можно поставить: мины минус флаги. */
  getFlagsYetToOpenCount(): number
  /** Игра окончена (победа или взрыв) — дальше ходы игнорируются. */
  isGameOver(): boolean
  /** Игра выиграна. */
  isWon(): boolean
  /** Поставить или снять флаг. На открытой клетке и после конца игры игнорируется. */
  setFlagged(x: number, y: number, state: boolean): void
  /** Стоит ли флаг. */
  getFlagged(x: number, y: number): boolean
  /** Открыть клетку или взорвать мину. Автопропагация внутри. */
  open(x: number, y: number): void
  /** Открыта ли клетка. */
  isOpened(x: number, y: number): boolean
  /** Число мин вокруг открытой клетки. -1, если клетка закрыта или в ней мина. */
  getRank(x: number, y: number): number
  /** Мина ли в клетке. UI смотрит сюда только после конца игры. */
  isMine(x: number, y: number): boolean
  /** Это та мина, на которой подорвались. */
  isExploded(x: number, y: number): boolean
  /** Кнопка «уверен»: открывает соседей у чисел, вокруг которых уже стоит столько флагов. */
  sure(): void
  /** Квантовый ход по двум клеткам. */
  quantumOpen(x1: number, y1: number, x2: number, y2: number): void
}

type Status = 'ready' | 'playing' | 'won' | 'lost'

const NO_MINE_AROUND = 0
const NO_RANK = -1

export class Sweeper implements SweeperGame {
  private readonly config: SweeperConfig
  private readonly random: () => number
  private mines = new Set<number>()
  private flags = new Set<number>()
  private opened = new Set<number>()
  private ranks: number[]
  private status: Status = 'ready'
  private exploded = -1

  /** `random` возвращает число в [0, 1). Подменяется в тестах. */
  constructor(config: SweeperConfig, random: () => number = Math.random) {
    validate(config)
    this.config = config
    this.random = random
    this.ranks = new Array<number>(this.total()).fill(NO_MINE_AROUND)
  }

  getWidth(): number {
    return this.config.width
  }

  getHeight(): number {
    return this.config.height
  }

  getMinesCount(): number {
    return this.config.mines
  }

  getFlagsCount(): number {
    return this.flags.size
  }

  getFlagsYetToOpenCount(): number {
    return this.config.mines - this.flags.size
  }

  isGameOver(): boolean {
    return this.status === 'won' || this.status === 'lost'
  }

  isWon(): boolean {
    return this.status === 'won'
  }

  getFlagged(x: number, y: number): boolean {
    if (!this.isInside(x, y)) {
      return false
    }
    return this.flags.has(this.index(x, y))
  }

  setFlagged(x: number, y: number, state: boolean): void {
    if (this.isGameOver() || !this.isInside(x, y)) {
      return
    }
    const idx = this.index(x, y)
    if (this.opened.has(idx)) {
      return
    }
    if (state) {
      this.flags.add(idx)
    } else {
      this.flags.delete(idx)
    }
  }

  isOpened(x: number, y: number): boolean {
    if (!this.isInside(x, y)) {
      return false
    }
    return this.opened.has(this.index(x, y))
  }

  isMine(x: number, y: number): boolean {
    if (!this.isInside(x, y)) {
      return false
    }
    return this.mines.has(this.index(x, y))
  }

  isExploded(x: number, y: number): boolean {
    if (!this.isInside(x, y)) {
      return false
    }
    return this.index(x, y) === this.exploded
  }

  getRank(x: number, y: number): number {
    if (!this.isInside(x, y)) {
      return NO_RANK
    }
    const idx = this.index(x, y)
    if (!this.opened.has(idx) || this.mines.has(idx)) {
      return NO_RANK
    }
    return this.ranks[idx]
  }

  open(x: number, y: number): void {
    if (this.isGameOver() || !this.isInside(x, y)) {
      return
    }
    const idx = this.index(x, y)
    if (this.opened.has(idx) || this.flags.has(idx)) {
      return
    }
    if (this.status === 'ready') {
      this.placeMines(this.safeZone(idx))
    }
    if (this.mines.has(idx)) {
      this.exploded = idx
      this.status = 'lost'
      return
    }
    this.revealFrom(idx)
    this.checkWin()
  }

  sure(): void {
    if (this.status !== 'playing') {
      return
    }
    // Открытие соседей вскрывает новые числа — повторяем, пока есть что открывать.
    let progressed = true
    while (progressed) {
      progressed = false
      for (let idx = 0; idx < this.total(); idx++) {
        if (!this.canChord(idx)) {
          continue
        }
        if (this.openAround(idx)) {
          progressed = true
        }
        if (this.isGameOver()) {
          return
        }
        if (this.isAllSafeOpened()) {
          this.win()
          return
        }
      }
    }
  }

  quantumOpen(x1: number, y1: number, x2: number, y2: number): void {
    if (this.isGameOver() || !this.isInside(x1, y1) || !this.isInside(x2, y2)) {
      return
    }
    const a = this.index(x1, y1)
    const b = this.index(x2, y2)
    if (a === b || this.opened.has(a) || this.opened.has(b) || this.flags.has(a) || this.flags.has(b)) {
      return
    }
    // Квантовый ход может быть первым: мины кладутся по всему полю, без безопасной зоны.
    if (this.status === 'ready') {
      this.placeMines(new Set())
    }

    const aIsMine = this.mines.has(a)
    const bIsMine = this.mines.has(b)
    if (aIsMine === bIsMine) {
      // Обе с минами или обе пустые — взрыв.
      this.exploded = aIsMine ? a : -1
      this.status = 'lost'
      return
    }
    // Ровно одна мина: пустую открываем, минную помечаем флагом.
    const safe = aIsMine ? b : a
    const mined = aIsMine ? a : b
    this.flags.add(mined)
    this.revealFrom(safe)
    this.checkWin()
  }

  private total(): number {
    return this.config.width * this.config.height
  }

  private index(x: number, y: number): number {
    return y * this.config.width + x
  }

  private isInside(x: number, y: number): boolean {
    const insideX = Number.isInteger(x) && x >= 0 && x < this.config.width
    const insideY = Number.isInteger(y) && y >= 0 && y < this.config.height
    return insideX && insideY
  }

  /** Клетка и её соседи: первый обычный ход всегда открывает область. */
  private safeZone(idx: number): Set<number> {
    const zone = new Set<number>([idx])
    for (const n of this.neighbors(idx)) {
      zone.add(n)
    }
    return zone
  }

  private placeMines(excluded: ReadonlySet<number>): void {
    const free: number[] = []
    for (let idx = 0; idx < this.total(); idx++) {
      if (!excluded.has(idx)) {
        free.push(idx)
      }
    }
    // Частичный Fisher–Yates: первые `mines` элементов становятся случайной выборкой.
    for (let i = 0; i < this.config.mines; i++) {
      const j = i + Math.floor(this.random() * (free.length - i))
      swap(free, i, j)
    }
    this.mines = new Set(free.slice(0, this.config.mines))
    for (const mine of this.mines) {
      for (const n of this.neighbors(mine)) {
        this.ranks[n]++
      }
    }
    this.status = 'playing'
  }

  /** Открывает клетку. Если вокруг нет мин, идёт по соседям до клеток с числами. Флажки не трогает. */
  private revealFrom(start: number): void {
    const stack = [start]
    while (stack.length > 0) {
      const idx = stack.pop()
      if (idx === undefined) {
        continue
      }
      if (this.opened.has(idx) || this.flags.has(idx) || this.mines.has(idx)) {
        continue
      }
      this.opened.add(idx)
      if (this.ranks[idx] === NO_MINE_AROUND) {
        for (const n of this.neighbors(idx)) {
          stack.push(n)
        }
      }
    }
  }

  private checkWin(): void {
    if (this.isAllSafeOpened()) {
      this.win()
    }
  }

  private isAllSafeOpened(): boolean {
    return this.opened.size === this.total() - this.config.mines
  }

  private win(): void {
    this.status = 'won'
    this.flags = new Set(this.mines)
  }

  private canChord(idx: number): boolean {
    if (!this.opened.has(idx) || this.ranks[idx] === NO_MINE_AROUND) {
      return false
    }
    return this.flagsAround(idx) === this.ranks[idx]
  }

  private flagsAround(idx: number): number {
    let count = 0
    for (const n of this.neighbors(idx)) {
      if (this.flags.has(n)) {
        count++
      }
    }
    return count
  }

  /** Открывает скрытых соседей. Мина среди них — взрыв. Возвращает true, если что-то открылось. */
  private openAround(idx: number): boolean {
    let openedSomething = false
    for (const n of this.neighbors(idx)) {
      if (this.opened.has(n) || this.flags.has(n)) {
        continue
      }
      if (this.mines.has(n)) {
        this.exploded = n
        this.status = 'lost'
        return openedSomething
      }
      this.revealFrom(n)
      openedSomething = true
    }
    return openedSomething
  }

  private neighbors(idx: number): number[] {
    const x = idx % this.config.width
    const y = Math.floor(idx / this.config.width)
    const result: number[] = []
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) {
          continue
        }
        if (this.isInside(x + dx, y + dy)) {
          result.push(this.index(x + dx, y + dy))
        }
      }
    }
    return result
  }
}

function swap(items: number[], a: number, b: number): void {
  const tmp = items[a]
  items[a] = items[b]
  items[b] = tmp
}

function validate({ width, height, mines }: SweeperConfig): void {
  const integers = [width, height, mines].every(Number.isInteger)
  if (!integers || width < 1 || height < 1 || mines < 1 || mines >= width * height) {
    throw new Error(`Некорректная конфигурация поля: ${width}×${height}, ${mines} мин`)
  }
}
