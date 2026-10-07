package com.beauty4you.client.data

import java.io.File

/**
 * Дисковый кэш сырых байт фото услуг: ключ — id фото. Фото неизменяемо (на сервере его нельзя править,
 * только удалить и добавить новое с другим id), поэтому устаревания нет — только вытеснение по размеру:
 * при превышении [maxBytes] удаляются давно не открывавшиеся файлы. Потокобезопасен.
 */
class PhotoDiskCache(private val dir: File, private val maxBytes: Long) {

    @Synchronized
    fun get(key: String): ByteArray? {
        val file = fileFor(key)
        if (!file.isFile) return null
        // Чтение = «использование»: свежий lastModified не даёт вытеснить недавно просмотренное
        file.setLastModified(System.currentTimeMillis())
        return runCatching { file.readBytes() }.getOrNull()
    }

    @Synchronized
    fun put(key: String, bytes: ByteArray) {
        if (bytes.size > maxBytes) return
        dir.mkdirs()
        // Запись через временный файл: оборванная запись не оставит битую картинку под настоящим ключом
        val tmp = File(dir, "$key.tmp")
        val ok = runCatching {
            tmp.writeBytes(bytes)
            tmp.renameTo(fileFor(key))
        }.getOrDefault(false)
        if (!ok) tmp.delete()
        trim()
    }

    @Synchronized
    fun clear() {
        dir.listFiles()?.forEach { it.delete() }
    }

    @Synchronized
    fun sizeBytes(): Long = files().sumOf { it.length() }

    private fun fileFor(key: String) = File(dir, key.filter { it.isLetterOrDigit() || it == '-' || it == '_' })

    private fun files(): List<File> = dir.listFiles { f -> f.isFile && !f.name.endsWith(".tmp") }?.toList().orEmpty()

    private fun trim() {
        var total = sizeBytes()
        if (total <= maxBytes) return
        for (file in files().sortedBy { it.lastModified() }) {
            if (total <= maxBytes) break
            total -= file.length()
            file.delete()
        }
    }
}
