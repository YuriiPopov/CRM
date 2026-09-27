package com.beauty4you.client.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LoyaltyStoreTest {

    @Test
    fun `paying in salon accrues 10 percent of price`() {
        val store = LoyaltyStore(initialPoints = 640)
        store.onBookingCreated(price = 320.0, payment = PaymentMethod.IN_SALON)
        assertEquals(672, store.points.value)
    }

    @Test
    fun `paying with points deducts at most the balance`() {
        val store = LoyaltyStore(initialPoints = 170)
        assertEquals(150, store.pointsCoverage(150.0))
        store.onBookingCreated(price = 320.0, payment = PaymentMethod.POINTS)
        assertEquals(0, store.points.value)
    }

    @Test
    fun `reward is redeemed only when balance is sufficient`() {
        val store = LoyaltyStore(initialPoints = 640)
        assertTrue(store.redeem("r2")) // 600
        assertEquals(40, store.points.value)
        assertFalse(store.redeem("r1")) // 200 > 40
        assertEquals(40, store.points.value)
    }
}
