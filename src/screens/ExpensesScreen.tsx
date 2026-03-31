import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { View, Text, ScrollView, TouchableOpacity, Modal, Alert, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { RADIUS, SPACING, TYPOGRAPHY, SHADOWS } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import { useNavigation } from "@src/contexts/NavigationContext";
import { usePets } from "@src/contexts/PetContext";
import { useAuth } from "@src/contexts/AuthContext";
import { Button, Card, Chip, Input } from "@src/components/UI";
import ActionSheet, { ActionSheetOption } from "@src/components/ActionSheet";
import EmptyState from "@src/components/EmptyState";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "@src/components/ScreenHeader";
import { ChartTabs, DonutChart } from "@src/components/ChartTabs";
import AddExpenseModal from "@src/components/AddExpenseModal";
import { fetchExpenses, insertExpense, updateExpense, deleteExpense, insertNotification } from "@src/services/supabaseData";
import storage from "@src/utils/storage";

const expenseCategories = ["food", "medical", "toys", "grooming", "other"] as const;
type ExpenseCategory = typeof expenseCategories[number];

interface Expense {
  id: string;
  title: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
  createdAt?: string;
  notes?: string;
  receipt?: { type: 'image' | 'pdf'; url: string; name: string; uri: string; path?: string; documentId?: string };
}

const categories = ["All", "Food", "Medical", "Toys", "Grooming", "Other"];

const ExpenseCard = ({
  expense,
  highlighted,
  onOpenActions,
}: {
  expense: Expense;
  highlighted?: boolean;
  onOpenActions?: () => void;
}) => {
  const { colors } = useTheme();
  return (
    <View style={{
      marginBottom: SPACING.md,
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: highlighted ? colors.accent : colors.borderLight,
      overflow: "hidden",
      ...SHADOWS.sm,
    }}>
      <LinearGradient
        colors={[colors.accent + "14", colors.accent + "06", "transparent"]}
        style={{ height: 24 }}
      />
      <View style={{ paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg, paddingTop: SPACING.sm }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1, paddingRight: SPACING.sm }}>
          <Text style={{ ...TYPOGRAPHY.base, fontWeight: "600", color: colors.text }}>
            {expense.title}
          </Text>
          <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginTop: 2 }}>
            {new Date(expense.date).toLocaleDateString()} • {expense.category}
          </Text>
          {expense.receipt && (
            <Text style={{ ...TYPOGRAPHY.sm, color: colors.accent, marginTop: SPACING.xs }}>
              📄 Receipt attached
            </Text>
          )}
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "700", color: colors.text }}>
            ${expense.amount.toFixed(2)}
          </Text>
          {onOpenActions && (
            <TouchableOpacity onPress={onOpenActions} style={{ marginTop: SPACING.xs }}>
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      </View>
    </View>
  );
};

type TimePeriod = "thisMonth" | "thisWeek" | "lastMonth" | "oneYear";

