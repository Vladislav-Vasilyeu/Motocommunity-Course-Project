# MotoClub

## Структура проекта

- `src/app/` — маршруты React Router и общий каркас приложения.
- `src/pages/` — отдельные страницы ленты, поездок, клубов, объявлений, карты, гаража, друзей и профиля.
- `src/features/auth/` — состояние текущего пользователя и вход/регистрация.
- `src/shared/` — типы, HTTP-клиент и повторно используемые состояния интерфейса.
- `server/src/routes/` — HTTP API. Маршруты проверяют входные данные, права пользователя и работают с Prisma.
- `server/prisma/` — схема PostgreSQL, миграции и демонстрационные данные.

Frontend отвечает за маршруты, страницы, формы и отображение состояний запроса. Backend — за проверку данных, авторизацию, бизнес-правила и сохранение в базе. Страница загружает данные только своего раздела; карта и остальные разделы собираются в отдельные JS-части.

Адаптивное веб-приложение для мотоциклетного сообщества: профили, гараж, публикации, друзья, сообщества, объявления и совместные поездки с точками на карте.

## Стек

- Клиент: React, TypeScript, Vite, Leaflet и OpenStreetMap.
- API: Node.js, Express 5, TypeScript.
- База данных: PostgreSQL 17, Prisma ORM 7.
- Архитектура: модульный монолит; клиент обращается к HTTP API.

## Запуск на Windows

Нужны Node.js 24+ и Docker Desktop.

1. Установите зависимости: `npm install` и `npm --prefix server install`.
2. Скопируйте шаблон окружения: `Copy-Item .env.example .env`.
3. Запустите PostgreSQL: `docker compose up -d db`.
4. Примените миграции, сгенерируйте Prisma Client и добавьте демонстрационные записи:

   ```powershell
   npm --prefix server run db:deploy
   npm --prefix server run db:generate
   npm --prefix server run db:seed
   ```

5. Запустите клиент и API: `npm run dev:all`.

Клиент откроется по адресу <http://localhost:5173>, API — по адресу <http://localhost:3000>. Проверка API и подключения к базе: <http://localhost:3000/health>.

Для локальной демонстрации после выполнения seed можно войти как `demo@motoclub.local` с паролем `RideSafe2026!`. Демонстрационные учётные данные предназначены только для локальной разработки; не разворачивайте seed-данные в публичном окружении.

Перед публичным развёртыванием задайте `AUTH_SECRET` длиной не менее 32 символов. `.env` и секреты исключены из Git; в репозитории хранится только `.env.example`.

## Реализованные HTTP-маршруты

- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.
- `GET /api/users/:id`, `PATCH /api/profile`.
- CRUD гаража через `/api/motorcycles`.
- Лента и публикации через `/api/posts`.
- Заявки и список друзей через `/api/friend-requests` и `/api/friends`.
- Сообщества и членство через `/api/communities`.
- Поиск и управление объявлениями через `/api/listings`.
- Точки и поездки через `/api/places` и `/api/trips`.

## Документы

- [Требования MVP](docs/requirements.md)
- [Архитектура](docs/architecture.md)
- [ER-диаграмма](docs/er-diagram.md)
- [UX/UI варианты и анализ аналогов](docs/design-options.md)
