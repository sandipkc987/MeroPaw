import React, { useMemo, memo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

interface WelcomeScreenProps {
  onGetStarted: () => void;
  onCreateAccount?: () => void;
}

interface FeatureItem {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}

interface FeatureCardProps extends FeatureItem {
  colors: {
    white: string;
  };
}

const FEATURES: FeatureItem[] = [
  {
    icon: "restaurant",
    title: "Track Meals & Health",
    description: "Monitor nutrition and wellness"
  },
  {
    icon: "images",
    title: "Save Precious Memories",
    description: "Capture and organize moments"
  },
  {
    icon: "notifications",
    title: "Never Miss Appointments",
    description: "Stay on top of vet visits"
  }
];

const FeatureCard = memo(({ icon, title, description, colors }: FeatureCardProps) => (
  <View style={styles.featureRow}>
    <View style={styles.featureIconContainer}>
      <Ionicons name={icon} size={24} color={colors.white} />
    </View>
    <View style={styles.featureTextContainer}>
      <Text style={[styles.featureTitle, { color: colors.white }]}>
        {title}
      </Text>
      <Text style={[styles.featureDescription, { color: colors.white }]}>
        {description}
      </Text>
    </View>
  </View>
));

FeatureCard.displayName = "FeatureCard";

function WelcomeScreen({ onGetStarted, onCreateAccount }: WelcomeScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  
  const gradientColors = useMemo(() => [colors.accent, "#A78BFA"] as const, [colors.accent]);
  
  const containerStyle = useMemo(() => [
    styles.container,
    { paddingHorizontal: SPACING.xl }
  ], []);

  const logoStyle = useMemo(() => [
    styles.logo,
    { backgroundColor: colors.white, ...SHADOWS.lg }
  ], [colors.white]);

  const featuresContainerStyle = useMemo(() => [
    styles.featuresContainer,
    { backgroundColor: "transparent", borderColor: "rgba(255,255,255,0.2)" }
  ], []);

  const buttonStyle = useMemo(() => [
    styles.button,
    { backgroundColor: colors.white, ...SHADOWS.lg }
  ], [colors.white]);

  return (
    <LinearGradient colors={gradientColors} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.content}>
          <ScrollView
            contentContainerStyle={containerStyle}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Logo */}
            <View style={logoStyle}>
              <Image
                source={require("../../assets/meropaw_logo.png")}
                style={styles.logoImage}
                resizeMode="contain"
                accessibilityLabel="Meropaw logo"
              />
            </View>

            {/* Welcome Text */}
            <Text style={[styles.title, { color: colors.white }]}>
              Welcome to Meropaw
            </Text>

            <Text style={[styles.subtitle, { color: colors.white }]}>
              Track your pet's daily activities, health records, and create lasting memories
            </Text>

            {/* Features */}
            <View style={featuresContainerStyle}>
              {FEATURES.map((feature) => (
                <FeatureCard
                  key={feature.icon}
                  {...feature}
                  colors={colors}
                />
              ))}
            </View>
          </ScrollView>

          <View style={[styles.actions, { paddingBottom: SPACING.lg + insets.bottom }]}>
            {/* Create Account Button */}
            <TouchableOpacity
              onPress={onCreateAccount || onGetStarted}
              activeOpacity={0.9}
              style={buttonStyle}
              accessibilityRole="button"
              accessibilityLabel="Create account"
              accessibilityHint="Navigate to signup screen"
            >
              <Text style={[styles.buttonText, { color: colors.accent }]}>
                Create account
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onGetStarted}
              activeOpacity={0.9}
              style={[styles.secondaryButton, { borderColor: colors.white }]}
              accessibilityRole="button"
              accessibilityLabel="Sign in"
              accessibilityHint="Navigate to login screen"
            >
              <Text style={[styles.secondaryButtonText, { color: colors.white }]}>
                Sign in
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: SPACING.xl,
  },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.xxxl,
  },
  logoImage: {
    width: 50,
    height: 50,
  },
  title: {
    ...TYPOGRAPHY["3xl"],
    fontWeight: "700",
    textAlign: "center",
    marginBottom: SPACING.md,
    letterSpacing: -0.2,
  },
  subtitle: {
    ...TYPOGRAPHY.base,
    textAlign: "center",
    marginBottom: SPACING.lg,
    opacity: 0.85,
    paddingHorizontal: SPACING.sm,
    fontWeight: "300",
  },
  featuresContainer: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    width: "100%",
    borderWidth: 1,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  featureIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.md,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    ...TYPOGRAPHY.sm,
    fontWeight: "600",
    marginBottom: 2,
  },
  featureDescription: {
    ...TYPOGRAPHY.xs,
    opacity: 0.75,
  },
  button: {
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xxxl,
    width: "100%",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  buttonText: {
    ...TYPOGRAPHY.base,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  secondaryButton: {
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xxxl,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
  },
  secondaryButtonText: {
    ...TYPOGRAPHY.sm,
    fontWeight: "500",
  },
  actions: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
  },
});

export default memo(WelcomeScreen);
