'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  Award,
  Briefcase,
  CalendarRange,
  CheckCircle2,
  Circle,
  GraduationCap,
  Layers,
  Loader2,
  Lock,
  PartyPopper,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import type { DashboardSummary } from '../../lib/types';
import { ErrorState } from '../ui/ErrorState';

const EASE = [0.16, 1, 0.3, 1] as const;

type StepStatus = 'locked' | 'incomplete' | 'in-progress' | 'completed';

interface StepDef {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  status: StepStatus;
  lockReason?: string;
  lockActionHref?: string;
}

type SetupBooleans = DashboardSummary['setup'];

function skipKey(userId?: string) {
  return `nuruddeen_onboarding_skipped_${userId || 'admin'}`;
}
function ackKey(userId?: string) {
  return `nuruddeen_onboarding_ack_${userId || 'admin'}`;
}

function buildSteps(data: SetupBooleans): StepDef[] {
  const { hasSession, hasTerm, hasClasses, hasSubjects, hasStaff, hasStudents } = data;

  return [
    {
      id: 'session',
      title: 'Academic Session & Term',
      description: 'Create your academic session and set the current term.',
      icon: CalendarRange,
      href: '/admin/academic',
      status: !hasSession ? 'incomplete' : !hasTerm ? 'in-progress' : 'completed',
    },
    {
      id: 'classes',
      title: 'Classes',
      description: 'Set up your classes from Nursery through SSS3.',
      icon: Layers,
      href: '/admin/classes',
      status: hasClasses ? 'completed' : 'incomplete',
    },
    {
      id: 'subjects',
      title: 'Subjects',
      description: 'Create and organize the subjects taught at your school.',
      icon: Award,
      href: '/admin/subjects',
      status: hasSubjects ? 'completed' : 'incomplete',
    },
    {
      id: 'staff',
      title: 'Staff',
      description: 'Add staff members and assign them to classes and subjects.',
      icon: Briefcase,
      href: '/admin/staff',
      status: hasStaff ? 'completed' : 'incomplete',
    },
    {
      id: 'students',
      title: 'Students & Guardians',
      description: 'Enroll students and configure guardian portal access.',
      icon: GraduationCap,
      href: '/admin/students',
      status: !hasClasses ? 'locked' : hasStudents ? 'completed' : 'incomplete',
      lockReason: !hasClasses ? 'Create a class before enrolling students.' : undefined,
      lockActionHref: '/admin/classes',
    },
  ];
}

const STATUS_LABEL: Record<StepStatus, string> = {
  locked: 'Complete previous setup first',
  incomplete: 'Set up',
  'in-progress': 'Continue',
  completed: 'Completed',
};

interface OnboardingSetupProps {
  /** Setup-progress booleans from the shared /api/dashboard/summary
   *  request (fetched once by the parent dashboard page) — null while
   *  that request is still in flight. */
  setup: SetupBooleans | null;
  error: boolean;
  onRetry: () => void;
}

