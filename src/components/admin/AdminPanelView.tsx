import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  BookPlus,
  CheckCircle2,
  Edit3,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Users,
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { CAREER_PATHS, getCareerPath } from '../../data/curriculum';
import {
  createCustomContentAdmin,
  deleteCustomContentAdmin,
  fetchAllAttemptsAdmin,
  fetchAllLearnersAdmin,
  updateCustomContentAdmin,
} from '../../firebase/dataService';
import type {
  CareerPathId,
  CustomContentRecord,
  DifficultyLevel,
  ExerciseAttempt,
  UserProfile,
} from '../../types';

type AdminTab = 'overview' | 'stats' | 'content';

interface ContentFormState {
  editingId: string | null;
  contentType: 'exercise' | 'concept' | 'simulation' | 'module' | 'careerPath';
  careerPathId: CareerPathId;
  moduleId: string;
  title: string;
  summary: string;
  difficulty: DifficultyLevel;
  published: boolean;
  targetCell: string;
  expectedFormula: string;
  expectedValue: string;
  hint: string;
  explanation: string;
  datasetCsv: string;
}

const DEFAULT_FORM: ContentFormState = {
  editingId: null,
  contentType: 'exercise',
  careerPathId: 'inventory',
  moduleId: 'custom',
  title: '',
  summary: '',
  difficulty: 'Medium',
  published: true,
  targetCell: 'C5',
  expectedFormula: '=SUM(C2:C4)',
  expectedValue: '1500',
  hint: 'Use the SUM function across rows 2 to 4 in column C.',
  explanation: 'SUM(C2:C4) totals all numeric values cleanly without manual addition.',
  datasetCsv: 'Item,Quantity,Amount\nKeyboard,10,500\nMouse,20,400\nWebcam,6,600\nTotal,,',
};

