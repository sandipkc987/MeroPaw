import React, { useMemo, memo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path, Ellipse, Circle } from "react-native-svg";
import { SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface BackgroundDecorationsProps {
  width: number;
  height: number;
}

const BackgroundDecorations = memo(({ width, height }: BackgroundDecorationsProps) => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <Svg width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
      {/* Top clouds */}
      <Ellipse cx={-30} cy={80} rx={100} ry={50} fill="rgba(255,255,255,0.18)" />
      <Ellipse cx={50} cy={60} rx={70} ry={40} fill="rgba(255,255,255,0.12)" />
      <Ellipse cx={width + 20} cy={100} rx={90} ry={45} fill="rgba(255,255,255,0.15)" />
      <Ellipse cx={width - 60} cy={70} rx={60} ry={35} fill="rgba(255,255,255,0.1)" />
      
      {/* Middle floating clouds */}
      <Ellipse cx={width * 0.15} cy={height * 0.4} rx={80} ry={35} fill="rgba(255,255,255,0.08)" />
      <Ellipse cx={width * 0.85} cy={height * 0.35} rx={70} ry={30} fill="rgba(255,255,255,0.1)" />
      <Ellipse cx={width * 0.5} cy={height * 0.45} rx={60} ry={25} fill="rgba(255,255,255,0.06)" />
      
      {/* Bottom landscape - hills */}
      <Path
        d={`M0 ${height} L0 ${height * 0.85} Q${width * 0.2} ${height * 0.75} ${width * 0.35} ${height * 0.82} Q${width * 0.5} ${height * 0.9} ${width * 0.65} ${height * 0.78} Q${width * 0.85} ${height * 0.68} ${width} ${height * 0.8} L${width} ${height} Z`}
        fill="rgba(255,255,255,0.1)"
      />
      <Path
        d={`M0 ${height} L0 ${height * 0.9} Q${width * 0.15} ${height * 0.83} ${width * 0.3} ${height * 0.88} Q${width * 0.45} ${height * 0.93} ${width * 0.6} ${height * 0.85} Q${width * 0.8} ${height * 0.78} ${width} ${height * 0.88} L${width} ${height} Z`}
        fill="rgba(255,255,255,0.15)"
      />
      
      {/* Small decorative elements - stars/sparkles */}
      <Circle cx={width * 0.1} cy={height * 0.2} r={2} fill="rgba(255,255,255,0.4)" />
      <Circle cx={width * 0.9} cy={height * 0.15} r={1.5} fill="rgba(255,255,255,0.3)" />
      <Circle cx={width * 0.7} cy={height * 0.25} r={2} fill="rgba(255,255,255,0.35)" />
      <Circle cx={width * 0.25} cy={height * 0.3} r={1.5} fill="rgba(255,255,255,0.25)" />
    </Svg>
  </View>
));

BackgroundDecorations.displayName = "BackgroundDecorations";

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
  const { width, height } = useWindowDimensions();
  
  const gradientColors = useMemo(() => ["#8B5CF6", "#A78BFA", "#C4B5FD"] as const, []);

  return (
    <LinearGradient colors={gradientColors} locations={[0, 0.5, 1]} style={styles.gradient}>
      <BackgroundDecorations width={width} height={height} />
      
      <View style={[styles.safeArea, { paddingTop: insets.top + SPACING.xl }]}>
        {/* Main Content */}
        <View style={styles.content}>
          {/* Logo */}
          <View style={[styles.logo, { backgroundColor: "#1a1a2e", ...SHADOWS.lg }]}>
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

          <Text style={[styles.subtitle, { color: "rgba(255,255,255,0.85)" }]}>
            Track your pet's daily activities, health records,{"\n"}and create lasting memories
          </Text>

          {/* Features Card */}
          <View style={styles.featuresContainer}>
            {FEATURES.map((feature, index) => (
              <FeatureCard
                key={feature.icon}
                {...feature}
                colors={colors}
              />
            ))}
          </View>
        </View>

        {/* Bottom Actions */}
        <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, SPACING.lg) + SPACING.md }]}>
          <TouchableOpacity
            onPress={onCreateAccount || onGetStarted}
            activeOpacity={0.85}
            style={styles.primaryButton}
            accessibilityRole="button"
            accessibilityLabel="Create account"
          >
            <Text style={styles.primaryButtonText}>
              Create account
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onGetStarted}
            activeOpacity={0.85}
            style={styles.secondaryButton}
            accessibilityRole="button"
            accessibilityLabel="Sign in"
          >
            <Text style={styles.secondaryButtonText}>
              Sign in
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.xl,
  },
  logoImage: {
    width: 55,
    height: 55,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: SPACING.sm,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    marginBottom: SPACING.xl,
    lineHeight: 22,
    fontWeight: "400",
  },
  featuresContainer: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    paddingVertical: SPACING.md,
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.sm,
  },
  featureIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.md,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 13,
    opacity: 0.8,
  },
  actions: {
    width: "100%",
    paddingTop: SPACING.lg,
  },
  primaryButton: {
    backgroundColor: "#1a1a2e",
    borderRadius: RADIUS.xl,
    paddingVertical: 16,
    width: "100%",
    alignItems: "center",
    marginBottom: SPACING.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderRadius: RADIUS.xl,
    paddingVertical: 16,
    width: "100%",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#1a1a2e",
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a2e",
  },
});

export default memo(WelcomeScreen);
