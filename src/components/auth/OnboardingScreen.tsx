import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Table2 } from 'lucide-react';
import { CAREER_PATHS } from '../../data/curriculum';
import { useApp } from '../../contexts/AppContext';
import type { CareerPathId } from '../../types';
import { CreditFooter } from '../layout/CreditFooter';

export const OnboardingScreen: React.FC = () => {
  const { profile, selectCareerPath } = useApp();
  const [selected, setSelected] = useState<CareerPathId>('inventory');
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await selectCareerPath(selected, true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Table2 className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-bold text-slate-900">ExcelGym</span>
        </div>

        <div className="max-w-2xl mb-8">
          <p className="text-xs font-semibold text-blue-700 mb-2">
            Welcome, {profile?.fullName || 'Learner'}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-2">
            Which career path are you preparing for?
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Your choice personalizes your 12-module curriculum, workplace spreadsheet datasets, and
            career simulations. You can switch or explore other paths anytime from Career Paths.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          {CAREER_PATHS.map((path) => {
            const isSelected = selected === path.id;
            return (
              <button
                key={path.id}
                type="button"
                onClick={() => setSelected(path.id)}
                className={`text-left bg-white rounded-xl overflow-hidden border transition-all ${
                  isSelected
                    ? 'border-blue-600 ring-2 ring-blue-600/15'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="aspect-16/9 w-full bg-slate-100 relative overflow-hidden">
                  <img
                    src={path.coverImage}
                    alt={path.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <h2 className="text-base font-bold text-slate-900">{path.title}</h2>
                    {isSelected && <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />}
                  </div>
                  <p className="text-xs text-slate-500 mb-3">
                    {path.modules.length} Modules · {path.modules.length * 20} Learning Items ·{' '}
                    {path.jobRoles[0]}
                  </p>
                  <p className="text-sm text-slate-600 leading-relaxed mb-3">{path.description}</p>
                  <ul className="space-y-1 text-xs text-slate-600">
                    {path.practicalSkills.slice(0, 3).map((skill) => (
                      <li key={skill} className="flex items-center gap-2">
                        <span className="text-blue-600 font-bold">·</span>
                        <span>{skill}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={handleConfirm}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            <span>{saving ? 'Setting up your path...' : 'Start Learning Path'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="mt-10 -mx-6 -mb-10">
        <CreditFooter />
      </div>
    </div>
  );
};
