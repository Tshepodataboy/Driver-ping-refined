package com.aistudio.driverping.data

import com.aistudio.driverping.model.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.UUID

object DriverPingRepository {

    // Predefined Demo Users
    val DEMO_ALEX = User(
        id = "usr_alex_001",
        phone = "+27 82 123 4567",
        fullName = "Alex Morgan",
        email = "alex.morgan@driverping.co.za",
        role = UserRole.USER,
        plan = PlanTier.PAID_OWNER,
        smsOptIn = true,
        defaultPlate = "CK 45 DF GP",
        defaultProvinceCode = "GP"
    )

    val DEMO_JORDAN = User(
        id = "usr_jordan_002",
        phone = "+27 83 234 5678",
        fullName = "Jordan Lee",
        email = "jordan.lee@example.com",
        role = UserRole.USER,
        plan = PlanTier.FREE,
        smsOptIn = true,
        defaultPlate = "CA 812-482 WC",
        defaultProvinceCode = "WC"
    )

    val DEMO_ADMIN = User(
        id = "usr_admin_003",
        phone = "+27 84 345 6789",
        fullName = "System Administrator",
        email = "admin@driverping.co.za",
        role = UserRole.ADMIN,
        plan = PlanTier.PAID_OWNER,
        smsOptIn = true,
        defaultPlate = "CF 10 VD GP",
        defaultProvinceCode = "GP"
    )

    private val _currentUser = MutableStateFlow<User?>(DEMO_ALEX)
    val currentUser: StateFlow<User?> = _currentUser.asStateFlow()

    private val _isDarkMode = MutableStateFlow(true)
    val isDarkMode: StateFlow<Boolean> = _isDarkMode.asStateFlow()

    private val _vehicles = MutableStateFlow<List<Vehicle>>(
        listOf(
            Vehicle(
                id = "veh_001",
                plateNormalized = "CK45DFGP",
                plateDisplay = "CK 45 DF GP",
                make = "Volkswagen",
                model = "Golf 8 TSI",
                color = "Pure White",
                verifiedOwnerId = "usr_alex_001",
                userRole = "owner",
                driverStatus = "approved",
                isVerifiedOwner = true,
                isDefault = true,
                allDrivers = listOf(
                    VehicleDriverItem("drv_1", "usr_alex_001", "Alex Morgan", "+27 82 123 4567", "owner", "approved", "2025-01-10"),
                    VehicleDriverItem("drv_2", "usr_sub_01", "Thabo Ndlovu", "+27 82 555 1234", "driver", "approved", "2025-02-15")
                ),
                trustedContacts = listOf(
                    TrustedContactItem("tc_1", "veh_001", "Naledi Dlamini", "+27 82 555 0192", "Spouse / Co-Driver"),
                    TrustedContactItem("tc_2", "veh_001", "Jabu Khumalo", "+27 83 444 9821", "Emergency Contact")
                )
            ),
            Vehicle(
                id = "veh_002",
                plateNormalized = "CA812482WC",
                plateDisplay = "CA 812-482 WC",
                make = "Toyota",
                model = "Corolla Cross Hybrid",
                color = "Celestite Grey",
                verifiedOwnerId = "usr_alex_001",
                userRole = "owner",
                driverStatus = "approved",
                isVerifiedOwner = true,
                isDefault = false,
                allDrivers = emptyList(),
                trustedContacts = emptyList()
            )
        )
    )
    val vehicles: StateFlow<List<Vehicle>> = _vehicles.asStateFlow()

