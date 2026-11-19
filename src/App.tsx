import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Table2 } from 'lucide-react';
import { AppProvider, useApp } from './contexts/AppContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthScreen } from './components/auth/AuthScreen';
import { OnboardingScreen } from './components/auth/OnboardingScreen';
import { AppShell } from './components/layout/AppShell';
import { DashboardView } from './components/dashboard/DashboardView';
import { CareerPathsView } from './components/learning/CareerPathsView';
import { MyLearningView } from './components/learning/MyLearningView';
import { ConceptLessonView } from './components/learning/ConceptLessonView';
import { PracticeLibraryView } from './components/practice/PracticeLibraryView';
import { PracticeWorkspace } from './components/practice/PracticeWorkspace';
import { MixedPracticeView } from './components/practice/MixedPracticeView';
import { WorkplaceSimulationView } from './components/simulations/WorkplaceSimulationView';
import { AchievementsView } from './components/progress/AchievementsView';
import { MyProgressView } from './components/progress/MyProgressView';
import { ProfileView } from './components/profile/ProfileView';
import { AdminPanelView } from './components/admin/AdminPanelView';
import { getModuleById, getStageId } from './data/curriculum';
import type { CurriculumModule, ExerciseItem } from './types';

interface ConceptSession {
  module: CurriculumModule;
  stageNumber: 1 | 3;
  initialIndex: number;
}

interface PracticeSession {
  exercises: ExerciseItem[];
  initialIndex: number;
  headerTitle: string;
  stageNumber?: 2 | 4;
  moduleId?: string;
}

const AcademyContent: React.FC = () => {
  const {
    authLoading,
    profile,
    needsEmailVerification,
    activeView,
    setActiveView,
    completedStageIds,
  } = useApp();

  const [conceptSession, setConceptSession] = useState<ConceptSession | null>(null);
  const [practiceSession, setPracticeSession] = useState<PracticeSession | null>(null);
  const [viewFocusMode, setViewFocusMode] = useState(false);
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);

  // Reset active sessions if user signs out
  useEffect(() => {
    if (!profile) {
      setConceptSession(null);
      setPracticeSession(null);
      setViewFocusMode(false);
    }
  }, [profile]);

  const handleOpenStage = useCallback(
    (moduleId: string, stageNumber: 1 | 2 | 3 | 4, itemIndex = 0) => {
      const mod = getModuleById(moduleId);
      if (!mod) return;
      setExpandedModuleId(moduleId);
      const stage = mod.stages[stageNumber - 1];

      if (stage.kind === 'concepts' && stage.concepts && stage.concepts.length > 0) {
        setPracticeSession(null);
        setConceptSession({
          module: mod,
          stageNumber: stageNumber as 1 | 3,
          initialIndex: Math.min(itemIndex, stage.concepts.length - 1),
        });
      } else if (stage.kind === 'practice' && stage.exercises && stage.exercises.length > 0) {
        setConceptSession(null);
        setPracticeSession({
          exercises: stage.exercises,
          initialIndex: Math.min(itemIndex, stage.exercises.length - 1),
          headerTitle: `Module ${mod.order}: ${mod.title} · Stage ${stageNumber}`,
          stageNumber: stageNumber as 2 | 4,
          moduleId: mod.id,
        });
      }
    },
    []
  );

  const handleLaunchModule = useCallback(
    (moduleId: string, stageNumber?: 1 | 2 | 3 | 4) => {
      setExpandedModuleId(moduleId);
      if (stageNumber) {
        const isUnlocked =
          stageNumber === 1 ||
          completedStageIds.has(getStageId(moduleId, (stageNumber - 1) as 1 | 2 | 3));
        if (isUnlocked) {
          handleOpenStage(moduleId, stageNumber, 0);
          return;
        }
      }
      setActiveView('my-learning');
    },
    [completedStageIds, handleOpenStage, setActiveView]
  );

  const handleLaunchPracticeList = useCallback(
    (exercises: ExerciseItem[], index: number, title: string) => {
      setConceptSession(null);
      setPracticeSession({
        exercises,
        initialIndex: index,
        headerTitle: title,
      });
    },
    []
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center mb-4">
          <Table2 className="w-5 h-5 text-white" />
        </div>
        <div className="text-base font-bold text-slate-900">ExcelGym</div>
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
          <span>Loading your learning workspace...</span>
        </div>
      </div>
    );
  }

  if (!profile || needsEmailVerification) {
    return <AuthScreen />;
  }

  if (!profile.onboardingComplete) {
    return <OnboardingScreen />;
  }

  // Distraction-free Concept Learning Session
  if (conceptSession) {
    const stage = conceptSession.module.stages[conceptSession.stageNumber - 1];
    return (
      <AppShell focusMode>
        <ConceptLessonView
          module={conceptSession.module}
          stageNumber={conceptSession.stageNumber}
          concepts={stage.concepts || []}
          initialIndex={conceptSession.initialIndex}
          onExit={() => {
            setConceptSession(null);
            setActiveView('my-learning');
          }}
          onProceedToPractice={(nextStage) => {
            handleOpenStage(conceptSession.module.id, nextStage, 0);
          }}
        />
      </AppShell>
    );
  }

  // Distraction-free Guided / Library Practice Session
  if (practiceSession) {
    return (
      <AppShell focusMode>
        <PracticeWorkspace
          exercises={practiceSession.exercises}
          initialIndex={practiceSession.initialIndex}
          headerTitle={practiceSession.headerTitle}
          stageNumber={practiceSession.stageNumber}
          onExit={() => {
            setPracticeSession(null);
          }}
          onStageFinished={() => {
            if (practiceSession.moduleId && practiceSession.stageNumber === 2) {
              handleOpenStage(practiceSession.moduleId, 3, 0);
            } else {
              setPracticeSession(null);
              setActiveView('my-learning');
            }
          }}
        />
      </AppShell>
    );
  }

  return (
    <AppShell focusMode={viewFocusMode}>
      {activeView === 'dashboard' && <DashboardView onLaunchModule={handleLaunchModule} />}
      {activeView === 'career-paths' && <CareerPathsView />}
      {activeView === 'my-learning' && (
        <MyLearningView
          onOpenStage={handleOpenStage}
          initialExpandedModuleId={expandedModuleId}
        />
      )}
      {activeView === 'practice' && (
        <PracticeLibraryView onLaunchExercise={handleLaunchPracticeList} />
      )}
      {activeView === 'mixed-practice' && (
        <MixedPracticeView onFocusChange={setViewFocusMode} />
      )}
      {activeView === 'simulations' && (
        <WorkplaceSimulationView onFocusModeChange={setViewFocusMode} />
      )}
      {activeView === 'achievements' && <AchievementsView />}
      {activeView === 'progress' && <MyProgressView onLaunchModule={handleLaunchModule} />}
      {activeView === 'profile' && <ProfileView />}
      {activeView === 'admin' && <AdminPanelView />}
    </AppShell>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AcademyContent />
      </AppProvider>
    </ErrorBoundary>
  );
}
