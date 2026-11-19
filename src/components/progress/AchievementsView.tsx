import React, { useState } from 'react';
import {
  Award,
  CheckCircle2,
  FileBadge,
  Lock,
  Printer,
  ShieldCheck,
  Trophy,
  X,
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { ACHIEVEMENT_BADGES, getCareerPath, getLearnerLevel } from '../../data/curriculum';
import type { CertificateRecord } from '../../types';

export const AchievementsView: React.FC = () => {
  const {
    profile,
    completedConceptIds,
    completedExerciseIds,
    completedModuleIds,
    completedSimulationIds,
    averageAccuracy,
    certificates,
    setActiveView,
  } = useApp();

  const [selectedCert, setSelectedCert] = useState<CertificateRecord | null>(null);

  const xp = profile?.xp || 0;
  const level = getLearnerLevel(xp);

  const badgeStats = {
    conceptsCompleted: completedConceptIds.size,
    exercisesCompleted: completedExerciseIds.size,
    modulesCompleted: completedModuleIds.size,
    simulationsCompleted: completedSimulationIds.size,
    streakDays: profile?.streakDays || 1,
    avgAccuracy: averageAccuracy,
    xp,
  };

  const earnedBadges = ACHIEVEMENT_BADGES.filter((b) => b.isEarned(badgeStats));

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold text-blue-700 mb-1">Milestones &amp; Recognition</p>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          Achievements &amp; Certificates
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Earn XP, unlock verified skill badges, and collect module completion certificates as you
          master job-ready Excel workflows.
        </p>
      </div>

      {/* Career Readiness Level Banner */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Current Career Readiness Level</div>
              <div className="text-xl font-bold text-slate-900">{level.title}</div>
            </div>
          </div>
          <div className="text-left md:text-right tabular-nums">
            <div className="text-2xl font-bold text-blue-700 font-mono">{xp} XP</div>
            <div className="text-xs text-slate-500">
              {level.title === 'Advanced'
                ? 'Top readiness tier reached'
                : `${Math.max(0, level.nextXp - xp)} XP to next level (${level.nextXp} XP)`}
            </div>
          </div>
        </div>

        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-300"
            style={{ width: `${level.progressPct}%` }}
          />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4 pt-4 border-t border-slate-100 text-xs">
          <div>
            <span className="font-semibold text-slate-900">Beginner</span>
            <p className="text-slate-500 mt-0.5 tabular-nums">0 – 499 XP</p>
          </div>
          <div>
            <span className="font-semibold text-slate-900">Intermediate</span>
            <p className="text-slate-500 mt-0.5 tabular-nums">500 – 1,799 XP</p>
          </div>
          <div>
            <span className="font-semibold text-slate-900">Advanced</span>
            <p className="text-slate-500 mt-0.5 tabular-nums">1,800+ XP</p>
          </div>
        </div>
      </section>

      {/* Achievement Badges Grid */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900">Skill Badges</h3>
          <span className="text-xs font-medium text-slate-500 tabular-nums">
            {earnedBadges.length} of {ACHIEVEMENT_BADGES.length} unlocked
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ACHIEVEMENT_BADGES.map((badge) => {
            const unlocked = badge.isEarned(badgeStats);
            return (
              <div
                key={badge.id}
                className={`rounded-xl border p-5 flex flex-col justify-between transition-colors ${
                  unlocked
                    ? 'bg-white border-blue-200'
                    : 'bg-slate-50/70 border-slate-200 text-slate-500'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        unlocked ? 'bg-blue-50 text-blue-700' : 'bg-slate-200/70 text-slate-400'
                      }`}
                    >
                      {unlocked ? <Award className="w-5 h-5" /> : <Lock className="w-4 h-4" />}
                    </div>
                    <span
                      className={`text-xs font-semibold ${
                        unlocked ? 'text-emerald-700' : 'text-slate-400'
                      }`}
                    >
                      {unlocked ? 'Unlocked' : 'Locked'}
                    </span>
                  </div>
                  <h4
                    className={`text-sm font-bold ${
                      unlocked ? 'text-slate-900' : 'text-slate-600'
                    }`}
                  >
                    {badge.title}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{badge.description}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-medium text-slate-500">
                  Requirement: {badge.criteria}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Module Completion Certificates */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900">Module Completion Certificates</h3>
          <span className="text-xs font-medium text-slate-500 tabular-nums">
            {certificates.length} issued
          </span>
        </div>

        {certificates.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
            <FileBadge className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h4 className="text-sm font-semibold text-slate-900">No certificates issued yet</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Complete all 4 stages (10 concepts and 10 practice questions) of any career module to
              automatically earn a verifiable ExcelGym certificate.
            </p>
            <button
              type="button"
              onClick={() => setActiveView('my-learning')}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg"
            >
              Go to My Learning
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {certificates.map((cert) => (
              <div
                key={cert.id}
                className="bg-white border border-slate-200 rounded-xl p-5 flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 mb-1">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Verified Module Certificate</span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">{cert.moduleTitle}</h4>
                  <p className="text-xs text-slate-500 mt-1 tabular-nums">
                    Awarded to {cert.learnerName} · {cert.accuracy}% accuracy · Issued{' '}
                    {formatDate(cert.issuedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCert(cert)}
                  className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg shrink-0"
                >
                  View Certificate
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Printable Certificate Modal */}
      {selectedCert && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between print:hidden">
              <span className="text-sm font-bold text-slate-900">Module Completion Certificate</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / Save PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCert(null)}
                  className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-8 sm:p-10 bg-white">
              <div className="border-2 border-slate-800 rounded-xl p-8 text-center space-y-5">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
                  ExcelGym
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                  Certificate of Completion
                </h3>
                <p className="text-sm text-slate-500">This certifies that</p>
                <div className="text-2xl font-bold text-slate-900 border-b border-slate-200 pb-3 max-w-md mx-auto">
                  {selectedCert.learnerName}
                </div>
                <p className="text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
                  has successfully completed all concepts and practical spreadsheet assessments for
                </p>
                <div className="text-base font-bold text-blue-800">{selectedCert.moduleTitle}</div>
                <div className="text-xs text-slate-500 tabular-nums">
                  Career Track: {getCareerPath(selectedCert.careerPathId as never).title} ·
                  Assessment Accuracy: {selectedCert.accuracy}% · Issued{' '}
                  {formatDate(selectedCert.issuedAt)}
                </div>
                <div className="pt-4 flex items-center justify-center gap-2 text-xs text-emerald-700 font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Certificate ID: {selectedCert.id}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
