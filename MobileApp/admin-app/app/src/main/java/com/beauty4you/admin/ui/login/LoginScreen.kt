package com.beauty4you.admin.ui.login

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.beauty4you.admin.R
import com.beauty4you.admin.ui.common.appContainer
import com.beauty4you.admin.ui.theme.AppBackground
import com.beauty4you.admin.ui.theme.B4UType
import com.beauty4you.admin.ui.theme.Border
import com.beauty4you.admin.ui.theme.FieldShape
import com.beauty4you.admin.ui.theme.Ink
import com.beauty4you.admin.ui.theme.Muted
import com.beauty4you.admin.ui.theme.Rose
import com.beauty4you.admin.ui.theme.StatusCancelled

// Экрана входа нет в дизайне — стиль взят из master-app, цвета и шрифты из дизайна админа
@Composable
fun LoginScreen() {
    val viewModel: LoginViewModel = viewModel(factory = LoginViewModel.factory(appContainer()))
    val state by viewModel.state.collectAsState()

    Surface(color = AppBackground, modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .systemBarsPadding()
                .imePadding()
                .padding(horizontal = 24.dp),
            verticalArrangement = Arrangement.Center,
        ) {
            Text(text = stringResource(R.string.login_title), style = B4UType.ScreenTitle, color = Ink)
            Text(
                text = stringResource(R.string.login_subtitle),
                style = B4UType.Body,
                color = Muted,
                modifier = Modifier.padding(top = 4.dp, bottom = 24.dp),
            )

            val fieldColors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Rose,
                unfocusedBorderColor = Border,
                focusedContainerColor = Color.White,
                unfocusedContainerColor = Color.White,
                focusedLabelColor = Rose,
            )
            OutlinedTextField(
                value = state.email,
                onValueChange = viewModel::onEmailChange,
                label = { Text(stringResource(R.string.login_email)) },
                singleLine = true,
                shape = FieldShape,
                colors = fieldColors,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = state.password,
                onValueChange = viewModel::onPasswordChange,
                label = { Text(stringResource(R.string.login_password)) },
                singleLine = true,
                shape = FieldShape,
                colors = fieldColors,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
            )

            state.error?.let { error ->
                Text(
                    text = if (error.code != null) stringResource(error.message, error.code) else stringResource(error.message),
                    color = StatusCancelled.fg,
                    style = B4UType.Caption,
                    modifier = Modifier.padding(top = 10.dp),
                )
            }

            Button(
                onClick = viewModel::login,
                enabled = !state.loading,
                shape = FieldShape,
                colors = ButtonDefaults.buttonColors(containerColor = Rose),
                modifier = Modifier.fillMaxWidth().padding(top = 20.dp),
            ) {
                if (state.loading) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), color = Color.White, strokeWidth = 2.dp)
                } else {
                    Text(stringResource(R.string.login_button), style = B4UType.Button)
                }
            }
        }
    }
}
