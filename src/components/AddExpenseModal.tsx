import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Modal, Alert, ActivityIndicator } from "react-native";
import { RADIUS, SPACING, TYPOGRAPHY, SHADOWS } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import { Button, Input } from "@src/components/UI";
import { Ionicons } from "@expo/vector-icons";
import ReceiptUpload from "@src/components/ReceiptUpload";
import analyzeReceipt from "@src/services/receiptAnalysis";
import Select from "@src/components/Select";
import { getReceiptPublicUrl } from "@src/services/supabaseData";

const expenseCategories = ["food", "medical", "toys", "grooming", "other"] as const;
export type ExpenseCategory = typeof expenseCategories[number];

export interface ExpenseForModal {
  id?: string;
  title: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
  createdAt?: string;
  notes?: string;
  receipt?: { type: 'image' | 'pdf'; url: string; name: string; uri: string; path?: string; documentId?: string };
}

export default function AddExpenseModal({
  visible,
  onClose,
  onSave,
  onDelete,
  petId,
  initialExpense,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (expense: Omit<ExpenseForModal, 'id'>) => Promise<void>;
  onDelete?: () => void;
  petId?: string | null;
  initialExpense?: ExpenseForModal | null;
}) {
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

  const handleReceiptAnalysis = async (receiptData: { type: 'image' | 'pdf'; uri: string; base64?: string }) => {
    setIsAnalyzing(true);
    try {
      const extractedData = await analyzeReceipt(receiptData.uri, receiptData.type, {
        petId: petId || undefined,
        saveExpense: false,
        base64: receiptData.base64,
      });

      if (extractedData.amount) {
        setAmount(extractedData.amount.toFixed(2));
      }

      if (extractedData.date) {
        try {
          const parsedDate = new Date(extractedData.date);
          if (!isNaN(parsedDate.getTime())) {
            setDate(parsedDate.toISOString().split('T')[0]);
          }
        } catch (e) {
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
        if (firstItem) setTitle(String(firstItem));
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
    if (addMethod !== "receipt") setAnalysisSummary(null);
  }, [addMethod]);

  useEffect(() => {
    if (!visible) setAnalysisSummary(null);
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
}
