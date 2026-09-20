# B4U CRM

CRM-система для многопрофильного beauty-салона (маникюр/педикюр, спа, массаж). Пет-проект для портфолио.

Документы проекта (ТЗ, архитектура, план реализации) лежат в папке `BEAUTY4YOU/` рядом с этим репозиторием.

## Стек

- **Backend:** NestJS + TypeScript + Prisma + PostgreSQL
- **Frontend:** React + TypeScript + Vite
- **Mobile (мастер):** Kotlin + Jetpack Compose — нативное Android-приложение, переиспользует backend веб-CRM
- **CI:** GitHub Actions

## Структура репозитория

```
b4u-crm/
  backend/                — NestJS API (модули: auth, clients, staff, services, bookings, payments,
                             inventory, notifications, master-schedules, ...)
  frontend/                — React SPA (веб-CRM для администратора/ресепшена)
  MobileApp/
    master-app/            — нативное Android-приложение мастера (Kotlin + Jetpack Compose)
    design_extracted*/     — распакованные дизайн-макеты (design handoff) для мобильных приложений
  docker-compose.yml       — локальный PostgreSQL
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

### 4. Приложение мастера (Android)

```bash
cd MobileApp/master-app
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export ANDROID_SDK_ROOT=/opt/homebrew/share/android-commandlinetools
adb reverse tcp:3000 tcp:3000   # тоннель к backend на хосте через USB (для реального устройства)
./gradlew installDebug
```

Backend должен быть уже поднят (шаг 2). Подробнее — в разделе ниже.

## Модель данных

Схема — в `backend/prisma/schema.prisma`, соответствует ER-модели из архитектурного документа. Каждая ключевая сущность содержит `salonId` — задел под мультифилиальность без дорогой миграции в будущем.

## Мобильное приложение мастера (Android)

`MobileApp/master-app/` — нативное Android-приложение для роли MASTER (сотрудник салона), компаньон к
веб-CRM: использует тот же backend/API и тот же JWT-логин (`/auth/login`), без отдельной мобильной
аутентификации. Дизайн-макет — в `MobileApp/design_extracted_adm/` (распакован из `B4U Mobile Adm App
Design.zip`).

Стек: Kotlin + Jetpack Compose, Material 3 с кастомными токенами дизайна, Retrofit2 + OkHttp +
kotlinx.serialization, DataStore Preferences (сессия), Coil (фото мастера), Navigation-Compose.

Три экрана (bottom nav):
- **Panel** — приветствие, статистика (визиты сегодня/на неделе/завершённых), список визитов на
  сегодня, недельная полоска с индикатором дней с записями;
- **Kalendarz** — список и Timeline (09:00–19:00, шаг 15 мин) своих записей на выбранный день, с
  фильтром по статусу; недоступное по графику работы время подсвечивается серой заливкой;
- **Profil** — фото/имя/специализация, статистика, реальные недельные часы работы (`GET
  /master-schedules`), контакты, выход.

**Раздел "Grafik pracy"** (предложение мастером изменений графика с подтверждением администратором)
в этой версии **не реализован функционально** — кнопка "Ustawienia grafiku pracy" открывает статичную
шторку-макет (календарь, поля времени), ничего не сохраняющую и не отправляющую на backend. Полноценный
workflow подтверждения — в следующей версии.

**Backend:** единственное изменение ради этого приложения — `GET /master-schedules` (чтение
подтверждённого графика) теперь доступен не только роли ADMIN, но и самому мастеру, со
скоупингом на собственный `masterId` (`ForbiddenException`, если мастер пытается прочитать чужой
график). Все остальные эндпоинты (`/auth/login`, `GET /bookings`, `GET /bookings/:id`, `GET
/staff/:id`, `GET /clients`, `GET /services`) переиспользуются как есть — мастер уже был
самоскоуплен на них на уровне сервисов.

Запуск на реальном устройстве по USB, включая настройку `adb reverse` и переменных окружения для
сборки — см. шаг 4 выше и комментарии в `MobileApp/master-app/app/build.gradle.kts`.

## Roadmap

См. `BEAUTY4YOU_Plan_realizacii.md`: Этап 0 (это репо) → MVP → второй релиз → развитие.
