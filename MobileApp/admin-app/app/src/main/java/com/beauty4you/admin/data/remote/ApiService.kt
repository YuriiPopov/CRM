package com.beauty4you.admin.data.remote

import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface ApiService {

    @POST("auth/login")
    suspend fun login(@Body body: LoginRequest): LoginResponse

    @GET("auth/me")
    suspend fun me(): MeDto

    @GET("bookings")
    suspend fun listBookings(
        @Query("from") from: String? = null,
        @Query("clientId") clientId: String? = null,
    ): List<BookingDto>

    @GET("bookings/pending-online/count")
    suspend fun pendingOnlineCount(): CountDto

    @POST("bookings")
    suspend fun createBooking(@Body body: CreateBookingRequest): BookingDto

    @PATCH("bookings/{id}/reschedule")
    suspend fun rescheduleBooking(@Path("id") id: String, @Body body: RescheduleRequest): BookingDto

    @PATCH("bookings/{id}/status")
    suspend fun updateBookingStatus(@Path("id") id: String, @Body body: StatusRequest): BookingDto

    @GET("clients")
    suspend fun listClients(): List<ClientDto>

    @GET("clients/{id}")
    suspend fun getClient(@Path("id") id: String): ClientDto

    @POST("clients")
    suspend fun createClient(@Body body: CreateClientRequest): ClientDto

    @GET("staff")
    suspend fun listStaff(): List<StaffDto>

    @GET("services")
    suspend fun listServices(): List<ServiceDto>

    @GET("service-categories")
    suspend fun listCategories(): List<CategoryDto>

    @GET("master-schedules")
    suspend fun getSchedule(
        @Query("masterId") masterId: String,
        @Query("year") year: Int,
        @Query("month") month: Int,
    ): List<ScheduleDayDto>

    @GET("master-blocks")
    suspend fun listBlocks(
        @Query("from") from: String,
        @Query("to") to: String,
    ): List<MasterBlockDto>

    @GET("news")
    suspend fun listNews(): List<NewsPostDto>

    @POST("news")
    suspend fun createNews(@Body body: NewsBody): NewsPostDto

    @PATCH("news/{id}")
    suspend fun updateNews(@Path("id") id: String, @Body body: NewsBody): NewsPostDto

    @DELETE("news/{id}")
    suspend fun deleteNews(@Path("id") id: String)

    @POST("news/{id}/image")
    suspend fun uploadNewsImage(@Path("id") id: String, @Body body: NewsImageBody): NewsPostDto

    @DELETE("news/{id}/image")
    suspend fun deleteNewsImage(@Path("id") id: String)

    // Свободные слоты — тот же публичный расчёт, что использует форма записи веб-CRM (SlotPicker)
    @GET("public/booking/slots")
    suspend fun availableSlots(
        @Query("masterId") masterId: String,
        @Query("serviceId") serviceId: String,
        @Query("date") date: String,
    ): SlotsResponse
}
