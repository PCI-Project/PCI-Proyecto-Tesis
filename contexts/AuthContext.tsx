import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useTranslations } from '../hooks/useTranslations';

interface User {
  id: string;
  email: string;
  name: string;
  company?: string;
  role?: string;
  country?: string;
  phone?: string;
}

// Dummy password, in a real app this would be handled by a backend.
const DUMMY_USER_DB_KEY = 'pci-users';
const SESSION_KEY = 'pci-session-user';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, pass: string) => Promise<boolean>;
  signup: (data: { email: string; pass: string; name: string; }) => Promise<boolean>;
  logout: () => void;
  updateUser: (updatedData: Omit<User, 'id' | 'email'>) => Promise<boolean>;
  changePassword: (oldPass: string, newPass: string) => Promise<boolean>;
  deleteAccount: (userId: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getUsersFromStorage = (): (User & { pass: string })[] => {
    try {
        const usersJSON = localStorage.getItem(DUMMY_USER_DB_KEY);
        if (usersJSON) {
            const users = JSON.parse(usersJSON);
            return Array.isArray(users) ? users : [];
        }
    } catch (e) {
        console.error("Failed to parse users from localStorage", e);
    }
    return [];
};

const saveUsersToStorage = (users: (User & { pass: string })[]) => {
    try {
        localStorage.setItem(DUMMY_USER_DB_KEY, JSON.stringify(users));
    } catch (e) {
        console.error("Failed to save users to localStorage", e);
    }
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { t } = useTranslations();
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Seed protected user if not exists on first load
        try {
            const users = getUsersFromStorage();
            if (!users.some(u => u.email.toLowerCase() === 'dk.surfos@gmail.com')) {
                const protectedUser = {
                    id: 'user_dk_surfos_protected',
                    email: 'dk.surfos@gmail.com',
                    pass: '123456',
                    name: 'DK Surfos',
                    company: '', role: '', country: '', phone: '',
                };
                saveUsersToStorage([...users, protectedUser]);
            }
        } catch (e) {
            console.error("Failed to seed protected user.", e);
        }

        // Check for active session
        try {
            const savedUserJSON = sessionStorage.getItem(SESSION_KEY);
            if (savedUserJSON) {
                setUser(JSON.parse(savedUserJSON));
            }
        } catch (e) {
            console.error("Failed to parse user from sessionStorage", e);
        } finally {
            setIsLoading(false);
        }
    }, []);
    
    const logout = useCallback(() => {
        setUser(null);
        sessionStorage.removeItem(SESSION_KEY);
        // We don't clear localStorage users db on logout
    }, []);

    const login = useCallback(async (email: string, pass: string): Promise<boolean> => {
        setIsLoading(true);
        setError(null);
        
        await new Promise(res => setTimeout(res, 500)); // Simulate network delay

        const users = getUsersFromStorage();
        const foundUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());

        if (!foundUser) {
            setError(t('auth.errorNotFound'));
            setIsLoading(false);
            return false;
        }

        if (foundUser.pass !== pass) { // Plain text comparison for this simulation
            setError(t('auth.errorWrongPassword'));
            setIsLoading(false);
            return false;
        }

        const { pass: _, ...userData } = foundUser;
        setUser(userData);
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(userData));
        setIsLoading(false);
        return true;
    }, [t]);

    const signup = useCallback(async (data: { email: string; pass: string; name: string; }): Promise<boolean> => {
        setIsLoading(true);
        setError(null);

        await new Promise(res => setTimeout(res, 500)); // Simulate network delay
        
        const users = getUsersFromStorage();
        if (users.some(u => u.email.toLowerCase() === data.email.toLowerCase())) {
            setError(t('auth.errorUserExists'));
            setIsLoading(false);
            return false;
        }
        
        const newUserDbEntry = {
            id: `user_${Date.now()}`,
            email: data.email,
            pass: data.pass, // In real app, hash this
            name: data.name,
            company: '',
            role: '',
            country: '',
            phone: '',
        };

        const updatedUsers = [...users, newUserDbEntry];
        saveUsersToStorage(updatedUsers);

        const { pass: __, ...userData } = newUserDbEntry;
        setUser(userData);
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(userData));
        setIsLoading(false);
        return true;
    }, [t]);

    const updateUser = useCallback(async (updatedData: Omit<User, 'id' | 'email'>): Promise<boolean> => {
        if (!user) return false;
        setIsLoading(true);
        setError(null);

        await new Promise(res => setTimeout(res, 300));

        let users = getUsersFromStorage();
        const userIndex = users.findIndex(u => u.id === user.id);

        if (userIndex === -1) {
            setError('User not found in DB.');
            setIsLoading(false);
            return false;
        }

        const updatedUser = { ...users[userIndex], ...updatedData };
        users[userIndex] = updatedUser;
        saveUsersToStorage(users);

        const { pass: _, ...publicUserData } = updatedUser;
        setUser(publicUserData);
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(publicUserData));
        
        setIsLoading(false);
        return true;
    }, [user]);

    const changePassword = useCallback(async (oldPass: string, newPass: string): Promise<boolean> => {
        if (!user) return false;
        setIsLoading(true);
        setError(null);
        
        await new Promise(res => setTimeout(res, 300));
        
        let users = getUsersFromStorage();
        const userIndex = users.findIndex(u => u.id === user.id);
        
        if (userIndex === -1 || users[userIndex].pass !== oldPass) {
            setError(t('profile.passwordUpdateError'));
            setIsLoading(false);
            return false;
        }

        users[userIndex].pass = newPass;
        saveUsersToStorage(users);
        
        setIsLoading(false);
        return true;
    }, [user, t]);

    const deleteAccount = useCallback(async (userId: string): Promise<boolean> => {
        // Check for protected user before doing anything
        if (user && user.email.toLowerCase() === 'dk.surfos@gmail.com') {
            setError(t('profile.errorDeleteProtectedAccount'));
            return false;
        }

        setIsLoading(true);
        setError(null);

        await new Promise(res => setTimeout(res, 500));
        
        let users = getUsersFromStorage();
        const updatedUsers = users.filter(u => u.id !== userId);

        if (users.length === updatedUsers.length) {
            // User not found, though this shouldn't happen in normal flow
            setIsLoading(false);
            return false; 
        }

        saveUsersToStorage(updatedUsers);
        logout(); // Log out the user after deleting their account
        setIsLoading(false);
        return true;
    }, [logout, user, t]);
    

    const value = useMemo(() => ({
        user,
        isLoading,
        error,
        login,
        signup,
        logout,
        updateUser,
        changePassword,
        deleteAccount
    }), [user, isLoading, error, login, signup, logout, updateUser, changePassword, deleteAccount]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
