package com.beauty4you.master.ui.common

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver

// Compose-навигация с save/restoreState (см. MainScaffold — паттерн для bottom nav) держит
// ViewModel таба живым при переключении на другой таб и обратно — без этого хелпера данные,
// изменённые где-то ещё (например, новая запись, созданная в веб-CRM), не подхватывались бы,
// пока приложение не перезапустят. Срабатывает и на самый первый ON_RESUME (сразу поверх
// ViewModel.init) — это один лишний silent-запрос, но зато надёжно работает независимо от того,
// пересоздаётся ли composable таба при возврате (addObserver на уже RESUMED lifecycle сам
// синхронно шлёт ON_RESUME, так что отличить "первый" резюм от "возврата на таб" нельзя).
@Composable
fun RefreshOnResume(onResume: () -> Unit) {
    val callback by rememberUpdatedState(onResume)
    val lifecycleOwner = LocalLifecycleOwner.current

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                callback()
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }
}
