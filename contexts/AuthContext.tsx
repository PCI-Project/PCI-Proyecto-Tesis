import React, {
    createContext,
    useState,
    useContext,
    useEffect,
    ReactNode,
    useCallback,
    useMemo,
} from 'react';
import axios from 'axios';
import { useTranslations } from '../hooks/useTranslations';
import { MongoUser } from '../types';

export interface User {
  id: string;
  email: string;
  name: string;
  company?: string;
  role?: string;
  country?: string;
  phone?: string;
  jobTitle?: string;
}

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://pci-backend-mqoc.onrender.com/api',
});

// Adjunta automáticamente el token a cada petición
API.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        }
    return config;
});

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    error: string | null;
    login: (email: string, pass: string) => Promise<boolean>;
    signup: (data: {
        email: string;
        pass: string;
        name: string;
        company?: string;
        jobTitle?: string;
    }) => Promise<boolean>;
    logout: () => void;
    updateUser: (
        updatedData: Omit<User, 'id' | 'email'>
    ) => Promise<boolean>;
    changePassword: (
        oldPass: string,
        newPass: string
    ) => Promise<boolean>;
    deleteAccount: (userId: string) => Promise<boolean>;
    resetPassword: (email: string, code: string, newPass: string) => Promise<boolean>;
    requestPasswordReset: (email: string) => Promise<{ emailDelivery: boolean }>;
    generateRecoveryCode: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const mapUser = (mongoUser: MongoUser): User => ({
    id: mongoUser._id,
    email: mongoUser.email,
    name: mongoUser.nombre,
    role: mongoUser.rol,
    company: mongoUser.company || '',
    jobTitle: mongoUser.jobTitle || '',
    phone: mongoUser.phone || '',
    country: mongoUser.country || '',
});

export const AuthProvider: React.FC<{children: ReactNode;}> = ({ children }) => {

    const { t } = useTranslations();

    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Fuerza que el usuario vuelva a iniciar sesión al cargar la aplicación
        localStorage.removeItem('token');
        setUser(null); // Elimina el usuario al cargar la aplicación
        setIsLoading(false);
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('token');
        setUser(null);
    }, []);

    const login = useCallback(
        async (email: string, pass: string): Promise<boolean> => {
        setIsLoading(true);
        setError(null);

        try {
            const { data } = await API.post<{
            token: string;
            user: MongoUser;
            }>('/auth/login', {
            email,
            password: pass,
            });

            localStorage.setItem('token', data.token);
            setUser(mapUser(data.user));

            setIsLoading(false);
            return true;
        } catch (err: any) {
            console.error('Login failed', err);

            setError(
            err.response?.data?.message ||
                t('auth.errorNotFound')
            );

            setIsLoading(false);
            return false;
        }
        },
        [t]
    );

    const signup = useCallback(
        async (data: {
        email: string;
        pass: string;
        name: string;
        company?: string;
        jobTitle?: string;
        }): Promise<boolean> => {
        setIsLoading(true);
        setError(null);

        try {
            const payload = {
            email: data.email,
            password: data.pass,
            nombre: data.name,
            company: data.company || '',
            jobTitle: data.jobTitle || '',
            };

            const { data: responseData } = await API.post<{
            token: string;
            user: MongoUser;
            }>('/auth/register', payload);

            localStorage.setItem('token', responseData.token);
            setUser(mapUser(responseData.user));

            setIsLoading(false);
            return true;
        } catch (err: any) {
            console.error('Signup failed', err);

            setError(
            err.response?.data?.msg ||
                err.response?.data?.message ||
                t('auth.errorUserExists')
            );

            setIsLoading(false);
            return false;
        }
        },[t]);

    const updateUser = useCallback(async (updatedData: Omit<User, 'id' | 'email'>): Promise<boolean> => {
        if (!user) {return false;}
        setIsLoading(true);
        setError(null);

        try {
            const payload = {
            nombre: updatedData.name,
            company: updatedData.company || '',
            jobTitle: updatedData.jobTitle || '',
            phone: updatedData.phone || '',
            country: updatedData.country || '',
            };

            const { data } = await API.put<MongoUser>('/auth/profile', payload);
            setUser(mapUser(data));
            setIsLoading(false);
            return true;
        } catch (err: any) {
            console.error('Update user failed', err);
            setError(err.response?.data?.msg ||err.response?.data?.message || 'Failed to update profile');
            setIsLoading(false);
            return false;
        }
        }, [user]);

    const changePassword = useCallback(async (oldPass: string, newPass: string): Promise<boolean> => {
        if (!user) { return false; } 
        setIsLoading(true);
        setError(null);

        try {
            await API.put('/auth/password', { oldPassword: oldPass, newPassword: newPass});
            setIsLoading(false);
            return true;
        } catch (err: any) {
            console.error('Change password failed', err);
            setError( err.response?.data?.message || t('profile.passwordUpdateError'));
            setIsLoading(false);
            return false;
        }
        }, [user, t]);

    const deleteAccount = useCallback(
        async (userId: string): Promise<boolean> => {
            setIsLoading(true);
            setError(null);
            
            try {
                await API.delete(`/auth/${userId}`);
                logout();
                setIsLoading(false);
                return true;
                } catch (err: any) {
                    console.error('Delete account failed', err);
                    setError( err.response?.data?.message || t('profile.deleteAccountErrorGeneric'));
                    setIsLoading(false);
                    return false;
                }
        }, [logout, t]);

    const resetPassword = useCallback(async (email: string, code: string, newPass: string): Promise<boolean> => {
        setError(null);
        try {
            const { data } = await API.post<{ recoveryCode: string }>('/auth/reset-password', { email, code, newPassword: newPass });
            return true;
        } catch (err: any) {
            setError(err.response?.data?.message || t('auth.resetError'));
            return false;
        }
    }, [t]);

    const requestPasswordReset = useCallback(async (email: string): Promise<{ emailDelivery: boolean }> => {
        try {
            const { data } = await API.post<{ emailDelivery: boolean }>('/auth/forgot-password', { email });
            return { emailDelivery: Boolean(data.emailDelivery) };
        } catch {
            return { emailDelivery: false };
        }
    }, []);

    const generateRecoveryCode = useCallback(async (): Promise<boolean> => {
        try {
            const { data } = await API.post<{ recoveryCode: string }>('/auth/recovery-code');
            return true;
        } catch (err: any) {
            setError(err.response?.data?.message || t('auth.resetError'));
            return false;
        }
    }, [t]);

    const value = useMemo(() => ({
        user,
        isLoading,
        error,
        login,
        signup,
        logout,
        updateUser,
        changePassword,
        deleteAccount,
        resetPassword,
        requestPasswordReset,
        generateRecoveryCode}),
        [
        user,
        isLoading,
        error,
        login,
        signup,
        logout,
        updateUser,
        changePassword,
        deleteAccount,
        resetPassword,
        requestPasswordReset,
        generateRecoveryCode,
        ]
    );
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
