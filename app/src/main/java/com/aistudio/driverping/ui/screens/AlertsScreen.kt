package com.aistudio.driverping.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.aistudio.driverping.data.DriverPingRepository
import com.aistudio.driverping.model.AlertItem
import com.aistudio.driverping.model.AlertStatus
import com.aistudio.driverping.ui.components.ProvincialPlateView
import com.aistudio.driverping.ui.theme.*

@Composable
fun AlertsScreen(
    modifier: Modifier = Modifier
) {
    val isDark by DriverPingRepository.isDarkMode.collectAsState()
    val alerts by DriverPingRepository.alerts.collectAsState()

    var filter by remember { mutableStateOf("all") }
    var selectedAlertForAction by remember { mutableStateOf<AlertItem?>(null) }
    var actionNote by remember { mutableStateOf("") }

    val filteredAlerts = alerts.filter { alert ->
        when (filter) {
            "unread" -> alert.status == AlertStatus.RECEIVED || alert.status == AlertStatus.NEEDS_REVIEW
            "read" -> alert.status == AlertStatus.RESOLVED || alert.status == AlertStatus.DISMISSED
            else -> true
        }
    }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(top = 8.dp, bottom = 100.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Top Filter Card
        item {
            Card(
                shape = RoundedCornerShape(26.dp),
                colors = CardDefaults.cardColors(
                    containerColor = if (isDark) SlateDarkCard else LightCardBg
                ),
                elevation = CardDefaults.cardElevation(6.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(18.dp)) {
                    Text(
                        text = "Alerts & Observations",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Black,
                        color = if (isDark) Color.White else Color(0xFF111827)
                    )
                    Text(
                        text = "Road user observations reported for your registered cars.",
                        fontSize = 12.sp,
                        color = if (isDark) Color.White.copy(alpha = 0.7f) else Color.Gray,
                        modifier = Modifier.padding(top = 2.dp)
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(if (isDark) Color(0xFF131417) else Color(0xFFE5E7EB))
                            .padding(4.dp),
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        listOf("all" to "All (${alerts.size})", "unread" to "Unread", "read" to "Resolved").forEach { (key, label) ->
                            val isSelected = filter == key
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(if (isSelected) CrimsonBright else Color.Transparent)
                                    .clickable { filter = key }
                                    .padding(vertical = 8.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = label,
                                    color = if (isSelected) Color.White else if (isDark) Color.White.copy(alpha = 0.7f) else Color.Black,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
            }
        }

        if (filteredAlerts.isEmpty()) {
            item {
                Card(
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = if (isDark) SlateDarkCard else LightCardBg
                    ),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Box(
                        modifier = Modifier.fillMaxWidth().padding(40.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "No alerts found in this filter.",
                            color = if (isDark) Color.White.copy(alpha = 0.7f) else Color.Gray,
                            fontSize = 13.sp
                        )
                    }
                }
            }
        } else {
            items(filteredAlerts) { alert ->
                AlertDetailCard(
                    alert = alert,
                    isDark = isDark,
                    onTakeAction = { selectedAlertForAction = alert }
                )
            }
        }
    }

    // Action Dialog
    selectedAlertForAction?.let { alert ->
        AlertDialog(
            onDismissRequest = { selectedAlertForAction = null },
            title = {
                Text(text = "Respond to Alert", fontWeight = FontWeight.Black, fontSize = 18.sp)
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = "${alert.issueTitle} on ${alert.plateDisplay}",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold
                    )

                    OutlinedTextField(
                        value = actionNote,
                        onValueChange = { actionNote = it },
                        label = { Text("Note / Resolution details") },
                        placeholder = { Text("e.g. Fixed bulb or Replaced tyre") },
                        modifier = Modifier.fillMaxWidth()
                    )

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

                        Button(
                            onClick = {
                                DriverPingRepository.takeAlertAction(alert.id, "flag_abuse", actionNote)
                                selectedAlertForAction = null
                                actionNote = ""
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = AccentRose),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Abuse", fontSize = 12.sp)
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
fun AlertDetailCard(
    alert: AlertItem,
    isDark: Boolean,
    onTakeAction: () -> Unit
) {
    Card(
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isDark) SlateDarkCard else LightCardBg
        ),
        elevation = CardDefaults.cardElevation(5.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(18.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                ProvincialPlateView(
                    plateNumber = alert.plateDisplay,
                    height = 38.dp,
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
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = if (isDark) Color.White else Color(0xFF111827)
            )

            if (!alert.customNote.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Note: ${alert.customNote}",
                    fontSize = 12.sp,
                    color = if (isDark) Color.White.copy(alpha = 0.75f) else Color(0xFF4B5563)
                )
            }

            if (!alert.recipientActionNote.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Resolution: ${alert.recipientActionNote}",
                    fontSize = 11.sp,
                    color = AccentEmerald,
                    fontWeight = FontWeight.SemiBold
                )
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Courtesy & Privacy Guarantee notice
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(if (isDark) Color(0xFF121417) else Color(0xFFF3F4F6))
                    .padding(8.dp)
            ) {
                Text(
                    text = "${alert.neutralNotice} ${alert.privacyNotice}",
                    fontSize = 10.sp,
                    color = if (isDark) Color.White.copy(alpha = 0.5f) else Color.Gray
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = alert.createdAt,
                    fontSize = 11.sp,
                    color = if (isDark) Color.White.copy(alpha = 0.5f) else Color.Gray
                )

                Button(
                    onClick = onTakeAction,
                    colors = ButtonDefaults.buttonColors(containerColor = CrimsonBright),
                    shape = RoundedCornerShape(12.dp),
                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp)
                ) {
                    Text("Take Action", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
