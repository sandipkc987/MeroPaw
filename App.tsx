import React, { useState, useEffect, useRef } from "react";
import { SafeAreaView, StatusBar, View, ActivityIndicator, Text, TouchableOpacity } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@src/contexts/AuthContext";
import { NavigationProvider, useNavigation } from "@src/contexts/NavigationContext";
import { MemoriesProvider } from "@src/contexts/MemoriesContext";
import { ProfileProvider } from "@src/contexts/ProfileContext";
import { PetProvider, usePets } from "@src/contexts/PetContext";
import { ThemeProvider, useTheme } from "@src/contexts/ThemeContext";
import { useInstagramSansFonts } from "@src/utils/fonts";
import AuthFlow from "@src/components/AuthFlow";
import HomeScreen from "@src/screens/HomeScreen";
import MemoriesScreen from "@src/screens/MemoriesScreen";
import RemindersScreen from "@src/screens/RemindersScreen";
import ExpensesScreen from "@src/screens/ExpensesScreen";
import HealthScreen from "@src/screens/HealthScreen";
import ProfileScreen from "@src/screens/ProfileScreen";
import ShopScreen from "@src/screens/ShopScreen";
import AlertsScreen from "@src/screens/AlertsScreen";
import SettingsScreen from "@src/screens/SettingsScreen";
import PersonalInformationScreen from "@src/screens/PersonalInformationScreen";
import LoginSecurityScreen from "@src/screens/LoginSecurityScreen";
import NotificationsSettingsScreen from "@src/screens/NotificationsSettingsScreen";
import HealthWellnessSettingsScreen from "@src/screens/HealthWellnessSettingsScreen";
import AppearancePreferencesScreen from "@src/screens/AppearancePreferencesScreen";
import DataAccountScreen from "@src/screens/DataAccountScreen";
import SupportScreen from "@src/screens/SupportScreen";
import AddPetScreen from "@src/screens/AddPetScreen";
import FeedbackScreen from "@src/screens/FeedbackScreen";
import ReceiptsScreen from "@src/screens/ReceiptsScreen";
import Navigation from "@src/components/Navigation";
import AddModal from "@src/components/AddModal";
import { fetchExpenses, hasMonthlyExpenseSummary, insertNotification } from "@src/services/supabaseData";

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fff' }}>
          <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 10, color: '#000' }}>Something went wrong</Text>
          <Text style={{ textAlign: 'center', color: 'red', marginBottom: 20 }}>{this.state.error?.message}</Text>
          <TouchableOpacity
            onPress={() => this.setState({ hasError: false, error: null })}
            style={{ padding: 10, backgroundColor: '#007AFF', borderRadius: 5 }}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

