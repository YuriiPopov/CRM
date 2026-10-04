package com.beauty4you.admin.domain

import com.beauty4you.admin.domain.BookingStatus.CONFIRMED
import com.beauty4you.admin.domain.BookingStatus.CREATED
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalTime

class BookingFormLogicTest {

    private val haircut = Service("s1", "Strzyżenie", "cat-hair", 60, "150.00")
    private val manicure = Service("s2", "Manicure", "cat-nails", 50, "110.00")
    private val massage = Service("s3", "Masaż", "cat-body", 45, "130.00")
    private val services = listOf(haircut, manicure, massage)

    private val maria = Master("m1", "Maria", serviceIds = setOf("s1"))
    private val olga = Master("m2", "Olga", serviceIds = setOf("s1", "s2"))
    private val retired = Master("m3", "Irina", isActive = false, serviceIds = setOf("s1", "s3"))
    private val masters = listOf(maria, olga, retired)

    @Test
    fun `services narrow to the selected master`() {
        assertEquals(services, BookingFormLogic.servicesForMaster(services, masters, null))
        assertEquals(listOf(haircut), BookingFormLogic.servicesForMaster(services, masters, "m1"))
        assertEquals(listOf(haircut, manicure), BookingFormLogic.servicesForMaster(services, masters, "m2"))
        assertEquals(emptyList<Service>(), BookingFormLogic.servicesForMaster(services, masters, "unknown"))
    }

    @Test
    fun `masters narrow to the selected service and never include inactive`() {
        assertEquals(listOf(maria, olga), BookingFormLogic.mastersForService(masters, null))
        assertEquals(listOf(maria, olga), BookingFormLogic.mastersForService(masters, "s1"))
        assertEquals(listOf(olga), BookingFormLogic.mastersForService(masters, "s2"))
        assertEquals(emptyList<Master>(), BookingFormLogic.mastersForService(masters, "s3"))
    }

    @Test
    fun `incompatible selection is reset when the other field changes`() {
        assertEquals("s1", BookingFormLogic.serviceAfterMasterChange(masters, "m1", "s1"))
        assertNull(BookingFormLogic.serviceAfterMasterChange(masters, "m1", "s2"))
        assertNull(BookingFormLogic.serviceAfterMasterChange(masters, "m1", null))

        assertEquals("m2", BookingFormLogic.masterAfterServiceChange(masters, "s2", "m2"))
        assertNull(BookingFormLogic.masterAfterServiceChange(masters, "s2", "m1"))
    }

    @Test
    fun `own booking time stays selectable while master and date are unchanged`() {
        val original = booking("b", at(11), masterId = "m1")
        assertEquals(LocalTime.of(11, 0), BookingFormLogic.keepTimeFor(original, "m1", DAY))
        assertNull(BookingFormLogic.keepTimeFor(original, "m2", DAY))
        assertNull(BookingFormLogic.keepTimeFor(original, "m1", DAY.plusDays(1)))
        assertNull(BookingFormLogic.keepTimeFor(null, "m1", DAY))
    }

    @Test
    fun `time options merge free slots with the kept time, sorted and distinct`() {
        val free = listOf(LocalTime.of(13, 0), LocalTime.of(9, 0), LocalTime.of(9, 15))
        assertEquals(
            listOf(LocalTime.of(9, 0), LocalTime.of(9, 15), LocalTime.of(11, 0), LocalTime.of(13, 0)),
            BookingFormLogic.timeOptions(free, LocalTime.of(11, 0)),
        )
        assertEquals(listOf(LocalTime.of(9, 0)), BookingFormLogic.timeOptions(listOf(LocalTime.of(9, 0)), LocalTime.of(9, 0)))
    }

    @Test
    fun `new booking creates, and confirms right away only if asked`() {
        assertEquals(SavePlan(create = true, reschedule = false, statusChange = null), BookingFormLogic.planSave(null, "m1", DAY, LocalTime.of(10, 0), CREATED))
        assertEquals(SavePlan(create = true, reschedule = false, statusChange = CONFIRMED), BookingFormLogic.planSave(null, "m1", DAY, LocalTime.of(10, 0), CONFIRMED))
    }

