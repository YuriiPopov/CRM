package com.beauty4you.client.data

import org.junit.Assert.assertEquals
import org.junit.Test

class ImageSamplingTest {

    @Test
    fun `image not larger than twice the display size is decoded as is`() {
        assertEquals(1, inSampleSize(1600, 1200, 1080))
        assertEquals(1, inSampleSize(1080, 720, 1080))
        assertEquals(1, inSampleSize(300, 200, 1080))
    }

    @Test
    fun `large photo is halved until its long side would drop below the display size`() {
        assertEquals(2, inSampleSize(4000, 3000, 1080)) // 2000 px
        assertEquals(4, inSampleSize(8000, 6000, 1080)) // 2000 px
        assertEquals(2, inSampleSize(2160, 1000, 1080)) // ровно 1080 px
    }

    @Test
    fun `portrait photo uses its height as the long side`() {
        assertEquals(2, inSampleSize(3000, 4000, 1080))
    }

    @Test
    fun `unknown bounds or display size mean no downsampling`() {
        assertEquals(1, inSampleSize(-1, -1, 1080))
        assertEquals(1, inSampleSize(4000, 3000, 0))
    }
}
