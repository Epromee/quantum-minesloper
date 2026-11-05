import { DIFFICULTIES } from './config.ts'
import type { Difficulty } from './config.ts'
import { button, clear, div, header, li, span, ul } from './dom.ts'
import { Sweeper } from './game.ts'
import type { SweeperGame } from './game.ts'
import { bindCellInput } from './input.ts'
import type { GameSound } from './sound.ts'

const FIRST_PICK = 'выберите первую клетку'
const SECOND_PICK = 'выберите вторую клетку'
const SURE_HINT = 'открыть автоматически остальное'
const QUANTUM_HINT = 'в 2 клетках строго 1 мина, не 0, не 2'

const ABOUT =
  'Q-Слопёр — квантовый слоп-сапёр. Создан как челлендж: завайбкодить игру без единой строчки кода руками. ' +
  'Автор идеи Егор Промышленников, при поддержке Claude, Qwen и DeepSeek.'

interface Rule {
  readonly key: string
  readonly text: string
}

const RULES: readonly Rule[] = [
  { key: 'Короткое ЛКМ / тап', text: 'открыть клетку' },
  { key: 'Долгое нажатие (ЛКМ, палец) или ПКМ', text: 'поставить или снять флажок' },
  { key: 'Уверен', text: 'у числа с полным набором флагов открывает остальных соседей' },
  { key: 'Квант', text: 'две клетки: мина строго в одной — пустая открывается, минную метит флагом. Иначе взрыв' },
  { key: 'Победа', text: 'открыть все клетки без мин' },
]

interface Coord {
  readonly x: number
  readonly y: number
}

/** Точка входа UI: меню сложности, помощь и сама игра. */
export function mountApp(root: HTMLElement, sound: GameSound): void {
  const openMenu = (): void => {
    clear(root)
    root.append(buildMenu(startGame, openHelp))
  }

  const openHelp = (): void => {
    clear(root)
    root.append(buildHelp(openMenu))
  }

  const startGame = (difficulty: Difficulty): void => {
    clear(root)
    root.append(buildGame(difficulty, sound, openMenu, startGame))
  }

  openMenu()
}

function buildMenu(onPick: (difficulty: Difficulty) => void, onHelp: () => void): HTMLElement {
  const list = div({ class: 'menu__list' })
  for (const difficulty of DIFFICULTIES) {
    list.append(
      button(
        { class: 'menu__item', type: 'button', onClick: () => onPick(difficulty) },
        span({ class: 'menu__name', text: difficulty.name }),
        span({ class: 'menu__meta', text: `${difficulty.width}×${difficulty.height} · мин ${difficulty.mines}` }),
      ),
    )
  }
  list.append(
    button(
      { class: 'menu__item menu__item--help', type: 'button', onClick: onHelp },
      span({ class: 'menu__name', text: 'Помощь' }),
      span({ class: 'menu__meta', text: 'правила и об игре' }),
    ),
  )
  return div(
    { class: 'menu' },
    div({ class: 'menu__title', text: 'Q-Слопёр' }),
    div({ class: 'menu__subtitle', text: 'выберите уровень' }),
    list,
  )
}

function buildHelp(onBack: () => void): HTMLElement {
  const rules = ul({ class: 'help__rules' })
  for (const rule of RULES) {
    rules.append(
      li(
        {},
        span(
          { class: 'help__line' },
          span({ class: 'help__key', text: rule.key }),
          span({ class: 'help__text', text: ` — ${rule.text}` }),
        ),
      ),
    )
  }

  return div(
    { class: 'help' },
    div(
      { class: 'help__head' },
      div({ class: 'menu__title', text: 'Q-Слопёр' }),
      div({ class: 'menu__subtitle', text: 'помощь' }),
    ),
    div({ class: 'help__about', text: ABOUT }),
    rules,
    button(
      { class: 'menu__item menu__item--back', type: 'button', onClick: onBack },
      span({ class: 'menu__name', text: 'Назад в меню' }),
    ),
  )
}

