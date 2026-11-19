import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth, BOOTSTRAP_ADMIN_EMAIL, googleProvider, isFirebaseConfigured } from '../firebase/config';
import {
  checkIsAdminDocument,
  computeNextStreak,
  ensureUserProfile,
  getTodayDateKey,
  issueCertificate,
  logExerciseAttempt,
  saveProgressItem,
  subscribePublishedCustomContent,
  subscribeUserAttempts,
  subscribeUserCertificates,
  subscribeUserProfile,
  subscribeUserProgress,
  updateUserLearningStats,
  updateUserProfilePreferences,
} from '../firebase/dataService';
import type {
  CareerPathId,
  CertificateRecord,
  CustomContentRecord,
  ExerciseAttempt,
  NavView,
  ProgressRecord,
  UserProfile,
} from '../types';
import { getCareerPath, getModuleById, getStageId } from '../data/curriculum';

const DEMO_STORAGE_KEY = 'excel_career_academy_demo_state_v1';

interface DemoStoragePayload {
  profile: UserProfile;
  progress: ProgressRecord[];
  attempts: ExerciseAttempt[];
  certificates: CertificateRecord[];
}

function loadDemoState(): DemoStoragePayload {
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as DemoStoragePayload;
    }
  } catch {
    // ignore storage parse error
  }
  const now = new Date().toISOString();
  return {
    profile: {
      uid: 'demo_local_learner',
      fullName: 'Demo Learner',
      email: 'demo@local-sandbox.invalid',
      careerPathId: '',
      onboardingComplete: false,
      xp: 0,
      streakDays: 1,
      lastActiveDate: getTodayDateKey(),
      weeklyGoalItems: 15,
      totalLearningSeconds: 0,
      totalAttempts: 0,
      correctAttempts: 0,
      createdAt: now,
      updatedAt: now,
    },
    progress: [],
    attempts: [],
    certificates: [],
  };
}

export interface WeakTopicItem {
  topic: string;
  avgAccuracy: number;
  attempts: number;
  moduleId: string;
}

export interface AppContextValue {
  authLoading: boolean;
  firebaseUser: User | null;
  needsEmailVerification: boolean;
  isDemoMode: boolean;
  isAdmin: boolean;
  profile: UserProfile | null;
  progressRecords: ProgressRecord[];
  attempts: ExerciseAttempt[];
  certificates: CertificateRecord[];
  customContent: CustomContentRecord[];
  activeView: NavView;
  setActiveView: (v: NavView) => void;

  // Derived Sets & Stats
  completedConceptIds: Set<string>;
  completedExerciseIds: Set<string>;
  completedStageIds: Set<string>;
  completedModuleIds: Set<string>;
  completedSimulationIds: Set<string>;
  weakTopics: WeakTopicItem[];
  averageAccuracy: number;

  // Auth Actions
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (fullName: string, email: string, password: string) => Promise<void>;
  sendResetPassword: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshVerificationStatus: () => Promise<boolean>;
  enterDemoMode: () => void;
  logout: () => Promise<void>;

  // Profile & Progress Actions
  selectCareerPath: (pathId: CareerPathId, completeOnboarding?: boolean) => Promise<void>;
  updateProfileInfo: (fullName: string, weeklyGoalItems: number) => Promise<void>;
  recordConceptCompleted: (params: {
    conceptId: string;
    moduleId: string;
    careerPathId: CareerPathId;
    stageNumber: 1 | 3;
    topic: string;
  }) => Promise<void>;
  recordExerciseResult: (params: {
    exerciseId: string;
    exerciseTitle: string;
    moduleId: string;
    careerPathId: CareerPathId;
    stageNumber?: 2 | 4;
    mode: 'guided' | 'mixed' | 'simulation';
    topic: string;
    score: number;
    maxScore: number;
    accuracy: number;
    passed: boolean;
    timeSpentSeconds: number;
  }) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authLoading, setAuthLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [progressRecords, setProgressRecords] = useState<ProgressRecord[]>([]);
  const [attempts, setAttempts] = useState<ExerciseAttempt[]>([]);
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [customContent, setCustomContent] = useState<CustomContentRecord[]>([]);
  const [activeView, setActiveView] = useState<NavView>('dashboard');

