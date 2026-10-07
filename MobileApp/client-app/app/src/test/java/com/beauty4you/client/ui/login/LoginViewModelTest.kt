package com.beauty4you.client.ui.login

import com.beauty4you.client.data.CodeRequest
import com.beauty4you.client.data.LoginAuth
import com.beauty4you.client.data.VerifyOutcome
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

// item86: состояние входа не должно переживать смену сессии (выход, 401)
@OptIn(ExperimentalCoroutinesApi::class)
class LoginViewModelTest {

    private class FakeAuth : LoginAuth {
        val loggedIn = MutableStateFlow(false)
        override val isLoggedIn = loggedIn
        override suspend fun requestCode(phone: String) = CodeRequest(phone = "+48601234567", devCode = "123456")
        override suspend fun verify(phone: String, code: String, name: String?, email: String?, consentGiven: Boolean?): VerifyOutcome {
            loggedIn.value = true
            return VerifyOutcome.LoggedIn
        }
    }

    private val dispatcher = StandardTestDispatcher()

    @Before fun setUp() = Dispatchers.setMain(dispatcher)
    @After fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `login then logout or 401 shows initial phone step`() = runTest(dispatcher) {
        val auth = FakeAuth()
        val vm = LoginViewModel(auth)
        advanceUntilIdle()

        vm.onPhoneChange("601234567")
        vm.requestCode()
        advanceUntilIdle()
        vm.onCodeChange("123456")
        vm.verify() // сессия открылась
        advanceUntilIdle()
        auth.loggedIn.value = false // выход или 401 — токен очищен
        advanceUntilIdle()

        assertEquals(LoginState(), vm.state.value)
    }

    @Test
    fun `session change resets every field`() = runTest(dispatcher) {
        val auth = FakeAuth()
        val vm = LoginViewModel(auth)
        advanceUntilIdle()
        vm.onPhoneChange("601234567")
        vm.requestCode()
        advanceUntilIdle()
        vm.onCodeChange("12")
        vm.onNameChange("Anna")
        assertEquals(LoginStep.CODE, vm.state.value.step)

        auth.loggedIn.value = true
        advanceUntilIdle()

        val s = vm.state.value
        assertEquals(LoginStep.PHONE, s.step)
        assertEquals("", s.phone)
        assertEquals("", s.code)
        assertNull(s.devCode)
        assertNull(s.error)
    }

    @Test
    fun `state is kept while session does not change (rotation)`() = runTest(dispatcher) {
        val auth = FakeAuth()
        val vm = LoginViewModel(auth)
        advanceUntilIdle()
        vm.onPhoneChange("601234567")
        vm.requestCode()
        advanceUntilIdle()
        vm.onCodeChange("123")
        advanceUntilIdle()

        val s = vm.state.value
        assertEquals(LoginStep.CODE, s.step)
        assertEquals("601234567", s.phone)
        assertEquals("123", s.code)
        assertEquals("123456", s.devCode)
    }
}
