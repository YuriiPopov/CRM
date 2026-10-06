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
- **Więcej** — Mistrzowie, Usługi, Aktualności, выход.
- **Mistrzowie** (item76) — «+» → новый мастер; карточка: фото (камера/галерея, сжатие до 640 px
  и ≤ 2 МБ), имя, цвет (только показ — вычисляется из id, как в веб-CRM), специализации, услуги
  галочками, статус «Aktywny/Nieaktywny». «Usuń» мастера скрыто до item80 (DELETE /staff всегда 409),
  кнопки «Grafik pracy» и «Blokady» открывают шторки поверх карточки. Сохранение — цепочка
  `POST/PATCH /staff` → `POST/DELETE /staff/:id/photo` → `POST/DELETE /staff/:id/services/:serviceId`;
  после частичной ошибки повторное «Zapisz» досылает только недостающее.
- **Grafik pracy** (item76, часть 2) — неделя конкретных дат с листанием; выбор нескольких дней
  («Zaznacz cały tydzień») и «Pracuje od–do» / «Wolne» для всех выбранных (часы 06:00–22:00, шаг 15 мин).
  Сохраняются только изменённые дни, по запросу на месяц: сначала `POST /master-schedules/conflicts`,
  при конфликтах — список записей (дата, время, клиент, услуга) и «Zapisz mimo to», затем `PUT /master-schedules`.
  Бэкенд считает конфликтом только записи на днях, которые становятся выходными (не сужение часов).
- **Blokady** (item76, часть 2) — будущие блокировки мастера, «Dodaj blokadę» (дата, od–do, причина
  Urlop / Przerwa / Inne + комментарий; в `reason` пишется «Przerwa: комментарий»), удаление с подтверждением.
- **«Odrzucić zmiany?»** — общий `FormSheet` (`ui/common/FormSheet.kt`): если форма изменена, свайп вниз,
  «назад» и тап мимо формы спрашивают «Odrzuć» / «Wróć do edycji»; нетронутая форма закрывается сразу.
  На нём все формы: визит, новость, мастер, услуга, категория, график, блокировка.
- **Usługi** (item76) — «+» → новая услуга (категория, название, длительность, цена в zł);
  нажатие на услугу — редактирование/удаление; «+ Kategoria» и нажатие на заголовок категории —
  добавить/переименовать/удалить. Удаляется только пустая и не дефолтная категория.
  Ошибки backend (услуга с записями/мастерами, мастер с записями) показываются в форме, форма не закрывается.

## Логика и тесты

Чистая логика без Android-зависимостей — `app/src/main/java/com/beauty4you/admin/domain/`
(фильтры календаря, раскладка таймлайна, переходы статусов, польские даты, клиенты, форма).
Unit-тесты — `app/src/test/`.

## Не входит в этап 1

Синхронизация с Google Kalendarz; удаление мастера (item80).
