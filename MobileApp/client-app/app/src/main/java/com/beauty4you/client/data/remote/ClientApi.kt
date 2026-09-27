package com.beauty4you.client.data.remote

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface ClientApi {

    @POST("client/auth/request-code")
    suspend fun requestCode(@Body body: RequestCodeBody): RequestCodeResponse

    @POST("client/auth/verify")
    suspend fun verify(@Body body: VerifyCodeBody): VerifyCodeResponse

    @GET("client/me")
    suspend fun me(): ClientDto

    @GET("client/catalog")
    suspend fun catalog(): CatalogDto

    @GET("client/slots")
    suspend fun slots(
        @Query("masterId") masterId: String,
        @Query("serviceId") serviceId: String,
        @Query("date") date: String,
    ): SlotsResponse

    @GET("client/bookings")
    suspend fun bookings(): List<BookingDto>

    @POST("client/bookings")
    suspend fun createBooking(@Body body: CreateBookingBody): BookingDto

    @POST("client/bookings/{id}/cancel")
    suspend fun cancelBooking(@Path("id") id: String): BookingDto
}