export const AdminPanelView: React.FC = () => {
  const { isAdmin, firebaseUser, customContent } = useApp();

  const [tab, setTab] = useState<AdminTab>('overview');
  const [learners, setLearners] = useState<UserProfile[]>([]);
  const [allAttempts, setAllAttempts] = useState<ExerciseAttempt[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState<ContentFormState>(DEFAULT_FORM);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadAdminMetrics = async () => {
    if (!isAdmin) return;
    setLoadingData(true);
    setLoadError(null);
    try {
      const [usersData, attemptsData] = await Promise.all([
        fetchAllLearnersAdmin(),
        fetchAllAttemptsAdmin(),
      ]);
      setLearners(usersData);
      setAllAttempts(attemptsData);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Unable to load platform analytics from Firestore.'
      );
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      void loadAdminMetrics();
    }
  }, [isAdmin]);

  const topicStats = useMemo(() => {
    const map = new Map<
      string,
      { topic: string; total: number; passed: number; accSum: number; mode: string }
    >();
    for (const att of allAttempts) {
      const key = `${att.mode}::${att.topic}`;
      const prev = map.get(key) || {
        topic: att.topic,
        total: 0,
        passed: 0,
        accSum: 0,
        mode: att.mode,
      };
      prev.total += 1;
      if (att.passed) prev.passed += 1;
      prev.accSum += att.accuracy;
      map.set(key, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [allAttempts]);

  if (!isAdmin) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center max-w-lg mx-auto mt-8">
        <ShieldAlert className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900">Administrator Access Required</h2>
        <p className="text-sm text-slate-600 mt-1">
          This console is protected by Firestore Security Rules and is only accessible to verified
          administrators.
        </p>
      </div>
    );
  }

  const totalPassedAttempts = allAttempts.filter((a) => a.passed).length;
  const platformAvgAccuracy =
    allAttempts.length > 0
      ? Math.round(allAttempts.reduce((s, a) => s + a.accuracy, 0) / allAttempts.length)
      : 0;

  const openEditForm = (item: CustomContentRecord) => {
    setForm({
      editingId: item.id,
      contentType: item.contentType,
      careerPathId: (item.careerPathId as CareerPathId) || 'inventory',
      moduleId: item.moduleId || 'custom',
      title: item.title,
      summary: item.summary,
      difficulty: item.difficulty,
      published: item.published,
      targetCell: item.targetCell,
      expectedFormula: item.expectedFormula,
      expectedValue: item.expectedValue,
      hint: item.hint,
      explanation: item.explanation,
      datasetCsv: (item.datasetRows || []).join('\n'),
    });
    setShowForm(true);
    setFeedback(null);
  };

  const handleSaveContent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    setSubmitting(true);
    setFeedback(null);
    const datasetRows = form.datasetCsv
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    try {
      if (form.editingId) {
        await updateCustomContentAdmin(form.editingId, {
          title: form.title,
          summary: form.summary,
          difficulty: form.difficulty,
          published: form.published,
          targetCell: form.targetCell.toUpperCase(),
          expectedFormula: form.expectedFormula,
          expectedValue: form.expectedValue,
          hint: form.hint,
          explanation: form.explanation,
          datasetRows,
        });
        setFeedback('Content updated in Firestore.');
      } else {
        await createCustomContentAdmin(firebaseUser.uid, {
          contentType: form.contentType,
          careerPathId: form.careerPathId,
          moduleId: form.moduleId || 'custom',
          title: form.title,
          summary: form.summary,
          difficulty: form.difficulty,
          published: form.published,
          targetCell: form.targetCell.toUpperCase(),
          expectedFormula: form.expectedFormula,
          expectedValue: form.expectedValue,
          hint: form.hint,
          explanation: form.explanation,
          datasetRows,
        });
        setFeedback('New curriculum item published to Firestore.');
      }
      setShowForm(false);
      setForm(DEFAULT_FORM);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Failed to save content.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePublish = async (item: CustomContentRecord) => {
    await updateCustomContentAdmin(item.id, { published: !item.published });
  };

  const handleDelete = async (id: string) => {
    await deleteCustomContentAdmin(id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-blue-700 mb-1">Protected Console</p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Admin &amp; Curriculum Studio
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Monitor learner adoption, review exercise pass rates, and publish custom practice
            exercises live to learners.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadAdminMetrics()}
          disabled={loadingData}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        {[
          { id: 'overview' as const, label: 'Learners Overview', icon: Users },
          { id: 'stats' as const, label: 'Exercise Statistics', icon: BarChart3 },
          { id: 'content' as const, label: `Custom Curriculum (${customContent.length})`, icon: BookPlus },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors -mb-px ${
                active
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {loadError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
          {loadError}
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500 font-medium">Registered Learners</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {loadingData ? '—' : learners.length}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500 font-medium">Total Exercise Submissions</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {loadingData ? '—' : allAttempts.length}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500 font-medium">Pass Rate</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
            {allAttempts.length > 0
              ? `${Math.round((totalPassedAttempts / allAttempts.length) * 100)}%`
              : '0%'}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500 font-medium">Average Accuracy</div>
          <div className="text-2xl font-bold text-blue-700 mt-1 tabular-nums">
            {platformAvgAccuracy}%
          </div>
        </div>
      </div>

      {/* TAB 1: LEARNERS OVERVIEW */}
      {tab === 'overview' && (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Registered Learner Accounts</h3>
          </div>
          {loadingData ? (
            <div className="p-10 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading learners...
            </div>
          ) : learners.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">
              No learner profiles found yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="py-3 px-6">Learner</th>
                    <th className="py-3 px-4">Career Track</th>
                    <th className="py-3 px-4">XP</th>
                    <th className="py-3 px-4">Streak</th>
                    <th className="py-3 px-4">Attempts (Passed)</th>
                    <th className="py-3 px-6 text-right">Last Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {learners.map((u) => (
                    <tr key={u.uid} className="hover:bg-slate-50/70">
                      <td className="py-3 px-6">
                        <div className="font-semibold text-slate-900">{u.fullName}</div>
                        <div className="text-slate-500">{u.email}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {u.careerPathId ? getCareerPath(u.careerPathId).shortTitle : 'Onboarding'}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-blue-700 tabular-nums">
                        {u.xp}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700 tabular-nums">
                        {u.streakDays}d
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700 tabular-nums">
                        {u.totalAttempts} ({u.correctAttempts})
                      </td>
                      <td className="py-3 px-6 text-right text-slate-500 tabular-nums">
                        {u.lastActiveDate || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* TAB 2: EXERCISE STATISTICS */}
      {tab === 'stats' && (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Completion Statistics by Topic</h3>
          </div>
          {topicStats.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">
              No exercise attempts recorded across the platform yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="py-3 px-6">Topic</th>
                    <th className="py-3 px-4">Mode</th>
                    <th className="py-3 px-4">Total Attempts</th>
                    <th className="py-3 px-4">Pass Rate</th>
                    <th className="py-3 px-6 text-right">Avg Accuracy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {topicStats.map((st) => (
                    <tr key={`${st.mode}-${st.topic}`} className="hover:bg-slate-50/70">
                      <td className="py-3 px-6 font-semibold text-slate-900">{st.topic}</td>
                      <td className="py-3 px-4 capitalize text-slate-600">{st.mode}</td>
                      <td className="py-3 px-4 font-mono text-slate-700 tabular-nums">
                        {st.total}
                      </td>
                      <td className="py-3 px-4 font-mono text-emerald-700 tabular-nums">
                        {Math.round((st.passed / st.total) * 100)}%
                      </td>
                      <td className="py-3 px-6 text-right font-mono font-semibold text-slate-900 tabular-nums">
                        {Math.round(st.accSum / st.total)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* TAB 3: CUSTOM CURRICULUM CRUD */}
      {tab === 'content' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-600">
              Published exercises appear immediately inside learners&apos; Practice Library for the
              selected career path.
            </p>
            <button
              type="button"
              onClick={() => {
                setForm(DEFAULT_FORM);
                setShowForm((s) => !s);
                setFeedback(null);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
            >
              <Plus className="w-4 h-4" />
              <span>{showForm ? 'Close Editor' : 'Create Custom Exercise'}</span>
            </button>
          </div>

          {feedback && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{feedback}</span>
            </div>
          )}

          {showForm && (
            <form
              onSubmit={(e) => void handleSaveContent(e)}
              className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
            >
              <h3 className="text-base font-bold text-slate-900">
                {form.editingId ? 'Edit Custom Curriculum Item' : 'New Custom Practice Exercise'}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Career Path
                  </label>
                  <select
                    value={form.careerPathId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, careerPathId: e.target.value as CareerPathId }))
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    {CAREER_PATHS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Difficulty
                  </label>
                  <select
                    value={form.difficulty}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, difficulty: e.target.value as DifficultyLevel }))
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>

                <div className="flex items-end pb-1">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.published}
                      onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))}
                      className="rounded border-slate-300"
                    />
                    <span>Publish immediately to learners</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Exercise Title
                </label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g., Calculate Total Warehouse Reorder Value"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Objective / Learner Instructions
                </label>
                <textarea
                  required
                  rows={2}
                  value={form.summary}
                  onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                  placeholder="Describe what the learner must compute inside the target cell..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Target Cell (e.g. C5)
                  </label>
                  <input
                    type="text"
                    required
                    value={form.targetCell}
                    onChange={(e) => setForm((f) => ({ ...f, targetCell: e.target.value }))}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Expected Formula
                  </label>
                  <input
                    type="text"
                    required
                    value={form.expectedFormula}
                    onChange={(e) => setForm((f) => ({ ...f, expectedFormula: e.target.value }))}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Expected Result Value
                  </label>
                  <input
                    type="text"
                    required
                    value={form.expectedValue}
                    onChange={(e) => setForm((f) => ({ ...f, expectedValue: e.target.value }))}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Spreadsheet Dataset (CSV rows, first row = headers)
                </label>
                <textarea
                  rows={4}
                  value={form.datasetCsv}
                  onChange={(e) => setForm((f) => ({ ...f, datasetCsv: e.target.value }))}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Hint</label>
                  <input
                    type="text"
                    value={form.hint}
                    onChange={(e) => setForm((f) => ({ ...f, hint: e.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Post-Submission Explanation
                  </label>
                  <input
                    type="text"
                    value={form.explanation}
                    onChange={(e) => setForm((f) => ({ ...f, explanation: e.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg"
                >
                  {submitting ? 'Saving...' : form.editingId ? 'Update Item' : 'Publish Item'}
                </button>
              </div>
            </form>
          )}

          {/* Existing Custom Content List */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {customContent.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500">
                No custom curriculum items created yet. Click &ldquo;Create Custom Exercise&rdquo; to
                add a live spreadsheet exercise for learners.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {customContent.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 truncate">
                          {item.title}
                        </span>
                        <span
                          className={`text-[11px] font-semibold ${
                            item.published ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          · {item.published ? 'Published' : 'Draft'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{item.summary}</p>
                      <div className="text-[11px] text-slate-400 mt-1 font-mono">
                        {getCareerPath(item.careerPathId as CareerPathId).shortTitle} ·{' '}
                        {item.difficulty} · Cell {item.targetCell} → {item.expectedFormula}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleTogglePublish(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
                      >
                        {item.published ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>Unpublish</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            <span>Publish</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditForm(item)}
                        className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg"
                        title="Edit item"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(item.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                        title="Delete item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
