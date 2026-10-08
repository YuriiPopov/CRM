package com.beauty4you.client.data.remote

import okhttp3.ResponseBody
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query
import retrofit2.http.Streaming

interface ClientApi {

    @POST("client/auth/request-code")
    suspend fun requestCode(@Body body: RequestCodeBody): RequestCodeResponse

    @POST("client/auth/verify")
    suspend fun verify(@Body body: VerifyCodeBody): VerifyCodeResponse

    @GET("client/me")
    suspend fun me(): ClientDto

    @GET("client/catalog")
    suspend fun catalog(): CatalogDto

    @GET("client/services/{id}/photos")
    suspend fun servicePhotos(@Path("id") serviceId: String): List<ServicePhotoDto>

    // Бинарная картинка с Content-Type; фото неизменяемо, приложение кэширует его само (ServicePhotos)
    @Streaming
    @GET("client/service-photos/{photoId}")
    suspend fun servicePhoto(@Path("photoId") photoId: String): ResponseBody

    @GET("client/news")
    suspend fun news(): List<NewsDto>

    @GET("client/news/{id}")
    suspend fun newsArticle(@Path("id") id: String): NewsArticleDto

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
