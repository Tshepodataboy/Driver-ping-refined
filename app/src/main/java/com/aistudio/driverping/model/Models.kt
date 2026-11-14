package com.aistudio.driverping.model

enum class UserRole {
    USER, ADMIN
}

enum class PlanTier {
    FREE, PAID_OWNER
}

data class User(
    val id: String = "",
    val phone: String,
    val fullName: String,
    val email: String? = null,
    val role: UserRole = UserRole.USER,
    val plan: PlanTier = PlanTier.FREE,
    val smsOptIn: Boolean = true,
    val smsMonthlyCapPence: Int = 500,
    val smsCurrentSpendPence: Int = 0,
    val defaultPlate: String? = "CF 10 VD GP",
    val defaultProvinceCode: String? = "GP",
    val createdAt: String = "2025-01-01"
)

enum class ReportCategory(val id: String, val title: String, val subtitle: String) {
    VEHICLE_CONDITION("vehicle_condition", "Vehicle condition", "Faults, damage or safety issues"),
    DRIVER_BEHAVIOUR("driver_behaviour", "Driver behaviour", "Unsafe or dangerous driving"),
    ROAD_VIOLATION("road_violation", "Road-use violation", "Traffic and parking offences")
}

data class IssueOption(
    val code: String,
    val title: String,
    val description: String,
    val category: ReportCategory
)

data class VehicleDriverItem(
    val id: String,
    val userId: String,
    val fullName: String,
    val phone: String,
    val role: String, // "owner" or "driver"
    val status: String, // "approved", "pending_owner_approval", "rejected"
    val requestedAt: String,
    val approvedAt: String? = null
)

data class TrustedContactItem(
    val id: String,
    val vehicleId: String,
    val name: String,
    val phone: String,
    val relationship: String,
    val consentGiven: Boolean = true,
    val createdAt: String = "2025-01-01"
)

data class Vehicle(
    val id: String,
    val plateNormalized: String,
    val plateDisplay: String,
    val make: String,
    val model: String,
    val color: String,
    val verifiedOwnerId: String? = null,
    val userRole: String = "owner",
    val driverStatus: String = "approved",
    val isVerifiedOwner: Boolean = true,
    val allDrivers: List<VehicleDriverItem> = emptyList(),
    val trustedContacts: List<TrustedContactItem> = emptyList(),
    val pendingOwnershipVerification: Boolean = false,
    val isDefault: Boolean = false,
    val createdAt: String = "2025-01-01"
)

enum class AlertStatus {
    RECEIVED, NEEDS_REVIEW, RESOLVED, DISPUTED, FLAGGED_ABUSE, DISMISSED
}

data class AlertItem(
    val id: String,
    val plateDisplay: String,
    val vehicleMakeModel: String,
    val category: ReportCategory,
    val issueCode: String,
    val issueTitle: String,
    val customNote: String? = null,
    val photoUrl: String? = null,
    val status: AlertStatus = AlertStatus.RECEIVED,
    val recipientActionNote: String? = null,
    val disputeReason: String? = null,
    val abuseReason: String? = null,
    val createdAt: String = "2025-05-10",
    val isRecordedDelivered: Boolean = true,
    val deliveredAt: String = "2025-05-10",
    val neutralNotice: String = "This is a courtesy road observation reported by a fellow driver.",
    val privacyNotice: String = "Sender phone & identity are 100% anonymous."
)

data class OwnershipVerificationItem(
    val id: String,
    val vehicleId: String,
    val userId: String,
    val userPhone: String? = null,
    val userName: String? = null,
    val plateDisplay: String? = null,
    val vehicleDetails: String? = null,
    val documentName: String,
    val documentType: String,
    val documentUrl: String = "",
    val status: String = "pending", // "pending", "approved", "rejected"
    val adminNotes: String? = null,
    val submittedAt: String = "2025-05-10",
    val reviewedAt: String? = null,
    val reviewedById: String? = null
)

data class AuditLogItem(
    val id: String,
    val actorId: String?,
    val actionType: String,
    val targetId: String?,
    val targetType: String,
    val details: String,
    val createdAt: String
)

data class SAProvince(
    val code: String,
    val name: String,
    val fullName: String,
    val plateExample: String,
    val capital: String,
    val cities: List<String>,
    val searchTerms: List<String>
)

