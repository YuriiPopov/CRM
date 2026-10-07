# B4U CRM

CRM-система для многопрофильного beauty-салона (маникюр/педикюр, спа, массаж). Пет-проект для портфолио.

Документы проекта (ТЗ, архитектура, план реализации) лежат в папке `BEAUTY4YOU/` рядом с этим репозиторием.

## Стек

- **Backend:** NestJS + TypeScript + Prisma + PostgreSQL
- **Frontend:** React + TypeScript + Vite
- **Mobile (мастер):** Kotlin + Jetpack Compose — нативное Android-приложение, переиспользует backend веб-CRM
- **Mobile (клиент):** Kotlin + Jetpack Compose — нативное Android-приложение клиента салона, вход по телефону + SMS-коду
- **Наблюдаемость:** Winston (JSON-логи) → Filebeat → Logstash → Elasticsearch/Kibana; Prometheus + Grafana (HTTP-метрики с `/metrics`)
- **Контейнеры:** Docker Compose — Postgres, backend-образ (`backend/Dockerfile`), стек мониторинга
- **CI:** GitHub Actions

## Структура репозитория

```
b4u-crm/
  backend/                — NestJS API (модули: auth, clients, staff, services, bookings, payments,
                             inventory, notifications, master-schedules, master-blocks,
                             public-booking, client-portal, ...); Dockerfile — образ для compose
  frontend/                — React SPA (веб-CRM для администратора/ресепшена)
  MobileApp/
    master-app/            — нативное Android-приложение мастера (Kotlin + Jetpack Compose)
    client-app/            — нативное Android-приложение клиента (Kotlin + Jetpack Compose)
    design_extracted*/     — распакованные дизайн-макеты (design handoff) для мобильных приложений
  infra/                   — конфиги filebeat, logstash, prometheus, grafana (для docker-compose)
  docker-compose.yml       — PostgreSQL, backend-образ, ELK, Prometheus/Grafana, экспортёры
  .github/workflows/ci.yml — CI: lint, тесты, сборка
```

## Быстрый старт (Этап 0)

### 1. Поднять базу данных

```bash
docker compose up -d postgres
```

Для разработки нужен только Postgres — backend ниже запускается локально (`npm run start:dev`).
`docker compose up -d` без аргументов поднимает весь стек: backend в контейнере (`backend/Dockerfile`,
миграции применяются при старте), ELK, Prometheus и Grafana. Для него нужен `JWT_SECRET` в окружении
или в корневом `.env` — без него (или с дефолтным значением) backend в production не стартует:

```bash
JWT_SECRET="$(openssl rand -hex 32)" docker compose up -d
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

Frontend поднимется на `http://localhost:5173` и слушает все интерфейсы (`vite --host`) — веб-CRM
можно открыть с телефона по LAN IP. Без `VITE_API_URL` запросы идут на тот же хост, порт 3000.

### 4. Приложение мастера (Android)

```bash
cd MobileApp/master-app
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export ANDROID_SDK_ROOT=/opt/homebrew/share/android-commandlinetools
adb reverse tcp:3000 tcp:3000   # тоннель к backend на хосте через USB (для реального устройства)
./gradlew installDebug
```

Backend должен быть уже поднят (шаг 2). Подробнее — в разделе ниже.

### 5. Приложение клиента (Android)

```bash
cd MobileApp/client-app
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export ANDROID_SDK_ROOT=/opt/homebrew/share/android-commandlinetools
adb reverse tcp:3000 tcp:3000   # тоннель к backend на хосте через USB (как у приложения мастера)
./gradlew installDebug          # или assembleDebug → app/build/outputs/apk/debug/app-debug.apk
./gradlew testDebugUnitTest     # unit-тесты маппинга API и мока лояльности
```

Backend должен быть поднят (шаг 2). Для входа без SMS-провайдера в `backend/.env` должно быть
`CLIENT_OTP_DEV_MODE=true` — тогда код приходит в ответе API и показывается прямо на экране входа
(и всегда пишется в лог backend строкой `[mock sms]`).

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

## Мобильное приложение клиента (Android)

`MobileApp/client-app/` — нативное Android-приложение для клиентов салона. Дизайн-макет — в
`MobileApp/design_extracted/design_handoff_b4u_android_app/` (распакован из `B4U Mobile Client App
Design.zip`). Язык интерфейса — польский, строки вынесены в `res/values/strings.xml`.

Стек: Kotlin + Jetpack Compose, Material 3 с кастомными токенами дизайна (шрифты Playfair Display +
Inter), Retrofit2 + OkHttp + kotlinx.serialization, DataStore Preferences (токен клиента),
`ClientViewModel` и `LoginViewModel` на StateFlow, ручной service locator (`AppContainer`) без DI-фреймворка.
Как и приложение мастера, читает время записей «как есть» из UTC (время салона без таймзоны — см.
комментарий в `data/Mappers.kt`).

