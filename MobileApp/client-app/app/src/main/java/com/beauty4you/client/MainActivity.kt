package com.beauty4you.client

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import com.beauty4you.client.ui.ClientRoot
import com.beauty4you.client.ui.theme.B4UClientTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Фон светлый всегда — тёмные иконки системных баров независимо от системной темы.
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.light(android.graphics.Color.TRANSPARENT, android.graphics.Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.light(android.graphics.Color.TRANSPARENT, android.graphics.Color.TRANSPARENT),
        )
        setContent {
            B4UClientTheme {
                val container = (application as B4UClientApp).container
                val isLoggedIn by container.authRepository.isLoggedIn.collectAsState(initial = null)
                ClientRoot(isLoggedIn)
            }
        }
    }
}
