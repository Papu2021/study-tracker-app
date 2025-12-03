import React, { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import LoginPage from './pages/LoginPage';
import StudentDashboard from './pages/StudentDashboard';
import AdminDashboard from './pages/AdminDashboard';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { Loader2, Layout, Sparkles } from 'lucide-react';
import { doc, getDoc, setDoc, addDoc, collection } from 'firebase/firestore';
import { db } from './firebase';

// Shared Loading Component for consistent visuals
const LoadingScreen: React.FC<{ message: string; subMessage?: string }> = ({ message, subMessage }) => (
  <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 relative overflow-hidden font-sans">
    {/* Background Ambience */}
    <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
      <div className="absolute -top-20 -left-20 w-96 h-96 bg-brand-600/10 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-[100px]"></div>
    </div>

    <div className="relative z-10 flex flex-col items-center">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-amber-500/20 blur-xl rounded-full"></div>
        <div className="relative bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-2xl">
          <Layout className="w-8 h-8 text-amber-500 animate-pulse" />
        </div>
      </div>
      
      <div className="flex items-center gap-3 text-white text-lg font-medium">
        <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
        {message}
      </div>
      {subMessage && (
        <p className="text-slate-500 text-sm mt-2">{subMessage}</p>
      )}
    </div>
  </div>
);

const ProfileSetup: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    const initProfile = async () => {
      if (!user) return;
      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          // Profile exists, just refresh context
          await refreshProfile();
        } else {
          // Profile does not exist, create default STUDENT profile
          console.log("Creating default profile for new user...");
          const displayName = user.displayName || user.email?.split('@')[0] || 'Student';
          
          await setDoc(userRef, {
            uid: user.uid,
            email: user.email,
            displayName: displayName,
            photoURL: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
            role: 'STUDENT',
            bio: 'Ready to learn!',
            createdAt: Date.now(),
            requiresPasswordChange: false
          });

          // Notify Admin of New Signup
          await addDoc(collection(db, 'notifications'), {
            type: 'info',
            message: `New student '${displayName}' just joined.`,
            createdAt: Date.now(),
            read: false,
            studentId: user.uid
          });

          await refreshProfile();
        }
      } catch (err) {
        console.error("Profile setup error:", err);
        setError("Failed to load user profile. Please check your connection.");
      }
    };

    initProfile();
  }, [user, refreshProfile]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-center p-6">
        <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-xl max-w-sm w-full">
          <div className="w-12 h-12 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-6 h-6 text-red-500" />
          </div>
          <p className="text-red-400 mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return <LoadingScreen message="Setting up your workspace..." subMessage="Preparing your dashboard" />;
};

const AppContent: React.FC = () => {
  const { user, loading, userProfile, loadingProfile } = useAuth();

  // 1. Initial App Loading (checking Firebase Auth state)
  if (loading) {
    return <LoadingScreen message="Initializing..." />;
  }

  // 2. Not Logged In
  if (!user) {
    return <LoginPage />;
  }

  // 3. Profile Syncing (Transition State)
  if (loadingProfile) {
    return <LoadingScreen message="Syncing profile..." subMessage="Retrieving your data" />;
  }

  // 4. Missing Profile (Need Setup)
  if (!userProfile) {
    return <ProfileSetup />;
  }

  // 5. Force password change if flag is set on profile
  if (userProfile.requiresPasswordChange) {
    return <ChangePasswordModal />;
  }

  // 6. Role Based Routing
  if (userProfile.role === 'ADMIN') {
    return <AdminDashboard />;
  }

  // 7. Student Dashboard
  return <StudentDashboard />;
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}