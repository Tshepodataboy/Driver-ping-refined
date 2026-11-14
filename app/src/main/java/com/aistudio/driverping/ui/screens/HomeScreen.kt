package com.aistudio.driverping.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.aistudio.driverping.data.DriverPingRepository
import com.aistudio.driverping.model.AlertItem
import com.aistudio.driverping.model.AlertStatus
import com.aistudio.driverping.model.ReportCategory
import com.aistudio.driverping.ui.components.ProvincialPlateView
import com.aistudio.driverping.ui.theme.*

@Composable
fun HomeScreen(
    onNavigateToReportWithCategory: (ReportCategory) -> Unit,
    onNavigateToAlerts: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val alerts by DriverPingRepository.alerts.collectAsState()
    val isDark by DriverPingRepository.isDarkMode.collectAsState()

    var showEmergencyModal by remember { mutableStateOf(false) }
    var showSafetyGuide by remember { mutableStateOf(false) }
    var selectedAlertForAction by remember { mutableStateOf<AlertItem?>(null) }
    var actionNote by remember { mutableStateOf("") }

    val recentAlerts = alerts.take(3)

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(top = 8.dp, bottom = 100.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Hero / Safety Welcome Card
        item {
            Card(
                shape = RoundedCornerShape(28.dp),
                colors = CardDefaults.cardColors(
                    containerColor = if (isDark) SlateDarkCard else LightCardBg
                ),
                elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("home_hero_card")
            ) {
                Column(modifier = Modifier.padding(20.dp)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color(0xFF0D1829))
                                .border(1.dp, Color.White.copy(alpha = 0.15f), RoundedCornerShape(8.dp))
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = "COMMUNITY ROAD SAFETY",
                                color = Color.White,
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Black,
                                letterSpacing = 1.sp
                            )
                        }

                        IconButton(
                            onClick = { showSafetyGuide = true },
                            modifier = Modifier.size(32.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.HelpOutline,
                                contentDescription = "Safety Guide",
                                tint = if (isDark) Color.White.copy(alpha = 0.7f) else Color.Gray
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    Text(
                        text = "Instant Anonymous Road Alerts",
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Black,
                        color = if (isDark) Color.White else Color(0xFF111827)
                    )

                    Text(
                        text = "Alert drivers of flat tyres, broken brake lights, or hazards without revealing your identity.",
                        fontSize = 13.sp,
                        color = if (isDark) Color.White.copy(alpha = 0.7f) else Color(0xFF4B5563),
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
            }
        }

        // Quick Report Quadrant Grid
        item {
            Text(
                text = "QUICK OBSERVATION",
                color = Color.White.copy(alpha = 0.9f),
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 1.sp
            )

            Spacer(modifier = Modifier.height(8.dp))

            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    QuickActionCard(
                        title = "Vehicle Condition",
                        subtitle = "Brake lights, tyres, smoke",
                        icon = Icons.Default.Build,
                        accentColor = AccentSky,
                        isDark = isDark,
                        testTag = "quick_report_vehicle",
                        onClick = { onNavigateToReportWithCategory(ReportCategory.VEHICLE_CONDITION) },
                        modifier = Modifier.weight(1f)
                    )

                    QuickActionCard(
                        title = "Driver Behavior",
                        subtitle = "Swerving, tailgating",
                        icon = Icons.Default.DirectionsCar,
                        accentColor = AccentAmber,
                        isDark = isDark,
                        testTag = "quick_report_driver",
                        onClick = { onNavigateToReportWithCategory(ReportCategory.DRIVER_BEHAVIOUR) },
                        modifier = Modifier.weight(1f)
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    QuickActionCard(
                        title = "Road Violation",
                        subtitle = "Blocked lane, red light",
                        icon = Icons.Default.Warning,
                        accentColor = AccentEmerald,
                        isDark = isDark,
                        testTag = "quick_report_road",
                        onClick = { onNavigateToReportWithCategory(ReportCategory.ROAD_VIOLATION) },
                        modifier = Modifier.weight(1f)
                    )

                    QuickActionCard(
                        title = "Emergency SOS",
                        subtitle = "Direct 112 dispatch",
                        icon = Icons.Default.LocalHospital,
                        accentColor = AccentRose,
                        isDark = isDark,
                        testTag = "quick_report_sos",
                        onClick = { showEmergencyModal = true },
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }

        // Recent Observations / Alerts Section
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "RECENT ALERTS ON YOUR CARS",
                    color = Color.White.copy(alpha = 0.9f),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 1.sp
                )

                Text(
                    text = "View all",
                    color = Color.White,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.clickable { onNavigateToAlerts() }
                )
            }
        }

        if (recentAlerts.isEmpty()) {
            item {
                Card(
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = if (isDark) SlateDarkCard else LightCardBg
                    ),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(32.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "No recent alerts on your vehicles. All clear!",
                            color = if (isDark) Color.White.copy(alpha = 0.7f) else Color.Gray,
                            fontSize = 13.sp
                        )
                    }
                }
            }
        } else {
            items(recentAlerts) { alert ->
                AlertCardItem(
                    alert = alert,
                    isDark = isDark,
                    onActionClick = { selectedAlertForAction = alert }
                )
            }
        }
    }

    // Emergency SOS Modal
    if (showEmergencyModal) {
        AlertDialog(
            onDismissRequest = { showEmergencyModal = false },
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Warning,
                        contentDescription = "Emergency",
                        tint = AccentRose,
                        modifier = Modifier.size(28.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "South Africa Emergency 112",
                        fontWeight = FontWeight.Black,
                        fontSize = 18.sp
                    )
                }
            },
            text = {
                Column {
                    Text(
                        text = "This will initiate a phone call to 112 (National South African Emergency Services) for urgent crash or life-safety dispatch.",
                        fontSize = 14.sp
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = "• Toll-free from any mobile device in South Africa\n• Police, Ambulance, Fire and Traffic dispatch",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        showEmergencyModal = false
                        try {
                            val intent = Intent(Intent.ACTION_DIAL).apply {
                                data = Uri.parse("tel:112")
                            }
                            context.startActivity(intent)
                        } catch (e: Exception) {
                            // Dial fallback
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = AccentRose),
                    modifier = Modifier.testTag("confirm_call_112_button")
                ) {
                    Icon(imageVector = Icons.Default.Phone, contentDescription = "Call")
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Call 112 Now", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showEmergencyModal = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    // Safety Guide Modal
    if (showSafetyGuide) {
        AlertDialog(
            onDismissRequest = { showSafetyGuide = false },
            title = {
                Text(
                    text = "How Driver Ping Works",
                    fontWeight = FontWeight.Black,
                    fontSize = 18.sp
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = "1. Anonymous Observation",
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp
                    )
                    Text(
                        text = "When you report an issue, your phone number and identity are never revealed to the vehicle owner.",
                        fontSize = 12.sp
                    )
                    Text(
                        text = "2. Courtesy Delivery",
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp
                    )
                    Text(
                        text = "The verified vehicle owner receives an alert so they can fix their brake lights or tyres safely.",
                        fontSize = 12.sp
                    )
                    Text(
                        text = "3. Abuse Prevention",
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp
                    )
                    Text(
                        text = "Automated anti-spam limits repeat submissions, and owners can dispute inaccurate observations.",
                        fontSize = 12.sp
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = { showSafetyGuide = false },
                    colors = ButtonDefaults.buttonColors(containerColor = CrimsonBright)
                ) {
                    Text("Got it")
                }
            }
        )
    }

    // Alert Action Dialog
    selectedAlertForAction?.let { alert ->
        AlertDialog(
            onDismissRequest = { selectedAlertForAction = null },
            title = {
                Text(
                    text = "Alert Action",
                    fontWeight = FontWeight.Black,
                    fontSize = 18.sp
                )
            },
            text = {
                Column {
                    Text(
                        text = "${alert.issueTitle} on ${alert.plateDisplay}",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    OutlinedTextField(
                        value = actionNote,
                        onValueChange = { actionNote = it },
                        label = { Text("Response note (optional)") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(14.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            onClick = {
                                DriverPingRepository.takeAlertAction(alert.id, "resolve", actionNote)
                                selectedAlertForAction = null
                                actionNote = ""
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = AccentEmerald),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Resolve", fontSize = 12.sp)
                        }

                        Button(
                            onClick = {
                                DriverPingRepository.takeAlertAction(alert.id, "dispute", actionNote)
                                selectedAlertForAction = null
                                actionNote = ""
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = AccentAmber),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Dispute", fontSize = 12.sp)
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { selectedAlertForAction = null }) {
                    Text("Close")
                }
            }
        )
    }
}

@Composable
fun QuickActionCard(
    title: String,
    subtitle: String,
    icon: ImageVector,
    accentColor: Color,
    isDark: Boolean,
    testTag: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isDark) SlateDarkCard else LightCardBg
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 6.dp),
        modifier = modifier
            .testTag(testTag)
            .clickable { onClick() }
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(accentColor.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = title,
                    tint = accentColor,
                    modifier = Modifier.size(22.dp)
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = title,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = if (isDark) Color.White else Color(0xFF111827)
            )

            Text(
                text = subtitle,
                fontSize = 11.sp,
                color = if (isDark) Color.White.copy(alpha = 0.6f) else Color(0xFF6B7280),
                modifier = Modifier.padding(top = 2.dp)
            )
        }
    }
}

@Composable
fun AlertCardItem(
    alert: AlertItem,
    isDark: Boolean,
    onActionClick: () -> Unit
) {
    Card(
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isDark) SlateDarkCard else LightCardBg
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                ProvincialPlateView(
                    plateNumber = alert.plateDisplay,
                    height = 36.dp,
                    showEmblem = false,
                    modifier = Modifier.width(140.dp)
                )

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(
                            when (alert.status) {
                                AlertStatus.RECEIVED -> Color(0xFFDC2626).copy(alpha = 0.15f)
                                AlertStatus.RESOLVED -> Color(0xFF16A34A).copy(alpha = 0.15f)
                                AlertStatus.DISPUTED -> Color(0xFFD97706).copy(alpha = 0.15f)
                                else -> Color.Gray.copy(alpha = 0.15f)
                            }
                        )
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = alert.status.name,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = when (alert.status) {
                            AlertStatus.RECEIVED -> Color(0xFFEF4444)
                            AlertStatus.RESOLVED -> Color(0xFF22C55E)
                            AlertStatus.DISPUTED -> Color(0xFFF59E0B)
                            else -> Color.Gray
                        }
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            Text(
                text = alert.issueTitle,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = if (isDark) Color.White else Color(0xFF111827)
            )

            if (!alert.customNote.isNullOrBlank()) {
                Text(
                    text = alert.customNote,
                    fontSize = 12.sp,
                    color = if (isDark) Color.White.copy(alpha = 0.7f) else Color(0xFF4B5563),
                    modifier = Modifier.padding(top = 4.dp)
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = alert.createdAt,
                    fontSize = 11.sp,
                    color = if (isDark) Color.White.copy(alpha = 0.5f) else Color.Gray
                )

                Button(
                    onClick = onActionClick,
                    colors = ButtonDefaults.buttonColors(containerColor = CrimsonBright),
                    shape = RoundedCornerShape(12.dp),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Text("Action", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
