package com.beauty4you.client.data

/**
 * Во сколько раз уменьшать картинку при декодировании (BitmapFactory.Options.inSampleSize): наибольшая
 * степень двойки, при которой длинная сторона всё ещё не меньше [maxSide] — картинка не мельче места показа.
 * Чистый Kotlin, чтобы расчёт проверялся JVM unit-тестами.
 */
fun inSampleSize(width: Int, height: Int, maxSide: Int): Int {
    if (width <= 0 || height <= 0 || maxSide <= 0) return 1
    val longSide = maxOf(width, height)
    var sample = 1
    while (longSide / (sample * 2) >= maxSide) sample *= 2
    return sample
}