    @Test
    fun `edit reschedules only when master, date or time changed`() {
        val original = booking("b", at(10), masterId = "m1", status = CREATED)
        assertTrue(BookingFormLogic.planSave(original, "m1", DAY, LocalTime.of(10, 0), CREATED).isNoop)
        assertEquals(SavePlan(false, true, null), BookingFormLogic.planSave(original, "m1", DAY, LocalTime.of(11, 0), CREATED))
        assertEquals(SavePlan(false, true, null), BookingFormLogic.planSave(original, "m2", DAY, LocalTime.of(10, 0), CREATED))
        assertEquals(SavePlan(false, true, null), BookingFormLogic.planSave(original, "m1", DAY.plusDays(1), LocalTime.of(10, 0), CREATED))
        assertEquals(SavePlan(false, false, CONFIRMED), BookingFormLogic.planSave(original, "m1", DAY, LocalTime.of(10, 0), CONFIRMED))
        val both = BookingFormLogic.planSave(original, "m2", DAY, LocalTime.of(12, 0), CONFIRMED)
        assertTrue(both.reschedule)
        assertEquals(CONFIRMED, both.statusChange)
        assertFalse(both.create)
    }

    @Test
    fun `api date time keeps salon digits with a UTC marker`() {
        assertEquals("2026-10-06T09:05:00.000Z", BookingFormLogic.toApiDateTime(DAY, LocalTime.of(9, 5)))
    }

    @Test
    fun `backend errors are mapped to readable reasons`() {
        assertEquals(BookingError.OVERLAP, BookingFormLogic.mapError(409, "Master already has an overlapping booking at this time"))
        assertEquals(BookingError.MASTER_BLOCKED, BookingFormLogic.mapError(409, "Master is unavailable at this time (schedule blocked)"))
        assertEquals(BookingError.DAY_OFF, BookingFormLogic.mapError(409, "Master does not work on this day"))
        assertEquals(BookingError.OUTSIDE_HOURS, BookingFormLogic.mapError(409, "Booking time is outside the master's working hours for this day"))
        assertEquals(BookingError.INVALID_TRANSITION, BookingFormLogic.mapError(409, "Cannot transition booking from CREATED to COMPLETED"))
        assertEquals(BookingError.NOT_RESCHEDULABLE, BookingFormLogic.mapError(409, "Cannot reschedule a booking with status CANCELLED"))
        assertEquals(BookingError.PAST_TIME, BookingFormLogic.mapError(400, "Cannot book a time in the past"))
        assertEquals(BookingError.NOT_FOUND, BookingFormLogic.mapError(404, "Client not found"))
        assertEquals(BookingError.VALIDATION, BookingFormLogic.mapError(400, "startTime must be a valid ISO 8601 date string"))
        assertEquals(BookingError.NETWORK, BookingFormLogic.mapError(null, "timeout"))
        assertEquals(BookingError.UNKNOWN, BookingFormLogic.mapError(500, "Internal server error"))
    }

    @Test
    fun `new booking defaults to CONFIRMED and is saved with a status change`() {
        assertEquals(CONFIRMED, BookingFormLogic.initialStatus(null))
        assertEquals(
            SavePlan(create = true, reschedule = false, statusChange = CONFIRMED),
            BookingFormLogic.planSave(null, "m1", DAY, LocalTime.of(10, 0), BookingFormLogic.initialStatus(null)),
        )
    }

    @Test
    fun `editing keeps the booking's current status`() {
        assertEquals(CREATED, BookingFormLogic.initialStatus(booking("b", at(10), status = CREATED)))
        assertEquals(BookingStatus.COMPLETED, BookingFormLogic.initialStatus(booking("b", at(10), status = BookingStatus.COMPLETED)))
    }

    @Test
    fun `slot conflicts make the free slots stale, other errors do not`() {
        assertTrue(BookingFormLogic.staleSlots(BookingError.OVERLAP))
        assertTrue(BookingFormLogic.staleSlots(BookingError.MASTER_BLOCKED))
        assertTrue(BookingFormLogic.staleSlots(BookingError.OUTSIDE_HOURS))
        assertFalse(BookingFormLogic.staleSlots(BookingError.NETWORK))
        assertFalse(BookingFormLogic.staleSlots(BookingError.INVALID_TRANSITION))
    }
}