export default function ExpensesScreen() {
  const { colors } = useTheme();
  const { registerAddExpenseCallback, navigateTo } = useNavigation();
  const { activePetId, getActivePet } = usePets();
  const { user } = useAuth();
  const activePet = getActivePet();
  const petName = activePet?.name?.trim() || "your pet";
  const petNamePossessive = petName === "your pet" ? "your pet's" : petName.endsWith("s") ? `${petName}'` : `${petName}'s`;
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [actionSheetOptions, setActionSheetOptions] = useState<ActionSheetOption[]>([]);
  const [actionSheetTitle, setActionSheetTitle] = useState<string | undefined>(undefined);
  const [highlightedExpenseId, setHighlightedExpenseId] = useState<string | null>(null);
  const [pendingExpenseId, setPendingExpenseId] = useState<string | null>(null);
  const [chartTab, setChartTab] = useState<"categories" | "weekly">("categories");
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("thisMonth");
  const [showRecentActivityFilter, setShowRecentActivityFilter] = useState(false);
  const insightTabs = ['Total Spent', 'Top Category', 'This Month Spent'] as const;
  const [activeInsightTab, setActiveInsightTab] = useState<typeof insightTabs[number]>('Total Spent');
  const [headerCompact, setHeaderCompact] = useState(false);
  const headerCompactRef = useRef(false);
  const SCROLL_DOWN_THRESHOLD = 50;
  const SCROLL_UP_THRESHOLD = 35;
  const handleExpensesScroll = useCallback((event: any) => {
    const y = event.nativeEvent?.contentOffset?.y ?? 0;
    if (y <= 0) {
      if (headerCompactRef.current) {
        headerCompactRef.current = false;
        setHeaderCompact(false);
      }
    } else {
      const nextCompact = y >= SCROLL_DOWN_THRESHOLD ? true : y <= SCROLL_UP_THRESHOLD ? false : headerCompactRef.current;
      if (nextCompact !== headerCompactRef.current) {
        headerCompactRef.current = nextCompact;
        setHeaderCompact(nextCompact);
      }
    }
  }, []);

  useEffect(() => {
    registerAddExpenseCallback(() => {
      setShowAddModal(true);
    });
  }, [registerAddExpenseCallback]);

  useEffect(() => {
    const loadTarget = async () => {
      const raw = await storage.getItem("@kasper_notification_target");
      if (!raw) return;
      try {
        const target = JSON.parse(raw);
        if (target?.type === "expense" && target?.id) {
          if (target?.action === "edit") {
            const found = expenses.find(expense => expense.id === target.id);
            if (found) {
              setEditingExpense(found);
              setShowEditModal(true);
              storage.removeItem("@kasper_notification_target").catch(() => {});
              return;
            }
          }
          setPendingExpenseId(target.id);
        }
      } catch {
        return;
      }
    };
    loadTarget();
  }, [expenses]);

  useEffect(() => {
    if (!pendingExpenseId || expenses.length === 0) return;
    const exists = expenses.some(expense => expense.id === pendingExpenseId);
    if (!exists) return;
    setHighlightedExpenseId(pendingExpenseId);
    storage.removeItem("@kasper_notification_target").catch(() => {});
    setPendingExpenseId(null);
    setTimeout(() => setHighlightedExpenseId(null), 6000);
  }, [pendingExpenseId, expenses]);

  const loadExpenses = useCallback(async () => {
    if (!user?.id || !activePetId) {
          setExpenses([]);
            return;
          }
    try {
      const remote = await fetchExpenses(user.id, activePetId);
      setExpenses(remote);
    } catch (error) {
      console.error("Failed to load expenses:", error);
      setExpenses([]);
    }
  }, [user?.id, activePetId]);

  // Load expenses from Supabase on mount / pet change
  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  // Calculate date range based on selected time period
  const getDateRange = useCallback((period: TimePeriod): { start: Date; end: Date; budget: number } => {
    const now = new Date();
    let start: Date;
    let end: Date = new Date(now);
    end.setHours(23, 59, 59, 999); // End of today
    let budget = 200; // Default monthly budget

    switch (period) {
      case "thisWeek": {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
        start = new Date(now);
        start.setDate(diff);
        start.setHours(0, 0, 0, 0);
        budget = 50; // Weekly budget (approximate)
        break;
      }
      case "thisMonth": {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        budget = 200; // Monthly budget
        break;
      }
      case "lastMonth": {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        start = new Date(lastMonth);
        start.setHours(0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        budget = 200; // Monthly budget
        break;
      }
      case "oneYear": {
        start = new Date(now.getFullYear(), 0, 1);
        start.setHours(0, 0, 0, 0);
        budget = 2400; // Yearly budget (12 months * $200)
        break;
      }
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
    }

    return { start, end, budget };
  }, []);

  const getExpensePeriodDate = useCallback((expense: Expense) => {
    if (expense.createdAt) {
      const created = new Date(expense.createdAt);
      if (!isNaN(created.getTime())) return created;
    }
    const fallback = new Date(`${expense.date}T00:00:00`);
    return isNaN(fallback.getTime()) ? new Date(0) : fallback;
  }, []);

  // Filter expenses by time period
  const periodFilteredExpenses = useMemo(() => {
    const { start, end } = getDateRange(timePeriod);
    return expenses.filter(expense => {
      const expenseDate = getExpensePeriodDate(expense);
      expenseDate.setHours(0, 0, 0, 0);
      return expenseDate >= start && expenseDate <= end;
    });
  }, [expenses, timePeriod, getDateRange, getExpensePeriodDate]);

  // Filter by category and time period
  const filteredExpenses = periodFilteredExpenses.filter(expense => 
    selectedCategory === "All" || expense.category === selectedCategory.toLowerCase()
  );

  const totalSpent = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const { budget: periodBudget } = getDateRange(timePeriod);
  const budgetUsed = (totalSpent / periodBudget) * 100;

  // All-time totals for "Total Spent" and "Top Category" insight tabs only
  const totalSpentToDate = useMemo(
    () => expenses.reduce((sum, expense) => sum + expense.amount, 0),
    [expenses]
  );
  const categoryBreakdownToDate = useMemo(() => {
    const breakdown: Record<string, number> = {
      food: 0,
      medical: 0,
      toys: 0,
      grooming: 0,
      other: 0
    };
    expenses.forEach(expense => {
      breakdown[expense.category] += expense.amount;
    });
    return Object.entries(breakdown)
      .filter(([_, amount]) => amount > 0)
      .map(([category, amount]) => ({
        category: category as ExpenseCategory,
        amount,
        percentage: totalSpentToDate > 0 ? (amount / totalSpentToDate) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses, totalSpentToDate]);
  const topCategoryToDate = categoryBreakdownToDate[0];

  // Get period label for display
  const getPeriodLabel = (period: TimePeriod): string => {
    switch (period) {
      case "thisWeek": return "This Week";
      case "thisMonth": return "This Month";
      case "lastMonth": return "Last Month";
      case "oneYear": return "One Year";
      default: return "This Month";
    }
  };

  const periodOptions = [
    { label: "This Week", value: "thisWeek" },
    { label: "This Month", value: "thisMonth" },
    { label: "Last Month", value: "lastMonth" },
    { label: "One Year", value: "oneYear" },
  ];

  const getExpenseSortTs = (expense: Expense) => {
    const created = expense.createdAt ? new Date(expense.createdAt).getTime() : NaN;
    if (Number.isFinite(created)) return created;
    const dated = expense.date ? new Date(expense.date).getTime() : NaN;
    return Number.isFinite(dated) ? dated : 0;
  };

  const orderedExpenses = useMemo(() => {
    return [...filteredExpenses].sort((a, b) => getExpenseSortTs(b) - getExpenseSortTs(a));
  }, [filteredExpenses]);

  // Get current week's Monday
  const getWeekStart = useCallback(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const weekStart = new Date(today);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0); // Set to start of day
    return weekStart;
  }, []);

  // Memoized helper to get day index from date
  const getDayIndex = useCallback((expense: Expense) => {
    const expenseDate = getExpensePeriodDate(expense);
    const dayOfWeek = expenseDate.getDay();
    return dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  }, [getExpensePeriodDate]);

  // Memoized helper to get dominant category for a day
  const getDominantCategory = useCallback((dayIndex: number) => {
    const weekStart = getWeekStart();
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const dayExpenses = expenses.filter(e => {
      const expenseDate = getExpensePeriodDate(e);
      expenseDate.setHours(0, 0, 0, 0);
      return getDayIndex(e) === dayIndex && 
             expenseDate >= weekStart && 
             expenseDate < weekEnd;
    });
    
    if (dayExpenses.length === 0) return "other";
    
    const categoryCounts = dayExpenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.keys(categoryCounts).reduce((a, b) => 
      categoryCounts[a] > categoryCounts[b] ? a : b, "other"
    ) as any;
  }, [expenses, getDayIndex, getWeekStart, getExpensePeriodDate]);

  // Calculate monthly trend data for last 6 months
  const monthlyTrendData = useMemo(() => {
    const now = new Date();
    const months: { month: string; monthIndex: number; year: number; amount: number }[] = [];
    
    // Get last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthIndex = date.getMonth();
      const year = date.getFullYear();
      const monthName = date.toLocaleDateString('en-US', { month: 'short' });
      
      months.push({
        month: monthName,
        monthIndex,
        year,
        amount: 0
      });
    }
    
    // Calculate expenses for each month
    expenses.forEach(expense => {
      const expenseDate = getExpensePeriodDate(expense);
      const expenseMonth = expenseDate.getMonth();
      const expenseYear = expenseDate.getFullYear();
      
      const monthData = months.find(m => m.monthIndex === expenseMonth && m.year === expenseYear);
      if (monthData) {
        monthData.amount += expense.amount;
      }
    });
    
    return months;
  }, [expenses, getExpensePeriodDate]);
  
  // Calculate average spend
  const avgSpend = useMemo(() => {
    const total = monthlyTrendData.reduce((sum, m) => sum + m.amount, 0);
    return total / monthlyTrendData.length;
  }, [monthlyTrendData]);
  
  // Calculate max amount for chart scaling - dynamic based on data
  const maxMonthlyAmount = useMemo(() => {
    const max = Math.max(...monthlyTrendData.map(m => m.amount), 1);
    if (max === 0) return 1000; // Default if no data
    
    // Round up to a nice number for better scaling
    const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
    const normalized = max / magnitude;
    
    let roundedMax;
    if (normalized <= 1) roundedMax = magnitude;
    else if (normalized <= 2) roundedMax = 2 * magnitude;
    else if (normalized <= 5) roundedMax = 5 * magnitude;
    else roundedMax = 10 * magnitude;
    
    return roundedMax;
  }, [monthlyTrendData]);
  
  // Generate dynamic Y-axis labels (4 labels: 0, 1/3, 2/3, max)
  const yAxisLabels = useMemo(() => {
    const labels = [];
    for (let i = 0; i <= 3; i++) {
      const value = (i / 3) * maxMonthlyAmount;
      labels.push(value);
    }
    return labels.reverse(); // Top to bottom: max, 2/3, 1/3, 0
  }, [maxMonthlyAmount]);
  
  // Format Y-axis label
  const formatYAxisLabel = (value: number) => {
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
    }
    return `$${Math.round(value)}`;
  };
  
  // Get current month index
  const currentMonthIndex = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  // Calculate this month's spending (always current month, regardless of filter)
  const thisMonthSpent = useMemo(() => {
    const now = new Date();
    const thisMonthExpenses = expenses.filter(expense => {
      const expenseDate = getExpensePeriodDate(expense);
      return expenseDate.getMonth() === now.getMonth() &&
             expenseDate.getFullYear() === now.getFullYear();
    });
    return thisMonthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  }, [expenses, getExpensePeriodDate]);

  // Last month's spending and % change vs this month (for "This Month Spent" comparison)
  const lastMonthSpent = useMemo(() => {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthExpenses = expenses.filter(expense => {
      const expenseDate = getExpensePeriodDate(expense);
      return expenseDate.getMonth() === lastMonth.getMonth() &&
             expenseDate.getFullYear() === lastMonth.getFullYear();
    });
    return lastMonthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  }, [expenses, getExpensePeriodDate]);

  const monthOverMonthChange = useMemo(() => {
    if (lastMonthSpent === 0) return null;
    const change = ((thisMonthSpent - lastMonthSpent) / lastMonthSpent) * 100;
    return Math.round(change * 10) / 10; // one decimal
  }, [thisMonthSpent, lastMonthSpent]);

  // Calculate category breakdown (based on filtered period)
  const categoryBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {
      food: 0,
      medical: 0,
      toys: 0,
      grooming: 0,
      other: 0
    };
    
    // Calculate total from period-filtered expenses for accurate percentages
    const allExpensesTotal = periodFilteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    
    periodFilteredExpenses.forEach(expense => {
      breakdown[expense.category] += expense.amount;
    });
    
    return Object.entries(breakdown)
      .filter(([_, amount]) => amount > 0) // Only include categories with expenses
      .map(([category, amount]) => ({
        category: category as any,
        amount,
        percentage: allExpensesTotal > 0 ? (amount / allExpensesTotal) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [periodFilteredExpenses]);

  const topCategory = categoryBreakdown[0];


  const addExpense = async (expenseData: Omit<Expense, 'id'>) => {
    if (!user?.id || !activePetId) {
      Alert.alert("Sign in required", "Please sign in to save expenses.");
      return;
    }
    try {
      const normalizedExpense = {
        ...expenseData,
        date: expenseData.date || new Date().toISOString().split("T")[0],
      };
      const inserted = await insertExpense(user.id, activePetId, normalizedExpense);
      const newExpense: Expense = {
        ...normalizedExpense,
        id: inserted.id,
        createdAt: inserted.created_at || new Date().toISOString(),
      };
      setExpenses(prev => [newExpense, ...prev]);
    Alert.alert("Success", "Expense added successfully!");
      insertNotification(user.id, {
        petId: activePetId,
        kind: "expense",
        title: "Expense added",
        message: `${expenseData.title || "Expense"} added for $${Number(expenseData.amount || 0).toFixed(2)}.`,
        ctaLabel: "View expenses",
        metadata: { type: "expense_added", expenseId: inserted.id },
      }).catch(error => {
        console.error("ExpensesScreen: Failed to create notification:", error);
      });
    } catch (error) {
      console.error("Failed to add expense:", error);
      Alert.alert("Error", "Could not save expense. Please try again.");
    }
  };

  const saveExpenseEdits = async (expenseData: Omit<Expense, 'id'>) => {
    if (!user?.id || !editingExpense) return;
    try {
      const normalizedExpense = {
        ...expenseData,
        date: expenseData.date || new Date().toISOString().split("T")[0],
      };
      await updateExpense(user.id, editingExpense.id, normalizedExpense);
      setExpenses(prev =>
        prev.map(expense =>
          expense.id === editingExpense.id
            ? { ...expense, ...normalizedExpense }
            : expense
        )
      );
      setShowEditModal(false);
      setEditingExpense(null);
      Alert.alert("Saved", "Expense updated successfully!");
    } catch (error) {
      console.error("Failed to update expense:", error);
      Alert.alert("Error", "Could not update expense. Please try again.");
    }
  };

  const removeExpense = async (expenseId: string) => {
    if (!user?.id) return;
    try {
      setExpenses(prev => prev.filter(expense => expense.id !== expenseId));
      await deleteExpense(user.id, expenseId);
      if (editingExpense?.id === expenseId) {
        setShowEditModal(false);
        setEditingExpense(null);
      }
    } catch (error) {
      console.error("Failed to delete expense:", error);
      Alert.alert("Error", "Could not delete expense. Please try again.");
    }
  };

  const openExpenseActions = (expense: Expense) => {
    setActionSheetTitle("Expense");
    setActionSheetOptions([
      {
        label: "Edit",
        icon: "create-outline",
        onPress: () => {
          setEditingExpense(expense);
          setShowEditModal(true);
        },
      },
      {
        label: "Delete",
        icon: "trash-outline",
        onPress: () => removeExpense(expense.id),
      },
    ]);
    setActionSheetVisible(true);
  };

  const handleViewAllFiles = () => {
    navigateTo("Receipts");
  };

  const handleExport = (format: "csv" | "pdf") => {
    Alert.alert(
      "Export expenses",
      `We'll add ${format.toUpperCase()} export soon.`
    );
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "food": return "#FF8A5B";
      case "medical": return "#F25DA2";
      case "toys": return "#6E8BFF";
      case "grooming": return "#8F6CF3";
      default: return "#A1A8B3";
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Screen Header */}
      <ScreenHeader
        title="Expenses"
        actionIcon="paw"
        onActionPress={() => setShowAddModal(true)}
        centerTitle={headerCompact}
        titleStyle={headerCompact ? { ...TYPOGRAPHY.sm, fontWeight: "400" } : { ...TYPOGRAPHY.base, fontWeight: "400" }}
        paddingTop={SPACING.lg}
        paddingBottom={headerCompact ? SPACING.sm : SPACING.lg}
        insetSeparator
      />
      
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: 120
        }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={true}
        bounces={true}
        alwaysBounceVertical={false}
        nestedScrollEnabled={true}
        keyboardShouldPersistTaps="handled"
        onScroll={handleExpensesScroll}
        scrollEventThrottle={0}
      >
        {/* Header */}
        <View style={{ 
          paddingHorizontal: SPACING.lg,
          paddingTop: SPACING.lg,
          paddingBottom: SPACING.sm,
          backgroundColor: colors.bg,
        }}>
          <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted }}>
            Track {petNamePossessive} spending and budget
          </Text>
        </View>

        {/* Spending dashboard – single card, hero metric, View All Files, Time period */}
        <View style={{ paddingHorizontal: SPACING.lg, marginBottom: SPACING.lg }}>
          <View style={{
            borderRadius: RADIUS.xxl,
            overflow: "hidden",
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.borderLight,
            ...SHADOWS.sm,
          }}>
            {/* Insight area with gradient */}
            <LinearGradient
              colors={[colors.accent + "14", colors.accent + "06", "transparent"]}
              style={{ paddingHorizontal: SPACING.lg, paddingTop: SPACING.xl, paddingBottom: SPACING.xxl }}
            >
              {/* Segmented control – swipeable so all labels fit on small screens */}
              <View style={{
                backgroundColor: colors.surface,
                borderRadius: RADIUS.lg,
                padding: 4,
                marginBottom: SPACING.xxl,
                minHeight: 44,
                overflow: "hidden",
              }}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{
                    flexDirection: "row",
                    alignItems: "stretch",
                    gap: 6,
                    paddingHorizontal: 2,
                  }}
                >
                  {insightTabs.map((tab) => {
                    const isActive = activeInsightTab === tab;
                    return (
                      <TouchableOpacity
                        key={tab}
                        onPress={() => setActiveInsightTab(tab)}
                        activeOpacity={0.85}
                        style={{
                          paddingVertical: 10,
                          paddingHorizontal: SPACING.md,
                          borderRadius: RADIUS.md,
                          backgroundColor: isActive ? colors.accent : "transparent",
                          alignItems: "center",
                          justifyContent: "center",
                          ...(isActive ? SHADOWS.xs : {}),
                        }}
                      >
                        <Text
                          numberOfLines={1}
                          style={{
                            ...TYPOGRAPHY.sm,
                            fontSize: 13,
                            color: isActive ? colors.white : colors.textMuted,
                            fontWeight: isActive ? "700" : "500",
                          }}
                        >
                          {tab}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Hero metric – clearer hierarchy and spacing */}
              {activeInsightTab === "Total Spent" && (
                <View>
                  <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginBottom: SPACING.sm, textTransform: "uppercase", letterSpacing: 1 }}>
                    Total spent to date
                  </Text>
                  <Text style={{ ...TYPOGRAPHY["3xl"], color: colors.text, fontWeight: "700", letterSpacing: -0.5 }}>
                    ${totalSpentToDate.toFixed(2)}
                  </Text>
                </View>
              )}
              {activeInsightTab === "Top Category" && topCategoryToDate && (
                <View>
                  <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginBottom: SPACING.sm, textTransform: "uppercase", letterSpacing: 1 }}>
                    Top category
                  </Text>
                  <Text style={{ ...TYPOGRAPHY["2xl"], color: colors.text, fontWeight: "700", letterSpacing: -0.3 }}>
                    {topCategoryToDate.category === "other"
                      ? "Other"
                      : topCategoryToDate.category.charAt(0).toUpperCase() + topCategoryToDate.category.slice(1)}
                  </Text>
                  <Text style={{ ...TYPOGRAPHY.base, color: colors.textMuted, marginTop: SPACING.sm }}>
                    ${topCategoryToDate.amount.toFixed(2)}
                  </Text>
                </View>
              )}
              {activeInsightTab === "This Month Spent" && (
                <View>
                  <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginBottom: SPACING.sm, textTransform: "uppercase", letterSpacing: 1 }}>
                    This month
                  </Text>
                  <Text style={{ ...TYPOGRAPHY["3xl"], color: colors.text, fontWeight: "700", letterSpacing: -0.5 }}>
                    ${thisMonthSpent.toFixed(2)}
                  </Text>
                  {monthOverMonthChange !== null && (
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: SPACING.sm }}>
                      <Ionicons
                        name={monthOverMonthChange >= 0 ? "arrow-up" : "arrow-down"}
                        size={14}
                        color={monthOverMonthChange >= 0 ? colors.danger : colors.success}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={{ ...TYPOGRAPHY.sm, color: monthOverMonthChange >= 0 ? colors.danger : colors.success, fontWeight: "600" }}>
                        {Math.abs(monthOverMonthChange)}% vs last month
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </LinearGradient>

            {/* View All Files – primary CTA with left accent bar */}
            <TouchableOpacity
              onPress={handleViewAllFiles}
              activeOpacity={0.8}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: SPACING.xl,
                paddingHorizontal: SPACING.lg,
                borderTopWidth: 1,
                borderTopColor: colors.borderLight,
                borderLeftWidth: 4,
                borderLeftColor: colors.accent,
              }}
            >
              <View style={{
                width: 44,
                height: 44,
                borderRadius: RADIUS.lg,
                backgroundColor: colors.accent + "18",
                alignItems: "center",
                justifyContent: "center",
                marginRight: SPACING.md,
              }}>
                <Ionicons name="document-text-outline" size={22} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...TYPOGRAPHY.base, color: colors.text, fontWeight: "700" }}>
                  View All Files
                </Text>
                <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: 2 }}>
                  Receipts and attachments
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Time period row */}
            <TouchableOpacity
              onPress={() => setShowRecentActivityFilter(!showRecentActivityFilter)}
              activeOpacity={0.8}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: SPACING.lg,
                paddingHorizontal: SPACING.lg,
                borderTopWidth: 1,
                borderTopColor: colors.borderLight,
              }}
            >
              <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted }}>
                Time period
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.sm }}>
                <Text style={{ ...TYPOGRAPHY.sm, color: colors.accent, fontWeight: "600" }}>
                  {getPeriodLabel(timePeriod)}
                </Text>
                <Ionicons
                  name={showRecentActivityFilter ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.accent}
                />
              </View>
            </TouchableOpacity>

            {showRecentActivityFilter && (
              <View style={{
                paddingHorizontal: SPACING.lg,
                paddingBottom: SPACING.lg,
                paddingTop: SPACING.sm,
                borderTopWidth: 1,
                borderTopColor: colors.borderLight,
              }}>
                {periodOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => {
                      setTimePeriod(option.value as TimePeriod);
                      setShowRecentActivityFilter(false);
                    }}
                    activeOpacity={0.8}
                    style={{
                      paddingVertical: SPACING.md,
                      paddingHorizontal: SPACING.md,
                      borderRadius: RADIUS.md,
                      backgroundColor: timePeriod === option.value ? colors.accent + "18" : "transparent",
                      marginBottom: SPACING.xs,
                    }}
                  >
                    <Text style={{
                      ...TYPOGRAPHY.sm,
                      color: timePeriod === option.value ? colors.accent : colors.text,
                      fontWeight: timePeriod === option.value ? "600" : "400",
                    }}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Spending Charts with Tabs */}
        <View style={{
          paddingHorizontal: SPACING.lg,
          marginBottom: SPACING.lg,
        }}>
          <View style={{
            backgroundColor: colors.card,
            borderRadius: RADIUS.lg,
            borderWidth: 1,
            borderColor: colors.borderLight,
            overflow: "hidden",
            ...SHADOWS.sm,
          }}>
            <LinearGradient
              colors={[colors.accent + "14", colors.accent + "06", "transparent"]}
              style={{ height: 24 }}
            />
            <View style={{ padding: SPACING.lg, paddingTop: SPACING.sm }}>
            <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "600", marginBottom: SPACING.md, color: colors.text }}>
              Spending Analysis
            </Text>

            {/* Chart Tabs */}
            <ChartTabs activeTab={chartTab} onTabChange={setChartTab} />
            
            {/* Tab Content */}
            {chartTab === "categories" && (
              <DonutChart 
                data={categoryBreakdown} 
                getCategoryColor={getCategoryColor}
                dateRange={getDateRange(timePeriod)}
                totalAmount={totalSpent}
              />
            )}
            
            {chartTab === "weekly" && (
              <View>
                {/* Monthly Trend Chart */}
                <View style={{ marginTop: SPACING.md }}>
                  {/* Header */}
                  <View style={{ marginBottom: SPACING.md }}>
                    <Text style={{ 
                      ...TYPOGRAPHY.base, 
                      fontWeight: "600", 
                      color: colors.text,
                      marginBottom: SPACING.xs
                    }}>
                      All Categories
                    </Text>
                    <Text style={{ 
                      ...TYPOGRAPHY.sm, 
                      color: colors.textMuted
                    }}>
                      Avg. Spend: ${avgSpend.toFixed(2)}
                    </Text>
                  </View>
                  
                  {/* Chart Container */}
                  <View style={{ 
                    height: 200,
                    paddingHorizontal: SPACING.md,
                    paddingBottom: SPACING.lg,
                  }}>
                    {/* Y-Axis Labels - Dynamic */}
                    <View style={{ 
                      position: "absolute", 
                      left: 0, 
                      top: 0, 
                      bottom: SPACING.lg,
                      width: 50,
                      justifyContent: "space-between",
                      paddingRight: SPACING.xs
                    }}>
                      {yAxisLabels.map((value, idx) => (
                        <Text 
                          key={idx}
                          style={{ 
                            ...TYPOGRAPHY.xs,
                            color: colors.textMuted,
                            fontSize: 10,
                            textAlign: "right"
                          }}
                        >
                          {formatYAxisLabel(value)}
                        </Text>
                      ))}
                    </View>
                    
                    {/* Chart Bars */}
                    <View style={{ 
                      flex: 1,
                      flexDirection: "row", 
                      alignItems: "flex-end",
                      justifyContent: "space-between",
                      marginLeft: 55,
                      paddingTop: SPACING.sm,
                    }}>
                      {monthlyTrendData.map((monthData, index) => {
                        const isCurrentMonth = monthData.monthIndex === currentMonthIndex && monthData.year === currentYear;
                        // Calculate bar height based on dynamic max
                        const barHeight = maxMonthlyAmount > 0 
                          ? (monthData.amount / maxMonthlyAmount) * 160 
                          : 0; // Max height 160
                        const minHeight = monthData.amount > 0 ? 8 : 4;
                        const height = Math.max(minHeight, barHeight);
                        
                        return (
                          <View
                            key={index}
                            style={{
                              flex: 1,
                              alignItems: "center",
                              justifyContent: "flex-end",
                              marginHorizontal: 2,
                            }}
                          >
                            {/* Bar */}
                            <View
                              style={{
                                width: "80%",
                                height: height,
                                backgroundColor: isCurrentMonth ? colors.accent : "#6E8BFF",
                                borderTopLeftRadius: 4,
                                borderTopRightRadius: 4,
                                ...SHADOWS.sm
                              }}
                            />
                            {/* Month Label Only */}
                            <Text style={{ 
                              ...TYPOGRAPHY.xs, 
                              color: colors.textMuted,
                              fontSize: 10,
                              marginTop: SPACING.xs,
                              fontWeight: "500"
                            }}>
                              {monthData.month}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </View>
              </View>
            )}

            </View>
          </View>
        </View>

        {/* Optimized Category Filter */}
        <View style={{ 
          paddingHorizontal: SPACING.lg,
          marginBottom: SPACING.lg
        }}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ 
              paddingHorizontal: SPACING.xs,
              gap: SPACING.sm 
            }}
          >
            {categories.map(category => (
              <TouchableOpacity
                key={category}
                onPress={() => setSelectedCategory(category)}
                style={{
                  paddingVertical: SPACING.sm,
                  paddingHorizontal: SPACING.md,
                  backgroundColor: selectedCategory === category ? colors.accent : colors.surface,
                  borderRadius: RADIUS.xl,
                  borderWidth: 1,
                  borderColor: selectedCategory === category ? colors.accent : colors.borderLight,
                  minWidth: 60,
                  alignItems: "center"
                }}
              >
                <Text style={{
                  ...TYPOGRAPHY.sm,
                  color: selectedCategory === category ? colors.white : colors.textMuted,
                  fontWeight: selectedCategory === category ? "600" : "500",
                  fontSize: 13
                }}>
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Expenses List */}
        <View style={{ 
          paddingHorizontal: SPACING.lg,
          marginBottom: SPACING.lg
        }}>
          <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "600", marginBottom: SPACING.md, color: colors.text }}>
            Recent Expenses
          </Text>
          {orderedExpenses.length === 0 ? (
            <Card>
              <EmptyState
                icon="card-outline"
                title="No expenses yet"
                subtitle="Add your first expense or scan a receipt."
                ctaLabel="Add expense"
                onPress={() => setShowAddModal(true)}
              />
            </Card>
          ) : (
            orderedExpenses.map(expense => (
              <ExpenseCard
                key={expense.id}
                expense={expense}
                highlighted={expense.id === highlightedExpenseId}
                onOpenActions={() => openExpenseActions(expense)}
              />
            ))
          )}
        </View>

        {/* Sanity check spacer to ensure scrollable content */}
        <View style={{ height: 200, backgroundColor: 'transparent' }} />
      </ScrollView>

      {/* Add Expense Modal */}
      <AddExpenseModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={addExpense}
        petId={activePetId || undefined}
      />

      {/* Edit Expense Modal */}
      <AddExpenseModal
        visible={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingExpense(null);
        }}
        onSave={saveExpenseEdits}
        onDelete={() => editingExpense && removeExpense(editingExpense.id)}
        petId={activePetId || undefined}
        initialExpense={editingExpense}
      />

      <ActionSheet
        visible={actionSheetVisible}
        title={actionSheetTitle}
        options={actionSheetOptions}
        onClose={() => setActionSheetVisible(false)}
      />
    </View>
  );
}

