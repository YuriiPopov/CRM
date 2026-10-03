package com.beauty4you.client.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LoyaltyStoreTest {

    @Test
    fun `reward is redeemed only when balance is sufficient`() {
        val store = LoyaltyStore(initialPoints = 640)
        assertTrue(store.redeem("r2")) // 600
        assertEquals(40, store.points.value)
        assertFalse(store.redeem("r1")) // 200 > 40
        assertEquals(40, store.points.value)
    }
}
