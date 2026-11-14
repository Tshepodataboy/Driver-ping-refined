package com.aistudio.driverping.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import com.aistudio.driverping.ui.theme.CrimsonBright
import com.aistudio.driverping.ui.theme.CrimsonDeep
import com.aistudio.driverping.ui.theme.CrimsonPrimary

@Composable
fun GeometricBackground(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        CrimsonBright,
                        CrimsonPrimary,
                        CrimsonDeep
                    )
                )
            )
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val width = size.width
            val height = size.height

            // Ambient circular radial glows
            drawCircle(
                color = Color.White.copy(alpha = 0.04f),
                radius = width * 0.7f,
                center = Offset(width * 0.5f, height * 0.15f)
            )

            drawCircle(
                color = Color.Black.copy(alpha = 0.18f),
                radius = width * 0.6f,
                center = Offset(width * 0.9f, height * 0.85f)
            )
        }
    }
}
