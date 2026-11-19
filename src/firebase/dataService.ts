import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './config';
import type {
  CareerPathId,
  CertificateRecord,
  CustomContentRecord,
  DifficultyLevel,
  ExerciseAttempt,
  ProgressRecord,
  UserProfile,
} from '../types';

function toIsoString(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return cleaned.length > 0 ? cleaned : `id_${Date.now()}`;
}

function clampString(val: string, maxLen: number): string {
  return (val || '').trim().slice(0, maxLen);
}

export function getTodayDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function computeNextStreak(lastActiveDate: string, currentStreak: number): number {
  const today = getTodayDateKey();
  if (!lastActiveDate) return 1;
  if (lastActiveDate === today) return Math.max(1, currentStreak);
  const last = new Date(`${lastActiveDate}T00:00:00`);
  const now = new Date(`${today}T00:00:00`);
  const diffDays = Math.round((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 1) return currentStreak + 1;
  return 1;
}

export async function ensureUserProfile(
  uid: string,
  fullName: string,
  email: string
): Promise<UserProfile> {
  const safeUid = sanitizeId(uid);
  const path = `users/${safeUid}`;
  const ref = doc(db, 'users', safeUid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const d = snap.data();
      return {
        uid: d.uid,
        fullName: d.fullName,
        email: d.email,
        careerPathId: d.careerPathId || '',
        onboardingComplete: Boolean(d.onboardingComplete),
        xp: Number(d.xp || 0),
        streakDays: Number(d.streakDays || 1),
        lastActiveDate: String(d.lastActiveDate || getTodayDateKey()),
        weeklyGoalItems: Number(d.weeklyGoalItems || 15),
        totalLearningSeconds: Number(d.totalLearningSeconds || 0),
        totalAttempts: Number(d.totalAttempts || 0),
        correctAttempts: Number(d.correctAttempts || 0),
        createdAt: toIsoString(d.createdAt),
        updatedAt: toIsoString(d.updatedAt),
      };
    }

    const today = getTodayDateKey();
    const safeName = clampString(fullName || email.split('@')[0] || 'Learner', 120);
    const safeEmail = clampString(email, 200);

    await setDoc(ref, {
      uid: safeUid,
      fullName: safeName,
      email: safeEmail,
      careerPathId: '',
      onboardingComplete: false,
      xp: 0,
      streakDays: 1,
      lastActiveDate: today,
      weeklyGoalItems: 15,
      totalLearningSeconds: 0,
      totalAttempts: 0,
      correctAttempts: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const nowIso = new Date().toISOString();
    return {
      uid: safeUid,
      fullName: safeName,
      email: safeEmail,
      careerPathId: '',
      onboardingComplete: false,
      xp: 0,
      streakDays: 1,
      lastActiveDate: today,
      weeklyGoalItems: 15,
      totalLearningSeconds: 0,
      totalAttempts: 0,
      correctAttempts: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateUserProfilePreferences(
  uid: string,
  updates: {
    fullName?: string;
    careerPathId?: CareerPathId | '';
    onboardingComplete?: boolean;
    weeklyGoalItems?: number;
  }
): Promise<void> {
  const safeUid = sanitizeId(uid);
  const path = `users/${safeUid}`;
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (updates.fullName !== undefined) payload.fullName = clampString(updates.fullName, 120) || 'Learner';
  if (updates.careerPathId !== undefined) payload.careerPathId = updates.careerPathId;
  if (updates.onboardingComplete !== undefined) payload.onboardingComplete = updates.onboardingComplete;
  if (updates.weeklyGoalItems !== undefined) {
    payload.weeklyGoalItems = Math.max(1, Math.min(500, Math.round(updates.weeklyGoalItems)));
  }

  try {
    await updateDoc(doc(db, 'users', safeUid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateUserLearningStats(
  uid: string,
  stats: {
    xp: number;
    streakDays: number;
    lastActiveDate: string;
    totalLearningSeconds: number;
    totalAttempts: number;
    correctAttempts: number;
  }
): Promise<void> {
  const safeUid = sanitizeId(uid);
  const path = `users/${safeUid}`;
  const totalAttempts = Math.max(0, Math.round(stats.totalAttempts));
  const correctAttempts = Math.max(0, Math.min(totalAttempts, Math.round(stats.correctAttempts)));
  try {
    await updateDoc(doc(db, 'users', safeUid), {
      xp: Math.max(0, Math.min(10000000, Math.round(stats.xp))),
      streakDays: Math.max(0, Math.min(10000, Math.round(stats.streakDays))),
      lastActiveDate: clampString(stats.lastActiveDate, 20),
      totalLearningSeconds: Math.max(0, Math.min(100000000, Math.round(stats.totalLearningSeconds))),
      totalAttempts,
      correctAttempts,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveProgressItem(
  uid: string,
  record: {
    itemType: 'concept' | 'stage' | 'module' | 'simulation';
    itemId: string;
    careerPathId: string;
    moduleId: string;
    topic: string;
    score: number;
    maxScore: number;
  }
): Promise<void> {
  const safeUid = sanitizeId(uid);
  const docId = sanitizeId(`${record.itemType}_${record.itemId}`);
  const path = `users/${safeUid}/progress/${docId}`;
  const ref = doc(db, 'users', safeUid, 'progress', docId);

  try {
    const existingSnap = await getDoc(ref);
    if (existingSnap.exists()) {
      const prevScore = Number(existingSnap.data().score || 0);
      await updateDoc(ref, {
        score: Math.max(prevScore, Math.round(record.score)),
        maxScore: Math.max(0, Math.round(record.maxScore)),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        userId: safeUid,
        itemType: record.itemType,
        itemId: sanitizeId(record.itemId),
        careerPathId: clampString(record.careerPathId, 64),
        moduleId: clampString(record.moduleId, 128),
        topic: clampString(record.topic, 120),
        score: Math.max(0, Math.round(record.score)),
        maxScore: Math.max(0, Math.round(record.maxScore)),
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function logExerciseAttempt(
  uid: string,
  attempt: Omit<ExerciseAttempt, 'id' | 'userId' | 'createdAt'>
): Promise<void> {
  const safeUid = sanitizeId(uid);
  const attemptId = sanitizeId(`att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const path = `exerciseAttempts/${attemptId}`;
  try {
    await setDoc(doc(db, 'exerciseAttempts', attemptId), {
      userId: safeUid,
      careerPathId: clampString(attempt.careerPathId, 64) || 'inventory',
      moduleId: clampString(attempt.moduleId, 128),
      exerciseId: clampString(attempt.exerciseId, 128) || 'exercise',
      exerciseTitle: clampString(attempt.exerciseTitle, 200) || 'Exercise',
      mode: attempt.mode,
      topic: clampString(attempt.topic, 120) || 'Excel Practice',
      score: Math.max(0, Math.round(attempt.score)),
      maxScore: Math.max(1, Math.round(attempt.maxScore)),
      accuracy: Math.max(0, Math.min(100, Math.round(attempt.accuracy))),
      passed: Boolean(attempt.passed),
      timeSpentSeconds: Math.max(0, Math.min(86400, Math.round(attempt.timeSpentSeconds))),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function issueCertificate(
  uid: string,
  cert: Omit<CertificateRecord, 'id' | 'userId' | 'issuedAt'>
): Promise<void> {
  const safeUid = sanitizeId(uid);
  const certId = sanitizeId(`cert_${safeUid}_${cert.moduleId}`);
  const path = `certificates/${certId}`;
  try {
    const snap = await getDoc(doc(db, 'certificates', certId));
    if (snap.exists()) return;
    await setDoc(doc(db, 'certificates', certId), {
      userId: safeUid,
      learnerName: clampString(cert.learnerName, 120) || 'Learner',
      careerPathId: clampString(cert.careerPathId, 64) || 'inventory',
      moduleId: clampString(cert.moduleId, 128),
      moduleTitle: clampString(cert.moduleTitle, 200),
      accuracy: Math.max(0, Math.min(100, Math.round(cert.accuracy))),
      issuedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeUserProfile(
  uid: string,
  onData: (profile: UserProfile | null) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const safeUid = sanitizeId(uid);
  const path = `users/${safeUid}`;
  return onSnapshot(
    doc(db, 'users', safeUid),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const d = snap.data();
      onData({
        uid: d.uid,
        fullName: d.fullName,
        email: d.email,
        careerPathId: d.careerPathId || '',
        onboardingComplete: Boolean(d.onboardingComplete),
        xp: Number(d.xp || 0),
        streakDays: Number(d.streakDays || 1),
        lastActiveDate: String(d.lastActiveDate || getTodayDateKey()),
        weeklyGoalItems: Number(d.weeklyGoalItems || 15),
        totalLearningSeconds: Number(d.totalLearningSeconds || 0),
        totalAttempts: Number(d.totalAttempts || 0),
        correctAttempts: Number(d.correctAttempts || 0),
        createdAt: toIsoString(d.createdAt),
        updatedAt: toIsoString(d.updatedAt),
      });
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export function subscribeUserProgress(
  uid: string,
  onData: (records: ProgressRecord[]) => void
): Unsubscribe {
  const safeUid = sanitizeId(uid);
  const path = `users/${safeUid}/progress`;
  return onSnapshot(
    collection(db, 'users', safeUid, 'progress'),
    (snap) => {
      const items: ProgressRecord[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          userId: d.userId,
          itemType: d.itemType,
          itemId: d.itemId,
          careerPathId: d.careerPathId,
          moduleId: d.moduleId,
          topic: d.topic,
          score: Number(d.score || 0),
          maxScore: Number(d.maxScore || 0),
          completedAt: toIsoString(d.completedAt),
          updatedAt: toIsoString(d.updatedAt),
        };
      });
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeUserAttempts(
  uid: string,
  onData: (attempts: ExerciseAttempt[]) => void
): Unsubscribe {
  const safeUid = sanitizeId(uid);
  const path = 'exerciseAttempts';
  const q = query(
    collection(db, 'exerciseAttempts'),
    where('userId', '==', safeUid),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: ExerciseAttempt[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          userId: d.userId,
          careerPathId: d.careerPathId,
          moduleId: d.moduleId,
          exerciseId: d.exerciseId,
          exerciseTitle: d.exerciseTitle,
          mode: d.mode,
          topic: d.topic,
          score: Number(d.score || 0),
          maxScore: Number(d.maxScore || 1),
          accuracy: Number(d.accuracy || 0),
          passed: Boolean(d.passed),
          timeSpentSeconds: Number(d.timeSpentSeconds || 0),
          createdAt: toIsoString(d.createdAt),
        };
      });
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeUserCertificates(
  uid: string,
  onData: (certs: CertificateRecord[]) => void
): Unsubscribe {
  const safeUid = sanitizeId(uid);
  const path = 'certificates';
  const q = query(collection(db, 'certificates'), where('userId', '==', safeUid));
  return onSnapshot(
    q,
    (snap) => {
      const items: CertificateRecord[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          userId: d.userId,
          learnerName: d.learnerName,
          careerPathId: d.careerPathId,
          moduleId: d.moduleId,
          moduleTitle: d.moduleTitle,
          accuracy: Number(d.accuracy || 100),
          issuedAt: toIsoString(d.issuedAt),
        };
      });
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribePublishedCustomContent(
  isAdminUser: boolean,
  onData: (items: CustomContentRecord[]) => void
): Unsubscribe {
  const path = 'customContent';
  const q = isAdminUser
    ? query(collection(db, 'customContent'))
    : query(collection(db, 'customContent'), where('published', '==', true));

  return onSnapshot(
    q,
    (snap) => {
      const items: CustomContentRecord[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          contentType: d.contentType,
          careerPathId: d.careerPathId,
          moduleId: d.moduleId,
          title: d.title,
          summary: d.summary,
          difficulty: d.difficulty,
          published: Boolean(d.published),
          targetCell: d.targetCell || '',
          expectedFormula: d.expectedFormula || '',
          expectedValue: d.expectedValue || '',
          hint: d.hint || '',
          explanation: d.explanation || '',
          datasetRows: Array.isArray(d.datasetRows) ? d.datasetRows : [],
          createdBy: d.createdBy,
          createdAt: toIsoString(d.createdAt),
          updatedAt: toIsoString(d.updatedAt),
        };
      });
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function checkIsAdminDocument(uid: string): Promise<boolean> {
  const safeUid = sanitizeId(uid);
  try {
    const snap = await getDoc(doc(db, 'admins', safeUid));
    return snap.exists();
  } catch {
    return false;
  }
}

// Admin-only operations
export async function fetchAllLearnersAdmin(): Promise<UserProfile[]> {
  const path = 'users';
  try {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map((docSnap) => {
      const d = docSnap.data();
      return {
        uid: d.uid,
        fullName: d.fullName,
        email: d.email,
        careerPathId: d.careerPathId || '',
        onboardingComplete: Boolean(d.onboardingComplete),
        xp: Number(d.xp || 0),
        streakDays: Number(d.streakDays || 0),
        lastActiveDate: String(d.lastActiveDate || ''),
        weeklyGoalItems: Number(d.weeklyGoalItems || 15),
        totalLearningSeconds: Number(d.totalLearningSeconds || 0),
        totalAttempts: Number(d.totalAttempts || 0),
        correctAttempts: Number(d.correctAttempts || 0),
        createdAt: toIsoString(d.createdAt),
        updatedAt: toIsoString(d.updatedAt),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchAllAttemptsAdmin(): Promise<ExerciseAttempt[]> {
  const path = 'exerciseAttempts';
  try {
    const snap = await getDocs(collection(db, 'exerciseAttempts'));
    return snap.docs.map((docSnap) => {
      const d = docSnap.data();
      return {
        id: docSnap.id,
        userId: d.userId,
        careerPathId: d.careerPathId,
        moduleId: d.moduleId,
        exerciseId: d.exerciseId,
        exerciseTitle: d.exerciseTitle,
        mode: d.mode,
        topic: d.topic,
        score: Number(d.score || 0),
        maxScore: Number(d.maxScore || 1),
        accuracy: Number(d.accuracy || 0),
        passed: Boolean(d.passed),
        timeSpentSeconds: Number(d.timeSpentSeconds || 0),
        createdAt: toIsoString(d.createdAt),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function createCustomContentAdmin(
  adminUid: string,
  input: {
    contentType: 'careerPath' | 'module' | 'concept' | 'exercise' | 'simulation';
    careerPathId: string;
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
    datasetRows?: string[];
  }
): Promise<string> {
  const contentId = sanitizeId(`cnt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const path = `customContent/${contentId}`;
  const cleanRows = (input.datasetRows || []).map((r) => clampString(r, 300)).slice(0, 50);

  try {
    await setDoc(doc(db, 'customContent', contentId), {
      contentType: input.contentType,
      careerPathId: clampString(input.careerPathId, 64) || 'inventory',
      moduleId: clampString(input.moduleId, 128),
      title: clampString(input.title, 200),
      summary: clampString(input.summary, 1000),
      difficulty: input.difficulty,
      published: Boolean(input.published),
      targetCell: clampString(input.targetCell, 20),
      expectedFormula: clampString(input.expectedFormula, 200),
      expectedValue: clampString(input.expectedValue, 200),
      hint: clampString(input.hint, 500),
      explanation: clampString(input.explanation, 1500),
      datasetRows: cleanRows,
      createdBy: sanitizeId(adminUid),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return contentId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateCustomContentAdmin(
  contentId: string,
  updates: Partial<{
    title: string;
    summary: string;
    difficulty: DifficultyLevel;
    published: boolean;
    targetCell: string;
    expectedFormula: string;
    expectedValue: string;
    hint: string;
    explanation: string;
    datasetRows: string[];
  }>
): Promise<void> {
  const safeId = sanitizeId(contentId);
  const path = `customContent/${safeId}`;
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (updates.title !== undefined) payload.title = clampString(updates.title, 200);
  if (updates.summary !== undefined) payload.summary = clampString(updates.summary, 1000);
  if (updates.difficulty !== undefined) payload.difficulty = updates.difficulty;
  if (updates.published !== undefined) payload.published = Boolean(updates.published);
  if (updates.targetCell !== undefined) payload.targetCell = clampString(updates.targetCell, 20);
  if (updates.expectedFormula !== undefined) payload.expectedFormula = clampString(updates.expectedFormula, 200);
  if (updates.expectedValue !== undefined) payload.expectedValue = clampString(updates.expectedValue, 200);
  if (updates.hint !== undefined) payload.hint = clampString(updates.hint, 500);
  if (updates.explanation !== undefined) payload.explanation = clampString(updates.explanation, 1500);
  if (updates.datasetRows !== undefined) {
    payload.datasetRows = updates.datasetRows.map((r) => clampString(r, 300)).slice(0, 50);
  }

  try {
    await updateDoc(doc(db, 'customContent', safeId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCustomContentAdmin(contentId: string): Promise<void> {
  const safeId = sanitizeId(contentId);
  const path = `customContent/${safeId}`;
  try {
    await deleteDoc(doc(db, 'customContent', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
