package com.beauty4you.admin.domain

import org.junit.Assert.assertEquals
import org.junit.Test

class ImageSamplingTest {

    @Test
    fun `news image up to twice the screen width is decoded as is`() {
        assertEquals(1, ImageSampling.inSampleSize(1600, 1200, 1080))
    }

    @Test
    fun `large image is halved while the long side stays at least the display size`() {
        assertEquals(2, ImageSampling.inSampleSize(4000, 3000, 1080))
        assertEquals(4, ImageSampling.inSampleSize(8000, 6000, 1080))
        assertEquals(2, ImageSampling.inSampleSize(3000, 4000, 1080))
    }

    @Test
    fun `master avatar of 132 px decodes a 1600 px photo at one eighth`() {
        assertEquals(8, ImageSampling.inSampleSize(1600, 1600, 132)) // 200 px
    }

    @Test
    fun `unknown bounds mean no downsampling`() {
        assertEquals(1, ImageSampling.inSampleSize(0, 0, 1080))
        assertEquals(1, ImageSampling.inSampleSize(1600, 1200, -1))
    }
}
