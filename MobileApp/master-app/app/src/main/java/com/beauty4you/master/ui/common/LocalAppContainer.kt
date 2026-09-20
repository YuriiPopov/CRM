package com.beauty4you.master.ui.common

import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import com.beauty4you.master.AppContainer
import com.beauty4you.master.B4UMasterApp

@Composable
fun appContainer(): AppContainer {
    val context = LocalContext.current.applicationContext as B4UMasterApp
    return context.container
}
