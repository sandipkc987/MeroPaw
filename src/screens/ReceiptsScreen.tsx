import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "@src/components/ScreenHeader";
import { Card, Button } from "@src/components/UI";
import { useTheme } from "@src/contexts/ThemeContext";
import { useNavigation } from "@src/contexts/NavigationContext";
import { usePets } from "@src/contexts/PetContext";
import { useAuth } from "@src/contexts/AuthContext";
import { RADIUS, SPACING, TYPOGRAPHY, SHADOWS } from "@src/theme";
import ReceiptViewer from "@src/components/ReceiptViewer";
import { fetchReceipts } from "@src/services/supabaseData";

interface ExpenseReceipt {
  id: string;
  title: string;
  amount: number;
  date: string;
  category: string;
  receipt: { type: "image" | "pdf"; url: string; name: string };
}

export default function ReceiptsScreen() {
  const { colors } = useTheme();
  const { navigateTo, triggerAddExpense } = useNavigation();
  const { activePetId } = usePets();
  const { user } = useAuth();
  const [receipts, setReceipts] = useState<ExpenseReceipt[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<ExpenseReceipt["receipt"] | null>(null);

  useEffect(() => {
    const loadReceipts = async () => {
      try {
        if (!user?.id || !activePetId) {
          setReceipts([]);
          return;
        }
        const remote = await fetchReceipts(user.id, activePetId);
        setReceipts(remote);
      } catch (error) {
        console.error("ReceiptsScreen: Failed to load receipts", error);
        setReceipts([]);
      }
    };

    loadReceipts();
  }, [activePetId, user?.id]);

  const hasReceipts = receipts.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Receipts" />
      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {!hasReceipts ? (
          <Card style={{ alignItems: "center", paddingVertical: SPACING.xl }}>
            <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
            <Text style={{ ...TYPOGRAPHY.base, color: colors.textMuted, marginTop: SPACING.md }}>
              No receipts yet
            </Text>
            <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginTop: SPACING.xs }}>
              Add an expense with a receipt to see it here.
            </Text>
            <Button
              title="Add Expense"
              onPress={() => {
                navigateTo("Expenses");
                triggerAddExpense();
              }}
              style={{ marginTop: SPACING.md }}
            />
          </Card>
        ) : (
          <View style={{ gap: SPACING.md }}>
            {receipts.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => setSelectedReceipt(item.receipt)}
                activeOpacity={0.9}
                style={{
                  backgroundColor: colors.card,
                  borderRadius: RADIUS.lg,
                  borderWidth: 1,
                  borderColor: colors.borderLight,
                  overflow: "hidden",
                  ...SHADOWS.sm,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={{ width: 72, height: 72, backgroundColor: colors.bgSecondary }}>
                    {item.receipt.type === "image" ? (
                      <Image
                        source={{ uri: item.receipt.url }}
                        style={{ width: "100%", height: "100%" }}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="document-text-outline" size={28} color={colors.textMuted} />
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm }}>
                    <Text style={{ ...TYPOGRAPHY.base, color: colors.text, fontWeight: "700" }}>
                      {item.title}
                    </Text>
                    <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginTop: 2 }}>
                      {new Date(item.date).toLocaleDateString()} • {item.category}
                    </Text>
                    <Text style={{ ...TYPOGRAPHY.sm, color: colors.accent, marginTop: 4 }}>
                      Tap to view receipt
                    </Text>
                  </View>
                  <View style={{ paddingRight: SPACING.md }}>
                    <Text style={{ ...TYPOGRAPHY.base, color: colors.text, fontWeight: "700" }}>
                      ${item.amount.toFixed(2)}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={{ marginTop: SPACING.xs }} />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {selectedReceipt && (
        <ReceiptViewer
          visible={!!selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
          receipt={selectedReceipt}
        />
      )}
    </View>
  );
}

