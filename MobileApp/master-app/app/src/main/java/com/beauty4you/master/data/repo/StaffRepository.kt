package com.beauty4you.master.data.repo

import com.beauty4you.master.data.remote.ApiService

data class MasterProfile(
    val id: String,
    val name: String,
    val photo: String?,
    // Категории/специализации мастера бэкенд не отдаёт по имени роли MASTER (GET /service-categories
    // — ADMIN-only), поэтому специальность собирается из названий услуг, реально закреплённых за
    // мастером (GET /staff/:id -> services[].name, плоский массив Service — см. MasterDetailDto) —
    // не идентично дизайновому "Fryzjer, koloryzacja" (там это категории), но те же реальные данные
    // без расширения бэкенда.
    val specialtyLine: String,
)

class StaffRepository(private val api: ApiService) {
    suspend fun getMyProfile(masterId: String): MasterProfile {
        val master = api.getMaster(masterId)
        val specialty = master.services
            .map { it.name }
            .distinct()
            .take(3)
            .joinToString(", ")
        return MasterProfile(
            id = master.id,
            name = master.name,
            photo = master.photo,
            specialtyLine = specialty,
        )
    }
}