function buildGame(
  difficulty: Difficulty,
  sound: GameSound,
  onMenu: () => void,
  onRestart: (difficulty: Difficulty) => void,
): HTMLElement {
  const game: SweeperGame = new Sweeper({
    width: difficulty.width,
    height: difficulty.height,
    mines: difficulty.mines,
  })
  const width = game.getWidth()
  const height = game.getHeight()

  let armed = false
  let selection: Coord[] = []
  let hoverHint: string | null = null

  const board = div({ class: 'board' })
  board.style.setProperty('--cols', String(width))
  board.style.setProperty('--rows', String(height))
  board.style.setProperty('--ratio', String(width / height))

  const cells: HTMLElement[][] = []
  for (let y = 0; y < height; y++) {
    const row: HTMLElement[] = []
    for (let x = 0; x < width; x++) {
      const cell = div({ class: 'cell', dataset: { x: String(x), y: String(y) } })
      row.push(cell)
      board.append(cell)
    }
    cells.push(row)
  }

  const boardArea = div({ class: 'board-area' }, board)

  const counter = span({ class: 'counter' })
  const status = span({ class: 'status' })
  const level = span({ class: 'level', text: difficulty.name })
  const topbar = header({ class: 'topbar' }, counter, status, level)

  const sureButton = button(
    { class: 'ctrl', type: 'button', onClick: onSure, onMouseEnter: () => setHint(SURE_HINT), onMouseLeave: () => setHint(null) },
    'Уверен',
  )
  const quantumButton = button(
    { class: 'ctrl', type: 'button', onClick: onQuantum, onMouseEnter: () => setHint(QUANTUM_HINT), onMouseLeave: () => setHint(null) },
    'Квант',
  )
  const restartButton = button({ class: 'ctrl', type: 'button', onClick: () => onRestart(difficulty) }, 'Заново')
  const menuButton = button({ class: 'ctrl', type: 'button', onClick: onMenu }, 'Меню')
  const controlButtons = [sureButton, quantumButton, restartButton, menuButton]

  if (typeof document.documentElement.requestFullscreen === 'function') {
    const fullscreenButton = button({ class: 'ctrl', type: 'button', onClick: () => toggleFullscreen(fullscreenButton) }, 'Экран')
    controlButtons.push(fullscreenButton)
  }

  const controls = div({ class: 'controls' }, ...controlButtons)

  function toggleFullscreen(fullscreenButton: HTMLButtonElement): void {
    const entering = document.fullscreenElement === null
    const action = entering ? document.documentElement.requestFullscreen() : document.exitFullscreen()
    void action.then(() => {
      fullscreenButton.textContent = document.fullscreenElement !== null ? 'Выход' : 'Экран'
    })
  }

  function isSelected(x: number, y: number): boolean {
    return selection.some((coord) => coord.x === x && coord.y === y)
  }

  function render(): void {
    const over = game.isGameOver()
    board.classList.toggle('is-over', over)
    board.classList.toggle('is-won', game.isWon())
    board.classList.toggle('is-lost', over && !game.isWon())
    board.classList.toggle('is-picking-1', armed && selection.length === 0)
    board.classList.toggle('is-picking-2', armed && selection.length === 1)

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        paintCell(cells[y][x], game, x, y, isSelected(x, y))
      }
    }

    counter.textContent = `флаги ${game.getFlagsYetToOpenCount()}`
    status.textContent = hoverHint ?? statusText(game, armed, selection)
    status.classList.toggle('is-hint', hoverHint !== null)
    quantumButton.setAttribute('aria-pressed', String(armed))
    quantumButton.disabled = over
    sureButton.disabled = over
  }

  function setHint(hint: string | null): void {
    hoverHint = hint
    render()
  }

  function onSure(): void {
    const before = openedCount()
    game.sure()
    render()
    if (playOutcome()) {
      return
    }
    if (openedCount() > before) {
      sound.cellOpened()
    }
  }

  /** Играет мелодию победы или проигрыша, если игра закончилась. */
  function playOutcome(): boolean {
    if (game.isWon()) {
      sound.win()
      return true
    }
    if (game.isGameOver()) {
      sound.lose()
      return true
    }
    return false
  }

  function openedCount(): number {
    let count = 0
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (game.isOpened(x, y)) {
          count++
        }
      }
    }
    return count
  }

  function onQuantum(): void {
    if (game.isGameOver()) {
      return
    }
    armed = !armed
    selection = []
    render()
  }

  function selectCell(x: number, y: number): void {
    const selectable = !game.isOpened(x, y) && !game.getFlagged(x, y)
    if (game.isGameOver() || !selectable || isSelected(x, y)) {
      return
    }
    selection.push({ x, y })
    if (selection.length < 2) {
      render()
      return
    }
    game.quantumOpen(selection[0].x, selection[0].y, selection[1].x, selection[1].y)
    armed = false
    selection = []
    render()
    if (!playOutcome()) {
      sound.quantumMove()
    }
  }

  function onOpen(x: number, y: number): void {
    if (armed) {
      selectCell(x, y)
      return
    }
    if (game.isGameOver()) {
      return
    }
    const wasOpen = game.isOpened(x, y)
    const wasFlagged = game.getFlagged(x, y)
    game.open(x, y)
    render()
    if (wasOpen || wasFlagged) {
      return
    }
    if (!playOutcome()) {
      sound.cellOpened()
    }
  }

  function onFlag(x: number, y: number): void {
    if (armed || game.isGameOver() || game.isOpened(x, y)) {
      return
    }
    const next = !game.getFlagged(x, y)
    game.setFlagged(x, y, next)
    if (next) {
      sound.flagPlaced()
    }
    render()
  }

  bindCellInput(board, { open: onOpen, flag: onFlag })
  render()

  return div({ class: 'screen' }, topbar, boardArea, controls)
}

function statusText(game: SweeperGame, armed: boolean, selection: Coord[]): string {
  if (game.isWon()) {
    return 'победа'
  }
  if (game.isGameOver()) {
    return 'взрыв'
  }
  if (armed) {
    return selection.length === 0 ? FIRST_PICK : SECOND_PICK
  }
  return ''
}

function paintCell(cell: HTMLElement, game: SweeperGame, x: number, y: number, selected: boolean): void {
  cell.className = 'cell'
  cell.textContent = ''
  cell.setAttribute('aria-label', labelFor(game, x, y))

  if (game.isOpened(x, y)) {
    const rank = game.getRank(x, y)
    if (rank > 0) {
      cell.classList.add('is-open', `rank-${rank}`)
      cell.textContent = String(rank)
    } else {
      cell.classList.add('is-open')
    }
  } else if (game.getFlagged(x, y)) {
    cell.classList.add(game.isGameOver() && !game.isMine(x, y) ? 'is-wrong' : 'is-flag')
  } else if (game.isGameOver() && game.isMine(x, y)) {
    cell.classList.add('is-mine')
    if (game.isExploded(x, y)) {
      cell.classList.add('is-exploded')
    }
  }

  if (selected) {
    cell.classList.add('is-selected')
  }
}

function labelFor(game: SweeperGame, x: number, y: number): string {
  if (game.isOpened(x, y)) {
    const rank = game.getRank(x, y)
    return rank > 0 ? `Открыта, мин рядом: ${rank}` : 'Открыта, пусто'
  }
  if (game.getFlagged(x, y)) {
    return 'Флажок'
  }
  if (game.isGameOver() && game.isMine(x, y)) {
    return 'Мина'
  }
  return 'Закрыта'
}
