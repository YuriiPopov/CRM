package com.beauty4you.client.domain

/** Ввод польского номера: в поле живут только 9 национальных цифр, «+48» — фиксированный префикс. */
object PhoneInput {
    const val COUNTRY_PREFIX = "+48"
    const val LENGTH = 9

    /**
     * Приводит ввод или вставку к национальным цифрам (максимум 9): убирает всё, кроме цифр,
     * и срезает код страны («+48…», «0048…», «48…»), если после него остаётся полный номер.
     * Набор по одной цифре не затрагивается: «48» при вводе остаётся «48».
     */
    fun normalize(input: String): String {
        val digits = input.filter { it in '0'..'9' }
        val national = when {
            digits.startsWith("0048") && digits.length >= 4 + LENGTH -> digits.substring(4)
            digits.startsWith("48") && digits.length >= 2 + LENGTH -> digits.substring(2)
            else -> digits
        }
        return national.take(LENGTH)
    }

    /** «601234567» → «601 234 567»; неполный номер группируется по мере набора. */
    fun format(national: String): String = national.chunked(3).joinToString(" ")

    fun isComplete(national: String): Boolean = national.length == LENGTH

    /** Формат запроса к серверу: «+48» и 9 цифр. */
    fun toE164(national: String): String = COUNTRY_PREFIX + national
}
