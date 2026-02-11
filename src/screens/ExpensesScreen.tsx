import React, { useState, useEffect, useMemo, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, Modal, Alert, ActivityIndicator } from "react-native";
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
import ReceiptUpload from "@src/components/ReceiptUpload";
import analyzeReceipt from "@src/services/receiptAnalysis";
import Select from "@src/components/Select";
import { fetchExpenses, insertExpense, updateExpense, deleteExpense, getReceiptPublicUrl, insertNotification } from "@src/services/supabaseData";
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

// Add Expense Modal Component
const AddExpenseModal = ({ visible, onClose, onSave, onDelete, petId, initialExpense }: {
  visible: boolean;
  onClose: () => void;
  onSave: (expense: Omit<Expense, 'id'>) => Promise<void>;
  onDelete?: () => void;
  petId?: string | null;
  initialExpense?: Expense | null;
}) => {
  const { colors } = useTheme();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("other");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState("");
  const [addMethod, setAddMethod] = useState<"manual" | "receipt">("manual");
  const [receipt, setReceipt] = useState<{ type: 'image' | 'pdf'; url: string; name: string; uri: string; path?: string; documentId?: string } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisSummary, setAnalysisSummary] = useState<string | null>(null);
  const isEdit = !!initialExpense;

  const categories: { value: ExpenseCategory; label: string; emoji: string }[] = [
    { value: "food", label: "Food", emoji: "🍽️" },
    { value: "medical", label: "Medical", emoji: "🏥" },
    { value: "toys", label: "Toys", emoji: "🎾" },
    { value: "grooming", label: "Grooming", emoji: "✂️" },
    { value: "other", label: "Other", emoji: "📦" },
  ];
  const categoryOptions = categories.map((cat) => ({
    label: cat.label,
    value: cat.value,
  }));

  const isExpenseCategory = (value: string): value is ExpenseCategory =>
    (expenseCategories as readonly string[]).includes(value);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Error", "Please enter a title for the expense");
      return;
    }
    if (!amount.trim() || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }

    await onSave({
      title: title.trim(),
      amount: Number(amount),
      category,
      date,
      notes: notes.trim() || undefined,
      receipt: receipt || undefined,
    });

    // Reset form
    setTitle("");
    setAmount("");
    setCategory("other");
    setDate(new Date().toISOString().split('T')[0]);
    setNotes("");
    setAddMethod("manual");
    setReceipt(null);
    setAnalysisSummary(null);
    onClose();
  };

  useEffect(() => {
    if (!visible) return;
    if (initialExpense) {
      setTitle(initialExpense.title || "");
      setAmount(initialExpense.amount ? initialExpense.amount.toString() : "");
      setCategory(initialExpense.category || "other");
      setDate(initialExpense.date || new Date().toISOString().split('T')[0]);
      setReceipt(initialExpense.receipt || null);
      setNotes(initialExpense.notes || "");
      setAddMethod(initialExpense.receipt ? "receipt" : "manual");
      setAnalysisSummary(null);
      return;
    }
    setTitle("");
    setAmount("");
    setCategory("other");
    setDate(new Date().toISOString().split('T')[0]);
    setAddMethod("manual");
    setReceipt(null);
    setNotes("");
    setAnalysisSummary(null);
  }, [visible, initialExpense]);

  const handleReceiptAnalysis = async (receiptData: { type: 'image' | 'pdf'; uri: string }) => {
    setIsAnalyzing(true);
    try {
      const extractedData = await analyzeReceipt(receiptData.uri, receiptData.type, {
        petId: petId || undefined,
        saveExpense: false,
      });
      
      // Auto-populate fields with extracted data
      if (extractedData.amount) {
        setAmount(extractedData.amount.toFixed(2));
      }
      
      if (extractedData.date) {
        // Try to parse and format date
        try {
          const parsedDate = new Date(extractedData.date);
          if (!isNaN(parsedDate.getTime())) {
            setDate(parsedDate.toISOString().split('T')[0]);
          }
        } catch (e) {
          // If date parsing fails, try to extract from string
          const dateMatch = extractedData.date.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
          if (dateMatch) {
            const [_, month, day, year] = dateMatch;
            const fullYear = year.length === 2 ? `20${year}` : year;
            setDate(`${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
          }
        }
      }
      
      if (extractedData.merchant) {
        setTitle(extractedData.merchant);
      } else {
        const firstItem = extractedData.items?.[0];
        if (firstItem) {
          // Use first item as title if no merchant
          setTitle(String(firstItem));
        }
      }
      
      if (extractedData.category) {
        setCategory(isExpenseCategory(extractedData.category) ? extractedData.category : "other");
      }

      if (extractedData.receiptPath) {
        const publicUrl = getReceiptPublicUrl(extractedData.receiptPath);
        if (publicUrl) {
          setReceipt(prev => prev ? {
            ...prev,
            url: publicUrl,
            path: extractedData.receiptPath,
            documentId: extractedData.documentId,
          } : null);
        }
      }
      
      const summary = `Extracted ${extractedData.amount ? `$${extractedData.amount.toFixed(2)}` : "amount"} from ${extractedData.merchant || "receipt"}. Please review and adjust if needed.`;
      setAnalysisSummary(summary);
    } catch (error) {
      console.error("Receipt analysis error:", error);
      const message = error instanceof Error ? error.message : "Could not analyze receipt.";
      Alert.alert("Analysis Error", message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (addMethod !== "receipt") {
      setAnalysisSummary(null);
    }
  }, [addMethod]);

  useEffect(() => {
    if (!visible) {
      setAnalysisSummary(null);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{ 
        flex: 1, 
        backgroundColor: colors.black + "80", 
        justifyContent: "center",
        alignItems: "center",
        padding: SPACING.lg
      }}>
        <View style={{ 
          width: "100%",
          maxWidth: 420,
          backgroundColor: colors.card, 
          borderRadius: RADIUS.xl,
          paddingTop: SPACING.lg,
          paddingHorizontal: SPACING.lg,
          paddingBottom: SPACING.xl,
          maxHeight: "85%",
          borderWidth: 1,
          borderColor: colors.borderLight,
          overflow: "hidden",
          ...SHADOWS.lg
        }}>
          <View style={{ 
            flexDirection: "row", 
            justifyContent: "space-between", 
            alignItems: "center", 
            marginBottom: SPACING.xs
          }}>
            <View>
              <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "700", color: colors.text }}>
                {isEdit ? "Edit Expense" : "Add expense"}
              </Text>
              <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginTop: 2 }}>
                Track a purchase for your pet
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={{ height: 1, backgroundColor: colors.borderLight, marginBottom: SPACING.md }} />
          
          <ScrollView
            showsVerticalScrollIndicator
            contentContainerStyle={{ paddingBottom: SPACING.md, paddingTop: SPACING.sm }}
          >
            {/* Add Method Selection */}
            <View style={{ marginBottom: SPACING.lg }}>
              <View
                style={{
                  flexDirection: "row",
                  borderRadius: RADIUS.pill,
                  borderWidth: 1,
                  borderColor: colors.borderLight,
                  backgroundColor: colors.cardSecondary,
                  overflow: "hidden",
                }}
              >
                {(["manual", "receipt"] as const).map((method, idx) => {
                  const isActive = addMethod === method;
                  return (
                    <TouchableOpacity
                      key={method}
                      onPress={() => setAddMethod(method)}
                      style={{
                        flex: 1,
                        paddingVertical: SPACING.sm,
                        alignItems: "center",
                        backgroundColor: isActive ? colors.accent : "transparent",
                        borderRightWidth: idx === 1 ? 0 : 1,
                        borderRightColor: colors.borderLight,
                      }}
                    >
                      <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: isActive ? colors.white : colors.textMuted }}>
                        {method === "manual" ? "Manual" : "Receipt"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {addMethod === "manual" && (
              <View style={{ gap: SPACING.md }}>
                <View>
                  <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", marginBottom: SPACING.xs, color: colors.text }}>
                    Expense name
                  </Text>
                  <Input
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Premium dog food"
                  />
                </View>
                
                <View>
                  <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", marginBottom: SPACING.xs, color: colors.text }}>
                    Amount
                  </Text>
                  <Input
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="0.00"
                    keyboardType="numeric"
                  />
                </View>

                {/* Category Selection */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: colors.text }}>
                    Category
                  </Text>
                  <View style={{ position: "relative" }}>
                    <Select
                      value={category}
                      onChange={(v) => setCategory(v as ExpenseCategory)}
                      options={categoryOptions}
                      modalTitle="Category"
                      modalIcon="pricetag-outline"
                      width={200}
                    />
                    <View
                      pointerEvents="none"
                      style={{
                        position: "absolute",
                        right: 10,
                        top: "50%",
                        transform: [{ translateY: -8 }],
                      }}
                    >
                      <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
                    </View>
                  </View>
                </View>

                <View>
                  <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", marginBottom: SPACING.xs, color: colors.text }}>
                    Notes (optional)
                  </Text>
                  <Input
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Add notes"
                    multiline
                    style={{ minHeight: 80 }}
                  />
                </View>

                <View>
                  <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", marginBottom: SPACING.xs, color: colors.text }}>
                    Date
                  </Text>
                  <Input
                    value={date}
                    onChangeText={setDate}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
              </View>
            )}

            {addMethod === "receipt" && (
              <View>
                <View style={{ marginBottom: SPACING.md }}>
                  <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", marginBottom: SPACING.xs, color: colors.text }}>
                    Receipt upload
                  </Text>
                  <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginBottom: SPACING.md }}>
                    Auto-fill amount, date, and merchant from a photo or PDF.
                  </Text>
                  
                  <ReceiptUpload
                    onReceiptSelect={setReceipt}
                    currentReceipt={receipt}
                    onAnalyze={handleReceiptAnalysis}
                  />
                </View>

                {isAnalyzing && (
                  <View style={{ 
                    flexDirection: "row", 
                    alignItems: "center", 
                    justifyContent: "center",
                    paddingVertical: SPACING.md,
                    backgroundColor: colors.accent + "10",
                    borderRadius: RADIUS.md,
                    marginBottom: SPACING.md
                  }}>
                    <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: SPACING.sm }} />
                    <Text style={{ ...TYPOGRAPHY.sm, color: colors.accent, fontWeight: "600" }}>
                      Analyzing receipt...
                    </Text>
                  </View>
                )}

                {analysisSummary && (
                  <View style={{
                    padding: SPACING.md,
                    backgroundColor: colors.successLight,
                    borderRadius: RADIUS.md,
                    borderWidth: 1,
                    borderColor: colors.success,
                    marginBottom: SPACING.md,
                  }}>
                    <Text style={{ ...TYPOGRAPHY.sm, color: colors.success, fontWeight: "600" }}>
                      Receipt analyzed
                    </Text>
                    <Text style={{ ...TYPOGRAPHY.sm, color: colors.text, marginTop: SPACING.xs }}>
                      {analysisSummary}
                    </Text>
                  </View>
                )}

                {/* Form fields for editing extracted data */}
                <View style={{ marginTop: SPACING.md }}>
                  <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", marginBottom: SPACING.xs, color: colors.text }}>
                    Review & edit details
                  </Text>
                  
                  <View style={{ marginBottom: SPACING.md }}>
                    <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", marginBottom: SPACING.xs, color: colors.text }}>
                      Expense name
                    </Text>
                    <Input
                      value={title}
                      onChangeText={setTitle}
                      placeholder="Premium dog food"
                    />
                  </View>
                  
                  <View style={{ marginBottom: SPACING.md }}>
                    <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", marginBottom: SPACING.xs, color: colors.text }}>
                      Amount
                    </Text>
                    <Input
                      value={amount}
                      onChangeText={setAmount}
                      placeholder="0.00"
                      keyboardType="numeric"
                    />
                  </View>

                {/* Category Selection */}
                <View style={{ marginBottom: SPACING.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: colors.text }}>
                    Category
                  </Text>
                  <View style={{ position: "relative" }}>
                    <Select
                      value={category}
                      onChange={(v) => setCategory(v as ExpenseCategory)}
                      options={categoryOptions}
                      modalTitle="Category"
                      modalIcon="pricetag-outline"
                      width={200}
                    />
                    <View
                      pointerEvents="none"
                      style={{
                        position: "absolute",
                        right: 10,
                        top: "50%",
                        transform: [{ translateY: -8 }],
                      }}
                    >
                      <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
                    </View>
                  </View>
                </View>

                  <View style={{ marginBottom: SPACING.md }}>
                    <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", marginBottom: SPACING.xs, color: colors.text }}>
                      Date
                    </Text>
                    <Input
                      value={date}
                      onChangeText={setDate}
                      placeholder="YYYY-MM-DD"
                    />
                  </View>
                  <View style={{ marginBottom: SPACING.md }}>
                    <Input
                      label="Notes (optional)"
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="Add notes"
                      multiline
                      style={{ minHeight: 80 }}
                    />
                  </View>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={{ height: 1, backgroundColor: colors.borderLight, marginTop: SPACING.lg }} />
          <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, textAlign: "center", marginTop: SPACING.sm }}>
            You can edit expenses later.
          </Text>
          <View style={{ 
            flexDirection: "row", 
            marginTop: SPACING.md,
            paddingTop: SPACING.xs
          }}>
            <Button
              title="Cancel"
              onPress={onClose}
              style={{ flex: 1, marginRight: SPACING.sm, backgroundColor: colors.bgSecondary }}
              titleStyle={{ color: colors.text }}
            />
            <Button
              title={isEdit ? "Update" : "Save"}
              onPress={handleSave}
              style={{ flex: 1, marginLeft: SPACING.sm }}
            />
          </View>
          {isEdit && onDelete && (
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  "Delete expense?",
                  "This will remove the expense and its receipt from your list.",
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: onDelete },
                  ]
                );
              }}
              style={{ alignSelf: "flex-start", marginTop: SPACING.sm }}
            >
              <Text style={{ ...TYPOGRAPHY.sm, color: colors.danger, fontWeight: "600" }}>
                Delete expense
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};


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
    <Card style={{ marginBottom: SPACING.md, borderWidth: highlighted ? 1 : 0, borderColor: highlighted ? colors.accent : "transparent" }}>
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
    </Card>
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
        titleStyle={{ ...TYPOGRAPHY.base, fontWeight: "600", letterSpacing: -0.2 }}
        paddingTop={SPACING.lg}
        paddingBottom={SPACING.lg}
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

        {/* Spending Insights Section - Horizontal Tabs */}
        <View style={{ 
          paddingHorizontal: SPACING.lg,
          paddingBottom: SPACING.md,
          marginBottom: SPACING.lg
        }}>
          {/* Tab Navigation Bar */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: SPACING.xs,
              gap: SPACING.lg,
            }}
          >
            {insightTabs.map((tab) => {
              const isActive = activeInsightTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActiveInsightTab(tab)}
                  style={{
                    paddingVertical: SPACING.sm,
                  }}
                >
                  <Text
                    style={{
                      ...TYPOGRAPHY.base,
                      color: isActive ? colors.accent : colors.textMuted,
                      fontWeight: isActive ? "700" : "500",
                      textAlign: "center",
                    }}
                  >
                    {tab}
                  </Text>
                  <View
                    style={{
                      height: 4,
                      borderRadius: 999,
                      backgroundColor: isActive ? colors.accent : "transparent",
                      marginTop: SPACING.xs,
                    }}
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Tab Content */}
          <Card style={{ marginTop: SPACING.sm }}>
            {activeInsightTab === 'Total Spent' && (
              <View style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: SPACING.md
              }}>
                <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted }}>
                  Total Spent
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1, marginLeft: SPACING.md }}>
                  <View style={{ width: 1, height: 20, backgroundColor: colors.borderLight, marginRight: SPACING.md }} />
                  <Text style={{ ...TYPOGRAPHY.base, color: colors.text, flex: 1, fontWeight: "600" }}>
                    ${totalSpent.toFixed(2)}
                  </Text>
                </View>
              </View>
            )}
            
            {activeInsightTab === 'Top Category' && topCategory && (
              <View style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: SPACING.md
              }}>
                <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted }}>
                  Top Category
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1, marginLeft: SPACING.md }}>
                  <View style={{ width: 1, height: 20, backgroundColor: colors.borderLight, marginRight: SPACING.md }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...TYPOGRAPHY.base, color: colors.text, fontWeight: "600" }}>
                      {topCategory.category === "other"
                        ? "Other"
                        : topCategory.category.charAt(0).toUpperCase() + topCategory.category.slice(1)}
                    </Text>
                    <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: 2 }}>
                      ${topCategory.amount.toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>
            )}
            
            {activeInsightTab === 'This Month Spent' && (
              <View style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: SPACING.md
              }}>
                <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted }}>
                  This Month Spent
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1, marginLeft: SPACING.md }}>
                  <View style={{ width: 1, height: 20, backgroundColor: colors.borderLight, marginRight: SPACING.md }} />
                  <Text style={{ ...TYPOGRAPHY.base, color: colors.text, flex: 1, fontWeight: "600" }}>
                    ${thisMonthSpent.toFixed(2)}
                  </Text>
                </View>
              </View>
            )}
          </Card>
        </View>
        
        {/* Period Filter Section */}
        <View style={{ 
          paddingHorizontal: SPACING.lg,
          marginBottom: SPACING.lg
        }}>
          <Card>
            {/* Recent Activity Filter */}
            <TouchableOpacity
              onPress={() => setShowRecentActivityFilter(!showRecentActivityFilter)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: SPACING.md
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginRight: SPACING.md }}>
                  Time period
                </Text>
                <View style={{ width: 1, height: 20, backgroundColor: colors.borderLight, marginRight: SPACING.md }} />
                <Text style={{ ...TYPOGRAPHY.base, color: colors.accent, flex: 1 }}>
                  {getPeriodLabel(timePeriod)}
                </Text>
              </View>
              <Ionicons 
                name={showRecentActivityFilter ? "chevron-up" : "chevron-forward"} 
                size={16} 
                color={colors.accent} 
                style={{ marginLeft: SPACING.xs }}
              />
            </TouchableOpacity>
            
            {/* Dynamic Filter Options */}
            {showRecentActivityFilter && (
              <View style={{
                paddingTop: SPACING.sm,
                borderTopWidth: 1,
                borderTopColor: colors.borderLight,
                marginTop: SPACING.xs
              }}>
                {periodOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => {
                      setTimePeriod(option.value as TimePeriod);
                      setShowRecentActivityFilter(false);
                    }}
                    style={{
                      paddingVertical: SPACING.sm,
                      paddingHorizontal: SPACING.md,
                      borderRadius: RADIUS.md,
                      backgroundColor: timePeriod === option.value ? colors.accent + "10" : "transparent",
                      marginBottom: SPACING.xs
                    }}
                  >
                    <Text style={{
                      ...TYPOGRAPHY.base,
                      color: timePeriod === option.value ? colors.accent : colors.text,
                      fontWeight: timePeriod === option.value ? "600" : "400"
                    }}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </Card>

          {/* View All Files Row */}
          <TouchableOpacity
            onPress={handleViewAllFiles}
            activeOpacity={0.8}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: SPACING.lg,
              paddingHorizontal: SPACING.lg,
              backgroundColor: colors.card,
              borderRadius: RADIUS.xl,
              marginTop: SPACING.sm,
              ...SHADOWS.sm,
              borderWidth: 1,
              borderColor: colors.borderLight,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.accent + "15",
                alignItems: "center",
                justifyContent: "center",
                marginRight: SPACING.md,
              }}>
                <Ionicons name="document-text-outline" size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ 
                  ...TYPOGRAPHY.base, 
                  color: colors.text, 
                  fontWeight: "700",
                  marginBottom: 2,
                }}>
                  View All Files
                </Text>
                <Text style={{ 
                  ...TYPOGRAPHY.xs, 
                  color: colors.textMuted,
                }}>
                  Receipts and attachments
                </Text>
              </View>
            </View>
            <View style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: colors.accent + "10",
              alignItems: "center",
              justifyContent: "center",
              marginLeft: SPACING.sm,
            }}>
              <Ionicons name="chevron-forward" size={18} color={colors.accent} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Spending Charts with Tabs */}
        <View style={{ 
          paddingHorizontal: SPACING.lg,
          marginBottom: SPACING.lg
        }}>
          <Card>
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
            
          </Card>
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