    private val _alerts = MutableStateFlow<List<AlertItem>>(
        listOf(
            AlertItem(
                id = "alt_101",
                plateDisplay = "CK 45 DF GP",
                vehicleMakeModel = "Volkswagen Golf 8 TSI",
                category = ReportCategory.VEHICLE_CONDITION,
                issueCode = "brake_light_out",
                issueTitle = "Right brake light not illuminating",
                customNote = "Observed while stopping at William Nicol Dr traffic intersection.",
                status = AlertStatus.RECEIVED,
                createdAt = "15 mins ago"
            ),
            AlertItem(
                id = "alt_102",
                plateDisplay = "CK 45 DF GP",
                vehicleMakeModel = "Volkswagen Golf 8 TSI",
                category = ReportCategory.VEHICLE_CONDITION,
                issueCode = "flat_or_low_tyre",
                issueTitle = "Rear left tyre dangerously low",
                customNote = "Looked below 1.5 bar on highway off-ramp.",
                status = AlertStatus.NEEDS_REVIEW,
                createdAt = "2 hours ago"
            ),
            AlertItem(
                id = "alt_103",
                plateDisplay = "CA 812-482 WC",
                vehicleMakeModel = "Toyota Corolla Cross",
                category = ReportCategory.DRIVER_BEHAVIOUR,
                issueCode = "swerving_drifting",
                issueTitle = "Drifting across lane markings",
                customNote = "Driver seemed distracted near N2 Cape Town outbound.",
                status = AlertStatus.RESOLVED,
                recipientActionNote = "Thank you, tyre pressure was checked and aligned.",
                createdAt = "Yesterday"
            )
        )
    )
    val alerts: StateFlow<List<AlertItem>> = _alerts.asStateFlow()

    private val _verifications = MutableStateFlow<List<OwnershipVerificationItem>>(
        listOf(
            OwnershipVerificationItem(
                id = "ver_501",
                vehicleId = "veh_001",
                userId = "usr_alex_001",
                userName = "Alex Morgan",
                userPhone = "+27 82 123 4567",
                plateDisplay = "CK 45 DF GP",
                vehicleDetails = "Volkswagen Golf 8 TSI (White)",
                documentName = "NATIS_Registration_RC1.pdf",
                documentType = "natis_certificate",
                status = "approved",
                submittedAt = "2025-04-12"
            ),
            OwnershipVerificationItem(
                id = "ver_502",
                vehicleId = "veh_003",
                userId = "usr_jordan_002",
                userName = "Jordan Lee",
                userPhone = "+27 83 234 5678",
                plateDisplay = "CA 234-890 WC",
                vehicleDetails = "BMW 320i M-Sport (Blue)",
                documentName = "License_Disk_Scan_2025.jpg",
                documentType = "license_disk",
                status = "pending",
                submittedAt = "Today at 09:14"
            )
        )
    )
    val verifications: StateFlow<List<OwnershipVerificationItem>> = _verifications.asStateFlow()

    private val _auditLogs = MutableStateFlow<List<AuditLogItem>>(
        listOf(
            AuditLogItem("aud_1", "usr_alex_001", "SUBMIT_REPORT", "alt_101", "Alert", "Created anonymous observation for CK 45 DF GP", "15 mins ago"),
            AuditLogItem("aud_2", "usr_admin_003", "VERIFY_OWNERSHIP", "ver_501", "Vehicle", "Approved NATIS RC1 Certificate", "3 days ago"),
            AuditLogItem("aud_3", "usr_alex_001", "REGISTER_VEHICLE", "veh_002", "Vehicle", "Added vehicle CA 812-482 WC", "5 days ago")
        )
    )
    val auditLogs: StateFlow<List<AuditLogItem>> = _auditLogs.asStateFlow()

    fun toggleDarkMode() {
        _isDarkMode.value = !_isDarkMode.value
    }

    fun setDarkMode(dark: Boolean) {
        _isDarkMode.value = dark
    }

    fun switchAccount(userId: String) {
        when (userId) {
            "usr_jordan_002" -> _currentUser.value = DEMO_JORDAN
            "usr_admin_003" -> _currentUser.value = DEMO_ADMIN
            else -> _currentUser.value = DEMO_ALEX
        }
    }

    fun signOut() {
        _currentUser.value = null
    }

    fun loginWithPhone(phone: String, fullName: String) {
        _currentUser.value = User(
            id = "usr_${System.currentTimeMillis()}",
            phone = phone,
            fullName = fullName.ifBlank { "Driver User" },
            role = UserRole.USER,
            plan = PlanTier.FREE
        )
    }

