import React, { useState } from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { RADIUS, SPACING, TYPOGRAPHY, SHADOWS } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import { Button, Input } from "@src/components/UI";
import ScreenHeader from "@src/components/ScreenHeader";

interface LoginScreenProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onSignup: () => void;
  onForgotPassword: () => void;
  onBack: () => void;
}

export default function LoginScreen({ onLogin, onSignup, onForgotPassword, onBack }: LoginScreenProps) {
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const validateEmail = (emailAddress: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailAddress);
  };

  const emailError = email.length > 0 && !validateEmail(email) ? "Enter a valid email address" : "";

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMessage("Please fill in all fields.");
      return;
    }
    if (!validateEmail(trimmedEmail)) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    try {
      await onLogin(trimmedEmail, password);
      // onLogin will handle navigation to onboarding or main app
    } catch (error) {
      console.error("Login error:", error);
      setLoading(false);
      const message = error instanceof Error ? error.message : "Failed to sign in. Please try again.";
      setErrorMessage(message);
    }
  };

  return (
    <View style={{ 
      flex: 1, 
      backgroundColor: colors.bg,
      paddingHorizontal: SPACING.xl,
    }}>
      <ScreenHeader title="Welcome Back" onBackPress={onBack} />

      {/* Logo */}
      <View style={{
        alignItems: "center",
        marginBottom: SPACING.xxxl,
        marginTop: SPACING.lg
      }}>
        <View style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: colors.accentLight,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: SPACING.lg
        }}>
          <Image
            source={require("../../assets/meropaw_logo.png")}
            style={{ width: 52, height: 52 }}
            resizeMode="contain"
            accessibilityLabel="Meropaw logo"
          />
        </View>
        <Text style={{
          ...TYPOGRAPHY.lg,
          color: colors.textMuted,
          textAlign: "center"
        }}>
          Sign in to continue caring for your pet
        </Text>
      </View>

      {/* Form */}
      <View style={{ marginBottom: SPACING.xxxl }}>
        <Input
          value={email}
          onChangeText={(text: string) => {
            setEmail(text);
            setErrorMessage("");
          }}
          placeholder="Email address"
          keyboardType="email-address"
          autoCapitalize="none"
          style={{ marginBottom: emailError ? SPACING.xs : SPACING.lg }}
        />
        {emailError ? (
          <Text style={{ ...TYPOGRAPHY.xs, color: colors.danger, marginBottom: SPACING.lg }}>
            {emailError}
          </Text>
        ) : null}
        
        <View style={{ position: "relative" }}>
          <Input
            value={password}
            onChangeText={(text: string) => {
              setPassword(text);
              setErrorMessage("");
            }}
            placeholder="Password"
            secureTextEntry={!showPassword}
            style={{ paddingRight: 70, marginBottom: SPACING.lg }}
          />
          <TouchableOpacity
            onPress={() => setShowPassword(prev => !prev)}
            style={{ position: "absolute", right: SPACING.md, top: 14 }}
          >
            <Text style={{ ...TYPOGRAPHY.sm, color: colors.accent, fontWeight: "600" }}>
              {showPassword ? "Hide" : "Show"}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={onForgotPassword} style={{ alignSelf: "flex-end", marginBottom: SPACING.xl }}>
          <Text style={{
            ...TYPOGRAPHY.sm,
            color: colors.accent,
            fontWeight: "600"
          }}>
            Forgot Password?
          </Text>
        </TouchableOpacity>

        {errorMessage ? (
          <View style={{ marginBottom: SPACING.lg }}>
            <Text style={{ ...TYPOGRAPHY.xs, color: colors.danger, marginBottom: SPACING.xs }}>
              {errorMessage}
            </Text>
            <TouchableOpacity onPress={onForgotPassword}>
              <Text style={{ ...TYPOGRAPHY.xs, color: colors.accent, fontWeight: "600" }}>
                Forgot your password? Reset it
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {/* Login Button */}
      <Button
        title={loading ? "Signing In..." : "Sign In"}
        onPress={handleLogin}
        disabled={loading}
        size="lg"
        style={{ marginBottom: SPACING.xl }}
      />

      {/* Sign Up Link */}
      <View style={{
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center"
      }}>
        <Text style={{
          ...TYPOGRAPHY.base,
          color: colors.textMuted
        }}>
          Don't have an account?{" "}
        </Text>
        <TouchableOpacity onPress={onSignup}>
          <Text style={{
            ...TYPOGRAPHY.base,
            color: colors.accent,
            fontWeight: "600"
          }}>
            Sign Up
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

