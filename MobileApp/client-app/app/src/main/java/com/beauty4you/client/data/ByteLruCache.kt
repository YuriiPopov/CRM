package com.beauty4you.client.data

// LRU-кэш с лимитом по сумме размеров значений (как android.util.LruCache, но на чистом Kotlin —
// вытеснение проверяется JVM unit-тестами, где android.util недоступен). Потокобезопасен.
class ByteLruCache<K : Any, V : Any>(
    private val maxBytes: Long,
    private val sizeOf: (V) -> Long,
) {
    // accessOrder = true: get() переносит запись в конец, первой вытесняется давно не использованная
    private val map = LinkedHashMap<K, V>(16, 0.75f, true)
    private var bytes = 0L

    val sizeBytes: Long @Synchronized get() = bytes

    @Synchronized
    operator fun get(key: K): V? = map[key]

    @Synchronized
    fun put(key: K, value: V) {
        val size = sizeOf(value)
        map.remove(key)?.let { bytes -= sizeOf(it) }
        // Значение больше всего кэша не кладём — оно вытеснило бы всё остальное и само не поместилось
        if (size > maxBytes) return
        map[key] = value
        bytes += size
        trimToSize()
    }

    @Synchronized
    fun removeIf(predicate: (K) -> Boolean) {
        val iterator = map.entries.iterator()
        while (iterator.hasNext()) {
            val entry = iterator.next()
            if (predicate(entry.key)) {
                bytes -= sizeOf(entry.value)
                iterator.remove()
            }
        }
    }

    @Synchronized
    fun keys(): List<K> = map.keys.toList()

    private fun trimToSize() {
        val iterator = map.entries.iterator()
        while (bytes > maxBytes && iterator.hasNext()) {
            bytes -= sizeOf(iterator.next().value)
            iterator.remove()
        }
    }
}
