import React, { useState } from "react";
import { View, Text, Pressable, Modal, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SPACING, RADIUS, SHADOWS } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";

export type Option = { label: string; value: string };

export default function Select({
  value,
  onChange,
  options,
  placeholder,
  modalTitle,
  modalIcon,
  width = 220,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  modalTitle?: string;
  modalIcon?: string;
  width?: number;
}) {
  const { colors } = useTheme();
  const current = options.find((o) => o.value === value)?.label || placeholder || "Select";
  const [open, setOpen] = useState(false);
  const showHeader = !!modalTitle || !!modalIcon;
  return (
    <>
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={[{
        paddingHorizontal: SPACING.md,
        paddingVertical: 10,
        backgroundColor: colors.surface,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: colors.borderLight,
        width
      }]}>
        <Text style={{ color: colors.text, fontSize: 14 }} numberOfLines={1}>{current}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <View
            style={[
              styles.modalCard,
              {
            backgroundColor: colors.card,
                borderColor: colors.borderLight,
                shadowColor: colors.black,
              },
            ]}
            onStartShouldSetResponder={() => true}
          >
            {showHeader ? (
              <View style={[styles.modalHeader, { borderBottomColor: colors.borderLight }]}>
                <View style={styles.modalTitleRow}>
                  {modalIcon ? <Ionicons name={modalIcon as any} size={18} color={colors.accent} /> : null}
                  {modalTitle ? (
                    <Text style={[styles.modalTitle, { color: colors.text }]}>{modalTitle}</Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => setOpen(false)}
                  style={[
                    styles.closeButton,
                    { backgroundColor: colors.surface, borderColor: colors.borderLight },
                  ]}
                >
                  <Ionicons name="close" size={18} color={colors.text} />
                </Pressable>
              </View>
            ) : null}
            {options.map((o) => (
              <Pressable
                key={o.value}
                onPress={() => { onChange(o.value); setOpen(false); }}
                style={[
                  styles.optionRow,
                  o.value === value && { backgroundColor: colors.accent + "12" },
                ]}
              >
                <Text style={[
                  { color: colors.text, fontSize: 16 },
                  o.value === value && { color: colors.accent, fontWeight: "700" }
                ]}>{o.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.lg,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 6,
    ...SHADOWS.lg,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.sm,
    paddingBottom: SPACING.sm,
    marginBottom: SPACING.xs,
    borderBottomWidth: 1,
  },
  modalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  optionRow: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
});

