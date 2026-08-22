<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## CORS

`app.enableCors()` в `main.ts` разрешает запросы с `FRONTEND_URL` (по умолчанию `http://localhost:5173`, если переменная не задана) и передачу credentials. При деплое фронтенда на другой origin — задать `FRONTEND_URL` в окружении backend.

## Auth

JWT-аутентификация по email+паролю (bcrypt), роли `ADMIN`/`MASTER` (см. `Role` в `prisma/schema.prisma`).

- `POST /auth/login` — `{ email, password }` → `{ accessToken }`.
- `GET /auth/me` — требует `Authorization: Bearer <token>`, возвращает текущего пользователя.
- `POST /auth/register` — требует токен пользователя с ролью `ADMIN`; создаёт нового пользователя (`email`, `password`, `role`, опционально `masterId`) в том же салоне, что и у создающего админа.

Так как `/auth/register` защищён ролью `ADMIN`, для первого запуска нужен посевной admin-пользователь:

```bash
npm run prisma:seed
```

Создаёт (или обновляет, если уже существует) салон и admin-пользователя с данными из `SEED_SALON_NAME` / `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (см. `.env.example`).

## Clients

CRUD карточек клиентов, все операции скоуплены по `salonId` текущего пользователя.

- `POST /clients` — только `ADMIN`; требует `consentGiven: true` (GDPR — явное согласие на обработку данных, см. архитектуру, п.6), фиксирует `consentGivenAt`.
- `GET /clients`, `GET /clients/:id` — `ADMIN` видит всех клиентов своего салона; `MASTER` — только клиентов по своим записям (через `Booking.masterId`).
- `PATCH /clients/:id` — только `ADMIN`; `consentWithdrawn: true` фиксирует отзыв согласия (`consentWithdrawnAt`).
- `DELETE /clients/:id` — только `ADMIN`; при наличии у клиента записей (bookings) удаление отклоняется (409).

### GDPR: удаление и экспорт данных клиента

- `DELETE /clients/:id/gdpr-erasure` — только `ADMIN`. **Анонимизация, а не физическое удаление строки**: `Booking.clientId` — обязательный (non-nullable) FK, у клиента почти всегда есть история записей, а `Payment` обязан пережить эрайзер по требованиям бухучёта (GDPR Art. 17(3)(b) — retention для соответствия юридическим обязательствам перекрывает право на удаление именно для этих данных). Вместо удаления строки — `name`/`phone`/`email`/`notes`/`tags` обнуляются, `consentWithdrawnAt` фиксирует момент; `Booking`/`Payment` остаются как есть (они и так хранят только `clientId`, а не имя/контакты напрямую). Тот же путь используется и для клиента без единой записи — единый код-путь без FK-развилки, результат для конкретного человека идентичен полному удалению. Каждый запрос фиксируется в `DataDeletionRequest` (audit trail) внутри одной транзакции с анонимизацией; повторный запрос на уже анонимизированного клиента — 409.
- `GET /clients/:id/export` — `ADMIN` и `MASTER` (право на переносимость данных, см. ТЗ). Отдаёт карточку клиента + историю записей; видимость наследует существующие правила ролей — `MASTER` получает только свои записи (`Booking.masterId`) и урезанный вид оплаты (только факт: `id`/`bookingId`/`paidAt`, без суммы/скидки/метода — та же логика, что и в Payments, вынесена в общую `payment-view.util.ts`).

## Staff

CRUD карточек мастеров, все операции скоуплены по `salonId` текущего пользователя.

- `POST /staff` — только `ADMIN`; создаёт мастера (`name`, `specialization`, опционально `isActive`).
- `GET /staff`, `GET /staff/:id` — `ADMIN` видит весь штат своего салона; `MASTER` — только собственную карточку. `GET /staff/:id` включает список привязанных услуг (`services`).
- `PATCH /staff/:id`, `DELETE /staff/:id` — только `ADMIN`; удаление отклоняется (409), если у мастера есть связанный логин, записи или привязанные услуги.
- `POST /staff/:id/services/:serviceId` — только `ADMIN`; привязывает услугу к мастеру через `MasterService` (идемпотентно — повторный вызов не ошибка).
- `DELETE /staff/:id/services/:serviceId` — только `ADMIN`; отвязывает услугу от мастера (404, если такой привязки нет).

## Services

CRUD справочника услуг, скоуплен по `salonId`; в отличие от Clients/Staff, чтение (`GET`) не различается по ролям — каталог общий для `ADMIN` и `MASTER`.

- `POST /services`, `PATCH /services/:id`, `DELETE /services/:id` — только `ADMIN`. Удаление отклоняется (409), если услуга ещё используется мастерами, материалами или записями.
- `GET /services`, `GET /services/:id` — `ADMIN` и `MASTER`.

## Bookings

Календарь записей, скоуплен по `salonId`; `endTime` всегда вычисляется сервером из `Service.durationMin`, клиент передаёт только `startTime`.

- `POST /bookings` — `ADMIN` указывает `masterId` явно; `MASTER` бронирует только на себя (передавать чужой `masterId` — 403). Проверяет пересечение по времени: конфликт (409), если у мастера уже есть активная (не `CANCELLED`) запись с пересекающимся интервалом — `COMPLETED` тоже блокирует слот, `CANCELLED` нет.
- `GET /bookings`, `GET /bookings/:id` — `ADMIN` видит все записи салона; `MASTER` — только свои.
- `PATCH /bookings/:id/reschedule` — только `ADMIN`; меняет `startTime` (и опционально `masterId`), пересчитывает `endTime`, повторяет проверку пересечений. Нельзя перенести `CANCELLED`/`COMPLETED` запись (409).
- `PATCH /bookings/:id/status` — переходы `CREATED → CONFIRMED|CANCELLED`, `CONFIRMED → COMPLETED|CANCELLED`; `COMPLETED`/`CANCELLED` терминальны. `ADMIN` может выполнить любой допустимый переход; `MASTER` — только `COMPLETED`/`CANCELLED` и только для своих записей (подтверждение — действие `ADMIN`).

## Payments

`Payment` 1—1 с `Booking` и не несёт `salonId` напрямую — скоуп везде идёт через связь `booking.salonId`/`booking.masterId`.

- `POST /payments` — только `ADMIN`; оплата создаётся только для записи в статусе `COMPLETED` (депозиты/предоплата — вне MVP, см. ТЗ). Повторная оплата той же записи отклоняется (409, `bookingId` уникален), скидка не может превышать сумму (400).
- `GET /payments`, `GET /payments/:id` — `ADMIN` видит полные финансовые детали (`amount`, `discount`, `method`, `status`) по всему салону; `MASTER` видит только факт оплаты по своим записям (`id`, `bookingId`, `paidAt`, без суммы/скидки/метода).
- `GET /payments/report/revenue?from&to` — только `ADMIN`; минимальная отчётность по выручке за период (оба параметра опциональны): `grossAmount` (сумма `amount`), `totalDiscount`, `netRevenue = grossAmount - totalDiscount`, `paymentsCount`.

## Notifications

Упрощённая "таблица исходящих" из архитектуры (п.5) — без Redis/очереди: `BookingsService` сам вызывает `NotificationsService` синхронно при создании/переносе/отмене записи, а сбой отправки никогда не ломает сам сценарий записи (фиксируется как `FAILED`).

- Bookings-триггеры: `POST /bookings` → `BOOKING_CONFIRMATION`; `PATCH /bookings/:id/reschedule` → `BOOKING_RESCHEDULED`; `PATCH /bookings/:id/status` с `CANCELLED` → `BOOKING_CANCELLATION`. Канал — только `EMAIL`; получатель — `booking.client.email`. Если email не указан или отправка упала — статус `FAILED`, при успехе — `SENT` (+`sentAt`).
- Реальная отправка замокана за интерфейсом `EmailProvider` (DI-токен `EMAIL_PROVIDER`) — `ConsoleEmailProvider` только логирует; замена на реального провайдера (SendGrid/SES/...) не требует изменений в `NotificationsService`.
- `GET /notifications` (с опциональным `?status=`), `GET /notifications/:id` — только `ADMIN`; `MASTER` доступа не имеет вовсе (403 на все маршруты).

В `Notification` — `type: NotificationType` (`BOOKING_CONFIRMATION`/`BOOKING_RESCHEDULED`/`BOOKING_CANCELLATION`) и `createdAt`; миграция `add_notification_type_and_created_at` — первая для этого проекта (БД поднималась впервые, `prisma/migrations/` до этого не было).

## Public booking (без авторизации)

Минимальная публичная онлайн-запись — единственные анонимные маршруты в API (см. ТЗ, раздел 8 "MVP и roadmap"). Отдают/принимают только то, что нужно самому клиенту: никогда не возвращают чужие записи, список клиентов или расписание мастера целиком — только доступные слоты и подтверждение собственной записи.

- `GET /public/booking/slots?masterId&serviceId&date=YYYY-MM-DD` — свободные слоты мастера под конкретную услугу на дату. Длительность слота — из `Service.durationMin`; занятость считается той же overlap-логикой, что и в Bookings (общая утилита `booking-overlap.util.ts`). Часы работы захардкожены как MVP-упрощение (`09:00–20:00 UTC`, шаг 15 мин) — в схеме пока нет модели расписания; ничего не блокирует добавить её позже. 404, если мастер неактивен/не найден, услуга не из его салона или мастер её не оказывает (через `MasterService`).
- `POST /public/booking` — создаёт запись с `source: ONLINE`. Требует `consentGiven: true` (GDPR, как и в закрытом Clients-модуле). Клиент ищется по `(salonId, phone)` — при совпадении переиспользуется существующая карточка вместо дубликата. Повторно проверяет отсутствие пересечения (защита от гонки между чтением слотов и созданием записи) — 409, если слот уже заняли. В ответе — только что созданная запись (`id`, `startTime`, `endTime`, `status`), без `salonId`/`clientId`.
- Rate-limit — только на этих двух маршрутах (`@nestjs/throttler`, in-memory, без Redis): 30 запросов/мин на чтение слотов, 5 запросов/мин на создание записи; при превышении — 429.

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
