package com.beauty4you.client.ui.login

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.beauty4you.client.R
import com.beauty4you.client.domain.PhoneInput
import com.beauty4you.client.ui.common.AccentButton
import com.beauty4you.client.ui.common.Pill
import com.beauty4you.client.ui.common.VSpace
import com.beauty4you.client.ui.theme.Accent
import com.beauty4you.client.ui.theme.AppBackground
import com.beauty4you.client.ui.theme.B4UType
import com.beauty4you.client.ui.theme.Border
import com.beauty4you.client.ui.theme.ButtonShape
import com.beauty4you.client.ui.theme.CardBg
import com.beauty4you.client.ui.theme.Ink
import com.beauty4you.client.ui.theme.InkStrong
import com.beauty4you.client.ui.theme.Muted
import com.beauty4you.client.ui.theme.MutedLight
import com.beauty4you.client.ui.theme.StatusCancelled
import com.beauty4you.client.ui.theme.StatusPending

// Экрана входа нет в макете — собран из тех же токенов и компонентов (Playfair-заголовки,
// поля как в шторке записи, акцентная кнопка).
@Composable
fun LoginScreen(vm: LoginViewModel = viewModel(factory = LoginViewModel.Factory)) {
    val state by vm.state.collectAsStateWithLifecycle()

    BackHandler(enabled = state.step != LoginStep.PHONE, onBack = vm::back)

    Column(
        Modifier
            .fillMaxSize()
            .background(AppBackground)
            .statusBarsPadding()
            .imePadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 32.dp),
    ) {
        Box(
            Modifier
                .size(72.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(CardBg)
                .border(1.dp, Border, RoundedCornerShape(20.dp))
                .padding(4.dp),
        ) {
            Image(
                painter = painterResource(R.drawable.b4u_logo),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(16.dp)),
            )
        }
        VSpace(28.dp)

        when (state.step) {
            LoginStep.PHONE -> PhoneStep(state, vm)
            LoginStep.CODE -> CodeStep(state, vm)
            LoginStep.PROFILE -> ProfileStep(state, vm)
        }

        state.error?.let {
            VSpace(12.dp)
            Text(stringResource(it), style = B4UType.Caption, color = StatusCancelled.fg)
        }
    }
}

@Composable
private fun PhoneStep(state: LoginState, vm: LoginViewModel) {
    Title(stringResource(R.string.login_title), stringResource(R.string.login_subtitle))
    Field(
        label = stringResource(R.string.login_phone_label),
        value = PhoneInput.format(state.phone),
        onChange = vm::onPhoneChange,
        keyboardType = KeyboardType.Phone,
        onDone = { if (PhoneInput.isComplete(state.phone)) vm.requestCode() },
        prefix = PhoneInput.COUNTRY_PREFIX,
    )
    VSpace(20.dp)
    SubmitButton(stringResource(R.string.login_send_code), state.loading, enabled = PhoneInput.isComplete(state.phone), onClick = vm::requestCode)
}

@Composable
private fun CodeStep(state: LoginState, vm: LoginViewModel) {
    Title(stringResource(R.string.login_code_title), stringResource(R.string.login_code_subtitle, state.sentTo))
    state.devCode?.let {
        // Только при CLIENT_OTP_DEV_MODE на бэкенде — SMS-провайдер ещё не подключён
        Pill(stringResource(R.string.login_dev_code, it), fg = StatusPending.fg, bg = StatusPending.bg, modifier = Modifier.clickable { vm.onCodeChange(it) })
        VSpace(14.dp)
    }
    Field(
        label = stringResource(R.string.login_code_label),
        value = state.code,
        onChange = vm::onCodeChange,
        keyboardType = KeyboardType.NumberPassword,
        onDone = vm::verify,
        large = true,
    )
    VSpace(20.dp)
    SubmitButton(stringResource(R.string.login_verify), state.loading, enabled = state.code.length == 6, onClick = vm::verify)
    VSpace(16.dp)
    Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
        LinkText(stringResource(R.string.login_change_phone), onClick = vm::back)
        LinkText(stringResource(R.string.login_resend), onClick = vm::requestCode)
    }
}

