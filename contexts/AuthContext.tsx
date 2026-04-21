import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useTranslations } from '../hooks/useTranslations';
import { User as MongoUser } from '../types';

// Interface for the user object used within the application (frontend)
export interface User {
  id: string;
  email: string;
  name: string;
  company?: string;
  role?: string;
  country?: string;
  phone?: string;
}

const API = axios.create({ baseURL: 'http://localhost:5000/api' });

// Interceptor: adjunta el token automáticamente a cada petición
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
  signup: (data: { email: string; pass: string; name: string; }) => Promise<boolean>;
  logout: () => void;
  updateUser: (updatedData: Omit<User, 'id' | 'email'>) => Promise<boolean>;
  changePassword: (oldPass: string, newPass: string) => Promise<boolean>;
  deleteAccount: (userId: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to map MongoUser (backend) to User (frontend)
const mapUser = (mongoUser: MongoUser): User => ({
  id: mongoUser._id,
  email: mongoUser.email,
  name: mongoUser.nombre,
  role: mongoUser.rol,
  // Default values for fields not yet in backend
  company: '',
  country: '',
  phone: ''
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { t } = useTranslations();
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Verificar sesión al recargar la página
    /* useEffect(() => {
        const verificarSesion = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                setIsLoading(false);
                return;
            }

            try {
                const { data } = await API.get<MongoUser>('/auth/verify');
                setUser(mapUser(data));
            } catch (error) {
                console.error("Session verification failed", error);
                localStorage.removeItem('token');
                setUser(null);
            } finally {
                setIsLoading(false);
            }
        };

        verificarSesion();
    }, []); */

// ✅ NUEVO — nunca restaura sesión, siempre pide login
    useEffect(() => {
        localStorage.removeItem('token'); // limpia cualquier token previo
        setIsLoading(false);
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('token');
        setUser(null);
    }, []);

    const login = useCallback(async (email: string, pass: string): Promise<boolean> => {
        setIsLoading(true);
        setError(null);
        
        try {
            const { data } = await API.post<{ token: string, user: MongoUser }>('/auth/login', { email, password: pass });
            localStorage.setItem('token', data.token);
            setUser(mapUser(data.user));
            setIsLoading(false);
            return true;
        } catch (err: any) {
            console.error("Login failed", err);
            setError(err.response?.data?.message || t('auth.errorNotFound')); // Fallback error
            setIsLoading(false);
            return false;
        }
    }, [t]);

    const signup = useCallback(async (data: { email: string; pass: string; name: string; }): Promise<boolean> => {
        setIsLoading(true);
        setError(null);

        try {
            const { data: responseData } = await API.post<{ token: string, user: MongoUser }>('/auth/register', { 
                email: data.email, 
                password: data.pass, 
                nombre: data.name 
            });
            localStorage.setItem('token', responseData.token);
            setUser(mapUser(responseData.user));
            setIsLoading(false);
            return true;
        } catch (err: any) {
            console.error("Signup failed", err);
            setError(err.response?.data?.message || t('auth.errorUserExists'));
            setIsLoading(false);
            return false;
        }
    }, [t]);

    const updateUser = useCallback(async (updatedData: Omit<User, 'id' | 'email'>): Promise<boolean> => {
        if (!user) return false;
        setIsLoading(true);
        setError(null);

        try {
            // Mapping frontend updates to backend structure if needed
            // For now assuming backend accepts partial updates
            const { data } = await API.put<MongoUser>('/users/profile', updatedData);
            setUser(mapUser(data));
            setIsLoading(false);
            return true;
        } catch (err: any) {
            console.error("Update user failed", err);
            setError(err.response?.data?.message || 'Failed to update profile');
            setIsLoading(false);
            return false;
        }
    }, [user]);

    const changePassword = useCallback(async (oldPass: string, newPass: string): Promise<boolean> => {
        if (!user) return false;
        setIsLoading(true);
        setError(null);
        
        try {
            await API.put('/users/password', { oldPassword: oldPass, newPassword: newPass });
            setIsLoading(false);
            return true;
        } catch (err: any) {
            console.error("Change password failed", err);
            setError(err.response?.data?.message || t('profile.passwordUpdateError'));
            setIsLoading(false);
            return false;
        }
    }, [user, t]);

    const deleteAccount = useCallback(async (userId: string): Promise<boolean> => {
        setIsLoading(true);
        setError(null);

        try {
            await API.delete(`/users/${userId}`); // Assuming backend uses _id which maps to userId here
            logout();
            setIsLoading(false);
            return true;
        } catch (err: any) {
            console.error("Delete account failed", err);
            setError(err.response?.data?.message || t('profile.deleteAccountErrorGeneric'));
            setIsLoading(false);
            return false;
        }
    }, [logout, t]);
    

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
