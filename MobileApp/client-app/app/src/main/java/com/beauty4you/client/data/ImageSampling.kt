package com.beauty4you.client.data

/**
 * Во сколько раз уменьшать картинку при декодировании (BitmapFactory.Options.inSampleSize): наибольшая
 * степень двойки, при которой короткая сторона всё ещё не меньше [slotSide]. Картинки показываются с
 * ContentScale.Crop, поэтому слот заполняет именно короткая сторона — по длинной картинка вышла бы мыльной.
 * Чистый Kotlin, чтобы расчёт проверялся JVM unit-тестами.
 */
fun inSampleSize(width: Int, height: Int, slotSide: Int): Int {
    if (width <= 0 || height <= 0 || slotSide <= 0) return 1
    val shortSide = minOf(width, height)
    var sample = 1
    while (shortSide / (sample * 2) >= slotSide) sample *= 2
    return sample
}
