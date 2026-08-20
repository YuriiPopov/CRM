# B4U CRM

CRM-система для многопрофильного beauty-салона (маникюр/педикюр, спа, массаж). Пет-проект для портфолио.

Документы проекта (ТЗ, архитектура, план реализации) лежат в папке `BEAUTY4YOU/` рядом с этим репозиторием.

## Стек

- **Backend:** NestJS + TypeScript + Prisma + PostgreSQL
- **Frontend:** React + TypeScript + Vite
- **CI:** GitHub Actions

## Структура репозитория

```
b4u-crm/
  backend/   — NestJS API (модули: auth, clients, staff, services, bookings, payments, inventory, notifications)
  frontend/  — React SPA
  docker-compose.yml — локальный PostgreSQL
  .github/workflows/ci.yml — CI: lint, тесты, сборка
```

## Быстрый старт (Этап 0)

### 1. Поднять базу данных

```bash
docker compose up -d
```

### 2. Настроить backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run start:dev
```

Backend поднимется на `http://localhost:3000`.

### 3. Настроить frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend поднимется на `http://localhost:5173`.

## Модель данных

Схема — в `backend/prisma/schema.prisma`, соответствует ER-модели из архитектурного документа. Каждая ключевая сущность содержит `salonId` — задел под мультифилиальность без дорогой миграции в будущем.

## Roadmap

См. `BEAUTY4YOU_Plan_realizacii.md`: Этап 0 (это репо) → MVP → второй релиз → развитие.
