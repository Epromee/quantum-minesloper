# Правила проекта

Этот файл агент читает в каждом запросе. Сюда пиши то, что действует всегда.

## Стек

- TypeScript + Vite (шаблон vanilla-ts)

## Процесс

- Пользователь сам держит `npm run dev` с hot reload. Не запускай dev-сервер.
- Ревью и коммит делает пользователь. Не делай `git commit`, `git add`, `git push`.
- После правок проверяй типы: `npx tsc --noEmit`.

## Правила кода

- plain CSS без scss/sass
- HTML/CSS responsive, mobile-first
- для графики выбери Canvas, обычный HTML или SVG, как тебе удобнее, без игрового движка

- никаких innerHTML и прочего такого говна, явно манипулируй дом через dom.ts (можешь переделывать этот файл, просто чтобы ты понял идею)

- Мы следуем паттерну KIDDO - Keep ID (SOLID with no necessary SOL) Don't Overengineer. Это такой SOLID+YAGNI+KISS в одном - мы убираем SOL из SOLID