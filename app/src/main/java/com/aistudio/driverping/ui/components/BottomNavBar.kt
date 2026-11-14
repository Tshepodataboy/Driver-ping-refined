package com.aistudio.driverping.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.aistudio.driverping.ui.theme.CrimsonBright
import com.aistudio.driverping.ui.theme.CrimsonDeep

enum class NavTab(val title: String, val icon: ImageVector, val tag: String) {
    HOME("Home", Icons.Default.Home, "nav_home"),
    REPORT("Report", Icons.Default.AddCircle, "nav_report"),
    VEHICLES("Vehicles", Icons.Default.DirectionsCar, "nav_vehicles"),
    ALERTS("Alerts", Icons.Default.Notifications, "nav_alerts"),
    PROFILE("Profile", Icons.Default.Person, "nav_profile"),
    ADMIN("Admin", Icons.Default.AdminPanelSettings, "nav_admin")
}

@Composable
fun BottomNavBar(
    selectedTab: NavTab,
    onTabSelected: (NavTab) -> Unit,
    unreadAlertsCount: Int = 0,
    isAdmin: Boolean = false,
    modifier: Modifier = Modifier
) {
    val tabs = mutableListOf(
        NavTab.HOME,
        NavTab.REPORT,
        NavTab.VEHICLES,
        NavTab.ALERTS,
        NavTab.PROFILE
    )
    if (isAdmin) {
        tabs.add(NavTab.ADMIN)
    }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 14.dp, vertical = 10.dp),
        contentAlignment = Alignment.Center
    ) {
        Row(
            modifier = Modifier
                .shadow(16.dp, RoundedCornerShape(28.dp))
                .clip(RoundedCornerShape(28.dp))
                .background(Color(0xFF1E2028))
                .border(1.dp, Color.White.copy(alpha = 0.15f), RoundedCornerShape(28.dp))
                .padding(horizontal = 8.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.SpaceAround,
            verticalAlignment = Alignment.CenterVertically
        ) {
            tabs.forEach { tab ->
                val isSelected = selectedTab == tab

                Box(
                    modifier = Modifier
                        .testTag(tab.tag)
                        .clip(RoundedCornerShape(20.dp))
                        .background(if (isSelected) CrimsonBright else Color.Transparent)
                        .clickable { onTabSelected(tab) }
                        .padding(horizontal = if (isSelected) 12.dp else 10.dp, vertical = 8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        BadgedBox(
                            badge = {
                                if (tab == NavTab.ALERTS && unreadAlertsCount > 0) {
                                    Badge(
                                        containerColor = Color(0xFFEF4444),
                                        contentColor = Color.White
                                    ) {
                                        Text(unreadAlertsCount.toString(), fontSize = 9.sp)
                                    }
                                }
                            }
                        ) {
                            Icon(
                                imageVector = tab.icon,
                                contentDescription = tab.title,
                                tint = if (isSelected) Color.White else Color.White.copy(alpha = 0.6f),
                                modifier = Modifier.size(20.dp)
                            )
                        }

                        if (isSelected) {
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = tab.title,
                                color = Color.White,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }
    }
}
