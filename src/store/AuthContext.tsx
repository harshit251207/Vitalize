import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/services/firebase';
import {
  CategorySource,
  clearCategory as clearStoredCategory,
  DisabilityCategory,
  loadCategory,
  saveCategory as saveStoredCategory,
} from '@/lib/categoryStorage';

interface AuthContextType {
  user: string | null;
  logout: () => Promise<void>;
  isLoading: boolean;
}

interface CategoryContextType {
  category: DisabilityCategory | null;
  isLoading: boolean;
  refreshCategory: () => Promise<DisabilityCategory | null>;
  saveCategory: (category: DisabilityCategory, source: CategorySource) => Promise<boolean>;
  clearCategory: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | null>(null);
const CategoryContext = createContext<CategoryContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useCategory() {
  const context = useContext(CategoryContext);
  if (!context) {
    throw new Error('useCategory must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [category, setCategory] = useState<DisabilityCategory | null>(null);
  const [isCategoryLoading, setIsCategoryLoading] = useState(true);
  const activeUid = useRef<string | null>(null);

  useEffect(() => {
    let isActive = true;
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      const uid = firebaseUser?.uid ?? null;
      activeUid.current = uid;
      setUser(uid);
      setCategory(null);
      setIsCategoryLoading(Boolean(uid));
      setIsLoading(false);

      if (!uid) {
        setIsCategoryLoading(false);
        return;
      }

      void loadCategory(
        uid,
        (refreshedCategory) => {
          if (isActive && activeUid.current === uid) setCategory(refreshedCategory);
        },
        () => {
          if (isActive && activeUid.current === uid) setIsCategoryLoading(false);
        },
      ).then((cachedCategory) => {
        if (!isActive || activeUid.current !== uid) return;
        setCategory(cachedCategory);
        if (cachedCategory) setIsCategoryLoading(false);
      });
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, []);

  const logout = async () => {
    await signOut(auth);
  };

  const refreshCategory = useCallback(async () => {
    if (!user) {
      setCategory(null);
      setIsCategoryLoading(false);
      return null;
    }

    setIsCategoryLoading(true);
    const cachedCategory = await loadCategory(
      user,
      (refreshedCategory) => {
        if (activeUid.current === user) setCategory(refreshedCategory);
      },
      () => {
        if (activeUid.current === user) setIsCategoryLoading(false);
      },
    );
    setCategory(cachedCategory);
    if (cachedCategory) setIsCategoryLoading(false);
    return cachedCategory;
  }, [user]);

  const persistCategory = useCallback(
    async (nextCategory: DisabilityCategory, source: CategorySource) => {
      if (!user) return false;
      const synced = await saveStoredCategory(user, nextCategory, source);
      setCategory(nextCategory);
      setIsCategoryLoading(false);
      return synced;
    },
    [user],
  );

  const removeCategory = useCallback(async () => {
    if (!user) return false;
    const synced = await clearStoredCategory(user);
    setCategory(null);
    setIsCategoryLoading(false);
    return synced;
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, logout, isLoading }}>
      <CategoryContext.Provider
        value={{
          category,
          isLoading: isCategoryLoading,
          refreshCategory,
          saveCategory: persistCategory,
          clearCategory: removeCategory,
        }}
      >
        {children}
      </CategoryContext.Provider>
    </AuthContext.Provider>
  );
}
