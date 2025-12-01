import React, { useState } from 'react';
import { updatePassword } from 'firebase/auth';
import { updateDoc, doc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { ShieldCheck, Lock, Eye, EyeOff, Sparkles, CheckCircle2 } from 'lucide-react';

export const ChangePasswordModal: React.FC = () => {
  const { user, refreshProfile, logout, userProfile } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      await updatePassword(user, newPassword);
      // Important: Turn off the flag so they aren't asked again
      await updateDoc(doc(db, 'users', user.uid), {
        requiresPasswordChange: false
      });
      await refreshProfile();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/requires-recent-login') {
        setError('For security, please sign out and sign in again to change your password.');
      } else {
        setError(err.message || 'Failed to update password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Get the first name for a personal touch
  const firstName = userProfile?.displayName?.split(' ')[0] || 'Student';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/95 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-300 relative">
        
        {/* Decorative background element */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-400 to-brand-600"></div>

        <div className="p-8 text-center bg-slate-50/50 dark:bg-slate-800/50">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-brand-100 dark:bg-brand-900/30 mb-4 shadow-sm border border-brand-200 dark:border-brand-800">
            <Sparkles className="h-8 w-8 text-brand-600 dark:text-brand-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Welcome, {firstName}!</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm leading-relaxed">
            Let's get your account set up. Please create a personal password to secure your account.
          </p>
        </div>

        <div className="px-8 pb-8 pt-6">
          {error && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg flex items-center gap-2 animate-in slide-in-from-top-2">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">New Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Create a strong password"
                  required
                  disabled={loading}
                  className="pr-10"
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  tabIndex={-1}
                >
                   {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Confirm Password</label>
              <div className="relative">
                 <Lock className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                 <Input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  required
                  disabled={loading}
                  className="pl-10"
                  minLength={6}
                />
              </div>
            </div>

            <div className="pt-2">
              <Button 
                type="submit" 
                className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 shadow-lg shadow-brand-900/20"
                isLoading={loading}
              >
                Set Password & Access Dashboard
              </Button>
            </div>
          </form>

          <div className="mt-6 text-center pt-4 border-t border-slate-100 dark:border-slate-700/50">
            <button 
              onClick={logout}
              className="text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              Log out and do this later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};