data class NumberPlateOption(
    val plateDisplay: String,
    val rawRegistration: String,
    val provinceCode: String,
    val provinceName: String,
    val vehicleName: String = "",
    val categoryTag: String = "Standard Tag"
)

object DriverPingConstants {
    val PROVINCES = listOf(
        SAProvince("WC", "Western Cape", "Western Cape (WC)", "CA 232-577", "Cape Town", listOf("Cape Town", "Stellenbosch", "George", "Paarl"), listOf("western cape", "wc")),
        SAProvince("ZN", "KwaZulu-Natal", "KwaZulu-Natal (ZN)", "NUR 18083", "Pietermaritzburg", listOf("Durban", "Pietermaritzburg", "Umhlanga"), listOf("kwazulu-natal", "kzn", "zn")),
        SAProvince("NW", "North West", "North West (NW)", "KTZ 747 NW", "Mahikeng", listOf("Rustenburg", "Potchefstroom", "Klerksdorp"), listOf("north west", "nw")),
        SAProvince("FS", "Free State", "Free State (FS)", "CAM 69 FS", "Bloemfontein", listOf("Bloemfontein", "Welkom", "Sasolburg"), listOf("free state", "fs")),
        SAProvince("NC", "Northern Cape", "Northern Cape (NC)", "BKK 973 NC", "Kimberley", listOf("Kimberley", "Upington", "Springbok"), listOf("northern cape", "nc")),
        SAProvince("GP", "Gauteng", "Gauteng (GP)", "CF 10 VD GP", "Johannesburg", listOf("Johannesburg", "Pretoria", "Centurion", "Sandton"), listOf("gauteng", "gp")),
        SAProvince("L", "Limpopo", "Limpopo (L)", "BKS 214 L", "Polokwane", listOf("Polokwane", "Tzaneen", "Mokopane"), listOf("limpopo", "l", "lp")),
        SAProvince("EC", "Eastern Cape", "Eastern Cape (EC)", "CBB 574 EC", "Bhisho", listOf("Gqeberha", "East London", "Mthatha"), listOf("eastern cape", "ec")),
        SAProvince("MP", "Mpumalanga", "Mpumalanga (MP)", "RGZ 191 MP", "Mbombela", listOf("Mbombela", "Witbank", "Secunda"), listOf("mpumalanga", "mp"))
    )

