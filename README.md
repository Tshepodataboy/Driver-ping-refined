# 🚗 Driver Ping (Android)

**Look out for each other. Helpful, anonymous vehicle condition and road safety alerts between drivers.**

Driver Ping is rewritten as a native Android application built with **Kotlin** and **Jetpack Compose**, adopting **Material Design 3**, responsive layouts, and edge-to-edge support.

---

## 🌟 Features Ported & Implemented

1. **South African Provincial Number Plate System**:
   - High-fidelity visual rendering of authentic South African vehicle registration plates for all 9 provinces:
     - Gauteng (GP)
     - Western Cape (WC)
     - KwaZulu-Natal (ZN)
     - Free State (FS)
     - North West (NW)
     - Northern Cape (NC)
     - Limpopo (L/LP)
     - Eastern Cape (EC)
     - Mpumalanga (MP)
   - Real-time plate number embossing, provincial coat of arms badge, and format validation.

2. **Quick Observation & Steering Wheel Hub (Home)**:
   - 4-Quadrant fast observation launcher for:
     - **Vehicle Condition**: Brake lights, low/flat tyre, exhaust smoke, fuel cap flap, loose cargo.
     - **Driver Behaviour**: Swerving, severe tailgating, phone use while driving, excessive speeding.
     - **Road Violation**: Blocked bus/cycle lane, red light violation, hazardous parking.
     - **Emergency SOS**: Immediate one-tap national emergency dispatch (112 South Africa).
   - Recent alerts summary on user registered vehicles with instant status badges (`RECEIVED`, `NEEDS_REVIEW`, `RESOLVED`, `DISPUTED`).

3. **Interactive 4-Step Report Wizard**:
   - **Step 1: Vehicle & Province**: Live visual plate preview with 9-province quick-select grid.
   - **Step 2: Observation Type**: Granular categorization across 21+ predefined vehicle and road faults.
   - **Step 3: Details & Notes**: Context notes, location cues, and 100% anonymous sender guarantee.
   - **Step 4: Review & Dispatch**: Final verification and instant courtesy dispatch.

4. **Vehicle Management & Ownership Verification**:
   - Register personal vehicles with provincial plate, make, model, and color.
   - Set primary/default vehicle for receiving alerts.
   - Upload NATIS RC1 Certificate or vehicle license disk for official Verified Owner verification.
   - Manage trusted emergency contacts and co-drivers.

5. **Alerts & Observations Feed**:
   - Filter by All, Unread, and Resolved alerts.
   - Action dialogs to **Resolve**, **Dispute**, or **Flag Abuse** with customizable notes.
   - Built-in courtesy and privacy statements ensuring sender anonymity.

6. **Profile, Settings & Demo Accounts**:
   - 1-tap demo account switching:
     - **Alex Morgan** (Verified Owner, Paid Tier)
     - **Jordan Lee** (Driver, Free Tier)
     - **System Administrator** (Supervisor with Admin Panel)
   - SMS alert notification preferences and monthly cap controls.
   - Dark & Light mode theme toggle with persistent state.

7. **Admin Control Panel**:
   - Supervisor review queue for submitted NATIS ownership documents (Approve / Reject).
   - Real-time audit trail and dispute logs.

---

## 🏗️ Architecture & Tech Stack

- **Language**: Kotlin 2.1.0
- **UI Framework**: Jetpack Compose (BOM 2025.01.00) + Material Design 3
- **State Management**: Kotlin Coroutines & `StateFlow` / `MutableStateFlow`
- **Navigation**: Multi-screen state machine with system `BackHandler`
- **Build System**: Gradle (Kotlin DSL, `build.gradle.kts`, `libs.versions.toml`)
- **Package**: `com.aistudio.driverping`
- **Target SDK**: Android SDK 35 (minSdk 26)
