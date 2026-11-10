import React from 'react';
import { useApp, TabKey } from '../context/AppContext.js';
import { Home, Car, User } from 'lucide-react';

interface NavItem {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'vehicles', label: 'Vehicles', icon: Car },
  { key: 'profile', label: 'Profile', icon: User },
];

export function BottomNav() {
  const { activeTab, setActiveTab, theme } = useApp();

  // Hide the floating bottom nav dock when the user is in the report form so it never blocks the Continue button or submit controls
  if (activeTab === 'report') {
    return null;
  }

  const isDark = theme === 'dark';

  return (
    <nav className="fixed bottom-3 inset-x-0 z-40 flex justify-center px-3 pointer-events-none safe-area-pb">
      <div
        className={`pointer-events-auto w-full max-w-[360px] backdrop-blur-2xl rounded-[26px] p-1.5 flex items-center justify-between gap-1 transition-all ${
          isDark
            ? 'bg-[#121316]/95 border border-white/15 shadow-[0_14px_40px_rgba(0,0,0,0.8)] text-white'
            : 'bg-[#FAF8F6]/95 border border-white/80 shadow-[0_14px_40px_rgba(0,0,0,0.28)] text-gray-900'
        }`}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.key;
          const Icon = item.icon;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveTab(item.key)}
              className={`flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all duration-200 cursor-pointer group relative ${
                isActive
                  ? 'nav-aurora-active text-white scale-[1.02]'
                  : isDark
                  ? 'text-white/60 hover:text-white hover:bg-white/10'
                  : 'text-gray-500 hover:text-gray-950 hover:bg-gray-100/70'
              }`}
              title={item.label}
              aria-label={item.label}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform group-hover:scale-110 ${
                    isActive ? 'stroke-[2.4]' : 'stroke-[2]'
                  }`}
                />
              </div>
              <span
                className={`text-[10px] tracking-tight mt-0.5 leading-none ${
                  isActive
                    ? 'font-black text-white'
                    : isDark
                    ? 'font-semibold text-white/60 group-hover:text-white'
                    : 'font-semibold text-gray-500 group-hover:text-gray-900'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