  const profileRef = useRef<UserProfile | null>(null);
  profileRef.current = profile;
  const progressRef = useRef<ProgressRecord[]>([]);
  progressRef.current = progressRecords;
  const attemptsRef = useRef<ExerciseAttempt[]>([]);
  attemptsRef.current = attempts;

  const persistDemo = useCallback(
    (next: Partial<DemoStoragePayload>) => {
      const current = loadDemoState();
      const merged: DemoStoragePayload = {
        profile: next.profile ?? current.profile,
        progress: next.progress ?? current.progress,
        attempts: next.attempts ?? current.attempts,
        certificates: next.certificates ?? current.certificates,
      };
      try {
        localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(merged));
      } catch {
        // ignore quota errors
      }
    },
    []
  );

  // Firebase Auth listener
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setAuthLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        if (!isDemoMode) {
          setProfile(null);
          setProgressRecords([]);
          setAttempts([]);
          setCertificates([]);
          setCustomContent([]);
          setIsAdmin(false);
        }
        setAuthLoading(false);
        return;
      }

      setIsDemoMode(false);

      if (!user.emailVerified) {
        setProfile(null);
        setIsAdmin(false);
        setAuthLoading(false);
        return;
      }

      try {
        const ensured = await ensureUserProfile(
          user.uid,
          user.displayName || user.email?.split('@')[0] || 'Learner',
          user.email || ''
        );
        setProfile(ensured);

        const isBootstrap =
          user.emailVerified &&
          (user.email || '').toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
        const hasAdminDoc = isBootstrap ? true : await checkIsAdminDocument(user.uid);
        setIsAdmin(hasAdminDoc);
      } catch (err) {
        console.error('Error initializing user profile:', err);
      } finally {
        setAuthLoading(false);
      }
    });

    return () => unsub();
  }, [isDemoMode]);

  // Real-time Firestore subscriptions for verified authenticated users
  useEffect(() => {
    if (isDemoMode || !firebaseUser || !firebaseUser.emailVerified) return;

    const unsubProfile = subscribeUserProfile(firebaseUser.uid, (p) => {
      if (p) setProfile(p);
    });
    const unsubProgress = subscribeUserProgress(firebaseUser.uid, (recs) => {
      setProgressRecords(recs);
    });
    const unsubAttempts = subscribeUserAttempts(firebaseUser.uid, (atts) => {
      setAttempts(atts);
    });
    const unsubCerts = subscribeUserCertificates(firebaseUser.uid, (certs) => {
      setCertificates(certs);
    });
    const unsubCustom = subscribePublishedCustomContent(isAdmin, (items) => {
      setCustomContent(items);
    });

    return () => {
      unsubProfile();
      unsubProgress();
      unsubAttempts();
      unsubCerts();
      unsubCustom();
    };
  }, [firebaseUser, isDemoMode, isAdmin]);

  // Learning time heartbeat (adds 60s every minute while active)
  useEffect(() => {
    if (!profile || !profile.onboardingComplete) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const cur = profileRef.current;
      if (!cur) return;
      const nextSeconds = cur.totalLearningSeconds + 60;
      if (isDemoMode) {
        const updated = { ...cur, totalLearningSeconds: nextSeconds, updatedAt: new Date().toISOString() };
        setProfile(updated);
        persistDemo({ profile: updated });
      } else if (firebaseUser?.emailVerified) {
        void updateUserLearningStats(firebaseUser.uid, {
          xp: cur.xp,
          streakDays: cur.streakDays,
          lastActiveDate: cur.lastActiveDate || getTodayDateKey(),
          totalLearningSeconds: nextSeconds,
          totalAttempts: cur.totalAttempts,
          correctAttempts: cur.correctAttempts,
        }).catch(() => {});
      }
    }, 60000);
    return () => window.clearInterval(interval);
  }, [profile?.uid, profile?.onboardingComplete, isDemoMode, firebaseUser, persistDemo]);

  // Derived Completion Sets
  const completedConceptIds = useMemo(
    () => new Set(progressRecords.filter((r) => r.itemType === 'concept').map((r) => r.itemId)),
    [progressRecords]
  );

  const completedStageIds = useMemo(
    () => new Set(progressRecords.filter((r) => r.itemType === 'stage').map((r) => r.itemId)),
    [progressRecords]
  );

  const completedModuleIds = useMemo(
    () => new Set(progressRecords.filter((r) => r.itemType === 'module').map((r) => r.itemId)),
    [progressRecords]
  );

  const completedSimulationIds = useMemo(
    () => new Set(progressRecords.filter((r) => r.itemType === 'simulation').map((r) => r.itemId)),
    [progressRecords]
  );

  const completedExerciseIds = useMemo(
    () => new Set(attempts.filter((a) => a.passed && a.mode === 'guided').map((a) => a.exerciseId)),
    [attempts]
  );

  const averageAccuracy = useMemo(() => {
    if (attempts.length === 0) return 0;
    const sum = attempts.reduce((acc, a) => acc + a.accuracy, 0);
    return Math.round(sum / attempts.length);
  }, [attempts]);

  const weakTopics = useMemo<WeakTopicItem[]>(() => {
    const byTopic = new Map<string, { sum: number; count: number; moduleId: string }>();
    for (const a of attempts) {
      const existing = byTopic.get(a.topic) || { sum: 0, count: 0, moduleId: a.moduleId };
      existing.sum += a.accuracy;
      existing.count += 1;
      byTopic.set(a.topic, existing);
    }
    const list: WeakTopicItem[] = [];
    for (const [topic, val] of byTopic.entries()) {
      const avg = Math.round(val.sum / val.count);
      if (avg < 80) {
        list.push({ topic, avgAccuracy: avg, attempts: val.count, moduleId: val.moduleId });
      }
    }
    return list.sort((a, b) => a.avgAccuracy - b.avgAccuracy).slice(0, 6);
  }, [attempts]);

  // Auth Methods
  const loginWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const loginWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  };

  const registerWithEmail = async (fullName: string, email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await updateProfile(cred.user, { displayName: fullName.trim() });
    await sendEmailVerification(cred.user);
    setFirebaseUser({ ...cred.user });
  };

  const sendResetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  };

  const resendVerificationEmail = async () => {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
  };

  const refreshVerificationStatus = async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    const verified = Boolean(auth.currentUser.emailVerified);
    if (verified) {
      const u = auth.currentUser;
      setFirebaseUser(u);
      const ensured = await ensureUserProfile(
        u.uid,
        u.displayName || u.email?.split('@')[0] || 'Learner',
        u.email || ''
      );
      setProfile(ensured);
      const isBootstrap =
        (u.email || '').toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
      setIsAdmin(isBootstrap || (await checkIsAdminDocument(u.uid)));
    }
    return verified;
  };

  const enterDemoMode = () => {
    const data = loadDemoState();
    setIsDemoMode(true);
    setIsAdmin(false);
    setProfile(data.profile);
    setProgressRecords(data.progress);
    setAttempts(data.attempts);
    setCertificates(data.certificates);
    setActiveView('dashboard');
  };

  const logout = async () => {
    if (isDemoMode) {
      setIsDemoMode(false);
      setProfile(null);
      setProgressRecords([]);
      setAttempts([]);
      setCertificates([]);
      setActiveView('dashboard');
      return;
    }
    await signOut(auth);
    setActiveView('dashboard');
  };

  // Profile updates
  const selectCareerPath = async (pathId: CareerPathId, completeOnboarding = true) => {
    const cur = profileRef.current;
    if (!cur) return;
    if (isDemoMode) {
      const updated: UserProfile = {
        ...cur,
        careerPathId: pathId,
        onboardingComplete: completeOnboarding || cur.onboardingComplete,
        updatedAt: new Date().toISOString(),
      };
      setProfile(updated);
      persistDemo({ profile: updated });
      return;
    }
    if (firebaseUser) {
      await updateUserProfilePreferences(firebaseUser.uid, {
        careerPathId: pathId,
        onboardingComplete: completeOnboarding || cur.onboardingComplete,
      });
    }
  };

  const updateProfileInfo = async (fullName: string, weeklyGoalItems: number) => {
    const cur = profileRef.current;
    if (!cur) return;
    if (isDemoMode) {
      const updated: UserProfile = {
        ...cur,
        fullName: fullName.trim() || cur.fullName,
        weeklyGoalItems,
        updatedAt: new Date().toISOString(),
      };
      setProfile(updated);
      persistDemo({ profile: updated });
      return;
    }
    if (firebaseUser) {
      await updateUserProfilePreferences(firebaseUser.uid, {
        fullName: fullName.trim(),
        weeklyGoalItems,
      });
    }
  };

  // Helper to check stage & module completion after any concept or exercise finishes
  const evaluateStageAndModuleProgress = async (
    moduleId: string,
    careerPathId: CareerPathId,
    stageNumber: 1 | 2 | 3 | 4,
    nextConceptSet: Set<string>,
    nextPassedExerciseSet: Set<string>
  ) => {
    const mod = getModuleById(moduleId);
    if (!mod) return;
    const stage = mod.stages[stageNumber - 1];
    let stageComplete = false;
    if (stage.kind === 'concepts' && stage.concepts) {
      stageComplete = stage.concepts.every((c) => nextConceptSet.has(c.id));
    } else if (stage.kind === 'practice' && stage.exercises) {
      stageComplete = stage.exercises.every((e) => nextPassedExerciseSet.has(e.id));
    }
    if (!stageComplete) return;

    const stageId = getStageId(moduleId, stageNumber);
    const cur = profileRef.current;
    if (!cur) return;

    const alreadyStage = progressRef.current.some(
      (r) => r.itemType === 'stage' && r.itemId === stageId
    );
    if (!alreadyStage) {
      if (isDemoMode) {
        const rec: ProgressRecord = {
          id: `stage_${stageId}`,
          userId: cur.uid,
          itemType: 'stage',
          itemId: stageId,
          careerPathId,
          moduleId,
          topic: stage.title,
          score: 100,
          maxScore: 100,
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const updatedProg = [...progressRef.current, rec];
        setProgressRecords(updatedProg);
        progressRef.current = updatedProg;
        persistDemo({ progress: updatedProg });
      } else if (firebaseUser) {
        await saveProgressItem(firebaseUser.uid, {
          itemType: 'stage',
          itemId: stageId,
          careerPathId,
          moduleId,
          topic: stage.title,
          score: 100,
          maxScore: 100,
        });
      }
    }

    // Check if ALL 4 stages are complete -> Module Complete + Certificate!
    const allStageIds = ([1, 2, 3, 4] as const).map((n) => getStageId(moduleId, n));
    const currentStageSet = new Set(
      progressRef.current.filter((r) => r.itemType === 'stage').map((r) => r.itemId)
    );
    currentStageSet.add(stageId);

    if (allStageIds.every((sid) => currentStageSet.has(sid))) {
      const alreadyMod = progressRef.current.some(
        (r) => r.itemType === 'module' && r.itemId === moduleId
      );
      if (!alreadyMod) {
        const modAttempts = attemptsRef.current.filter((a) => a.moduleId === moduleId);
        const modAcc =
          modAttempts.length > 0
            ? Math.round(modAttempts.reduce((s, a) => s + a.accuracy, 0) / modAttempts.length)
            : 100;

        if (isDemoMode) {
          const nowIso = new Date().toISOString();
          const modRec: ProgressRecord = {
            id: `module_${moduleId}`,
            userId: cur.uid,
            itemType: 'module',
            itemId: moduleId,
            careerPathId,
            moduleId,
            topic: mod.title,
            score: 100,
            maxScore: 100,
            completedAt: nowIso,
            updatedAt: nowIso,
          };
          const cert: CertificateRecord = {
            id: `cert_${cur.uid}_${moduleId}`,
            userId: cur.uid,
            learnerName: cur.fullName,
            careerPathId,
            moduleId,
            moduleTitle: `${getCareerPath(careerPathId).title} — ${mod.title}`,
            accuracy: modAcc,
            issuedAt: nowIso,
          };
          const updatedProg = [...progressRef.current, modRec];
          const updatedCerts = [...certificates, cert];
          setProgressRecords(updatedProg);
          setCertificates(updatedCerts);
          persistDemo({ progress: updatedProg, certificates: updatedCerts });
        } else if (firebaseUser) {
          await saveProgressItem(firebaseUser.uid, {
            itemType: 'module',
            itemId: moduleId,
            careerPathId,
            moduleId,
            topic: mod.title,
            score: 100,
            maxScore: 100,
          });
          await issueCertificate(firebaseUser.uid, {
            learnerName: cur.fullName,
            careerPathId,
            moduleId,
            moduleTitle: `${getCareerPath(careerPathId).title} — ${mod.title}`,
            accuracy: modAcc,
          });
        }
      }
    }
  };

  const recordConceptCompleted = async (params: {
    conceptId: string;
    moduleId: string;
    careerPathId: CareerPathId;
    stageNumber: 1 | 3;
    topic: string;
  }) => {
    const cur = profileRef.current;
    if (!cur) return;

    const alreadyDone = completedConceptIds.has(params.conceptId);
    const nextStreak = computeNextStreak(cur.lastActiveDate, cur.streakDays);
    const xpGain = alreadyDone ? 0 : 15;

    if (isDemoMode) {
      const nowIso = new Date().toISOString();
      let updatedProg = progressRef.current;
      if (!alreadyDone) {
        const rec: ProgressRecord = {
          id: `concept_${params.conceptId}`,
          userId: cur.uid,
          itemType: 'concept',
          itemId: params.conceptId,
          careerPathId: params.careerPathId,
          moduleId: params.moduleId,
          topic: params.topic,
          score: 100,
          maxScore: 100,
          completedAt: nowIso,
          updatedAt: nowIso,
        };
        updatedProg = [...progressRef.current, rec];
        setProgressRecords(updatedProg);
        progressRef.current = updatedProg;
      }
      const updatedProfile: UserProfile = {
        ...cur,
        xp: cur.xp + xpGain,
        streakDays: nextStreak,
        lastActiveDate: getTodayDateKey(),
        updatedAt: nowIso,
      };
      setProfile(updatedProfile);
      profileRef.current = updatedProfile;
      persistDemo({ profile: updatedProfile, progress: updatedProg });
    } else if (firebaseUser) {
      await saveProgressItem(firebaseUser.uid, {
        itemType: 'concept',
        itemId: params.conceptId,
        careerPathId: params.careerPathId,
        moduleId: params.moduleId,
        topic: params.topic,
        score: 100,
        maxScore: 100,
      });
      if (xpGain > 0 || cur.lastActiveDate !== getTodayDateKey()) {
        await updateUserLearningStats(firebaseUser.uid, {
          xp: cur.xp + xpGain,
          streakDays: nextStreak,
          lastActiveDate: getTodayDateKey(),
          totalLearningSeconds: cur.totalLearningSeconds,
          totalAttempts: cur.totalAttempts,
          correctAttempts: cur.correctAttempts,
        });
      }
    }

    const nextConceptSet = new Set(completedConceptIds);
    nextConceptSet.add(params.conceptId);
    await evaluateStageAndModuleProgress(
      params.moduleId,
      params.careerPathId,
      params.stageNumber,
      nextConceptSet,
      completedExerciseIds
    );
  };

  const recordExerciseResult = async (params: {
    exerciseId: string;
    exerciseTitle: string;
    moduleId: string;
    careerPathId: CareerPathId;
    stageNumber?: 2 | 4;
    mode: 'guided' | 'mixed' | 'simulation';
    topic: string;
    score: number;
    maxScore: number;
    accuracy: number;
    passed: boolean;
    timeSpentSeconds: number;
  }) => {
    const cur = profileRef.current;
    if (!cur) return;

    const nextStreak = computeNextStreak(cur.lastActiveDate, cur.streakDays);
    const xpGain = params.passed ? Math.max(20, Math.round(params.score)) : 5;
    const nextTotalAttempts = cur.totalAttempts + 1;
    const nextCorrectAttempts = cur.correctAttempts + (params.passed ? 1 : 0);

    if (isDemoMode) {
      const nowIso = new Date().toISOString();
      const newAttempt: ExerciseAttempt = {
        id: `att_${Date.now()}`,
        userId: cur.uid,
        careerPathId: params.careerPathId,
        moduleId: params.moduleId,
        exerciseId: params.exerciseId,
        exerciseTitle: params.exerciseTitle,
        mode: params.mode,
        topic: params.topic,
        score: params.score,
        maxScore: params.maxScore,
        accuracy: params.accuracy,
        passed: params.passed,
        timeSpentSeconds: params.timeSpentSeconds,
        createdAt: nowIso,
      };
      const updatedAttempts = [newAttempt, ...attemptsRef.current];
      setAttempts(updatedAttempts);
      attemptsRef.current = updatedAttempts;

      let updatedProg = progressRef.current;
      if (params.mode === 'simulation' && params.passed) {
        if (!updatedProg.some((r) => r.itemType === 'simulation' && r.itemId === params.exerciseId)) {
          updatedProg = [
            ...updatedProg,
            {
              id: `simulation_${params.exerciseId}`,
              userId: cur.uid,
              itemType: 'simulation',
              itemId: params.exerciseId,
              careerPathId: params.careerPathId,
              moduleId: 'simulation',
              topic: params.topic,
              score: params.score,
              maxScore: params.maxScore,
              completedAt: nowIso,
              updatedAt: nowIso,
            },
          ];
          setProgressRecords(updatedProg);
          progressRef.current = updatedProg;
        }
      }

      const updatedProfile: UserProfile = {
        ...cur,
        xp: cur.xp + xpGain,
        streakDays: nextStreak,
        lastActiveDate: getTodayDateKey(),
        totalAttempts: nextTotalAttempts,
        correctAttempts: nextCorrectAttempts,
        updatedAt: nowIso,
      };
      setProfile(updatedProfile);
      profileRef.current = updatedProfile;
      persistDemo({ profile: updatedProfile, attempts: updatedAttempts, progress: updatedProg });
    } else if (firebaseUser) {
      await logExerciseAttempt(firebaseUser.uid, {
        careerPathId: params.careerPathId,
        moduleId: params.moduleId,
        exerciseId: params.exerciseId,
        exerciseTitle: params.exerciseTitle,
        mode: params.mode,
        topic: params.topic,
        score: params.score,
        maxScore: params.maxScore,
        accuracy: params.accuracy,
        passed: params.passed,
        timeSpentSeconds: params.timeSpentSeconds,
      });

      if (params.mode === 'simulation' && params.passed) {
        await saveProgressItem(firebaseUser.uid, {
          itemType: 'simulation',
          itemId: params.exerciseId,
          careerPathId: params.careerPathId,
          moduleId: 'simulation',
          topic: params.topic,
          score: params.score,
          maxScore: params.maxScore,
        });
      }

      await updateUserLearningStats(firebaseUser.uid, {
        xp: cur.xp + xpGain,
        streakDays: nextStreak,
        lastActiveDate: getTodayDateKey(),
        totalLearningSeconds: cur.totalLearningSeconds,
        totalAttempts: nextTotalAttempts,
        correctAttempts: nextCorrectAttempts,
      });
    }

    if (params.mode === 'guided' && params.passed && params.stageNumber) {
      const nextExSet = new Set(completedExerciseIds);
      nextExSet.add(params.exerciseId);
      await evaluateStageAndModuleProgress(
        params.moduleId,
        params.careerPathId,
        params.stageNumber,
        completedConceptIds,
        nextExSet
      );
    }
  };

  const needsEmailVerification = Boolean(firebaseUser && !firebaseUser.emailVerified && !isDemoMode);

  const value: AppContextValue = {
    authLoading,
    firebaseUser,
    needsEmailVerification,
    isDemoMode,
    isAdmin,
    profile,
    progressRecords,
    attempts,
    certificates,
    customContent,
    activeView,
    setActiveView,
    completedConceptIds,
    completedExerciseIds,
    completedStageIds,
    completedModuleIds,
    completedSimulationIds,
    weakTopics,
    averageAccuracy,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    sendResetPassword,
    resendVerificationEmail,
    refreshVerificationStatus,
    enterDemoMode,
    logout,
    selectCareerPath,
    updateProfileInfo,
    recordConceptCompleted,
    recordExerciseResult,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
