import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  Table2,
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { CreditFooter } from '../layout/CreditFooter';

type AuthMode = 'login' | 'register' | 'forgot';

function mapAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('auth/operation-not-allowed')) {
    return 'Email/Password sign-in is not yet enabled in Firebase Console (Authentication → Sign-in method). Please use "Continue with Google" below, or enable Email/Password in your Firebase Console.';
  }
  if (msg.includes('auth/email-already-in-use')) {
    return 'An account with this email already exists. Try logging in instead.';
  }
  if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password') || msg.includes('auth/user-not-found')) {
    return 'Incorrect email or password. Please check your credentials and try again.';
  }
  if (msg.includes('auth/weak-password')) {
    return 'Password should be at least 6 characters long.';
  }
  if (msg.includes('auth/popup-closed-by-user')) {
    return 'Google sign-in window was closed before completing login.';
  }
  if (msg.includes('auth/too-many-requests')) {
    return 'Too many attempts. Please wait a minute and try again.';
  }
  return msg.replace('Firebase: ', '');
}

export const AuthScreen: React.FC = () => {
  const {
    needsEmailVerification,
    firebaseUser,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    sendResetPassword,
    resendVerificationEmail,
    refreshVerificationStatus,
    enterDemoMode,
    logout,
  } = useApp();

  const [mode, setMode] = useState<AuthMode>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (needsEmailVerification && firebaseUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-8">
          <div className="w-11 h-11 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center mb-5">
            <Mail className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Verify your email address</h1>
          <p className="text-sm text-slate-600 leading-relaxed mb-5">
            We sent a verification link to{' '}
            <strong className="text-slate-900">{firebaseUser.email}</strong>. Open your inbox, click
            the link, and then press the button below to enter ExcelGym.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {info && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{info}</span>
            </div>
          )}

          <div className="space-y-2.5">
            <button
              type="button"
              disabled={submitting}
              onClick={async () => {
                setSubmitting(true);
                setError(null);
                setInfo(null);
                try {
                  const ok = await refreshVerificationStatus();
                  if (!ok) {
                    setError('Your email is not verified yet. Please click the verification link in your inbox first.');
                  }
                } catch (e) {
                  setError(mapAuthError(e));
                } finally {
                  setSubmitting(false);
                }
              }}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" />
              <span>I Have Verified — Continue</span>
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={async () => {
                setSubmitting(true);
                setError(null);
                try {
                  await resendVerificationEmail();
                  setInfo('Verification email resent! Please check your inbox and spam folder.');
                } catch (e) {
                  setError(mapAuthError(e));
                } finally {
                  setSubmitting(false);
                }
              }}
              className="w-full py-2.5 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-medium rounded-lg transition-colors"
            >
              Resend Verification Email
            </button>

            <button
              type="button"
              onClick={() => void logout()}
              className="w-full py-2 text-xs text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1.5 mt-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign out and use another account</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (mode === 'forgot') {
      setSubmitting(true);
      try {
        await sendResetPassword(email);
        setInfo('Password reset link sent! Check your email inbox to choose a new password.');
      } catch (err) {
        setError(mapAuthError(err));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (mode === 'register') {
      if (fullName.trim().length < 2) {
        setError('Please enter your full name.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
      } else {
        await registerWithEmail(fullName, email, password);
      }
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 grid lg:grid-cols-12">
      {/* Left Brand & Value Column */}
      <div className="lg:col-span-6 bg-slate-900 text-white p-8 sm:p-12 lg:p-16 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-12">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
              <Table2 className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">ExcelGym</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight max-w-lg mb-4">
            Learn Excel. Practise Excel. Get Job Ready.
          </h1>
          <p className="text-slate-300 text-base leading-relaxed max-w-lg mb-10">
            Step-by-step career training for absolute beginners. Write real formulas inside a live
            interactive spreadsheet, complete graded job scenarios, and prepare for Inventory, Store,
            Banking, and MIS roles.
          </p>

          <div className="space-y-4 max-w-md border-t border-slate-800 pt-8">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-white">4 Career Paths · 48 Structured Modules</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Every module unlocks progressively across 4 stages (10 concepts + 10 graded spreadsheet exercises).
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-white">Live Excel-Like Formula Engine</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Supports SUM, IF, SUMIF, COUNTIF, VLOOKUP, XLOOKUP, PMT, drag-to-fill, sorting, filtering &amp; formatting.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-white">Real Indian Workplace Simulations</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Solve realistic ₹ warehouse, retail store, banking ledger, loan EMI, and HR payroll cases.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-800 flex items-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
          <span>Individual learner progress synced securely with Firebase Authentication &amp; Cloud Firestore.</span>
        </div>
      </div>

      {/* Right Authentication Form Column */}
      <div className="lg:col-span-6 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-7 sm:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900">
              {mode === 'login'
                ? 'Sign in to your account'
                : mode === 'register'
                ? 'Create your learner account'
                : 'Reset your password'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {mode === 'login'
                ? 'Resume your Excel career path and saved progress.'
                : mode === 'register'
                ? 'Start from zero and build verified workplace Excel skills.'
                : 'Enter your registered email to receive a reset link.'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {info && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{info}</span>
            </div>
          )}

          {/* Google Sign-In Primary Option */}
          {mode !== 'forgot' && (
            <>
              <button
                type="button"
                disabled={submitting}
                onClick={handleGoogle}
                className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 flex items-center justify-center gap-2.5 transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                  />
                  <path
                    fill="#34A853"
                    d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 000 10.76l3.98-3.09z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-slate-400">or use email and password</span>
                </div>
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Rohan Deshmukh"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">Password</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setError(null);
                        setInfo(null);
                      }}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {mode === 'forgot' ? <KeyRound className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              <span>
                {submitting
                  ? 'Please wait...'
                  : mode === 'login'
                  ? 'Sign In'
                  : mode === 'register'
                  ? 'Create Account'
                  : 'Send Password Reset Link'}
              </span>
            </button>
          </form>

          <div className="mt-5 text-center text-xs text-slate-600">
            {mode === 'login' ? (
              <>
                New to ExcelGym?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                    setInfo(null);
                  }}
                  className="font-semibold text-blue-600 hover:underline"
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                    setInfo(null);
                  }}
                  className="font-semibold text-blue-600 hover:underline"
                >
                  Sign in
                </button>
              </>
            )}
          </div>

          {/* Clearly separated Offline Demo Mode */}
          <div className="mt-6 pt-5 border-t border-slate-200">
            <button
              type="button"
              onClick={enterDemoMode}
              className="w-full py-2 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 transition-colors"
            >
              Explore Local Demo Mode (Browser-only, no Cloud Sync)
            </button>
          </div>
          <CreditFooter className="mt-6 border-t-0 bg-transparent py-2" />
        </div>
      </div>
    </div>
  );
};