    val ISSUES = listOf(
        // Vehicle Condition
        IssueOption("brake_light_out", "Brake light not working", "Rear brake light failed to illuminate while slowing or stopping.", ReportCategory.VEHICLE_CONDITION),
        IssueOption("headlight_indicator_out", "Headlight or indicator bulb out", "Front light or turn indicator not working properly.", ReportCategory.VEHICLE_CONDITION),
        IssueOption("flat_or_low_tyre", "Flat tyre / dangerously low pressure", "Tyre visibly flat or soft, possible puncture hazard.", ReportCategory.VEHICLE_CONDITION),
        IssueOption("exhaust_smoke_rattle", "Heavy exhaust smoke / scraping part", "Excessive black or blue smoke, or loose component under vehicle.", ReportCategory.VEHICLE_CONDITION),
        IssueOption("boot_door_open", "Boot or door not fully latched", "Boot lid or passenger door slightly ajar while moving.", ReportCategory.VEHICLE_CONDITION),
        IssueOption("fuel_cap_open", "Fuel cap flap open", "Fuel flap or inner screw cap left unscrewed.", ReportCategory.VEHICLE_CONDITION),
        IssueOption("loose_cargo_roof", "Loose cargo or roof rack load", "Items on roof or trailer shifting or improperly secured.", ReportCategory.VEHICLE_CONDITION),
        IssueOption("other_vehicle_condition", "Other vehicle condition issue", "Another observed vehicle fault not listed above.", ReportCategory.VEHICLE_CONDITION),

        // Driver Behaviour
        IssueOption("tailgating_severe", "Severe tailgating", "Driving dangerously close to vehicle in front without safe braking gap.", ReportCategory.DRIVER_BEHAVIOUR),
        IssueOption("swerving_drifting", "Drifting across lanes / swerving", "Repeatedly crossing road markings or struggling to maintain lane.", ReportCategory.DRIVER_BEHAVIOUR),
        IssueOption("phone_use_driving", "Mobile phone usage while driving", "Driver visibly handling phone or texting while in motion.", ReportCategory.DRIVER_BEHAVIOUR),
        IssueOption("excessive_speeding", "High speed in residential or school zone", "Travelling significantly over safe speed limit in pedestrian area.", ReportCategory.DRIVER_BEHAVIOUR),
        IssueOption("aggressive_undertaking", "Aggressive cutting off / overtaking", "Abruptly swerving in front of other vehicles without clearance.", ReportCategory.DRIVER_BEHAVIOUR),
        IssueOption("failure_to_indicate", "Failing to indicate at junction / roundabout", "Turning or changing lanes with no indicator signal given.", ReportCategory.DRIVER_BEHAVIOUR),
        IssueOption("other_driver_behaviour", "Other driving behaviour issue", "Another observed unsafe driving action not listed above.", ReportCategory.DRIVER_BEHAVIOUR),

        // Road Violation
        IssueOption("blocking_driveway_kerb", "Blocking driveway or dropped kerb", "Parked across private access or disabled dropped kerb ramp.", ReportCategory.ROAD_VIOLATION),
        IssueOption("bus_cycle_lane_blocked", "Obstruction in bus or cycle lane", "Parked or driving in designated cycle track or bus route.", ReportCategory.ROAD_VIOLATION),
        IssueOption("ran_red_light", "Ran red traffic light", "Proceeded across junction after traffic signal turned red.", ReportCategory.ROAD_VIOLATION),
        IssueOption("double_parking", "Double parking / blocking roadway", "Parked parallel to another vehicle preventing traffic flow.", ReportCategory.ROAD_VIOLATION),
        IssueOption("parked_on_blind_bend", "Hazardous parking on bend or brow of hill", "Stationary vehicle causing severe blind spot for oncoming traffic.", ReportCategory.ROAD_VIOLATION),
        IssueOption("other_road_violation", "Other road-use or parking offence", "Another traffic or parking issue not listed above.", ReportCategory.ROAD_VIOLATION)
    )

    val OFFICIAL_PLATES = listOf(
        NumberPlateOption("CF 10 VD GP", "CF 10 VD", "GP", "Gauteng", "Gauteng Provincial Sample", "Standard Tag"),
        NumberPlateOption("CK 45 DF GP", "CK 45 DF", "GP", "Gauteng", "Alex Morgan · Verified Owner", "Registered Vehicle"),
        NumberPlateOption("BB 12 CD GP", "BB 12 CD", "GP", "Gauteng", "Johannesburg Metro", "Gauteng Series"),
        NumberPlateOption("CA 812-482 WC", "812-482", "WC", "Western Cape", "Volkswagen Golf TSI · Deep Blue", "Registered Vehicle"),
        NumberPlateOption("CA 232-577 WC", "232-577", "WC", "Western Cape", "Cape Town Metro", "Standard Tag"),
        NumberPlateOption("ND 913-317 ZN", "913-317", "ZN", "KwaZulu-Natal", "Nissan Leaf Electric · Pearl White", "Registered Vehicle"),
        NumberPlateOption("NUR 18083", "18083", "ZN", "KwaZulu-Natal", "Umhlanga / Durban North", "Standard Tag"),
        NumberPlateOption("CAM 69 FS", "CAM 69", "FS", "Free State", "Bloemfontein Central", "Standard Tag"),
        NumberPlateOption("KTZ 747 NW", "KTZ 747", "NW", "North West", "Rustenburg Platinum Belt", "Standard Tag"),
        NumberPlateOption("BKK 973 NC", "BKK 973", "NC", "Northern Cape", "Kimberley Diamond City", "Standard Tag"),
        NumberPlateOption("BKS 214 L", "BKS 214", "L", "Limpopo", "Polokwane Capital", "Standard Tag"),
        NumberPlateOption("CBB 574 EC", "CBB 574", "EC", "Eastern Cape", "Gqeberha / Port Elizabeth", "Standard Tag"),
        NumberPlateOption("RGZ 191 MP", "RGZ 191", "MP", "Mpumalanga", "Mbombela / Nelspruit", "Standard Tag")
    )
}
