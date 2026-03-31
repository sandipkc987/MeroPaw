import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@src/contexts/AuthContext';
import { usePets } from '@src/contexts/PetContext';
import { fetchUnreadNotificationCount } from '@src/services/supabaseData';

interface NavigationContextType {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeScreen: string | null;
  setActiveScreen: (screen: string | null) => void;
  navigateTo: (screen: string) => void;
  goBack: () => void;
  canGoBack: boolean;
  navHidden: boolean;
  setNavHidden: (hidden: boolean) => void;
  registerAddReminderCallback: (callback: () => void) => void;
  triggerAddReminder: () => void;
  registerAddExpenseCallback: (callback: () => void) => void;
  triggerAddExpense: () => void;
  registerAddHealthRecordCallback: (callback: () => void) => void;
  triggerAddHealthRecord: () => void;
  unreadNotificationCount: number;
  setUnreadNotificationCount: (count: number) => void;
  refreshUnreadNotificationCount: () => Promise<void>;
  refreshVetVisitTrigger: number;
  incrementVetVisitRefreshTrigger: () => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { getActivePet } = usePets();
  const activePet = getActivePet();
  
  const [activeTab, setActiveTab] = useState("home");
  const [activeScreen, setActiveScreen] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [navHidden, setNavHidden] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [refreshVetVisitTrigger, setRefreshVetVisitTrigger] = useState(0);
  const addReminderCallbackRef = useRef<(() => void) | null>(null);
  const pendingAddReminderRef = useRef(false);
  const addExpenseCallbackRef = useRef<(() => void) | null>(null);
  const pendingAddExpenseRef = useRef(false);
  const addHealthRecordCallbackRef = useRef<(() => void) | null>(null);
  const pendingAddHealthRecordRef = useRef(false);

  const refreshUnreadNotificationCount = useCallback(async () => {
    if (!user?.id) {
      setUnreadNotificationCount(0);
      return;
    }
    try {
      const count = await fetchUnreadNotificationCount(user.id, activePet?.id);
      setUnreadNotificationCount(count);
    } catch {
      setUnreadNotificationCount(0);
    }
  }, [user?.id, activePet?.id]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!mounted) return;
      await refreshUnreadNotificationCount();
    };
    load();
    const interval = setInterval(load, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [refreshUnreadNotificationCount]);

  const setActiveScreenSafe = useCallback((screen: string | null) => {
    setNavHidden(false);
    setActiveScreen(screen);
    setHistory(screen ? [screen] : []);
  }, []);

  const navigateTo = (screen: string) => {
    setNavHidden(false);
    if (screen === "Home") {
      setActiveTab("home");
      setActiveScreenSafe(null);
    } else {
      setActiveScreen(screen);
      setHistory((prev) => {
        if (prev[prev.length - 1] === screen) return prev;
        return [...prev, screen];
      });
    }
  };

  const goBack = () => {
    setHistory((prev) => {
      if (prev.length <= 1) {
        setActiveScreenSafe(null);
        return [];
      }
      const next = prev.slice(0, -1);
      setActiveScreen(next[next.length - 1] || null);
      return next;
    });
  };

  const canGoBack = history.length > 1;

  const registerAddReminderCallback = useCallback((callback: () => void) => {
    addReminderCallbackRef.current = callback;
    if (pendingAddReminderRef.current) {
      pendingAddReminderRef.current = false;
      callback();
    }
  }, []);

  const triggerAddReminder = useCallback(() => {
    if (addReminderCallbackRef.current) {
      addReminderCallbackRef.current();
      return;
    }
    pendingAddReminderRef.current = true;
  }, []);

  const registerAddExpenseCallback = useCallback((callback: () => void) => {
    addExpenseCallbackRef.current = callback;
    if (pendingAddExpenseRef.current) {
      pendingAddExpenseRef.current = false;
      callback();
    }
  }, []);

  const triggerAddExpense = useCallback(() => {
    if (addExpenseCallbackRef.current) {
      addExpenseCallbackRef.current();
      return;
    }
    pendingAddExpenseRef.current = true;
  }, []);

  const registerAddHealthRecordCallback = useCallback((callback: () => void) => {
    addHealthRecordCallbackRef.current = callback;
    if (pendingAddHealthRecordRef.current) {
      pendingAddHealthRecordRef.current = false;
      callback();
    }
  }, []);

  const triggerAddHealthRecord = useCallback(() => {
    if (addHealthRecordCallbackRef.current) {
      addHealthRecordCallbackRef.current();
      return;
    }
    pendingAddHealthRecordRef.current = true;
  }, []);

  const incrementVetVisitRefreshTrigger = useCallback(() => {
    setRefreshVetVisitTrigger((prev) => prev + 1);
  }, []);

  return (
    <NavigationContext.Provider value={{ 
      activeTab,
      setActiveTab,
      activeScreen, 
      setActiveScreen: setActiveScreenSafe,
      navigateTo,
      goBack,
      canGoBack,
      navHidden,
      setNavHidden,
      registerAddReminderCallback,
      triggerAddReminder,
      registerAddExpenseCallback,
      triggerAddExpense,
      registerAddHealthRecordCallback,
      triggerAddHealthRecord,
      unreadNotificationCount,
      setUnreadNotificationCount,
      refreshUnreadNotificationCount,
      refreshVetVisitTrigger,
      incrementVetVisitRefreshTrigger
    }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}


