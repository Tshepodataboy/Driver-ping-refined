import React from 'react';
import { AppProvider, useApp } from './context/AppContext.js';
import { Header } from './components/Header.js';
import { BottomNav } from './components/BottomNav.js';
import { AuthModal } from './components/AuthModal.js';
import { GeometricBackground } from './components/GeometricBackground.js';
import { LoginPage } from './screens/LoginPage.js';
import { HomeScreen } from './screens/HomeScreen.js';
import { ReportScreen } from './screens/ReportScreen.js';
import { VehiclesScreen } from './screens/VehiclesScreen.js';
import { AlertsScreen } from './screens/AlertsScreen.js';
import { ProfileScreen } from './screens/ProfileScreen.js';
import { AdminScreen } from './screens/AdminScreen.js';
import { SettingsScreen } from './screens/SettingsScreen.js';

import { DriverPingLoader } from './components/DriverPingLoader.js';
import { LogoutConfirmModal } from './components/LogoutConfirmModal.js';

function MainApp() {
  const { user, activeTab, isLoading } = useApp();

  // Loading Splash Screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-crimson-gradient flex flex-col items-center justify-center p-4 text-white relative overflow-hidden">
        {/* Geometric Background for full app */}
        <GeometricBackground />

        <div className="relative z-10 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-2xl animate-bounce mb-2 p-2">
            <img
              src="https://res.cloudinary.com/dwd83begj/image/upload/v1792686945/logo_icon-removebg-preview_e6k6ne.png"
              alt="Driver Ping Logo"
              className="w-full h-full object-contain"
            />
          </div>

          {/* Dash-animated SVG stroke letters replacing static Driver Ping text */}
          <div className="my-2 flex justify-center">
            <DriverPingLoader height="36px" />
          </div>

          <div className="text-xs text-white/80 font-semibold tracking-wide">
            Loading secure driver session...
          </div>
        </div>
      </div>
    );
  }

  // If not logged in, display the Login Page
  if (!user) {
    return (
      <div className="min-h-screen bg-crimson-gradient text-white relative overflow-hidden">
        <GeometricBackground />
        <LoginPage />
        <AuthModal />
      </div>
    );
  }

  // When logged in, render full app with persistent geometric background
  return (
    <div className="min-h-screen bg-crimson-gradient text-white flex flex-col font-sans selection:bg-white/20 selection:text-white relative overflow-hidden">
      {/* App-wide Animated Geometric Background */}
      <GeometricBackground />

      {/* Top Header */}
      <Header />

      {/* Main View Area - screens are kept mounted so theme toggles and tab switching never reset user state */}
      <main className="flex-1 w-full max-w-[420px] mx-auto relative z-10">
        <div className={activeTab === 'home' ? 'block' : 'hidden'}>
          <HomeScreen />
        </div>
        <div className={activeTab === 'report' ? 'block' : 'hidden'}>
          <ReportScreen />
        </div>
        <div className={activeTab === 'vehicles' ? 'block' : 'hidden'}>
          <VehiclesScreen />
        </div>
        <div className={activeTab === 'alerts' ? 'block' : 'hidden'}>
          <AlertsScreen />
        </div>
        <div className={activeTab === 'profile' ? 'block' : 'hidden'}>
          <ProfileScreen />
        </div>
        <div className={activeTab === 'settings' ? 'block' : 'hidden'}>
          <SettingsScreen />
        </div>
        <div className={activeTab === 'admin' ? 'block' : 'hidden'}>
          <AdminScreen />
        </div>
      </main>

      {/* Fixed Bottom Crimson Dock Navigation */}
      <BottomNav />

      {/* Phone / Email Authentication Modal */}
      <AuthModal />

      {/* Logout Confirmation Modal */}
      <LogoutConfirmModal />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
