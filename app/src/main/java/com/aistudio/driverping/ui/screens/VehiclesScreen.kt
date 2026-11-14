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
import com.aistudio.driverping.model.DriverPingConstants
import com.aistudio.driverping.model.Vehicle
import com.aistudio.driverping.ui.components.ProvincialPlateView
import com.aistudio.driverping.ui.theme.*

@Composable
fun VehiclesScreen(
    modifier: Modifier = Modifier
) {
    val isDark by DriverPingRepository.isDarkMode.collectAsState()
    val vehicles by DriverPingRepository.vehicles.collectAsState()

    var showAddVehicleDialog by remember { mutableStateOf(false) }
    var showProofDialog by remember { mutableStateOf(false) }
    var selectedVehicleForProof by remember { mutableStateOf<Vehicle?>(null) }

    var newPlate by remember { mutableStateOf("") }
    var newProvince by remember { mutableStateOf("GP") }
    var newMake by remember { mutableStateOf("") }
    var newModel by remember { mutableStateOf("") }
    var newColor by remember { mutableStateOf("") }

    var docName by remember { mutableStateOf("NATIS_Registration_RC1.pdf") }
    var proofSubmittedMessage by remember { mutableStateOf<String?>(null) }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(top = 8.dp, bottom = 100.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Header & Add Vehicle CTA
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
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text(
                                text = "Your Registered Vehicles",
                                fontSize = 20.sp,
                                fontWeight = FontWeight.Black,
                                color = if (isDark) Color.White else Color(0xFF111827)
                            )
                            Text(
                                text = "Receive road alerts for these plates automatically.",
                                fontSize = 12.sp,
                                color = if (isDark) Color.White.copy(alpha = 0.7f) else Color.Gray,
                                modifier = Modifier.padding(top = 2.dp)
                            )
                        }

                        Button(
                            onClick = { showAddVehicleDialog = true },
                            colors = ButtonDefaults.buttonColors(containerColor = CrimsonBright),
                            shape = RoundedCornerShape(14.dp),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                            modifier = Modifier.testTag("add_vehicle_button")
                        ) {
                            Icon(imageVector = Icons.Default.Add, contentDescription = "Add", modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Add", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        // Vehicles List
        if (vehicles.isEmpty()) {
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
                            text = "No vehicles added yet. Tap 'Add' above to register your car.",
                            color = if (isDark) Color.White.copy(alpha = 0.7f) else Color.Gray,
                            fontSize = 13.sp
                        )
                    }
                }
            }
        } else {
            items(vehicles) { vehicle ->
                VehicleCardItem(
                    vehicle = vehicle,
                    isDark = isDark,
                    onSetDefault = { DriverPingRepository.setDefaultVehicle(vehicle.id) },
                    onVerifyOwnership = {
                        selectedVehicleForProof = vehicle
                        showProofDialog = true
                    }
                )
            }
        }
    }

    // Add Vehicle Dialog
    if (showAddVehicleDialog) {
        AlertDialog(
            onDismissRequest = { showAddVehicleDialog = false },
            title = {
                Text(text = "Register New Vehicle", fontWeight = FontWeight.Black, fontSize = 18.sp)
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = newPlate,
                        onValueChange = { newPlate = it.uppercase() },
                        label = { Text("Registration Number") },
                        placeholder = { Text("e.g. CK 45 DF") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )

                    Text(text = "Province:", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        listOf("GP", "WC", "ZN", "FS", "NW").forEach { prov ->
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(if (newProvince == prov) CrimsonBright else Color.LightGray.copy(alpha = 0.3f))
                                    .clickable { newProvince = prov }
                                    .padding(vertical = 6.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = prov,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (newProvince == prov) Color.White else Color.Black
                                )
                            }
                        }
                    }

                    OutlinedTextField(
                        value = newMake,
                        onValueChange = { newMake = it },
                        label = { Text("Make (e.g. Toyota, Volkswagen)") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )

                    OutlinedTextField(
                        value = newModel,
                        onValueChange = { newModel = it },
                        label = { Text("Model (e.g. Golf, Corolla)") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )

                    OutlinedTextField(
                        value = newColor,
                        onValueChange = { newColor = it },
                        label = { Text("Color (e.g. White, Silver)") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (newPlate.isNotBlank()) {
                            val full = if (newPlate.endsWith(newProvince)) newPlate else "$newPlate $newProvince"
                            DriverPingRepository.registerVehicle(full, newMake, newModel, newColor)
                            showAddVehicleDialog = false
                            newPlate = ""
                            newMake = ""
                            newModel = ""
                            newColor = ""
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = CrimsonBright),
                    modifier = Modifier.testTag("confirm_register_vehicle_button")
                ) {
                    Text("Register Car", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showAddVehicleDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    // Submit Ownership Proof Dialog
    if (showProofDialog && selectedVehicleForProof != null) {
        AlertDialog(
            onDismissRequest = {
                showProofDialog = false
                proofSubmittedMessage = null
            },
            title = {
                Text(text = "Verify Vehicle Ownership", fontWeight = FontWeight.Black, fontSize = 18.sp)
            },
            text = {
                Column {
                    Text(
                        text = "Upload NATIS RC1 Certificate or Vehicle License Disk to become a Verified Owner for ${selectedVehicleForProof?.plateDisplay}.",
                        fontSize = 13.sp
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    OutlinedTextField(
                        value = docName,
                        onValueChange = { docName = it },
                        label = { Text("Document File Name") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    if (proofSubmittedMessage != null) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = proofSubmittedMessage!!,
                            color = AccentEmerald,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        proofSubmittedMessage = "✓ Document submitted for review by admin team."
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = AccentEmerald)
                ) {
                    Text("Submit Document")
                }
            },
            dismissButton = {
                TextButton(onClick = {
                    showProofDialog = false
                    proofSubmittedMessage = null
                }) {
                    Text("Close")
                }
            }
        )
    }
}

@Composable
fun VehicleCardItem(
    vehicle: Vehicle,
    isDark: Boolean,
    onSetDefault: () -> Unit,
    onVerifyOwnership: () -> Unit
) {
    Card(
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isDark) SlateDarkCard else LightCardBg
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 5.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(18.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                ProvincialPlateView(
                    plateNumber = vehicle.plateDisplay,
                    height = 42.dp,
                    showEmblem = true,
                    modifier = Modifier.weight(1f)
                )

                Spacer(modifier = Modifier.width(10.dp))

                if (vehicle.isDefault) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(AccentEmerald.copy(alpha = 0.2f))
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = "PRIMARY",
                            color = AccentEmerald,
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Black
                        )
                    }
                } else {
                    OutlinedButton(
                        onClick = onSetDefault,
                        shape = RoundedCornerShape(10.dp),
                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                    ) {
                        Text("Set Default", fontSize = 10.sp)
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "${vehicle.make} ${vehicle.model}",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (isDark) Color.White else Color(0xFF111827)
                )
                if (vehicle.color.isNotBlank()) {
                    Text(
                        text = " · ${vehicle.color}",
                        fontSize = 14.sp,
                        color = if (isDark) Color.White.copy(alpha = 0.6f) else Color.Gray
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = if (vehicle.isVerifiedOwner) Icons.Default.VerifiedUser else Icons.Default.Pending,
                    contentDescription = "Status",
                    tint = if (vehicle.isVerifiedOwner) AccentEmerald else AccentAmber,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = if (vehicle.isVerifiedOwner) "Verified Vehicle Owner" else "Ownership Pending Verification",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = if (vehicle.isVerifiedOwner) AccentEmerald else AccentAmber
                )
            }

            if (!vehicle.isVerifiedOwner) {
                Spacer(modifier = Modifier.height(10.dp))
                Button(
                    onClick = onVerifyOwnership,
                    colors = ButtonDefaults.buttonColors(containerColor = CrimsonBright),
                    shape = RoundedCornerShape(10.dp),
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Icon(imageVector = Icons.Default.UploadFile, contentDescription = "Upload", modifier = Modifier.size(14.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Upload NATIS Proof", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
