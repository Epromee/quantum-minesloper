/** Что ввод умеет сделать с клеткой. */
export interface CellActions {
  open(x: number, y: number): void
  flag(x: number, y: number): void
}

/** `button` у PointerEvent: 0 — основная кнопка, 2 — вторичная (ПКМ). */
const PRIMARY_BUTTON = 0
const SECONDARY_BUTTON = 2

/** Сколько держать палец, чтобы нажатие считалось долгим. */
const LONG_PRESS_MS = 400
/** Если палец сдвинулся дальше, нажатие отменяется: пользователь прокручивает или промахнулся. */
const MOVE_TOLERANCE_PX = 10
/** Короткая вибрация в ответ на долгое нажатие, миллисекунды. */
const LONG_PRESS_VIBRATION_MS = 30

interface Cell {
  readonly x: number
  readonly y: number
}

interface Press {
  readonly pointerId: number
  readonly isMouse: boolean
  readonly cell: Cell
  readonly startX: number
  readonly startY: number
  timer?: number
}

/**
 * Короткое нажатие открывает клетку, долгое — ставит или снимает флажок.
 * Одинаково для мыши и пальца: ЛКМ/тап — открыть, удержание — флаг.
 * ПКМ по-прежнему ставит флаг сразу.
 */
export function bindCellInput(root: HTMLElement, actions: CellActions): void {
  let press: Press | null = null

  const cellAt = (target: EventTarget | null): Cell | null => {
    if (!(target instanceof Element)) {
      return null
    }
    const el = target.closest<HTMLElement>('[data-x]')
    if (!el || !root.contains(el)) {
      return null
    }
    return { x: Number(el.dataset.x), y: Number(el.dataset.y) }
  }

  const cancelPress = (): void => {
    window.clearTimeout(press?.timer)
    press = null
  }

  const onLongPress = (current: Press): void => {
    if (press !== current) {
      return
    }
    press = null
    actions.flag(current.cell.x, current.cell.y)
    navigator.vibrate?.(LONG_PRESS_VIBRATION_MS)
  }

  const startPress = (e: PointerEvent, cell: Cell): void => {
    const current: Press = {
      pointerId: e.pointerId,
      isMouse: e.pointerType === 'mouse',
      cell,
      startX: e.clientX,
      startY: e.clientY,
    }
    // Долгое удержание — флаг, и для мыши тоже.
    current.timer = window.setTimeout(() => onLongPress(current), LONG_PRESS_MS)
    press = current
  }

  const isOurPress = (e: PointerEvent): boolean => {
    return press !== null && press.pointerId === e.pointerId
  }

  const movedTooFar = (e: PointerEvent, current: Press): boolean => {
    const dx = e.clientX - current.startX
    const dy = e.clientY - current.startY
    return Math.hypot(dx, dy) > MOVE_TOLERANCE_PX
  }

  root.addEventListener('pointerdown', (e) => {
    const cell = cellAt(e.target)
    cancelPress()

    // Второй палец означает жест (например, зум), а не нажатие на клетку.
    if (cell === null || !e.isPrimary) {
      return
    }
    if (e.button === SECONDARY_BUTTON) {
      actions.flag(cell.x, cell.y)
      return
    }
    if (e.button !== PRIMARY_BUTTON) {
      return
    }
    startPress(e, cell)
  })

  root.addEventListener('pointermove', (e) => {
    if (!press || press.pointerId !== e.pointerId) {
      return
    }
    if (movedTooFar(e, press)) {
      cancelPress()
    }
  })

  root.addEventListener('pointerup', (e) => {
    const current = press
    if (!current || current.pointerId !== e.pointerId) {
      return
    }
    cancelPress()

    // Сенсорный указатель захвачен исходной клеткой. Мышь могли увести на другую клетку, тогда ничего не делаем.
    const target = cellAt(e.target)
    const releasedOnSame = target !== null && target.x === current.cell.x && target.y === current.cell.y
    if (current.isMouse && !releasedOnSame) {
      return
    }
    actions.open(current.cell.x, current.cell.y)
  })

  root.addEventListener('pointercancel', (e) => {
    if (isOurPress(e)) {
      cancelPress()
    }
  })

  root.addEventListener('contextmenu', blockNativeContextMenu)
}

function blockNativeContextMenu(e: Event): void {
  e.preventDefault()
}
