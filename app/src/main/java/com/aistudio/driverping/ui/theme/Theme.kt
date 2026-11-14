package com.aistudio.driverping.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val DarkColorScheme = darkColorScheme(
    primary = CrimsonBright,
    onPrimary = Color.White,
    primaryContainer = CrimsonPrimary,
    onPrimaryContainer = Color.White,
    secondary = AccentEmerald,
    onSecondary = Color.Black,
    background = CrimsonDeep,
    onBackground = Color.White,
    surface = SlateDarkCard,
    onSurface = Color.White,
    surfaceVariant = SlateDarkCardSubtle,
    onSurfaceVariant = Color(0xFFD1D5DB)
)

private val LightColorScheme = lightColorScheme(
    primary = CrimsonPrimary,
    onPrimary = Color.White,
    primaryContainer = CrimsonBright,
    onPrimaryContainer = Color.White,
    secondary = AccentEmerald,
    onSecondary = Color.Black,
    background = CrimsonPrimary,
    onBackground = Color.White,
    surface = LightCardBg,
    onSurface = Color(0xFF111827),
    surfaceVariant = Color(0xFFF3F4F6),
    onSurfaceVariant = Color(0xFF4B5563)
)

@Composable
fun DriverPingTheme(
    darkTheme: Boolean = true,
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = CrimsonPrimary.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = false
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
