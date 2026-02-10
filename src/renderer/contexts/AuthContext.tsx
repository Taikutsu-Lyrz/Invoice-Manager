import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
    User,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail
} from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { syncService } from '../services/syncService';

interface UserProfile {
    uid: string;
    email: string;
    displayName: string;
    role: 'mother' | 'child';
    tenantId: string;
    createdAt: any;
}

interface AuthContextType {
    user: User | null;
    userProfile: UserProfile | null;
    loading: boolean;
    isMother: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, companyName: string) => Promise<void>;
    logout: () => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    createChildUser: (email: string, password: string, displayName: string, motherPassword: string) => Promise<void>;
    deleteUser: (userId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);

            if (firebaseUser) {
                // Fetch user profile from Firestore
                try {
                    const profileDoc = await getDoc(doc(db, 'userProfiles', firebaseUser.uid));
                    if (profileDoc.exists()) {
                        setUserProfile(profileDoc.data() as UserProfile);
                    }
                } catch (error) {
                    console.error('Failed to fetch user profile:', error);
                }
            } else {
                setUserProfile(null);
            }

            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const login = async (email: string, password: string) => {
        await signInWithEmailAndPassword(auth, email, password);
    };

    const register = async (email: string, password: string, companyName: string) => {
        // Create Firebase auth user
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;

        // Create tenant (company) in Firestore
        const tenantId = uid; // Use user ID as tenant ID for mother
        await setDoc(doc(db, 'tenants', tenantId, 'info', tenantId), {
            name: companyName,
            plan: 'free',
            createdAt: serverTimestamp(),
            createdBy: uid
        });

        // Create user profile as mother
        const profile: UserProfile = {
            uid,
            email,
            displayName: companyName,
            role: 'mother',
            tenantId,
            createdAt: serverTimestamp()
        };
        await setDoc(doc(db, 'userProfiles', uid), profile);
        setUserProfile(profile);
    };

    const logout = async () => {
        // Reset sync service state to prevent data leakage between users
        syncService.reset();
        
        await signOut(auth);
        setUserProfile(null);
    };

    const resetPassword = async (email: string) => {
        await sendPasswordResetEmail(auth, email);
    };

    const createChildUser = async (email: string, password: string, displayName: string, motherPassword: string) => {
        if (!userProfile || userProfile.role !== 'mother') {
            throw new Error('Only mother accounts can create child users');
        }

        const motherEmail = userProfile.email;
        const motherTenantId = userProfile.tenantId;

        // FIRST: Verify mother password by re-authenticating
        // This ensures we can log back in after creating the child
        try {
            await signInWithEmailAndPassword(auth, motherEmail, motherPassword);
        } catch (error: any) {
            throw new Error('Invalid admin password. Please enter your correct password.');
        }

        // NOW create child user - this will sign in as child
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const childUid = userCredential.user.uid;

        // Create child user profile with same tenantId as mother
        const childProfile: UserProfile = {
            uid: childUid,
            email,
            displayName,
            role: 'child',
            tenantId: motherTenantId,
            createdAt: serverTimestamp()
        };
        await setDoc(doc(db, 'userProfiles', childUid), childProfile);

        // Sign back in as mother
        await signInWithEmailAndPassword(auth, motherEmail, motherPassword);
    };

    const deleteUser = async (userId: string) => {
        if (!userProfile || userProfile.role !== 'mother') {
            throw new Error('Only mother accounts can delete users');
        }

        // Don't allow deleting yourself
        if (userId === userProfile.uid) {
            throw new Error('Cannot delete your own account');
        }

        // Delete user profile from Firestore
        await deleteDoc(doc(db, 'userProfiles', userId));

        // Note: This doesn't delete from Firebase Auth - would need Cloud Functions for that
        // The user profile is removed, so they won't be able to use the app properly
    };

    const isMother = userProfile?.role === 'mother';

    const value: AuthContextType = {
        user,
        userProfile,
        loading,
        isMother,
        login,
        register,
        logout,
        resetPassword,
        createChildUser,
        deleteUser
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

