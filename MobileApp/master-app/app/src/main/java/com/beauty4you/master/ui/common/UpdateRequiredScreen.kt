package com.beauty4you.master.ui.common

import android.app.Activity
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.beauty4you.master.ui.theme.AppBackground
import com.beauty4you.master.ui.theme.B4UType
import com.beauty4you.master.ui.theme.Ink
import com.beauty4you.master.ui.theme.Muted

// Полноэкранное сообщение при 426 CLIENT_UPDATE_REQUIRED (item78). Ссылки на загрузку нет —
// APK раздаётся вручную, поэтому только «Zamknij».
@Composable
fun UpdateRequiredScreen() {
    val activity = LocalContext.current as? Activity
    Column(
        modifier = Modifier.fillMaxSize().background(AppBackground).padding(horizontal = 32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("Dostępna nowa wersja aplikacji", style = B4UType.ScreenTitle, color = Ink, textAlign = TextAlign.Center)
        Text("Zainstaluj aktualizację, aby kontynuować pracę z aplikacją.", style = B4UType.Body, color = Muted, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 12.dp, bottom = 24.dp))
        Button(onClick = { activity?.finishAffinity() }) { Text("Zamknij") }
    }
}
