import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as fbSignOut, 
  updateProfile 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import { UserProfile, UserRole } from '../types';

export const ADMIN_EMAIL = 'jamesbontuyan84@gmail.com';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  isAuthReady: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const snap = await getDoc(userDocRef);
          const isUserAdmin = user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

          if (snap.exists()) {
            const data = snap.data() as UserProfile;
            // Ensure runtime admin email gets admin role
            if (isUserAdmin && data.role !== 'admin') {
              const updated: UserProfile = { ...data, role: 'admin' };
              await setDoc(userDocRef, { role: 'admin' }, { merge: true });
              setUserProfile(updated);
            } else {
              setUserProfile(data);
            }
          } else {
            // Create user profile
            const now = new Date().toISOString();
            const newProfile: UserProfile = {
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || 'Customer',
              role: isUserAdmin ? 'admin' : 'customer',
              accountStatus: 'active',
              createdAt: now,
              updatedAt: now
            };
            await setDoc(userDocRef, newProfile);
            setUserProfile(newProfile);

            // Also register in admins collection if admin email
            if (isUserAdmin) {
              await setDoc(doc(db, 'admins', user.uid), {
                uid: user.uid,
                email: user.email,
                createdAt: now
              });
            }
          }
        } catch (err) {
          console.error('Error fetching or creating user profile:', err);
          // Fallback in-memory profile
          setUserProfile({
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || 'Customer',
            role: user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() ? 'admin' : 'customer',
            accountStatus: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      } else {
        setUserProfile(null);
      }
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const signInWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signUpWithEmail = async (email: string, pass: string, name: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    if (cred.user) {
      await updateProfile(cred.user, { displayName: name });
    }
  };

  const signOut = async () => {
    await fbSignOut(auth);
  };

  const isAdmin = 
    currentUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() || 
    userProfile?.role === 'admin';

  return (
    <AuthContext.Provider value={{
      currentUser,
      userProfile,
      isAdmin,
      isAuthReady,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
