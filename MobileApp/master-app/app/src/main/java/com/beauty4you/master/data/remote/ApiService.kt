package com.beauty4you.master.data.remote

import com.beauty4you.master.data.model.AuthenticatedUserDto
import com.beauty4you.master.data.model.BookingDto
import com.beauty4you.master.data.model.ClientDto
import com.beauty4you.master.data.model.LoginRequest
import com.beauty4you.master.data.model.LoginResponse
import com.beauty4you.master.data.model.MasterDetailDto
import com.beauty4you.master.data.model.MasterScheduleDayDto
import com.beauty4you.master.data.model.ServiceDto
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface ApiService {

    @POST("auth/login")
    suspend fun login(@Body body: LoginRequest): LoginResponse

    @GET("auth/me")
    suspend fun me(): AuthenticatedUserDto

    @GET("bookings")
    suspend fun listMyBookings(): List<BookingDto>

    @GET("bookings/{id}")
    suspend fun getBooking(@Path("id") id: String): BookingDto

    @GET("clients")
    suspend fun listClients(): List<ClientDto>

    @GET("services")
    suspend fun listServices(): List<ServiceDto>

    @GET("staff/{id}")
    suspend fun getMaster(@Path("id") id: String): MasterDetailDto

    @GET("master-schedules")
    suspend fun getMySchedule(
        @Query("masterId") masterId: String,
        @Query("year") year: Int,
        @Query("month") month: Int,
    ): List<MasterScheduleDayDto>
}
