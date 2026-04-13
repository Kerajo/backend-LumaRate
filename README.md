# CineScope Backend

NestJS + Prisma backend, generated from your uploaded CineScope documentation website.

## Что реализовано

- `Auth API`: регистрация, логин, refresh, logout
- `Content API`: главная, каталог, поиск, жанры, страны, детальная страница, похожее, рекомендованное, новинки
- `Reviews & Ratings API`: оценки 1–5, отзывы, рецензии экспертов
- `Profile API`: профиль, мои отзывы, мои оценки, избранное, смена пароля, деактивация аккаунта
- `Moderation API`: очередь отзывов/рецензий, approve/reject, статистика
- `Admin API`: управление контентом, пользователями, жанрами, странами, персонами

## Технологии

- NestJS 10
- Prisma 5
- PostgreSQL
- JWT access + refresh
- bcrypt
- Swagger

## Быстрый старт

```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run start:dev
```

Swagger будет доступен по адресу:

```bash
http://localhost:3000/docs
```

## Важное отличие от документации

Для безопасного logout/refresh я добавил таблицу `auth_sessions`. В исходной документации refresh flow описан, но отдельная таблица хранения refresh token там не была показана. Это практическое улучшение для production-ready поведения.

## ENV

См. `.env.example`.
