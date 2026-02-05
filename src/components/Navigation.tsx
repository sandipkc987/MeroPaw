import React from "react";
import { View, Text, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RADIUS, SPACING, SHADOWS } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";

// Use Ionicons (Expo) or react-native-vector-icons (bare RN)
// Expo:
import { Ionicons } from "@expo/vector-icons";
// Bare RN:
// import Ionicons from "react-native-vector-icons/Ionicons";

interface NavItem {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap; // vector icon name
}

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onAddPress: () => void;
}

const navItems: NavItem[] = [
  { id: "home",    label: "Home",    icon: "home" },
  { id: "shop",    label: "Shop",    icon: "bag" },
  { id: "alerts",  label: "Alerts",  icon: "notifications" },
  { id: "profile", label: "Settings", icon: "settings" },
];

export default function Navigation({ activeTab, onTabChange, onAddPress }: NavigationProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: colors.white,
        paddingHorizontal: SPACING.lg,
        paddingTop: SPACING.sm,
        paddingBottom: SPACING.md + Math.max(insets.bottom, Platform.OS === "android" ? 8 : 0),
        minHeight: 68,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-end",
        borderTopWidth: 1,
        borderTopColor: colors.borderLight,
        ...SHADOWS.lg,
      }}
    >
      {navItems.map((item, index) => {
        const isActive = activeTab === item.id;
        const color = isActive ? colors.accent : colors.textMuted;
        const iconName = isActive ? item.icon : `${item.icon}-outline`;

        return (
          <React.Fragment key={item.id}>
            <Pressable
              onPress={() => onTabChange(item.id)}
              android_ripple={{ color: "#00000010", borderless: true }}
              style={{
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: SPACING.sm,
                paddingHorizontal: SPACING.md,
                minWidth: 56,
                minHeight: 44,
              }}
              hitSlop={10}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              <Ionicons name={iconName as any} size={26} color={color} />
            </Pressable>

            {/* Center + button after Shop (index 1) */}
            {index === 1 && (
              <Pressable
                onPress={onAddPress}
                android_ripple={{ color: "#ffffff30", borderless: true }}
                style={{
                  backgroundColor: colors.accent,
                  borderRadius: RADIUS.pill,
                  paddingHorizontal: SPACING.md,
                  height: 48,
                  minWidth: 56,
                  marginBottom: 2,
                  alignItems: "center",
                  justifyContent: "center",
                  ...SHADOWS.md,
                }}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Add"
              >
                <Ionicons name="add" size={20} color={colors.white} />
              </Pressable>
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}