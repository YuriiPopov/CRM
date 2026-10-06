package com.beauty4you.client.data

import org.junit.Assert.assertEquals
import org.junit.Test

class ImageSamplingTest {

    @Test
    fun `image whose short side is below twice the display size is decoded as is`() {
        assertEquals(1, inSampleSize(1600, 1200, 1080))
        assertEquals(1, inSampleSize(1080, 720, 1080))
        assertEquals(1, inSampleSize(300, 200, 1080))
    }

    @Test
    fun `large photo is halved until its short side would drop below the display size`() {
        assertEquals(2, inSampleSize(4000, 3000, 1080)) // 1500 px
        assertEquals(4, inSampleSize(8000, 6000, 1080)) // 1500 px
    }

    @Test
    fun `wide banner is not downsampled by its long side`() {
        // Длинная сторона 2160 разрешила бы /2, но тогда высота 500 px растянулась бы под Crop
        assertEquals(1, inSampleSize(2160, 1000, 1080))
    }

    @Test
    fun `portrait photo uses its width as the short side`() {
        assertEquals(2, inSampleSize(3000, 4000, 1080))
    }

    @Test
    fun `unknown bounds or display size mean no downsampling`() {
        assertEquals(1, inSampleSize(-1, -1, 1080))
        assertEquals(1, inSampleSize(4000, 3000, 0))
    }
}
