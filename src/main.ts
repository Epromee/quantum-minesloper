import './style.css'
import { createGameSound } from './sound.ts'
import { mountApp } from './ui.ts'

const app = document.querySelector<HTMLElement>('#app')
if (!app) {
  throw new Error('Не найден контейнер #app')
}
mountApp(app, createGameSound())
