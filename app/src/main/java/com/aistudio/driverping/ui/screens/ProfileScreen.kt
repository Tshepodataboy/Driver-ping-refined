package com.aistudio.driverping.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
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
import com.aistudio.driverping.model.PlanTier
import com.aistudio.driverping.model.UserRole
import com.aistudio.driverping.ui.theme.*

@Composable
fun ProfileScreen(
    onSignOut: () -> Unit,
    modifier: Modifier = Modifier
) {
    val isDark by DriverPingRepository.isDarkMode.collectAsState()
    val currentUser by DriverPingRepository.currentUser.collectAsState()

    var showEditProfileDialog by remember { mutableStateOf(false) }
    var editName by remember { mutableStateOf(currentUser?.fullName ?: "") }
    var editPhone by remember { mutableStateOf(currentUser?.phone ?: "") }
    var showLogoutDialog by remember { mutableStateOf(false) }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(top = 8.dp, bottom = 100.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // User Profile Card
        item {
            Card(
                shape = RoundedCornerShape(26.dp),
                colors = CardDefaults.cardColors(
                    containerColor = if (isDark) SlateDarkCard else LightCardBg
                ),
                elevation = CardDefaults.cardElevation(6.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(20.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(56.dp)
                                .clip(CircleShape)
                                .background(CrimsonBright),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = currentUser?.fullName?.take(1) ?: "D",
                                color = Color.White,
                                fontSize = 24.sp,
                                fontWeight = FontWeight.Black
                            )
                        }

                        Spacer(modifier = Modifier.width(16.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = currentUser?.fullName ?: "Driver User",
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isDark) Color.White else Color(0xFF111827)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                if (currentUser?.role == UserRole.ADMIN) {
                                    Box(
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(6.dp))
                                            .background(Color(0xFFDC2626))
                                            .padding(horizontal = 5.dp, vertical = 2.dp)
                                    ) {
                                        Text("ADMIN", color = Color.White, fontSize = 8.sp, fontWeight = FontWeight.Black)
                                    }
                                }
                            }

                            Text(
                                text = currentUser?.phone ?: "",
                                fontSize = 13.sp,
                                color = if (isDark) Color.White.copy(alpha = 0.7f) else Color.Gray
                            )

                            Spacer(modifier = Modifier.height(4.dp))

                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(
                                        if (currentUser?.plan == PlanTier.PAID_OWNER) AccentEmerald.copy(alpha = 0.2f) else Color.Gray.copy(alpha = 0.2f)
                                    )
                                    .padding(horizontal = 8.dp, vertical = 2.dp)
                            ) {
                                Text(
                                    text = if (currentUser?.plan == PlanTier.PAID_OWNER) "VERIFIED OWNER" else "FREE DRIVER TIER",
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Black,
                                    color = if (currentUser?.plan == PlanTier.PAID_OWNER) AccentEmerald else Color.Gray
                                )
                            }
                        }

                        IconButton(
                            onClick = {
                                editName = currentUser?.fullName ?: ""
                                editPhone = currentUser?.phone ?: ""
                                showEditProfileDialog = true
                            }
                        ) {
                            Icon(imageVector = Icons.Default.Edit, contentDescription = "Edit Profile")
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    HorizontalDivider(color = if (isDark) Color.White.copy(alpha = 0.1f) else Color(0xFFE5E7EB))

                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text(
                                text = "SMS Courtesy Alerts",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (isDark) Color.White else Color(0xFF111827)
                            )
                            Text(
                                text = "Receive SMS when an alert is filed on your car",
                                fontSize = 11.sp,
                                color = if (isDark) Color.White.copy(alpha = 0.6f) else Color.Gray
                            )
                        }

                        Switch(
                            checked = currentUser?.smsOptIn ?: true,
                            onCheckedChange = {
                                DriverPingRepository.updateUserPreferences(null, null, null, null, it)
                            },
                            colors = SwitchDefaults.colors(checkedThumbColor = CrimsonBright)
                        )
                    }
                }
            }
        }

        // Demo Account Quick Switcher
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
                        text = "SWITCH DEMO ACCOUNT",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Black,
                        letterSpacing = 1.sp,
                        color = CrimsonBright
                    )

                    Spacer(modifier = Modifier.height(10.dp))

                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        DemoAccountOption(
                            name = "Alex Morgan",
                            role = "Verified Owner (Paid Plan)",
                            phone = "+27 82 123 4567",
                            isSelected = currentUser?.id == "usr_alex_001",
                            isDark = isDark,
                            onClick = { DriverPingRepository.switchAccount("usr_alex_001") }
                        )

                        DemoAccountOption(
                            name = "Jordan Lee",
                            role = "Driver (Free Plan)",
                            phone = "+27 83 234 5678",
                            isSelected = currentUser?.id == "usr_jordan_002",
                            isDark = isDark,
                            onClick = { DriverPingRepository.switchAccount("usr_jordan_002") }
                        )

                        DemoAccountOption(
                            name = "System Administrator",
                            role = "Admin Reviewer & Auditor",
                            phone = "+27 84 345 6789",
                            isSelected = currentUser?.id == "usr_admin_003",
                            isDark = isDark,
                            onClick = { DriverPingRepository.switchAccount("usr_admin_003") }
                        )
                    }
                }
            }
        }

        // Safety, Terms & Logout
        item {
            Card(
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(
                    containerColor = if (isDark) SlateDarkCard else LightCardBg
                ),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(18.dp)) {
                    ProfileMenuRow(
                        title = "Privacy Policy & Anonymous Guarantee",
                        icon = Icons.Default.PrivacyTip,
                        isDark = isDark,
                        onClick = {}
                    )

                    HorizontalDivider(color = if (isDark) Color.White.copy(alpha = 0.08f) else Color(0xFFE5E7EB))

                    ProfileMenuRow(
                        title = "Road Safety & Courtesy Guidelines",
                        icon = Icons.Default.Shield,
                        isDark = isDark,
                        onClick = {}
                    )

                    HorizontalDivider(color = if (isDark) Color.White.copy(alpha = 0.08f) else Color(0xFFE5E7EB))

                    ProfileMenuRow(
                        title = "Sign Out",
                        icon = Icons.Default.Logout,
                        isDark = isDark,
                        titleColor = AccentRose,
                        onClick = { showLogoutDialog = true }
                    )
                }
            }
        }
    }

    // Edit Profile Dialog
    if (showEditProfileDialog) {
        AlertDialog(
            onDismissRequest = { showEditProfileDialog = false },
            title = {
                Text("Edit Profile Details", fontWeight = FontWeight.Bold, fontSize = 18.sp)
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = editName,
                        onValueChange = { editName = it },
                        label = { Text("Full Name") },
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = editPhone,
                        onValueChange = { editPhone = it },
                        label = { Text("Phone Number") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        DriverPingRepository.updateUserPreferences(editName, editPhone, null, null, null)
                        showEditProfileDialog = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = CrimsonBright)
                ) {
                    Text("Save Changes")
                }
            },
            dismissButton = {
                TextButton(onClick = { showEditProfileDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    // Logout Dialog
    if (showLogoutDialog) {
        AlertDialog(
            onDismissRequest = { showLogoutDialog = false },
            title = { Text("Sign Out", fontWeight = FontWeight.Bold) },
            text = { Text("Are you sure you want to sign out of Driver Ping?") },
            confirmButton = {
                Button(
                    onClick = {
                        showLogoutDialog = false
                        DriverPingRepository.signOut()
                        onSignOut()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = AccentRose)
                ) {
                    Text("Sign Out")
                }
            },
            dismissButton = {
                TextButton(onClick = { showLogoutDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}

@Composable
fun DemoAccountOption(
    name: String,
    role: String,
    phone: String,
    isSelected: Boolean,
    isDark: Boolean,
    onClick: () -> Unit
) {
    Card(
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) CrimsonBright.copy(alpha = 0.2f) else if (isDark) Color(0xFF1E2129) else Color(0xFFF3F4F6)
        ),
        border = if (isSelected) androidx.compose.foundation.BorderStroke(1.5.dp, CrimsonBright) else null,
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(10.dp)
                    .clip(CircleShape)
                    .background(if (isSelected) CrimsonBright else Color.Gray)
            )
            Spacer(modifier = Modifier.width(10.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = name,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (isDark) Color.White else Color(0xFF111827)
                )
                Text(
                    text = "$role · $phone",
                    fontSize = 11.sp,
                    color = if (isDark) Color.White.copy(alpha = 0.6f) else Color.Gray
                )
            }
            if (isSelected) {
                Icon(
                    imageVector = Icons.Default.Check,
                    contentDescription = "Active",
                    tint = CrimsonBright,
                    modifier = Modifier.size(18.dp)
                )
            }
        }
    }
}

@Composable
fun ProfileMenuRow(
    title: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    isDark: Boolean,
    titleColor: Color? = null,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = title,
            tint = titleColor ?: if (isDark) Color.White.copy(alpha = 0.8f) else Color(0xFF374151),
            modifier = Modifier.size(20.dp)
        )
        Spacer(modifier = Modifier.width(12.dp))
        Text(
            text = title,
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
            color = titleColor ?: if (isDark) Color.White else Color(0xFF111827),
            modifier = Modifier.weight(1f)
        )
        Icon(
            imageVector = Icons.Default.ChevronRight,
            contentDescription = "Open",
            tint = if (isDark) Color.White.copy(alpha = 0.3f) else Color.LightGray,
            modifier = Modifier.size(18.dp)
        )
    }
}
