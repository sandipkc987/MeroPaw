import React from "react";
import { View, ScrollView } from "react-native";
import { SPACING } from "@src/theme";
import IconTile from "./IconTile";
import { navItems } from "@src/data/seed";
import { useNavigation } from "@src/contexts/NavigationContext";
import { useTheme } from "@src/contexts/ThemeContext";

interface QuickActionNavProps {
  activeTab: string | null;
}

export default function QuickActionNav({ activeTab }: QuickActionNavProps) {
  const { colors } = useTheme();
  const { navigateTo } = useNavigation();
  return (
    <View style={{
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
      paddingVertical: SPACING.sm
    }}>
      <ScrollView
        horizontal
        bounces
        decelerationRate="fast"
        snapToAlignment="start"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ 
          paddingHorizontal: SPACING.sm,
          paddingRight: SPACING.lg
        }}
      >
        {navItems.map((i, idx) => (
          <IconTile
            key={i.label}
            icon={i.label}
            label={i.label}
            onPress={() => navigateTo(i.label)}
            active={i.label === activeTab}
            style={{
              marginRight: idx !== navItems.length - 1 ? SPACING.sm : SPACING.md,
              minWidth: 85,
              height: 40
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
}
