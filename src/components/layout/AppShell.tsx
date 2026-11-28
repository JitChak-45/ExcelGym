import React, { useEffect, useState } from 'react';
import {
  Award,
  BarChart3,
  BookOpen,
  Briefcase,
  Compass,
  LayoutDashboard,
  LogOut,
  Menu,
  Shield,
  Shuffle,
  Table2,
  TerminalSquare,
  User,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { getCareerPath, getLearnerLevel } from '../../data/curriculum';
import {
  isSoundEnabled,
  setSoundEnabled,
  subscribeSoundEnabled,
} from '../../utils/soundEffects';
import type { NavView } from '../../types';
import { CreditFooter } from './CreditFooter';

interface AppShellProps {
  children: React.ReactNode;
  focusMode?: boolean;
}

const NAV_ITEMS: { id: NavView; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'my-learning', label: 'My Learning', icon: BookOpen },
  { id: 'career-paths', label: 'Career Paths', icon: Compass },
  { id: 'practice', label: 'Practice', icon: TerminalSquare },
  { id: 'mixed-practice', label: 'Mixed Practice', icon: Shuffle },
  { id: 'simulations', label: 'Workplace Simulation', icon: Briefcase },
  { id: 'achievements', label: 'Achievements', icon: Award },
  { id: 'progress', label: 'My Progress', icon: BarChart3 },
  { id: 'profile', label: 'Profile', icon: User },
];

export const AppShell: React.FC<AppShellProps> = ({ children, focusMode = false }) => {
  const { profile, activeView, setActiveView, isAdmin, isDemoMode, logout } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [soundOn, setSoundOn] = useState<boolean>(() => isSoundEnabled());

  useEffect(() => {
    return subscribeSoundEnabled(setSoundOn);
  }, []);

  if (focusMode) {
    return <div className="min-h-screen bg-slate-50 flex flex-col">{children}</div>;
  }

  const activePath = getCareerPath(profile?.careerPathId || 'inventory');
  const level = getLearnerLevel(profile?.xp || 0);
  const currentNavLabel =
    activeView === 'admin'
      ? 'Admin Console'
      : NAV_ITEMS.find((i) => i.id === activeView)?.label || 'Dashboard';

  const renderNavList = () => (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = activeView === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setActiveView(item.id);
              setMobileOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              active
                ? 'bg-blue-50 text-blue-700 font-semibold'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}

      {isAdmin && (
        <div className="pt-3 mt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={() => {
              setActiveView('admin');
              setMobileOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeView === 'admin'
                ? 'bg-slate-900 text-white font-semibold'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Shield className="w-4 h-4 shrink-0" />
            <span>Admin Panel</span>
          </button>
        </div>
      )}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 bg-white border-r border-slate-200 sticky top-0 h-screen">
        <div className="h-16 px-5 border-b border-slate-200 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <Table2 className="w-4 h-4 text-white" />
          </div>
          <span className="text-[15px] font-bold text-slate-900 tracking-tight whitespace-nowrap">
            ExcelGym
          </span>
        </div>

        {renderNavList()}

        {/* Compact Learner Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/70">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs font-semibold text-slate-900 truncate">
              {profile?.fullName || 'Learner'}
            </span>
            <span className="text-xs font-mono text-blue-700 font-semibold tabular-nums shrink-0">
              {profile?.xp || 0} XP
            </span>
          </div>
          <p className="text-[11px] text-slate-500 truncate mb-2.5">
            {level.title} · {activePath.shortTitle}
          </p>
          <button
            type="button"
            onClick={() => void logout()}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{isDemoMode ? 'Exit Demo Mode' : 'Sign Out'}</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
          <div className="relative w-72 max-w-[85vw] bg-white h-full flex flex-col z-10 shadow-xl">
            <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center">
                  <Table2 className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-bold text-slate-900">ExcelGym</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {renderNavList()}
            <div className="p-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => void logout()}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg"
              >
                <LogOut className="w-4 h-4" />
                <span>{isDemoMode ? 'Exit Demo Mode' : 'Sign Out'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {isDemoMode && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-2 flex items-center justify-between gap-4 text-xs text-amber-900">
            <span>
              <strong>Local Demo Mode:</strong> Progress is stored only in this browser. Sign in with
              Google or Email to sync across devices with Firebase Cloud.
            </span>
            <button
              type="button"
              onClick={() => void logout()}
              className="font-semibold text-amber-950 underline whitespace-nowrap shrink-0"
            >
              Sign In
            </button>
          </div>
        )}

        {/* Contextual Top Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline truncate">{activePath.title}</span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <h1 className="font-semibold text-slate-900 truncate">{currentNavLabel}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden md:inline text-xs text-slate-500 tabular-nums whitespace-nowrap">
              {profile?.streakDays || 1}-day streak · {level.title}
            </span>
            <button
              type="button"
              data-sound="none"
              onClick={() => setSoundEnabled(!soundOn)}
              title={soundOn ? 'Sound effects on (click to mute)' : 'Sound effects muted (click to unmute)'}
              aria-label={soundOn ? 'Mute sound effects' : 'Enable sound effects'}
              className={`p-2 rounded-lg border transition-colors shrink-0 ${
                soundOn
                  ? 'text-slate-600 border-slate-200 bg-white hover:bg-slate-50 hover:text-slate-900'
                  : 'text-slate-400 border-slate-200 bg-slate-50 hover:bg-slate-100'
              }`}
            >
              {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              type="button"
              data-sound="primary"
              onClick={() => setActiveView('my-learning')}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Continue Learning
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-[1280px] w-full mx-auto">{children}</main>
        <CreditFooter />
      </div>
    </div>
  );
};
