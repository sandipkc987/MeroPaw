import React from "react";
import { Modal, View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SPACING, RADIUS, TYPOGRAPHY, SHADOWS } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";

export type ActionSheetOption = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  subtitle?: string;
};

type ActionSheetProps = {
  visible: boolean;
  title?: string;
  options: ActionSheetOption[];
  onClose: () => void;
  variant?: "list" | "quick";
  footerText?: string;
};

export default function ActionSheet({ visible, title, options, onClose, variant = "list", footerText }: ActionSheetProps) {
  const { colors } = useTheme();
  if (!visible) return null;
  const isCentered = variant === "quick";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.65)",
          justifyContent: isCentered ? "center" : "flex-end",
          alignItems: isCentered ? "center" : undefined,
          paddingHorizontal: SPACING.lg,
          paddingBottom: isCentered ? 0 : SPACING.lg,
          paddingTop: isCentered ? SPACING.lg : 0,
        }}
      >
        <View
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: isCentered ? RADIUS.xl : RADIUS.xl,
            borderTopRightRadius: isCentered ? RADIUS.xl : RADIUS.xl,
            borderRadius: isCentered ? RADIUS.xl : undefined,
            width: isCentered ? "100%" : undefined,
            maxWidth: isCentered ? 420 : undefined,
            paddingHorizontal: SPACING.lg,
            paddingTop: SPACING.md,
            paddingBottom: SPACING.lg,
            borderTopWidth: isCentered ? 0 : 1,
            borderTopColor: colors.borderLight,
            ...SHADOWS.lg,
          }}
          onStartShouldSetResponder={() => true}
        >
          {!isCentered && (
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                alignSelf: "center",
                backgroundColor: colors.borderLight,
                marginBottom: SPACING.md,
              }}
            />
          )}
          {variant === "quick" ? (
            <>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: SPACING.md,
                }}
              >
                <View>
                  <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "700", color: colors.text, letterSpacing: -0.2 }}>
                    {title || "Quick Update"}
                  </Text>
                  <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginTop: 2 }}>
                    Choose how you want to add a record
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: colors.cardSecondary,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: colors.borderLight,
                  }}
                >
                  <Ionicons name="close" size={18} color={colors.text} />
                </TouchableOpacity>
              </View>
              <View
                style={{
                  height: 1,
                  backgroundColor: colors.borderLight,
                  marginBottom: SPACING.lg,
                }}
              />
              <ScrollView showsVerticalScrollIndicator={false}>
              {options.map((option, idx) => (
                <TouchableOpacity
                  key={`${option.label}-${idx}`}
                  onPress={() => {
                    onClose();
                    option.onPress();
                  }}
                  disabled={option.disabled}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: SPACING.md,
                    paddingHorizontal: SPACING.md,
                    backgroundColor: colors.cardSecondary,
                    borderRadius: RADIUS.md,
                    marginBottom: SPACING.sm,
                    borderWidth: 1,
                    borderColor: colors.borderLight,
                    opacity: option.disabled ? 0.5 : 1,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: colors.surface,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: SPACING.md,
                      borderWidth: 1,
                      borderColor: colors.borderLight,
                    }}
                  >
                    {option.icon ? (
                      <Ionicons
                        name={option.icon}
                        size={22}
                        color={option.iconColor || colors.accent}
                      />
                    ) : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...TYPOGRAPHY.base, fontWeight: "600", color: colors.text }}>
                      {option.label}
                    </Text>
                    {option.subtitle ? (
                      <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginTop: 2 }}>
                        {option.subtitle}
                      </Text>
                    ) : null}
                  </View>
                  <View style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: colors.surface,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: colors.borderLight,
                  }}>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </View>
                </TouchableOpacity>
              ))}
              </ScrollView>
              {footerText ? (
                <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginTop: SPACING.sm }}>
                  {footerText}
                </Text>
              ) : null}
            </>
          ) : (
            <>
              {title ? (
                <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginBottom: SPACING.sm }}>
                  {title}
                </Text>
              ) : null}
            <View style={{ gap: SPACING.xs }}>
              {options.map((option, idx) => (
                <TouchableOpacity
                  key={`${option.label}-${idx}`}
                  onPress={() => {
                    onClose();
                    option.onPress();
                  }}
                  disabled={option.disabled}
                  style={{
                    paddingVertical: SPACING.sm + 2,
                    paddingHorizontal: SPACING.sm,
                    borderRadius: RADIUS.md,
                  backgroundColor: colors.cardSecondary,
                    borderWidth: 1,
                    borderColor: colors.borderLight,
                    opacity: option.disabled ? 0.5 : 1,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    {option.icon ? (
                    <View style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: colors.surface,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: SPACING.sm,
                      borderWidth: 1,
                      borderColor: colors.borderLight,
                    }}>
                        <Ionicons
                          name={option.icon}
                          size={16}
                          color={colors.textMuted}
                        />
                      </View>
                    ) : null}
                    <Text
                      style={{
                        ...TYPOGRAPHY.base,
                        color: colors.text,
                        fontWeight: "600",
                        flex: 1,
                      }}
                    >
                      {option.label}
                    </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            </>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