function AppContent() {
  const { colors, isDark } = useTheme();
  const auth = useAuth();
  const { isAuthenticated, isLoading, isBootstrapping, hasCompletedOnboarding, user, needsEmailVerification } = auth;
  const { activeScreen, setActiveScreen, triggerAddReminder, navHidden } = useNavigation();
  const { getActivePet } = usePets();
  const activePet = getActivePet();
  const [activeTab, setActiveTab] = useState("home");
  const [showAddModal, setShowAddModal] = useState(false);
  const fontsLoaded = useInstagramSansFonts();
  const [forceUpdate, setForceUpdate] = useState(0);
  const lastSummaryKeyRef = useRef<string | null>(null);

  // Force re-render when auth state changes
  // Also reset navigation state when user logs out
  useEffect(() => {
    console.log('App.tsx: Auth state changed - isAuthenticated:', isAuthenticated, 'hasCompletedOnboarding:', hasCompletedOnboarding, 'user:', user);

    // If user logs out, reset navigation state
    if (!isAuthenticated || !user) {
      setActiveScreen(null);
      setActiveTab("home");
    }

    setForceUpdate(prev => prev + 1);
  }, [isAuthenticated, hasCompletedOnboarding, user, setActiveScreen]);

  useEffect(() => {
    if (!user?.id || !activePet?.id) return;
    const monthKey = new Date().toISOString().slice(0, 7);
    if (lastSummaryKeyRef.current === monthKey) return;
    let cancelled = false;
    const run = async () => {
      try {
        const exists = await hasMonthlyExpenseSummary(user.id, activePet.id, monthKey);
        if (exists || cancelled) {
          lastSummaryKeyRef.current = monthKey;
          return;
        }
        const expenses = await fetchExpenses(user.id, activePet.id);
        const monthTotal = expenses
          .filter(expense => (expense.date || "").startsWith(monthKey))
          .reduce((sum, expense) => sum + (expense.amount || 0), 0);
        if (monthTotal <= 0 || cancelled) {
          lastSummaryKeyRef.current = monthKey;
          return;
        }
        await insertNotification(user.id, {
          petId: activePet.id,
          kind: "expense",
          title: "Monthly spending summary",
          message: `You spent $${monthTotal.toFixed(2)} this month.`,
          ctaLabel: "View expenses",
          metadata: { type: "monthly_summary", monthKey, total: monthTotal },
        });
        lastSummaryKeyRef.current = monthKey;
      } catch (error) {
        console.warn("App.tsx: Failed to create monthly summary notification", error);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [user?.id, activePet?.id]);

  // Show loading screen while bootstrapping auth or loading fonts
  if (isBootstrapping || !fontsLoaded) {
    return (
      <View style={{
        flex: 1,
        backgroundColor: colors.bg,
        justifyContent: "center",
        alignItems: "center"
      }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // Show authentication flow if not logged in or onboarding not complete
  console.log('App.tsx render:', {
    isAuthenticated,
    hasCompletedOnboarding,
    isLoading,
    user: user,
    forceUpdate // Log force update counter
  });

  // Check both conditions - user must exist AND onboarding must be complete
  const shouldShowAuth = !user || !isAuthenticated || !hasCompletedOnboarding || needsEmailVerification;

  if (shouldShowAuth) {
    console.log('App.tsx: Showing AuthFlow - user:', user, 'isAuthenticated:', isAuthenticated, 'hasCompletedOnboarding:', hasCompletedOnboarding);
    // Use key to force remount when auth state changes, ensuring clean state
    // Include user ID (or null) to ensure key changes on logout
    return <AuthFlow key={`auth-${isAuthenticated}-${hasCompletedOnboarding}-${user?.id || 'null'}`} />;
  }

  console.log('App.tsx: Showing main app - both conditions met');

  const renderScreen = () => {
    // Handle settings sub-screens
    if (activeScreen === "PersonalInformation") return <PersonalInformationScreen />;
    if (activeScreen === "LoginSecurity") return <LoginSecurityScreen />;
    if (activeScreen === "NotificationsSettings") return <NotificationsSettingsScreen />;
    if (activeScreen === "HealthWellnessSettings") return <HealthWellnessSettingsScreen />;
    if (activeScreen === "AppearancePreferences") return <AppearancePreferencesScreen />;
    if (activeScreen === "DataAccount") return <DataAccountScreen />;
    if (activeScreen === "Support") return <SupportScreen />;
    if (activeScreen === "AddPet") return <AddPetScreen />;
    if (activeScreen === "Feedback") return <FeedbackScreen />;
    if (activeScreen === "Receipts") return <ReceiptsScreen />;
    if (activeScreen === "Memories") return <MemoriesScreen />;
    if (activeScreen === "Reminders") return <RemindersScreen />;
    if (activeScreen === "Profile") return <ProfileScreen />;
    if (activeScreen === "Health") return <HealthScreen />;
    if (activeScreen === "Expenses") return <ExpensesScreen />;

    // Handle main tab screens
    switch (activeTab) {
      case "shop":
        return <ShopScreen />;
      case "alerts":
        return <AlertsScreen />;
      case "profile":
        return <SettingsScreen />;
      default:
        return <HomeScreen showAddModal={showAddModal} onAddModalChange={setShowAddModal} />;
    }
  };

  const showNavigation = !activeScreen && !navHidden;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <SafeAreaView style={{ flex: 1 }}>
        {renderScreen()}
        {showNavigation && (
          <>
            <Navigation
              activeTab={activeTab}
              onTabChange={(tab) => {
                setActiveTab(tab);
                setActiveScreen(null);
              }}
              onAddPress={() => {
                setShowAddModal(true);
              }}
            />
            <AddModal
              visible={showAddModal}
              onClose={() => setShowAddModal(false)}
              onAddReminder={triggerAddReminder}
            />
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider>
          <PetProvider>
            <MemoriesProvider>
              <ProfileProvider>
                <NavigationProvider>
                  <AppContent />
                </NavigationProvider>
              </ProfileProvider>
            </MemoriesProvider>
          </PetProvider>
        </ThemeProvider>
      </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}