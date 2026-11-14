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
import com.aistudio.driverping.model.AuditLogItem
import com.aistudio.driverping.model.OwnershipVerificationItem
import com.aistudio.driverping.ui.theme.*

@Composable
fun AdminScreen(
    modifier: Modifier = Modifier
) {
    val isDark by DriverPingRepository.isDarkMode.collectAsState()
    val verifications by DriverPingRepository.verifications.collectAsState()
    val auditLogs by DriverPingRepository.auditLogs.collectAsState()

    var activeTab by remember { mutableStateOf("verifications") }
    var selectedItemForReview by remember { mutableStateOf<OwnershipVerificationItem?>(null) }
    var reviewNote by remember { mutableStateOf("") }
    var actionToast by remember { mutableStateOf<String?>(null) }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(top = 8.dp, bottom = 100.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Admin Header
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
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = "Admin Control Panel",
                                    fontSize = 19.sp,
                                    fontWeight = FontWeight.Black,
                                    color = if (isDark) Color.White else Color(0xFF111827)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(6.dp))
                                        .background(Color(0xFFDC2626))
                                        .padding(horizontal = 6.dp, vertical = 2.dp)
                                ) {
                                    Text("SUPERVISOR", color = Color.White, fontSize = 8.sp, fontWeight = FontWeight.Black)
                                }
                            }
                            Text(
                                text = "NATIS vehicle ownership approvals & audit trail.",
                                fontSize = 12.sp,
                                color = if (isDark) Color.White.copy(alpha = 0.7f) else Color.Gray,
                                modifier = Modifier.padding(top = 2.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (isDark) Color(0xFF131417) else Color(0xFFE5E7EB))
                            .padding(4.dp),
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        listOf("verifications" to "Verifications (${verifications.size})", "audit" to "Audit Trail (${auditLogs.size})").forEach { (key, label) ->
                            val isSelected = activeTab == key
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(if (isSelected) CrimsonBright else Color.Transparent)
                                    .clickable { activeTab = key }
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

                    if (actionToast != null) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = actionToast!!,
                            color = AccentEmerald,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }

        if (activeTab == "verifications") {
            items(verifications) { item ->
                VerificationCardItem(
                    item = item,
                    isDark = isDark,
                    onReviewClick = { selectedItemForReview = item }
                )
            }
        } else {
            items(auditLogs) { log ->
                AuditLogCardItem(log = log, isDark = isDark)
            }
        }
    }

    // Review Dialog
    selectedItemForReview?.let { item ->
        AlertDialog(
            onDismissRequest = { selectedItemForReview = null },
            title = {
                Text(text = "Review Document: ${item.documentName}", fontWeight = FontWeight.Bold, fontSize = 16.sp)
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(text = "Applicant: ${item.userName} (${item.userPhone})", fontSize = 12.sp)
                    Text(text = "Plate: ${item.plateDisplay}", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Text(text = "Vehicle: ${item.vehicleDetails}", fontSize = 12.sp)
                    Spacer(modifier = Modifier.height(4.dp))
                    OutlinedTextField(
                        value = reviewNote,
                        onValueChange = { reviewNote = it },
                        label = { Text("Supervisor notes") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            onClick = {
                                DriverPingRepository.reviewVerification(item.id, "approved", reviewNote)
                                actionToast = "✓ Approved ${item.plateDisplay} ownership"
                                selectedItemForReview = null
                                reviewNote = ""
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = AccentEmerald),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Approve")
                        }

                        Button(
                            onClick = {
                                DriverPingRepository.reviewVerification(item.id, "rejected", reviewNote)
                                actionToast = "✗ Rejected verification for ${item.plateDisplay}"
                                selectedItemForReview = null
                                reviewNote = ""
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = AccentRose),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Reject")
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { selectedItemForReview = null }) {
                    Text("Close")
                }
            }
        )
    }
}

@Composable
fun VerificationCardItem(
    item: OwnershipVerificationItem,
    isDark: Boolean,
    onReviewClick: () -> Unit
) {
    Card(
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isDark) SlateDarkCard else LightCardBg
        ),
        elevation = CardDefaults.cardElevation(4.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = item.plateDisplay ?: "Vehicle",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (isDark) Color.White else Color(0xFF111827)
                )

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(
                            if (item.status == "approved") AccentEmerald.copy(alpha = 0.2f) else AccentAmber.copy(alpha = 0.2f)
                        )
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = item.status.uppercase(),
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Black,
                        color = if (item.status == "approved") AccentEmerald else AccentAmber
                    )
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            Text(
                text = "Owner: ${item.userName} (${item.userPhone})",
                fontSize = 12.sp,
                color = if (isDark) Color.White.copy(alpha = 0.8f) else Color(0xFF374151)
            )

            Text(
                text = "Document: ${item.documentName}",
                fontSize = 11.sp,
                color = if (isDark) Color.White.copy(alpha = 0.6f) else Color.Gray
            )

            Spacer(modifier = Modifier.height(10.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Submitted: ${item.submittedAt}",
                    fontSize = 10.sp,
                    color = if (isDark) Color.White.copy(alpha = 0.4f) else Color.LightGray
                )

                if (item.status != "approved") {
                    Button(
                        onClick = onReviewClick,
                        colors = ButtonDefaults.buttonColors(containerColor = CrimsonBright),
                        shape = RoundedCornerShape(10.dp),
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                    ) {
                        Text("Review", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
fun AuditLogCardItem(
    log: AuditLogItem,
    isDark: Boolean
) {
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isDark) SlateDarkCard else LightCardBg
        ),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = log.actionType,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Black,
                    color = CrimsonBright
                )
                Text(
                    text = log.createdAt,
                    fontSize = 10.sp,
                    color = if (isDark) Color.White.copy(alpha = 0.5f) else Color.Gray
                )
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = log.details,
                fontSize = 12.sp,
                color = if (isDark) Color.White.copy(alpha = 0.85f) else Color(0xFF1F2937)
            )
        }
    }
}
