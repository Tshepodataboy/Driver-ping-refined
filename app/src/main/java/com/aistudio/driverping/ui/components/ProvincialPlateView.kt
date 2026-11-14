package com.aistudio.driverping.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.aistudio.driverping.model.DriverPingConstants

@Composable
fun ProvincialPlateView(
    plateNumber: String,
    provinceCode: String = "GP",
    modifier: Modifier = Modifier,
    height: Dp = 68.dp,
    showEmblem: Boolean = true
) {
    val prov = DriverPingConstants.PROVINCES.find { it.code.equals(provinceCode, ignoreCase = true) }
        ?: DriverPingConstants.PROVINCES.first { it.code == "GP" }

    // Color themes based on authentic SA Provincial plates
    val (plateTextColor, plateBorderColor, provinceBadgeColor, badgeTextColor) = when (prov.code) {
        "GP" -> Quad(Color(0xFF0F3B84), Color(0xFF0F3B84), Color(0xFF1D4ED8), Color.White)
        "ZN" -> Quad(Color(0xFF111827), Color(0xFFB45309), Color(0xFFD97706), Color.Black)
        "WC" -> Quad(Color(0xFF1E3A8A), Color(0xFF1E3A8A), Color(0xFF2563EB), Color.White)
        "FS" -> Quad(Color(0xFF991B1B), Color(0xFF991B1B), Color(0xFFDC2626), Color.White)
        "NW" -> Quad(Color(0xFF065F46), Color(0xFF065F46), Color(0xFF059669), Color.White)
        "NC" -> Quad(Color(0xFF854D0E), Color(0xFF854D0E), Color(0xFFCA8A04), Color.Black)
        "L"  -> Quad(Color(0xFF15803D), Color(0xFF15803D), Color(0xFF16A34A), Color.White)
        "EC" -> Quad(Color(0xFF1E293B), Color(0xFF1E293B), Color(0xFF334155), Color.White)
        "MP" -> Quad(Color(0xFF831843), Color(0xFF831843), Color(0xFFBE185D), Color.White)
        else -> Quad(Color(0xFF0F3B84), Color(0xFF0F3B84), Color(0xFF1D4ED8), Color.White)
    }

    Box(
        modifier = modifier
            .height(height)
            .shadow(6.dp, RoundedCornerShape(10.dp))
            .clip(RoundedCornerShape(10.dp))
            .background(
                Brush.verticalGradient(
                    colors = listOf(Color(0xFFFFFFFF), Color(0xFFF0F2F5))
                )
            )
            .border(2.5.dp, plateBorderColor, RoundedCornerShape(10.dp))
            .padding(horizontal = 12.dp, vertical = 6.dp),
        contentAlignment = Alignment.Center
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            // Left SA Provincial Emblem / Badge
            if (showEmblem) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(provinceBadgeColor)
                        .border(1.dp, Color.White.copy(alpha = 0.5f), RoundedCornerShape(6.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "RSA",
                            color = badgeTextColor,
                            fontSize = 8.sp,
                            fontWeight = FontWeight.Black,
                            letterSpacing = 0.5.sp
                        )
                        Text(
                            text = prov.code,
                            color = badgeTextColor,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.ExtraBold
                        )
                    }
                }
            }

            // Center Plate Number
            Text(
                text = plateNumber.ifBlank { prov.plateExample },
                color = plateTextColor,
                fontSize = if (height > 60.dp) 22.sp else 16.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace,
                letterSpacing = 2.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.weight(1f)
            )

            // Right Province Code badge
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .background(Color.Black.copy(alpha = 0.06f))
                    .padding(horizontal = 6.dp, vertical = 3.dp)
            ) {
                Text(
                    text = prov.code,
                    color = plateTextColor,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp
                )
            }
        }
    }
}

private data class Quad<A, B, C, D>(val first: A, val second: B, val third: C, val fourth: D)
