import React from "react";
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Pressable, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@src/contexts/ThemeContext";
import { SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from "@src/theme";

// Original UI Components
export function Button({ 
  title, 
  onPress, 
  disabled = false, 
  size = "md",
  style,
  titleStyle
}: { 
  title: string; 
  onPress: () => void; 
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  style?: any;
  titleStyle?: any;
}) {
  const { colors } = useTheme();
  const sizeStyles = {
    sm: { paddingVertical: 8, paddingHorizontal: 16, fontSize: 14 },
    md: { paddingVertical: 12, paddingHorizontal: 20, fontSize: 16 },
    lg: { paddingVertical: 16, paddingHorizontal: 24, fontSize: 16 },
  };
  
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[
        {
          backgroundColor: disabled ? colors.borderLight : colors.accent,
          borderRadius: RADIUS.md,
          alignItems: "center",
          justifyContent: "center",
          ...sizeStyles[size],
        },
        style,
      ]}
    >
      <Text style={[
        {
          color: disabled ? colors.textMuted : colors.white,
          fontWeight: "600",
          fontSize: sizeStyles[size].fontSize,
        },
        titleStyle,
      ]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

export function Input({
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = "default",
  autoCapitalize = "sentences",
  style,
  ...props
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: any;
  autoCapitalize?: any;
  style?: any;
  [key: string]: any;
}) {
  const { colors } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      style={[
        {
          backgroundColor: colors.cardSecondary,
          borderWidth: 1,
          borderColor: colors.borderLight,
          borderRadius: RADIUS.md,
          paddingHorizontal: SPACING.md,
          paddingVertical: SPACING.md,
          ...TYPOGRAPHY.base,
          color: colors.text,
        },
        style,
      ]}
      {...props}
    />
  );
}

export function Card({ children, style, elevated = false }: { children: React.ReactNode; style?: any; elevated?: boolean }) {
  const { colors } = useTheme();
  const defaultStyles = {
    backgroundColor: colors.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...(elevated && SHADOWS.sm),
  };
  
  return (
    <View style={[defaultStyles, style]}>
      {children}
    </View>
  );
}

export function Chip({ 
  label, 
  selected = false, 
  onPress,
  style 
}: { 
  label: string; 
  selected?: boolean;
  onPress?: () => void;
  style?: any;
}) {
  const { colors } = useTheme();
  const chipStyle = [
    {
      backgroundColor: selected ? colors.accent : colors.chip,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.pill,
      borderWidth: 1,
      borderColor: selected ? colors.accent : colors.borderLight,
    },
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={chipStyle}
      >
        <Text style={{
          ...TYPOGRAPHY.sm,
          color: selected ? colors.white : colors.text,
          fontWeight: selected ? "600" : "500",
        }}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={chipStyle}>
      <Text style={{
        ...TYPOGRAPHY.sm,
        color: selected ? colors.white : colors.text,
        fontWeight: selected ? "600" : "500",
      }}>
        {label}
      </Text>
    </View>
  );
}

export function Banner({
  text,
  tone = "info",
  style,
}: {
  text: string;
  tone?: "info" | "success" | "warning" | "error";
  style?: any;
}) {
  const { colors } = useTheme();
  const toneMap = {
    info: { bg: colors.accent + "15", text: colors.text },
    success: { bg: colors.success + "20", text: colors.success },
    warning: { bg: colors.warning + "20", text: colors.warning },
    error: { bg: colors.danger + "20", text: colors.danger },
  };
  const toneStyle = toneMap[tone];

  return (
    <View
      style={[
        {
          backgroundColor: toneStyle.bg,
          borderRadius: RADIUS.md,
          paddingVertical: SPACING.sm,
          paddingHorizontal: SPACING.md,
          borderWidth: 1,
          borderColor: colors.borderLight,
        },
        style,
      ]}
    >
      <Text style={{ ...TYPOGRAPHY.sm, color: toneStyle.text }}>{text}</Text>
    </View>
  );
}

export function Toggle({
  value,
  onValueChange,
  disabled = false,
}: {
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: colors.borderLight, true: colors.accent }}
      thumbColor={colors.white}
      ios_backgroundColor={colors.borderLight}
    />
  );
}

// New Settings Screen Components
export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
    </View>
  );
}

export function Row({ label, hint, control, disabled, icon, iconColor, onPress }: { label: string; hint?: string; control: React.ReactNode; disabled?: boolean; icon?: string; iconColor?: string; onPress?: () => void }) {
  const { colors } = useTheme();
  const labelContent = icon ? (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Ionicons name={icon as any} size={18} color={iconColor || colors.accent} style={{ marginRight: 8 }} />
      <Text style={[styles.rowLabel, { color: colors.text }]} numberOfLines={1}>{label}</Text>
    </View>
  ) : (
    <Text style={[styles.rowLabel, { color: colors.text }]} numberOfLines={1}>{label}</Text>
  );

  const content = (
    <>
      <View style={{ flex: 1, paddingRight: 12 }}>
        {labelContent}
        {hint ? <Text style={[styles.rowHint, { color: colors.textMuted }]}>{hint}</Text> : null}
      </View>
      <View>{control}</View>
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        style={[styles.row, disabled && styles.rowDisabled]}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.row, disabled && styles.rowDisabled]}>
      {content}
    </View>
  );
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />;
}

export function Pill({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: colors.accentVeryLight, borderColor: colors.accentLight }]}>
      <Text style={[styles.pillText, { color: colors.accent }]}>{children as any}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontWeight: "700", fontSize: 16 },
  sectionSubtitle: { fontSize: 12, marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10 },
  rowDisabled: { opacity: 0.5 },
  rowLabel: { fontSize: 15, fontWeight: "600" },
  rowHint: { fontSize: 12, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 6 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  pillText: { fontSize: 12, fontWeight: "600" },
});