Нижняя навигация — **Aktualności**, **Główna**, **Usługi**, **Wizyty**, **Profil**; поверх вкладок
открываются экраны **Mistrz** (карточка мастера) и **Program lojalnościowy**. Шторка **Nowa
rezerwacja** открывается с любого экрана и предзаполняется выбранной услугой/мастером. Вместо
перебора значений по тапу из прототипа в ней выпадающие списки и календарь, а в списке мастеров —
только те, кто оказывает выбранную услугу.

**Вход:** по номеру телефона и одноразовому 6-значному SMS-коду (5 минут, 5 проверок — считается
каждая, и верная тоже; попытка резервируется и код гасится атомарными условными UPDATE, поэтому
параллельные запросы не обходят лимит и не создают дубль клиента). Если клиента
с таким телефоном в салоне ещё нет, приложение спрашивает имя и согласие RODO и создаёт карточку
клиента (та же, что видит администратор в веб-CRM). Реального SMS-провайдера пока нет —
`ConsoleSmsProvider` пишет SMS в лог backend; подключается заменой провайдера по DI-токену
`SMS_PROVIDER`.

**Backend — модуль `client-portal` (`/client/*`):**
- `POST /client/auth/request-code`, `POST /client/auth/verify` — вход (анонимные, под rate limit);
- `GET /client/me`, `GET /client/catalog` — профиль; услуги, категории (с `coverPhotoId`) и активные мастера салона (с `specializationCategoryIds`), плюс `client: { isNew, services: [{serviceId, lastMasterId, lastVisitAt}] }` по COMPLETED-визитам клиентки (item88);
- `GET /client/slots` — свободные слоты мастера на день (та же логика, что у `/public/booking`);
- `GET/POST /client/bookings`, `POST /client/bookings/:id/cancel` — собственные записи клиента;
  создание и отмена идут через `BookingsService` с теми же проверками (пересечения, буфер,
  блокировки, график мастера) и уведомлениями, что и запись администратором. Запись создаётся
  со статусом `CREATED` и источником `ONLINE` — в приложении она «Oczekująca», пока салон её
  не подтвердит.

Токен клиента подписан тем же `JWT_SECRET`, но с отдельным audience (`b4u-client-app`) и
проверяется своей passport-стратегией — клиентский токен не пускает на маршруты сотрудников, и
наоборот. Коды хранятся только как bcrypt-хэш (таблица `client_otps`).

Переменные окружения (`backend/.env.example`): `CLIENT_APP_SALON_ID` (без него — первый салон в
БД), `CLIENT_JWT_EXPIRES_IN` (по умолчанию 30 дней), `CLIENT_OTP_DEV_MODE` (только для локальной
разработки — возвращает код в ответе API; в production не включать).

**Пока на мок-данных (нет на backend):** программа лояльности (баланс, награды — живут в памяти
приложения, «оплата баллами» сервер не затрагивает), новости и контакты салона. Рейтинг, портфолио
и отзывы мастеров из макета не показываются — этих данных нет.

## Наблюдаемость и Docker

`docker compose up -d` (с `JWT_SECRET`, см. шаг 1) поднимает:

| Сервис | Порт на хосте | Назначение |
|---|---|---|
| app | 3000 | backend в production-режиме (миграции применяются при старте контейнера) |
| postgres | 5432 | БД |
| elasticsearch / kibana | 9200 / 5601 | хранение и просмотр логов |
| logstash / filebeat | 5044 / — | filebeat читает `/var/log/b4u-crm/*.log` (общий volume с app) и шлёт в logstash |
| prometheus | 9090 | сбор метрик (`app:3000/metrics`, node-exporter, postgres-exporter) |
| grafana | 3001 | дашборды; источник данных Prometheus провижинится из `infra/grafana` |

**Логи:** Winston — в production JSON в консоль и в файлы `/var/log/b4u-crm/app.log` и `error.log`
(их и читает filebeat), в dev — цветной человекочитаемый формат только в консоль.

**Метрики:** `GET /metrics` — стандартные метрики Node.js и `b4u_http_requests_total` /
`b4u_http_request_duration_seconds` с метками `method`, `path` (шаблон маршрута, например
`/client/bookings/:id/cancel`) и `status_code`. Их пишет `MetricsMiddleware` по событию `finish`
ответа, поэтому учитываются все исходы — включая 401/429 от guard'ов, 404 и 500. Запросы без
совпавшего маршрута собираются под одной меткой `path="unmatched"`, чтобы сканеры не раздували
число временных рядов.

**Защита production-конфигурации:** при `NODE_ENV=production` backend не стартует, если
`JWT_SECRET` не задан или равен дефолтному `change-me-in-production`, либо если включён
`CLIENT_OTP_DEV_MODE` (`backend/src/common/config/assert-production-config.ts`).

Известные ограничения стека мониторинга: пароль администратора Grafana задан прямо в
`docker-compose.yml`, а Elasticsearch, Kibana, Prometheus и экспортёры опубликованы на хост без
аутентификации — конфигурация рассчитана на локальный запуск, не на публичный сервер.

## Roadmap

См. `BEAUTY4YOU_Plan_realizacii.md`: Этап 0 (это репо) → MVP → второй релиз → развитие.
