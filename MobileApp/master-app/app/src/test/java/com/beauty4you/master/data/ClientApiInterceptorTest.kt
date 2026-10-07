package com.beauty4you.master.data

import com.beauty4you.master.data.remote.ClientApiInterceptor
import com.beauty4you.master.data.remote.ClientApiVersion
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// item78 (часть A): заголовок версии и отдельная обработка 426
class ClientApiInterceptorTest {

    private class Probe(val code: Int, val body: String = "{}") {
        var sentHeader: String? = null
        var updateRequiredCalls = 0

        fun call(): Response {
            val client = OkHttpClient.Builder()
                .addInterceptor(ClientApiInterceptor(onUpdateRequired = { updateRequiredCalls++ }))
                .addInterceptor(Interceptor { chain ->
                    sentHeader = chain.request().header(ClientApiVersion.HEADER)
                    Response.Builder()
                        .request(chain.request())
                        .protocol(Protocol.HTTP_1_1)
                        .code(code)
                        .message("test")
                        .body(body.toResponseBody("application/json".toMediaType()))
                        .build()
                })
                .build()
            return client.newCall(Request.Builder().url("http://localhost/staff").build()).execute()
        }
    }

    private val updateBody = """{"statusCode":426,"code":"CLIENT_UPDATE_REQUIRED","message":"x"}"""

    @Test
    fun `adds the api version header to every request`() {
        val probe = Probe(200)
        probe.call().close()
        assertEquals(ClientApiVersion.VERSION.toString(), probe.sentHeader)
        assertEquals("X-Client-Api", ClientApiVersion.HEADER)
    }

    @Test
    fun `426 with CLIENT_UPDATE_REQUIRED raises the update flag and leaves the body readable`() {
        val probe = Probe(426, updateBody)
        val response = probe.call()
        assertEquals(1, probe.updateRequiredCalls)
        assertEquals(426, response.code)
        assertTrue(response.body!!.string().contains("CLIENT_UPDATE_REQUIRED"))
    }

    @Test
    fun `other statuses are not treated as update required`() {
        for (code in listOf(200, 401, 404, 500)) {
            val probe = Probe(code, updateBody)
            probe.call().close()
            assertEquals("status $code", 0, probe.updateRequiredCalls)
        }
    }

    @Test
    fun `426 without the update code is not treated as update required`() {
        val probe = Probe(426, """{"message":"Upgrade Required"}""")
        probe.call().close()
        assertFalse(probe.updateRequiredCalls > 0)
    }
}
