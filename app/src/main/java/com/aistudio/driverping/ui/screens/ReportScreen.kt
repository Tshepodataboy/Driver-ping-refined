package com.aistudio.driverping.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import com.aistudio.driverping.model.*
import com.aistudio.driverping.ui.components.ProvincialPlateView
import com.aistudio.driverping.ui.theme.*

@Composable
fun ReportScreen(
    initialCategory: ReportCategory? = null,
    onReportSubmitted: () -> Unit,
    modifier: Modifier = Modifier
) {
    val isDark by DriverPingRepository.isDarkMode.collectAsState()
    val currentUser by DriverPingRepository.currentUser.collectAsState()

    var step by remember { mutableStateOf(1) }
    var selectedProvinceCode by remember { mutableStateOf(currentUser?.defaultProvinceCode ?: "GP") }
    var plateInput by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf(initialCategory ?: ReportCategory.VEHICLE_CONDITION) }
    var selectedIssue by remember { mutableStateOf<IssueOption?>(null) }
    var customNote by remember { mutableStateOf("") }
    var isSubmitting by remember { mutableStateOf(false) }
    var isSubmittedSuccess by remember { mutableStateOf(false) }
    var provinceSearchQuery by remember { mutableStateOf("") }

    val fullPlate = if (plateInput.endsWith(selectedProvinceCode, ignoreCase = true)) {
        plateInput.uppercase()
    } else {
        "${plateInput.uppercase()} $selectedProvinceCode".trim()
    }

    val filteredProvinces = DriverPingConstants.PROVINCES.filter {
        it.name.contains(provinceSearchQuery, ignoreCase = true) ||
        it.code.contains(provinceSearchQuery, ignoreCase = true)
    }

    val issuesForCategory = DriverPingConstants.ISSUES.filter { it.category == selectedCategory }

    if (isSubmittedSuccess) {
        Box(
            modifier = modifier
                .fillMaxSize()
                .padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            Card(
                shape = RoundedCornerShape(28.dp),
                colors = CardDefaults.cardColors(
                    containerColor = if (isDark) SlateDarkCard else LightCardBg
                ),
                elevation = CardDefaults.cardElevation(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Box(
                        modifier = Modifier
                            .size(64.dp)
                            .clip(RoundedCornerShape(32.dp))
                            .background(AccentEmerald.copy(alpha = 0.15f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.CheckCircle,
                            contentDescription = "Success",
                            tint = AccentEmerald,
                            modifier = Modifier.size(36.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Text(
                        text = "Courtesy Alert Dispatched!",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Black,
                        color = if (isDark) Color.White else Color(0xFF111827)
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        text = "Your observation for plate $fullPlate was sent anonymously to the vehicle owner.",
                        fontSize = 13.sp,
                        color = if (isDark) Color.White.copy(alpha = 0.7f) else Color.Gray,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                    )

                    Spacer(modifier = Modifier.height(20.dp))

                    Button(
                        onClick = {
                            isSubmittedSuccess = false
                            step = 1
                            plateInput = ""
                            customNote = ""
                            selectedIssue = null
                            onReportSubmitted()
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = CrimsonBright),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth().testTag("return_home_after_report_button")
                    ) {
                        Text("Done / View Alerts", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
        return
    }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(top = 8.dp, bottom = 100.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Step Indicator Progress
        item {
            Card(
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(
                    containerColor = if (isDark) SlateDarkCard else LightCardBg
                ),
                elevation = CardDefaults.cardElevation(6.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "STEP $step OF 4",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Black,
                            letterSpacing = 1.sp,
                            color = CrimsonBright
                        )

                        Text(
                            text = when (step) {
                                1 -> "Vehicle & Province"
                                2 -> "Observation Type"
                                3 -> "Notes & Details"
                                else -> "Review & Send"
                            },
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (isDark) Color.White else Color(0xFF111827)
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    LinearProgressIndicator(
                        progress = { step / 4f },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(6.dp)
                            .clip(RoundedCornerShape(3.dp)),
                        color = CrimsonBright,
                        trackColor = if (isDark) Color.White.copy(alpha = 0.1f) else Color.LightGray
                    )
                }
            }
        }

        // STEP 1: License Plate & Province Selector
        if (step == 1) {
            item {
                Card(
                    shape = RoundedCornerShape(24.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = if (isDark) SlateDarkCard else LightCardBg
                    ),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(18.dp)) {
                        Text(
                            text = "1. Enter South African Number Plate",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (isDark) Color.White else Color(0xFF111827)
                        )

                        Spacer(modifier = Modifier.height(14.dp))

                        // Photorealistic Plate Preview
                        ProvincialPlateView(
                            plateNumber = plateInput.ifBlank { "REG NO" },
                            provinceCode = selectedProvinceCode,
                            modifier = Modifier.fillMaxWidth().testTag("report_plate_preview")
                        )

                        Spacer(modifier = Modifier.height(16.dp))

                        OutlinedTextField(
                            value = plateInput,
                            onValueChange = { plateInput = it.uppercase() },
                            label = { Text("Registration Letters & Numbers") },
                            placeholder = { Text("e.g. CA 232-577 or CK 45 DF") },
                            modifier = Modifier.fillMaxWidth().testTag("report_plate_input"),
                            singleLine = true
                        )

                        Spacer(modifier = Modifier.height(14.dp))

                        Text(
                            text = "Select South African Province:",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (isDark) Color.White.copy(alpha = 0.8f) else Color(0xFF374151)
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        // 9 Province Quick Pills
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            DriverPingConstants.PROVINCES.chunked(3).forEach { rowProvs ->
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    rowProvs.forEach { prov ->
                                        val isSelected = prov.code == selectedProvinceCode
                                        Box(
                                            modifier = Modifier
                                                .weight(1f)
                                                .clip(RoundedCornerShape(12.dp))
                                                .background(
                                                    if (isSelected) CrimsonBright else if (isDark) Color(0xFF22252C) else Color(0xFFE5E7EB)
                                                )
                                                .clickable { selectedProvinceCode = prov.code }
                                                .padding(vertical = 8.dp),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Text(
                                                text = "${prov.code} (${prov.name.take(6)})",
                                                color = if (isSelected) Color.White else if (isDark) Color.White.copy(alpha = 0.8f) else Color.Black,
                                                fontSize = 11.sp,
                                                fontWeight = FontWeight.Bold
                                            )
                                        }
                                    }
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(18.dp))

                        Button(
                            onClick = { if (plateInput.isNotBlank()) step = 2 },
                            enabled = plateInput.isNotBlank(),
                            colors = ButtonDefaults.buttonColors(containerColor = CrimsonBright),
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier.fillMaxWidth().testTag("report_step1_next_button")
                        ) {
                            Text("Next: Select Issue Type", fontWeight = FontWeight.Bold)
                            Spacer(modifier = Modifier.width(6.dp))
                            Icon(imageVector = Icons.Default.ArrowForward, contentDescription = "Next")
                        }
                    }
                }
            }
        }

        // STEP 2: Category & Granular Issue Selection
        if (step == 2) {
            item {
                Card(
                    shape = RoundedCornerShape(24.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = if (isDark) SlateDarkCard else LightCardBg
                    ),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(18.dp)) {
                        Text(
                            text = "2. Select Category & Fault",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (isDark) Color.White else Color(0xFF111827)
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        // Category Tabs
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            ReportCategory.values().forEach { cat ->
                                val isSelected = cat == selectedCategory
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(
                                            if (isSelected) CrimsonBright else if (isDark) Color(0xFF22252C) else Color(0xFFE5E7EB)
                                        )
                                        .clickable {
                                            selectedCategory = cat
                                            selectedIssue = null
                                        }
                                        .padding(vertical = 10.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = cat.title.substringBefore(" "),
                                        color = if (isSelected) Color.White else if (isDark) Color.White.copy(alpha = 0.8f) else Color.Black,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(14.dp))

                        Text(
                            text = "Specific Observation:",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (isDark) Color.White.copy(alpha = 0.8f) else Color(0xFF374151)
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            issuesForCategory.forEach { issue ->
                                val isSelected = selectedIssue?.code == issue.code
                                Card(
                                    shape = RoundedCornerShape(14.dp),
                                    colors = CardDefaults.cardColors(
                                        containerColor = if (isSelected) CrimsonBright.copy(alpha = 0.2f) else if (isDark) Color(0xFF1F222A) else Color(0xFFF3F4F6)
                                    ),
                                    border = if (isSelected) androidx.compose.foundation.BorderStroke(1.5.dp, CrimsonBright) else null,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable { selectedIssue = issue }
                                ) {
                                    Row(
                                        modifier = Modifier.padding(12.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        RadioButton(
                                            selected = isSelected,
                                            onClick = { selectedIssue = issue },
                                            colors = RadioButtonDefaults.colors(selectedColor = CrimsonBright)
                                        )
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Column {
                                            Text(
                                                text = issue.title,
                                                fontSize = 13.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = if (isDark) Color.White else Color(0xFF111827)
                                            )
                                            Text(
                                                text = issue.description,
                                                fontSize = 11.sp,
                                                color = if (isDark) Color.White.copy(alpha = 0.6f) else Color(0xFF6B7280)
                                            )
                                        }
                                    }
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(18.dp))

                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            OutlinedButton(
                                onClick = { step = 1 },
                                shape = RoundedCornerShape(14.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Text("Back")
                            }

                            Button(
                                onClick = { if (selectedIssue != null) step = 3 },
                                enabled = selectedIssue != null,
                                colors = ButtonDefaults.buttonColors(containerColor = CrimsonBright),
                                shape = RoundedCornerShape(14.dp),
                                modifier = Modifier.weight(1f).testTag("report_step2_next_button")
                            ) {
                                Text("Next: Details", fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }

        // STEP 3: Details & Custom Notes
        if (step == 3) {
            item {
                Card(
                    shape = RoundedCornerShape(24.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = if (isDark) SlateDarkCard else LightCardBg
                    ),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(18.dp)) {
                        Text(
                            text = "3. Observation Details & Note",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (isDark) Color.White else Color(0xFF111827)
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        OutlinedTextField(
                            value = customNote,
                            onValueChange = { customNote = it },
                            label = { Text("Helpful note for the driver (optional)") },
                            placeholder = { Text("e.g. Near N1 highway Sandton offramp heading North") },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(120.dp)
                                .testTag("report_custom_note_input"),
                            maxLines = 4
                        )

                        Spacer(modifier = Modifier.height(14.dp))

                        // Anonymous Guarantee Banner
                        Card(
                            shape = RoundedCornerShape(14.dp),
                            colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A))
                        ) {
                            Row(
                                modifier = Modifier.padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Shield,
                                    contentDescription = "Anonymous",
                                    tint = AccentEmerald,
                                    modifier = Modifier.size(24.dp)
                                )
                                Spacer(modifier = Modifier.width(10.dp))
                                Column {
                                    Text(
                                        text = "100% Anonymous Delivery",
                                        color = Color.White,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = "Your phone number and name are never revealed to the car owner.",
                                        color = Color.White.copy(alpha = 0.7f),
                                        fontSize = 10.sp
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(18.dp))

                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            OutlinedButton(
                                onClick = { step = 2 },
                                shape = RoundedCornerShape(14.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Text("Back")
                            }

                            Button(
                                onClick = { step = 4 },
                                colors = ButtonDefaults.buttonColors(containerColor = CrimsonBright),
                                shape = RoundedCornerShape(14.dp),
                                modifier = Modifier.weight(1f).testTag("report_step3_next_button")
                            ) {
                                Text("Review Report", fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }

        // STEP 4: Review & Submit
        if (step == 4) {
            item {
                Card(
                    shape = RoundedCornerShape(24.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = if (isDark) SlateDarkCard else LightCardBg
                    ),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(18.dp)) {
                        Text(
                            text = "4. Review & Send Alert",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (isDark) Color.White else Color(0xFF111827)
                        )

                        Spacer(modifier = Modifier.height(14.dp))

                        ProvincialPlateView(
                            plateNumber = fullPlate,
                            provinceCode = selectedProvinceCode,
                            modifier = Modifier.fillMaxWidth()
                        )

                        Spacer(modifier = Modifier.height(14.dp))

                        Text(
                            text = "Issue: ${selectedIssue?.title ?: "General observation"}",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (isDark) Color.White else Color(0xFF111827)
                        )

                        if (customNote.isNotBlank()) {
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = "Note: $customNote",
                                fontSize = 12.sp,
                                color = if (isDark) Color.White.copy(alpha = 0.8f) else Color(0xFF4B5563)
                            )
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            OutlinedButton(
                                onClick = { step = 3 },
                                shape = RoundedCornerShape(14.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Text("Back")
                            }

                            Button(
                                onClick = {
                                    isSubmitting = true
                                    DriverPingRepository.submitReport(
                                        plate = fullPlate,
                                        category = selectedCategory,
                                        issueCode = selectedIssue?.code ?: "other",
                                        issueTitle = selectedIssue?.title ?: "Vehicle observation",
                                        customNote = customNote.ifBlank { null }
                                    )
                                    isSubmitting = false
                                    isSubmittedSuccess = true
                                },
                                enabled = !isSubmitting,
                                colors = ButtonDefaults.buttonColors(containerColor = AccentEmerald),
                                shape = RoundedCornerShape(14.dp),
                                modifier = Modifier.weight(1.5f).testTag("submit_final_report_button")
                            ) {
                                Icon(imageVector = Icons.Default.Send, contentDescription = "Send")
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Dispatch Alert", fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }
}
