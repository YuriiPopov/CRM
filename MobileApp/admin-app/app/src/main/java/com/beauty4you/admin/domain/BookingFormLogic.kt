package com.beauty4you.admin.domain

import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime

// Ошибки сохранения визита, понятные администратору (текст — в strings.xml, см. ui/common/Errors.kt)
enum class BookingError {
    OVERLAP, // пересечение с другой записью, включая буфер 10 минут между записями
    MASTER_BLOCKED, // блокировка времени мастера (MasterBlock)
    DAY_OFF, // выходной по графику
    OUTSIDE_HOURS, // вне рабочих часов по графику
    PAST_TIME,
    INVALID_TRANSITION,
    NOT_RESCHEDULABLE,
    NOT_FOUND,
    VALIDATION,
    NETWORK,
    UNKNOWN,
}

// Что отправить на бэкенд при «Zapisz»
data class SavePlan(
    val create: Boolean,
    val reschedule: Boolean,
    // null — статус не менять
    val statusChange: BookingStatus?,
) {
    val isNoop: Boolean get() = !create && !reschedule && statusChange == null
}

object BookingFormLogic {

    // Взаимная фильтрация «мастер ↔ услуга» — как masterServiceFilter.ts в веб-CRM.
    // Не выбран мастер — все услуги; выбран — только закреплённые за ним.
    fun servicesForMaster(services: List<Service>, masters: List<Master>, masterId: String?): List<Service> {
        if (masterId == null) return services
        val allowed = masters.find { it.id == masterId }?.serviceIds ?: return emptyList()
        return services.filter { it.id in allowed }
    }

    // Деактивированный мастер для новой записи не предлагается никогда; по услуге — сужаем,
    // только если она выбрана.
    fun mastersForService(masters: List<Master>, serviceId: String?): List<Master> {
        val active = masters.filter { it.isActive }
        if (serviceId == null) return active
        return active.filter { serviceId in it.serviceIds }
    }

    fun isLinked(masters: List<Master>, masterId: String, serviceId: String): Boolean =
        masters.find { it.id == masterId }?.serviceIds?.contains(serviceId) == true

    // При смене одного поля несовместимое значение другого сбрасывается (а не молча остаётся)
    fun serviceAfterMasterChange(masters: List<Master>, newMasterId: String, currentServiceId: String?): String? =
        currentServiceId?.takeIf { isLinked(masters, newMasterId, it) }

    fun masterAfterServiceChange(masters: List<Master>, newServiceId: String, currentMasterId: String?): String? =
        currentMasterId?.takeIf { isLinked(masters, it, newServiceId) }

    // Время для выбора. Свободные слоты считает бэкенд (GET /public/booking/slots — тот же
    // расчёт, что у веб-CRM и клиентского приложения), но при переносе собственное время записи
    // он считает занятым ею же — его добавляем, чтобы можно было сменить только статус/мастера
    // без смены времени.
    fun timeOptions(freeSlots: List<LocalTime>, keepTime: LocalTime?): List<LocalTime> =
        (freeSlots + listOfNotNull(keepTime)).distinct().sorted()

    // Собственное время записи сохраняется вариантом, только пока выбраны её же мастер и дата
    fun keepTimeFor(original: Booking?, masterId: String?, date: LocalDate): LocalTime? =
        original?.takeIf { it.masterId == masterId && it.date == date }?.start?.toLocalTime()

    fun planSave(
        original: Booking?,
        masterId: String,
        date: LocalDate,
        time: LocalTime,
        status: BookingStatus,
    ): SavePlan {
        if (original == null) {
            return SavePlan(
                create = true,
                reschedule = false,
                statusChange = status.takeIf { it != BookingStatus.CREATED },
            )
        }
        val moved = original.masterId != masterId || original.start != LocalDateTime.of(date, time)
        return SavePlan(
            create = false,
            reschedule = moved,
            statusChange = status.takeIf { it != original.status },
        )
    }

    // Обратно в формат бэкенда: салонное время с меткой UTC, без конвертации часового пояса
    fun toApiDateTime(date: LocalDate, time: LocalTime): String =
        "%sT%02d:%02d:00.000Z".format(date, time.hour, time.minute)

    // Сопоставление ответа бэкенда (код + message из тела Nest-ошибки) с понятной ошибкой
    fun mapError(httpCode: Int?, message: String?): BookingError {
        val msg = message.orEmpty().lowercase()
        return when {
            httpCode == null -> BookingError.NETWORK
            "overlapping booking" in msg -> BookingError.OVERLAP
            "schedule blocked" in msg -> BookingError.MASTER_BLOCKED
            "does not work on this day" in msg -> BookingError.DAY_OFF
            "outside the master's working hours" in msg -> BookingError.OUTSIDE_HOURS
            "in the past" in msg -> BookingError.PAST_TIME
            "cannot transition" in msg -> BookingError.INVALID_TRANSITION
            "cannot reschedule" in msg -> BookingError.NOT_RESCHEDULABLE
            httpCode == 404 -> BookingError.NOT_FOUND
            httpCode == 400 -> BookingError.VALIDATION
            else -> BookingError.UNKNOWN
        }
    }
}