export function OnboardingSetup({ setup, error, onRetry }: OnboardingSetupProps) {
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();

  const [skipped, setSkipped] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [justCompletedStep, setJustCompletedStep] = useState<string | null>(null);

  const prevCompletedIds = useRef<Set<string> | null>(null);
  const bannerTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSkipped(window.localStorage.getItem(skipKey(user?.id)) === 'true');
    setAcknowledged(window.localStorage.getItem(ackKey(user?.id)) === 'true');
  }, [user?.id]);

  const steps = useMemo(() => (setup ? buildSteps(setup) : null), [setup]);
  const completedCount = steps ? steps.filter((s) => s.status === 'completed').length : 0;
  const allDone = steps ? completedCount === steps.length : false;

  // Detect a step transitioning into 'completed' to fire a subtle success beat.
  useEffect(() => {
    if (!steps) return;
    const currentCompleted = new Set(steps.filter((s) => s.status === 'completed').map((s) => s.id));
    if (prevCompletedIds.current) {
      const newlyDone = [...currentCompleted].find((id) => !prevCompletedIds.current!.has(id));
      if (newlyDone) {
        setJustCompletedStep(newlyDone);
        if (bannerTimeout.current) clearTimeout(bannerTimeout.current);
        bannerTimeout.current = setTimeout(() => setJustCompletedStep(null), 3200);
      }
    }
    prevCompletedIds.current = currentCompleted;
  }, [steps]);

  useEffect(() => () => {
    if (bannerTimeout.current) clearTimeout(bannerTimeout.current);
  }, []);

  function handleSkip() {
    window.localStorage.setItem(skipKey(user?.id), 'true');
    setSkipped(true);
  }

  function handleContinueSetup() {
    window.localStorage.removeItem(skipKey(user?.id));
    setSkipped(false);
  }

  function handleAcknowledgeComplete() {
    window.localStorage.setItem(ackKey(user?.id), 'true');
    setAcknowledged(true);
  }

  // Already fully set up and acknowledged - stay out of the admin's way for good.
  if (acknowledged && allDone) return null;

  if (error) {
    return (
      <div className="panel onboarding-panel">
        <ErrorState
          kind="server"
          description="Couldn't load your setup progress. Please try again."
          onRetry={onRetry}
          compact
        />
      </div>
    );
  }

  if (!setup || !steps) {
    return (
      <div className="panel onboarding-panel">
        <div className="onboarding-skeleton">
          <div className="skeleton" style={{ width: 220, height: 22 }} />
          <div className="skeleton" style={{ width: '100%', height: 8, marginTop: 14 }} />
          <div className="skeleton" style={{ width: '100%', height: 56, marginTop: 16 }} />
          <div className="skeleton" style={{ width: '100%', height: 56, marginTop: 10 }} />
        </div>
      </div>
    );
  }

  // Fully done, not yet acknowledged - show the completion moment once.
  if (allDone) {
    return (
      <motion.div
        className="panel onboarding-panel onboarding-complete"
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        <motion.div
          className="onboarding-complete-badge"
          initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.45, ease: EASE, delay: 0.1 }}
        >
          <PartyPopper size={26} />
        </motion.div>
        <h3 className="onboarding-complete-title">You&apos;re all set! 🎉</h3>
        <p className="onboarding-complete-sub">Your school is ready to use Nuruddeen SMS.</p>
        <button type="button" className="btn" onClick={handleAcknowledgeComplete}>
          Continue to dashboard
        </button>
      </motion.div>
    );
  }

  // Skipped while incomplete - compact reminder only.
  if (skipped) {
    return (
      <motion.button
        type="button"
        className="onboarding-reminder"
        onClick={handleContinueSetup}
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
      >
        <span className="onboarding-reminder-icon">
          <CalendarRange size={16} />
        </span>
        <span className="onboarding-reminder-text">
          <strong>Your school setup is incomplete</strong>
          <span>
            {completedCount} of {steps.length} steps completed.
          </span>
        </span>
        <span className="onboarding-reminder-cta">
          Continue setup <ArrowRight size={14} />
        </span>
      </motion.button>
    );
  }

  const progressPct = Math.round((completedCount / steps.length) * 100);
  const justCompletedTitle = steps.find((s) => s.id === justCompletedStep)?.title;

  return (
    <motion.div
      className="panel onboarding-panel"
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <div className="onboarding-header">
        <div>
          <h3 className="onboarding-title">Welcome to Nuruddeen SMS 👋</h3>
          <p className="onboarding-subtitle">
            Let&apos;s get your school ready. Complete a few setup steps before you start managing your school.
          </p>
        </div>
        <div className="onboarding-progress-chip">
          <span className="onboarding-progress-count">
            {completedCount} of {steps.length}
          </span>
          <span className="onboarding-progress-caption">completed</span>
        </div>
      </div>

      <div className="onboarding-progress-track" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100} aria-label="School setup progress">
        <motion.div
          className="onboarding-progress-fill"
          initial={false}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.5, ease: EASE }}
        />
      </div>

      <AnimatePresence>
        {justCompletedTitle && (
          <motion.div
            className="onboarding-success-banner"
            role="status"
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 10 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
          >
            <CheckCircle2 size={15} />
            <span>{justCompletedTitle} is set up. Nice work.</span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.ul
        className="onboarding-steps"
        role="list"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: reduceMotion ? 0 : 0.06 } },
        }}
      >
        {steps.map((step) => (
          <OnboardingStep key={step.id} step={step} reduceMotion={!!reduceMotion} />
        ))}
      </motion.ul>

      <div className="onboarding-footer">
        <button type="button" className="onboarding-skip" onClick={handleSkip}>
          Skip for now
        </button>
      </div>
    </motion.div>
  );
}

function OnboardingStep({ step, reduceMotion }: { step: StepDef; reduceMotion: boolean }) {
  const Icon = step.icon;
  const isLocked = step.status === 'locked';
  const isCompleted = step.status === 'completed';
  const isInProgress = step.status === 'in-progress';

  const itemVariants = {
    hidden: { opacity: 0, y: reduceMotion ? 0 : 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } },
  };

  const body = (
    <>
      <span className={`onboarding-step-icon status-${step.status}`}>
        {isCompleted ? (
          <motion.span
            initial={reduceMotion ? false : { scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            <CheckCircle2 size={18} />
          </motion.span>
        ) : isLocked ? (
          <Lock size={16} />
        ) : (
          <Icon size={18} />
        )}
      </span>

      <span className="onboarding-step-body">
        <span className="onboarding-step-title">{step.title}</span>
        <span className="onboarding-step-desc">
          {isLocked && step.lockReason ? step.lockReason : step.description}
        </span>
      </span>

      <span className={`onboarding-step-status status-${step.status}`}>
        {isInProgress && !reduceMotion && <Loader2 size={13} className="onboarding-spin" />}
        {isCompleted ? <CheckCircle2 size={13} /> : !isLocked ? <Circle size={11} /> : null}
        {STATUS_LABEL[step.status]}
        {!isLocked && !isCompleted && <ArrowRight size={13} />}
      </span>
    </>
  );

  if (isLocked) {
    return (
      <motion.li variants={itemVariants} className="onboarding-step is-locked" aria-disabled="true">
        <span className="onboarding-step-inner">{body}</span>
        {step.lockActionHref && (
          <Link href={step.lockActionHref} className="onboarding-setup-now">
            Set up now <ArrowRight size={12} />
          </Link>
        )}
      </motion.li>
    );
  }

  return (
    <motion.li variants={itemVariants} className={`onboarding-step status-${step.status}`}>
      <Link href={step.href} className="onboarding-step-inner">
        {body}
      </Link>
    </motion.li>
  );
}
