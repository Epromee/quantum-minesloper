/** Уровни сложности. Правь числа как хочешь: width × height клеток, mines мин. */
export interface Difficulty {
  readonly name: string
  readonly width: number
  readonly height: number
  readonly mines: number
}

export const DIFFICULTIES: readonly Difficulty[] = [
  { name: 'Лёгкий', width: 9, height: 9, mines: 10 },
  { name: 'Средний', width: 14, height: 12, mines: 30 },
  { name: 'Сложный', width: 16, height: 14, mines: 50 },
  { name: 'Адский', width: 16, height: 14, mines: 78 },
]
