package com.beauty4you.client.ui.home

import androidx.compose.ui.graphics.Color
import com.beauty4you.client.data.Catalog
import com.beauty4you.client.data.Category
import com.beauty4you.client.data.ClientServiceVisit
import com.beauty4you.client.data.Master
import com.beauty4you.client.data.Service
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDateTime

class HomeLogicTest {

    private fun service(id: String, category: String = "nails") =
        Service(id, category, id, durationMin = 60, price = 100.0, emoji = "")

    private fun master(id: String, vararg services: String) =
        Master(id, id, Color.Black, photo = null, specialty = "", serviceIds = services.toList())

    private fun visit(service: String, master: String, day: Int) =
        ClientServiceVisit(service, master, LocalDateTime.of(2026, 9, day, 10, 0))

    private val base = Catalog(
        salonName = "B4U",
        categories = listOf(Category("nails", "Paznokcie"), Category("hair", "Włosy"), Category("empty", "Puste"), Category("nomaster", "Bez mistrza")),
        services = listOf(
            service("manicure"), service("pedicure"), service("cut", "hair"), service("orphan", "nomaster"),
            service("s5"), service("s6"), service("s7"), service("s8"),
        ),
        masters = listOf(
            master("olga", "manicure", "pedicure", "s5", "s6", "s7", "s8"),
            master("daria", "cut"),
        ),
    )

    @Test
    fun `new client sees only categories, even with stale history`() {
        val catalog = base.copy(isNewClient = true, clientServices = listOf(visit("manicure", "olga", 1)))

        val blocks = buildHomeBlocks(catalog)

        assertTrue(blocks.yourServices.isEmpty())
        assertEquals(listOf("nails", "hair"), blocks.categories.map { it.id })
    }

    @Test
    fun `empty categories and categories without masters are hidden`() {
        assertEquals(listOf("nails", "hair"), homeCategories(base).map { it.id })
    }

    @Test
    fun `regular client sees own services latest first plus categories`() {
        val catalog = base.copy(
            isNewClient = false,
            clientServices = listOf(visit("manicure", "olga", 1), visit("cut", "daria", 9), visit("pedicure", "olga", 5)),
        )

        val blocks = buildHomeBlocks(catalog)

        assertEquals(listOf("cut", "pedicure", "manicure"), blocks.yourServices.map { it.service.id })
        assertEquals(listOf("nails", "hair"), blocks.categories.map { it.id })
    }

    @Test
    fun `your services are deduplicated keeping the latest visit`() {
        val catalog = base.copy(
            isNewClient = false,
            clientServices = listOf(visit("manicure", "olga", 1), visit("manicure", "daria", 8)),
        )

        val yours = buildHomeBlocks(catalog).yourServices

        assertEquals(1, yours.size)
        // daria не делает manicure → мастер не предвыбирается
        assertNull(yours.single().masterId)
    }

    @Test
    fun `your services are capped at six`() {
        val ids = listOf("manicure", "pedicure", "s5", "s6", "s7", "s8", "cut")
        val catalog = base.copy(isNewClient = false, clientServices = ids.mapIndexed { i, id -> visit(id, "olga", i + 1) })

        val yours = buildHomeBlocks(catalog).yourServices

        assertEquals(MAX_YOUR_SERVICES, yours.size)
        assertEquals("cut", yours.first().service.id)
    }

    @Test
    fun `services missing from the catalog are skipped and do not eat the limit`() {
        val clientServices = (1..6).map { visit("deleted$it", "olga", it + 10) } + visit("manicure", "olga", 1)
        val catalog = base.copy(isNewClient = false, clientServices = clientServices)

        assertEquals(listOf("manicure"), buildHomeBlocks(catalog).yourServices.map { it.service.id })
    }

    @Test
    fun `last master is preselected only if active and performs the service`() {
        assertEquals("olga", preferredMasterId(base, "manicure", "olga"))
        assertNull(preferredMasterId(base, "manicure", "daria")) // не делает услугу
        assertNull(preferredMasterId(base, "manicure", "fired")) // неактивен — нет в каталоге
    }
}
