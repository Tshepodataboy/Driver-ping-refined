package com.aistudio.driverping

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import com.aistudio.driverping.data.DriverPingRepository
import com.aistudio.driverping.model.AlertStatus
import com.aistudio.driverping.model.ReportCategory
import com.aistudio.driverping.model.UserRole
import com.aistudio.driverping.ui.components.BottomNavBar
import com.aistudio.driverping.ui.components.DriverPingHeader
import com.aistudio.driverping.ui.components.GeometricBackground
import com.aistudio.driverping.ui.components.NavTab
import com.aistudio.driverping.ui.screens.*
import com.aistudio.driverping.ui.theme.DriverPingTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            val isDark by DriverPingRepository.isDarkMode.collectAsState()
            val currentUser by DriverPingRepository.currentUser.collectAsState()
            val alerts by DriverPingRepository.alerts.collectAsState()

            var currentTab by remember { mutableStateOf(NavTab.HOME) }
            var reportPresetCategory by remember { mutableStateOf<ReportCategory?>(null) }
            val unreadCount = alerts.count { it.status == AlertStatus.RECEIVED || it.status == AlertStatus.NEEDS_REVIEW }

            DriverPingTheme(darkTheme = isDark) {
                Box(modifier = Modifier.fillMaxSize()) {
                    GeometricBackground()

                    if (currentUser == null) {
                        LoginScreen(
                            onLoginSuccess = { currentTab = NavTab.HOME }
                        )
                    } else {
                        // System back handler
                        BackHandler(enabled = currentTab != NavTab.HOME) {
                            currentTab = NavTab.HOME
                        }

                        Scaffold(
                            containerColor = Color.Transparent,
                            topBar = {
                                DriverPingHeader(
                                    user = currentUser,
                                    isDark = isDark,
                                    onToggleTheme = { DriverPingRepository.toggleDarkMode() },
                                    onProfileClick = { currentTab = NavTab.PROFILE }
                                )
                            },
                            bottomBar = {
                                BottomNavBar(
                                    selectedTab = currentTab,
                                    onTabSelected = { tab ->
                                        if (tab == NavTab.REPORT) {
                                            reportPresetCategory = null
                                        }
                                        currentTab = tab
                                    },
                                    unreadAlertsCount = unreadCount,
                                    isAdmin = currentUser?.role == UserRole.ADMIN
                                )
                            }
                        ) { innerPadding ->
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .padding(innerPadding)
                            ) {
                                when (currentTab) {
                                    NavTab.HOME -> HomeScreen(
                                        onNavigateToReportWithCategory = { cat ->
                                            reportPresetCategory = cat
                                            currentTab = NavTab.REPORT
                                        },
                                        onNavigateToAlerts = { currentTab = NavTab.ALERTS }
                                    )

                                    NavTab.REPORT -> ReportScreen(
                                        initialCategory = reportPresetCategory,
                                        onReportSubmitted = { currentTab = NavTab.ALERTS }
                                    )

                                    NavTab.VEHICLES -> VehiclesScreen()

                                    NavTab.ALERTS -> AlertsScreen()

                                    NavTab.PROFILE -> ProfileScreen(
                                        onSignOut = { currentTab = NavTab.HOME }
                                    )

                                    NavTab.ADMIN -> AdminScreen()
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
