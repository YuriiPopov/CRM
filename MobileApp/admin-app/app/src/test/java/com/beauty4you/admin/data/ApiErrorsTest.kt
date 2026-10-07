package com.beauty4you.admin.data

import com.beauty4you.admin.data.remote.parseNestErrorCode
import com.beauty4you.admin.data.remote.parseNestErrorMessage
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// Тело 409 при удалении мастера с записями (item80)
class ApiErrorsTest {

    private val body =
        """{"statusCode":409,"code":"MASTER_HAS_BOOKINGS","message":"Нельзя удалить мастера","error":"Conflict"}"""

    @Test
    fun `error code is read from the Nest body`() {
        assertEquals("MASTER_HAS_BOOKINGS", parseNestErrorCode(body))
        assertEquals("Нельзя удалить мастера", parseNestErrorMessage(body))
    }

    @Test
    fun `body without code or with garbage gives no code`() {
        assertNull(parseNestErrorCode("""{"statusCode":409,"message":"x"}"""))
        assertNull(parseNestErrorCode("""{"code":409,"message":"x"}"""))
        assertNull(parseNestErrorCode("not json"))
        assertNull(parseNestErrorCode(null))
    }
}