@Composable
private fun ProfileStep(state: LoginState, vm: LoginViewModel) {
    Title(stringResource(R.string.login_profile_title), stringResource(R.string.login_profile_subtitle))
    Field(
        label = stringResource(R.string.login_name_label),
        value = state.name,
        onChange = vm::onNameChange,
        keyboardType = KeyboardType.Text,
        capitalization = KeyboardCapitalization.Words,
        onDone = {},
    )
    VSpace(14.dp)
    Row(
        Modifier.clip(ButtonShape).clickable { vm.onConsentChange(!state.consent) }.padding(vertical = 4.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Checkbox(
            checked = state.consent,
            onCheckedChange = vm::onConsentChange,
            colors = CheckboxDefaults.colors(checkedColor = Accent, uncheckedColor = MutedLight),
        )
        Text(
            stringResource(R.string.login_consent),
            style = B4UType.Caption.copy(lineHeight = 17.sp),
            color = Muted,
            modifier = Modifier.padding(top = 12.dp),
        )
    }
    VSpace(20.dp)
    SubmitButton(
        stringResource(R.string.login_create),
        state.loading,
        enabled = state.name.isNotBlank() && state.consent,
        onClick = vm::completeProfile,
    )
}

@Composable
private fun Title(title: String, subtitle: String) {
    Text(title, style = B4UType.ScreenTitle.copy(fontSize = 28.sp), color = Ink)
    VSpace(6.dp)
    Text(subtitle, style = B4UType.Body.copy(lineHeight = 19.sp), color = Muted)
    VSpace(24.dp)
}

@Composable
private fun Field(
    label: String,
    value: String,
    onChange: (String) -> Unit,
    keyboardType: KeyboardType,
    onDone: () -> Unit,
    capitalization: KeyboardCapitalization = KeyboardCapitalization.None,
    large: Boolean = false,
    prefix: String? = null,
) {
    val focus = remember { FocusRequester() }
    LaunchedEffect(label) { focus.requestFocus() }
    Text(label, style = B4UType.FieldLabel, color = Muted, modifier = Modifier.padding(bottom = 6.dp))
    val textStyle = if (large) {
        B4UType.ScreenTitle.copy(color = InkStrong, letterSpacing = 6.sp)
    } else {
        B4UType.CardTitle.copy(fontSize = 16.sp, color = InkStrong)
    }
    // Поле с префиксом (телефон): курсор всегда в конце, значение форматируется извне.
    // Остальные поля (код, имя) редактируются как обычно — курсор можно ставить в середину.
    var field by remember { mutableStateOf(TextFieldValue(value, TextRange(value.length))) }
    if (field.text != value) field = TextFieldValue(value, TextRange(value.length))
    BasicTextField(
        value = field,
        onValueChange = {
            onChange(it.text)
            field = if (prefix != null) TextFieldValue(value, TextRange(value.length)) else it
        },
        singleLine = true,
        textStyle = textStyle,
        decorationBox = { inner ->
            if (prefix == null) {
                inner()
            } else {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(prefix, style = textStyle, color = Muted, modifier = Modifier.padding(end = 8.dp))
                    inner()
                }
            }
        },
        cursorBrush = SolidColor(Accent),
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType, capitalization = capitalization, imeAction = ImeAction.Done),
        keyboardActions = KeyboardActions(onDone = { onDone() }),
        modifier = Modifier
            .fillMaxWidth()
            .focusRequester(focus)
            .clip(ButtonShape)
            .background(CardBg)
            .border(1.dp, Border, ButtonShape)
            .padding(horizontal = 14.dp, vertical = 14.dp),
    )
}

@Composable
private fun SubmitButton(text: String, loading: Boolean, enabled: Boolean, onClick: () -> Unit) {
    Box(contentAlignment = Alignment.Center) {
        AccentButton(
            if (loading) " " else text,
            onClick = { if (enabled && !loading) onClick() },
            modifier = Modifier.fillMaxWidth().alpha(if (enabled) 1f else 0.5f),
            large = true,
        )
        if (loading) CircularProgressIndicator(color = CardBg, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
    }
}

@Composable
private fun LinkText(text: String, onClick: () -> Unit) {
    Text(
        text,
        style = B4UType.Caption.copy(fontWeight = FontWeight.SemiBold),
        color = Accent,
        modifier = Modifier.clip(ButtonShape).clickable(onClick = onClick).padding(vertical = 4.dp),
    )
}