    fun updateUserPreferences(fullName: String?, phone: String?, defaultPlate: String?, defaultProvinceCode: String?, smsOptIn: Boolean?) {
        val curr = _currentUser.value ?: return
        _currentUser.value = curr.copy(
            fullName = fullName ?: curr.fullName,
            phone = phone ?: curr.phone,
            defaultPlate = defaultPlate ?: curr.defaultPlate,
            defaultProvinceCode = defaultProvinceCode ?: curr.defaultProvinceCode,
            smsOptIn = smsOptIn ?: curr.smsOptIn
        )
    }

    fun registerVehicle(plate: String, make: String, model: String, color: String): Boolean {
        val clean = plate.trim().uppercase()
        val norm = clean.replace("[^A-Z0-9]".toRegex(), "")
        val newVeh = Vehicle(
            id = "veh_${System.currentTimeMillis()}",
            plateNormalized = norm,
            plateDisplay = clean,
            make = make.ifBlank { "Vehicle" },
            model = model.ifBlank { "Registered" },
            color = color.ifBlank { "White" },
            verifiedOwnerId = _currentUser.value?.id,
            isVerifiedOwner = false,
            pendingOwnershipVerification = true,
            isDefault = _vehicles.value.isEmpty()
        )
        _vehicles.value = _vehicles.value + newVeh
        return true
    }

    fun submitReport(
        plate: String,
        category: ReportCategory,
        issueCode: String,
        issueTitle: String,
        customNote: String?
    ): Boolean {
        val cleanPlate = plate.trim().uppercase()
        val newAlert = AlertItem(
            id = "alt_${System.currentTimeMillis()}",
            plateDisplay = cleanPlate,
            vehicleMakeModel = "Observed Vehicle",
            category = category,
            issueCode = issueCode,
            issueTitle = issueTitle,
            customNote = customNote,
            status = AlertStatus.RECEIVED,
            createdAt = "Just now"
        )
        _alerts.value = listOf(newAlert) + _alerts.value
        return true
    }

    fun takeAlertAction(alertId: String, action: String, note: String?) {
        val currentList = _alerts.value.toMutableList()
        val idx = currentList.indexOfFirst { it.id == alertId }
        if (idx != -1) {
            val item = currentList[idx]
            val updated = when (action) {
                "resolve" -> item.copy(status = AlertStatus.RESOLVED, recipientActionNote = note ?: "Resolved by owner")
                "dispute" -> item.copy(status = AlertStatus.DISPUTED, disputeReason = note ?: "Disputed as inaccurate")
                "flag_abuse" -> item.copy(status = AlertStatus.FLAGGED_ABUSE, abuseReason = note ?: "Reported inappropriate")
                "dismiss" -> item.copy(status = AlertStatus.DISMISSED)
                else -> item
            }
            currentList[idx] = updated
            _alerts.value = currentList
        }
    }

    fun reviewVerification(verificationId: String, decision: String, notes: String?) {
        val currentList = _verifications.value.toMutableList()
        val idx = currentList.indexOfFirst { it.id == verificationId }
        if (idx != -1) {
            val item = currentList[idx]
            currentList[idx] = item.copy(
                status = decision,
                adminNotes = notes,
                reviewedAt = "Just now"
            )
            _verifications.value = currentList

            // Also update vehicle verified state
            val vehs = _vehicles.value.toMutableList()
            val vIdx = vehs.indexOfFirst { it.id == item.vehicleId }
            if (vIdx != -1) {
                vehs[vIdx] = vehs[vIdx].copy(
                    isVerifiedOwner = (decision == "approved"),
                    pendingOwnershipVerification = false
                )
                _vehicles.value = vehs
            }
        }
    }

    fun setDefaultVehicle(vehicleId: String) {
        _vehicles.value = _vehicles.value.map {
            it.copy(isDefault = it.id == vehicleId)
        }
    }
}
