# MotoClub

Курсовой проект — веб-приложение для мотоциклетного сообщества с функциями социальной сети, совместных поездок и доской объявлений.

## Технологии

- Клиент: React, TypeScript, Vite
- API: Node.js, Express 5, TypeScript
- База данных: PostgreSQL, Prisma ORM 7
- Карты: Leaflet + OpenStreetMap (предусмотрено планом)

Приложение строится как модульный монолит: web-клиент обращается к HTTP API, сервер содержит бизнес-логику и работает с PostgreSQL через Prisma.

## Структура

- `src/` — клиентское приложение React + TypeScript
- `server/src/` — Express API, обработчики ошибок и доступ к БД
- `server/prisma/` — схема и миграции базы данных
- `docs/` — требования, архитектура и ER-диаграмма

## Требования

- Node.js 24 или новее
- Docker Desktop с Docker Compose

## Первый запуск

1. Установить зависимости клиента и API:

   ```bash
   npm install
   npm --prefix server install
   ```

2. Создать локальную конфигурацию и запустить PostgreSQL:

   ```powershell
   Copy-Item .env.example .env
   docker compose up -d db
   ```

3. Создать Prisma Client и применить миграцию:

   ```bash
   npm --prefix server run db:generate
   npm --prefix server run db:migrate -- --name init
   ```

4. Запустить клиент и API вместе либо в отдельных терминалах:

   ```bash
   npm run dev:all
   ```

   Клиент: <http://localhost:5173>, API health check: <http://localhost:3000/health>.

Секреты и локальный `.env` не добавляются в Git. Для переменных окружения используйте `.env.example` как шаблон.
