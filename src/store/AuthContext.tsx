import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Storage } from '@/services/storage';

interface AuthContextType {
  user: string | null;
  login: (username: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    Storage.getItem('currentUser').then((storedUser) => {
      if (storedUser) {
        setUser(storedUser);
      }
      setIsLoading(false);
    });
  }, []);

  const login = async (username: string) => {
    await Storage.setItem('currentUser', username);
    setUser(username);
  };

  const logout = async () => {
    await Storage.removeItem('currentUser');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}
