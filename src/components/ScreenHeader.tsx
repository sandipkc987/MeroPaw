import React from "react";
import { View, Text, TouchableOpacity, Image, Platform, StatusBar } from "react-native";
import { SPACING, TYPOGRAPHY } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@src/contexts/NavigationContext";

interface ScreenHeaderProps {
  title: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  avatarUri?: string | null;
  avatarFallback?: string;
  onAvatarPress?: () => void;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  onActionPress?: () => void;
  variant?: "default" | "stacked";
  centerTitle?: boolean;
  titleStyle?: any;
  paddingTop?: number;
  paddingBottom?: number;
}

export default function ScreenHeader({
  title,
  showBackButton = true,
  onBackPress,
  avatarUri,
  avatarFallback,
  onAvatarPress,
  actionIcon,
  onActionPress,
  variant = "default",
  centerTitle = false,
  titleStyle,
  paddingTop,
  paddingBottom,
}: ScreenHeaderProps) {
  const { colors } = useTheme();
  const { navigateTo, goBack, canGoBack } = useNavigation();
  const showAction = !!actionIcon && !!onActionPress;
  const showAvatar = !!avatarUri || !!avatarFallback;
  const topInset = Platform.OS === "android" ? (StatusBar.currentHeight || 0) : 0;
  const isStacked = variant === "stacked";
  const hasTitle = !!title;

  return (
    <>
      <View style={{
        paddingHorizontal: SPACING.lg,
        paddingTop:
          typeof paddingTop === "number"
            ? topInset + paddingTop
            : topInset + SPACING.md,
        paddingBottom:
          typeof paddingBottom === "number"
            ? paddingBottom
            : (isStacked && !hasTitle ? SPACING.xs : SPACING.md + 2),
        backgroundColor: colors.bg,
        borderBottomWidth: isStacked ? 0 : 1,
        borderBottomColor: colors.borderLight
      }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {showBackButton && (
              <TouchableOpacity
                onPress={() => {
                  if (onBackPress) {
                    onBackPress();
                    return;
                  }
                  if (canGoBack) {
                    goBack();
                    return;
                  }
                  navigateTo("Home");
                }}
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  width: 36,
                  height: 36,
                  backgroundColor: colors.surface,
                  borderRadius: 18,
                  marginRight: isStacked ? 0 : SPACING.sm
                }}
              >
                <Ionicons name="chevron-back" size={18} color={colors.text} />
              </TouchableOpacity>
            )}
            {!showBackButton && centerTitle ? (
              <View style={{ width: 36, height: 36 }} />
            ) : null}
            {!isStacked && showAvatar && (
              <TouchableOpacity
                onPress={onAvatarPress}
                disabled={!onAvatarPress}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  overflow: "hidden",
                  backgroundColor: colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: SPACING.sm,
                }}
              >
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={{ width: "100%", height: "100%" }} />
                ) : (
                  <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "700", color: colors.text }}>
                    {avatarFallback || ""}
                  </Text>
                )}
              </TouchableOpacity>
            )}
            {!isStacked && !centerTitle ? (
              <Text style={[{ ...TYPOGRAPHY.lg, fontWeight: "700", color: colors.text }, titleStyle]}>
                {title}
              </Text>
            ) : null}
          </View>

          {showAction ? (
            <TouchableOpacity
              onPress={onActionPress}
              style={{
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                backgroundColor: colors.accent,
                borderRadius: 18,
              }}
            >
              <Ionicons name={actionIcon as any} size={18} color={colors.white} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 36, height: 36 }} />
          )}
        </View>

        {!isStacked && centerTitle ? (
          <View style={{ position: "absolute", left: SPACING.lg, right: SPACING.lg, top: topInset + SPACING.md }}>
            <View style={{ height: 36, justifyContent: "center", alignItems: "center" }}>
              <Text style={[{ ...TYPOGRAPHY.base, fontWeight: "700", color: colors.text }, titleStyle]} numberOfLines={1}>
                {title}
              </Text>
            </View>
          </View>
        ) : null}

        {isStacked ? (
          <>
            <View
              style={{
                height: 1,
                backgroundColor: colors.borderLight,
                marginTop: hasTitle ? SPACING.sm : SPACING.xs,
                marginBottom: hasTitle ? SPACING.sm : 0,
              }}
            />
            {showAvatar && (
              <TouchableOpacity
                onPress={onAvatarPress}
                disabled={!onAvatarPress}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  overflow: "hidden",
                  backgroundColor: colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: SPACING.md,
                }}
              >
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={{ width: "100%", height: "100%" }} />
                ) : (
                  <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "700", color: colors.text }}>
                    {avatarFallback || ""}
                  </Text>
                )}
              </TouchableOpacity>
            )}
            {hasTitle ? (
              <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "700", color: colors.text, marginTop: SPACING.md }}>
                {title}
              </Text>
            ) : null}
          </>
        ) : null}
      </View>
    </>
  );
}
