# B4U Admin — Android-приложение администратора (item73, этап 1)

Пакет `com.beauty4you.admin`. Стек и структура как у `master-app`: Kotlin, Jetpack Compose,
Material 3, Retrofit + OkHttp + kotlinx.serialization, DataStore, Navigation-Compose.
Дизайн: `Design/B4U Admin App.dc.html`.

## Сборка и запуск

```bash
cd MobileApp/admin-app
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export ANDROID_SDK_ROOT=/opt/homebrew/share/android-commandlinetools
./gradlew :app:assembleDebug :app:testDebugUnitTest
adb reverse tcp:3000 tcp:3000   # реальное устройство по USB -> backend на хосте
./gradlew installDebug
```

`BASE_URL` — `http://127.0.0.1:3000/` (см. `app/build.gradle.kts`); для эмулятора — `http://10.0.2.2:3000/`.
Backend должен быть запущен (`backend/`, `npm run start:dev`).

## Вход

`POST /auth/login` → `GET /auth/me`. Пускаем только роль `ADMIN`, иначе «Brak dostępu — aplikacja
tylko dla administratora». Любой 401 очищает сессию в `AuthInterceptor` — приложение возвращается
на экран входа.

## Экраны

- **Panel** — «Cześć, …» и дата по-польски; «Dzisiaj»; 3 ближайшие записи; неделя с метками мастеров;
  плашка «Czekają na potwierdzenie» (`GET /bookings/pending-online/count`) → Kalendarz с фильтром
  Oczekująca на дне ближайшей такой записи.
- **Kalendarz** — Lista / Specjalista / Timeline; полоса недели с листанием; фильтры мастер/статус
  (выпадающие); pull-to-refresh; FAB «+». Timeline: 09:00–19:00, шаг 15 мин, колонки по мастерам,
  часы из `GET /master-schedules`, блокировки из `GET /master-blocks` серым, вне графика — светлая заливка.
- **Форма визита** — создание `POST /bookings` (статус «Potwierdzona» = POST + `PATCH …/status`),
  перенос `PATCH /bookings/:id/reschedule` (мастер/дата/время; клиент и услуга фиксированы),
  смена статуса `PATCH /bookings/:id/status`, «Usuń» = отмена (CANCELLED) с подтверждением.
  Время — из свободных слотов `GET /public/booking/slots` (тот же расчёт, что в веб-CRM).
  Ошибки backend (пересечение/буфер, блокировка, вне графика, выходной) показываются в форме.
- **Klienci** — поиск по имени/телефону, «+ Nowy klient» (`POST /clients`, телефон нормализуется
  к `+48 xxx xxx xxx`), карточка с историей (`GET /bookings?clientId=`).
- **Więcej** — Mistrzowie и Usługi (только просмотр), Aktualności — заглушка, выход.

## Логика и тесты

Чистая логика без Android-зависимостей — `app/src/main/java/com/beauty4you/admin/domain/`
(фильтры календаря, раскладка таймлайна, переходы статусов, польские даты, клиенты, форма).
Unit-тесты — `app/src/test/`.

## Не входит в этап 1

Статус «Nieobecna» и метка «Niewiarygodny», модуль Aktualności, синхронизация с Google Kalendarz,
редактирование мастеров/услуг (см. ТЗ item73, этап 2).
