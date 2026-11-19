import React, { useState } from 'react';
import {
  CheckCircle2,
  Cloud,
  HardDrive,
  LogOut,
  Save,
  Shield,
  Target,
  User,
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { CAREER_PATHS, getLearnerLevel } from '../../data/curriculum';
import type { CareerPathId } from '../../types';

export const ProfileView: React.FC = () => {
  const {
    profile,
    firebaseUser,
    isDemoMode,
    isAdmin,
    updateProfileInfo,
    selectCareerPath,
    logout,
  } = useApp();

  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [weeklyGoal, setWeeklyGoal] = useState(profile?.weeklyGoalItems || 15);
  const [selectedPath, setSelectedPath] = useState<CareerPathId>(
    (profile?.careerPathId as CareerPathId) || 'inventory'
  );
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!profile) return null;

  const level = getLearnerLevel(profile.xp);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedMessage(null);
    setErrorMsg(null);
    try {
      const trimmed = fullName.trim();
      if (!trimmed) {
        setErrorMsg('Please enter your full name.');
        setSaving(false);
        return;
      }
      await updateProfileInfo(trimmed, Math.max(5, Math.min(100, Number(weeklyGoal) || 15)));
      if (selectedPath !== profile.careerPathId) {
        await selectCareerPath(selectedPath, true);
      }
      setSavedMessage('Profile preferences saved.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-semibold text-blue-700 mb-1">Account &amp; Preferences</p>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Learner Profile</h2>
        <p className="text-sm text-slate-600 mt-1">
          Update your display name, career track focus, and weekly learning goal. All learning
          progress across paths is preserved when you switch tracks.
        </p>
      </div>

      {/* Account Status Card */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white font-bold text-lg flex items-center justify-center shrink-0">
            {(profile.fullName || 'L').charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-base font-bold text-slate-900">{profile.fullName}</div>
            <div className="text-xs text-slate-500 mt-0.5">{profile.email}</div>
            <div className="text-xs text-slate-600 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium text-blue-700">{level.title}</span>
              <span>·</span>
              <span className="font-mono tabular-nums">{profile.xp} XP</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                {isDemoMode ? (
                  <>
                    <HardDrive className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-amber-800">Local Demo Mode (Browser Only)</span>
                  </>
                ) : (
                  <>
                    <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">
                      Firebase Cloud Sync {firebaseUser?.emailVerified ? '· Email Verified' : ''}
                    </span>
                  </>
                )}
              </span>
              {isAdmin && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                    <Shield className="w-3.5 h-3.5" />
                    Administrator
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void logout()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shrink-0"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>{isDemoMode ? 'Exit Demo Mode' : 'Sign Out'}</span>
        </button>
      </section>

      {/* Editable Preferences Form */}
      <form
        onSubmit={(e) => void handleSave(e)}
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-6"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label
              htmlFor="profile-name"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Full Name (appears on Certificates)
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="profile-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={120}
                required
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="profile-goal"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Weekly Learning Goal (items per week)
            </label>
            <div className="relative">
              <Target className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="profile-goal"
                type="number"
                min={5}
                max={100}
                value={weeklyGoal}
                onChange={(e) => setWeeklyGoal(Number(e.target.value))}
                className="w-full pl-9 pr-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Recommended for beginners: 15–20 concepts &amp; exercises per week.
            </p>
          </div>
        </div>

        {/* Career Path Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            Primary Career Learning Path
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CAREER_PATHS.map((path) => {
              const active = selectedPath === path.id;
              return (
                <button
                  key={path.id}
                  type="button"
                  onClick={() => setSelectedPath(path.id)}
                  className={`text-left p-4 rounded-xl border transition-colors ${
                    active
                      ? 'border-blue-600 bg-blue-50/50'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-slate-900">{path.title}</span>
                    {active && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{path.subtitle}</p>
                </button>
              );
            })}
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
            {errorMsg}
          </div>
        )}

        {savedMessage && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{savedMessage}</span>
          </div>
        )}

        <div className="pt-2 flex items-center justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Preferences'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
