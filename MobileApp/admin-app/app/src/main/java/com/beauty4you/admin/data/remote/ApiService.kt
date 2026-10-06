package com.beauty4you.admin.data.remote

import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
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

    @POST("staff")
    suspend fun createMaster(@Body body: MasterBody): StaffDto

    @PATCH("staff/{id}")
    suspend fun updateMaster(@Path("id") id: String, @Body body: MasterBody): StaffDto

    @DELETE("staff/{id}")
    suspend fun deleteMaster(@Path("id") id: String)

    @POST("staff/{id}/services/{serviceId}")
    suspend fun assignService(@Path("id") id: String, @Path("serviceId") serviceId: String)

    @DELETE("staff/{id}/services/{serviceId}")
    suspend fun unassignService(@Path("id") id: String, @Path("serviceId") serviceId: String)

    @POST("staff/{id}/photo")
    suspend fun uploadMasterPhoto(@Path("id") id: String, @Body body: MasterPhotoBody): StaffDto

    @DELETE("staff/{id}/photo")
    suspend fun deleteMasterPhoto(@Path("id") id: String)

    @GET("services")
    suspend fun listServices(): List<ServiceDto>

    @POST("services")
    suspend fun createService(@Body body: ServiceBody): ServiceDto

    @PATCH("services/{id}")
    suspend fun updateService(@Path("id") id: String, @Body body: ServiceBody): ServiceDto

    @DELETE("services/{id}")
    suspend fun deleteService(@Path("id") id: String)

    @GET("service-categories")
    suspend fun listCategories(): List<CategoryDto>

    @POST("service-categories")
    suspend fun createCategory(@Body body: CategoryBody): CategoryDto

    @PATCH("service-categories/{id}")
    suspend fun updateCategory(@Path("id") id: String, @Body body: CategoryBody): CategoryDto

    @DELETE("service-categories/{id}")
    suspend fun deleteCategory(@Path("id") id: String)

    @GET("master-schedules")
    suspend fun getSchedule(
        @Query("masterId") masterId: String,
        @Query("year") year: Int,
        @Query("month") month: Int,
    ): List<ScheduleDayDto>

    @PUT("master-schedules")
    suspend fun saveSchedule(@Body body: ScheduleUpsertBody): List<ScheduleDayDto>

    // Записи, попадающие на дни, которые в предлагаемом графике становятся выходными (без сохранения)
    @POST("master-schedules/conflicts")
    suspend fun scheduleConflicts(@Body body: ScheduleUpsertBody): List<BookingDto>

    @GET("master-blocks")
    suspend fun listBlocks(
        @Query("from") from: String,
        @Query("to") to: String? = null,
        @Query("masterId") masterId: String? = null,
    ): List<MasterBlockDto>

    @POST("master-blocks")
    suspend fun createBlock(@Body body: CreateBlockBody): MasterBlockDto

    @DELETE("master-blocks/{id}")
    suspend fun deleteBlock(@Path("id") id: String)

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
