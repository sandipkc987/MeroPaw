import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Image, Linking } from "react-native";
import { SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import { Button, Input } from "@src/components/UI";
import ScreenHeader from "@src/components/ScreenHeader";

interface SignupScreenProps {
  onRequestCode: (email: string) => Promise<void>;
  onVerifyCode: (data: { email: string; code: string; password: string }) => Promise<void>;
  onGoogleSignIn?: () => Promise<void>;
  onLogin: () => void;
  onBack: () => void;
}

type SignupStep = "email" | "verify";

export default function SignupScreen({ onRequestCode, onVerifyCode, onGoogleSignIn, onLogin, onBack }: SignupScreenProps) {
  const { colors } = useTheme();
  const [step, setStep] = useState<SignupStep>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  const handleGoogleSignIn = async () => {
    if (!onGoogleSignIn) return;
    setGoogleLoading(true);
    setErrorMessage("");
    try {
      await onGoogleSignIn();
    } catch (error) {
      console.error("Google sign-in error:", error);
      const message = error instanceof Error ? error.message : "Failed to sign in with Google.";
      setErrorMessage(message);
    } finally {
      setGoogleLoading(false);
    }
  };

  const validateEmail = (emailAddress: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailAddress);
  };

  const handleSendCode = async () => {
    if (!email) {
      setErrorMessage("Please enter your email.");
      return;
    }

    if (!validateEmail(email)) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setInfoMessage("");
    try {
      await onRequestCode(email.trim());
      setStep("verify");
      setInfoMessage("We sent a 6-digit code to your email.");
      setLoading(false);
    } catch (error) {
      console.error("Send code error:", error);
      setLoading(false);
      const message = error instanceof Error ? error.message : "Failed to send code. Please try again.";
      setErrorMessage(message);
    }
  };

  const handleVerify = async () => {
    if (!code.trim()) {
      setErrorMessage("Please enter the 6-digit code.");
      return;
    }

    if (!/^\d{6}$/.test(code.trim())) {
      setErrorMessage("Enter the 6-digit code from your email.");
      return;
    }

    if (!password) {
      setErrorMessage("Please set a password.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords don't match.");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setInfoMessage("");
    try {
      await onVerifyCode({
        email: email.trim(),
        code: code.trim(),
        password,
      });
      // onVerifyCode will handle the transition to onboarding
    } catch (error) {
      console.error("Verify code error:", error);
      setLoading(false);
      const message = error instanceof Error ? error.message : "Failed to verify code. Please try again.";
      setErrorMessage(message);
    }
  };

  const handleChangeEmail = () => {
    setStep("email");
    setCode("");
    setErrorMessage("");
    setInfoMessage("");
  };

  const emailError = email.length > 0 && !validateEmail(email) ? "Enter a valid email address" : "";
  const passwordError = password.length > 0 && password.length < 6 ? "Password must be at least 6 characters" : "";
  const confirmError =
    confirmPassword.length > 0 && password !== confirmPassword ? "Passwords don't match" : "";

  const canSendCode = !!email && !emailError && !loading;
  const canVerify =
    !!email &&
    !!code &&
    !!password &&
    !!confirmPassword &&
    !passwordError &&
    !confirmError &&
    !loading;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingBottom: SPACING.xxxl }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingHorizontal: SPACING.xl }}>
        <ScreenHeader title="Create Account" onBackPress={onBack} useSafeArea={true} />

        {/* Logo */}
        <View
          style={{
            alignItems: "center",
            marginBottom: SPACING.xxxl,
            marginTop: SPACING.lg,
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: colors.accentLight,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: SPACING.lg,
            }}
          >
            <Image
              source={require("../../assets/meropaw_logo.png")}
              style={{ width: 52, height: 52 }}
              resizeMode="contain"
              accessibilityLabel="Meropaw logo"
            />
          </View>
          <Text
            style={{
              ...TYPOGRAPHY.lg,
              color: colors.textMuted,
              textAlign: "center",
            }}
          >
            Let's get started with your pet's journey
          </Text>
        </View>

        {/* Form */}
        <View style={{ marginBottom: SPACING.xxxl }}>
          <Text
            style={{
              ...TYPOGRAPHY.sm,
              fontWeight: "600",
              color: colors.text,
              marginBottom: SPACING.sm,
            }}
          >
            {step === "email" ? "Account Information" : "Verify your email"}
          </Text>

          <Input
            value={email}
            onChangeText={(text: string) => {
              setEmail(text);
              setErrorMessage("");
              setInfoMessage("");
            }}
            placeholder="Email address *"
            keyboardType="email-address"
            autoCapitalize="none"
            editable={step === "email"}
            style={{ marginBottom: emailError ? SPACING.xs : SPACING.lg }}
          />
          {emailError ? (
            <Text style={{ ...TYPOGRAPHY.xs, color: colors.danger, marginBottom: SPACING.lg }}>
              {emailError}
            </Text>
          ) : null}

          {step === "verify" ? (
            <>
              <Input
                value={code}
                onChangeText={(text: string) => {
                  setCode(text);
                  setErrorMessage("");
                  setInfoMessage("");
                }}
                placeholder="6-digit code"
                keyboardType="number-pad"
                style={{ marginBottom: SPACING.lg }}
              />

              <View style={{ position: "relative" }}>
                <Input
                  value={password}
                  onChangeText={(text: string) => {
                    setPassword(text);
                    setErrorMessage("");
                  }}
                  placeholder="Password (min 6 characters) *"
                  secureTextEntry={!showPassword}
                  style={{ paddingRight: 70, marginBottom: passwordError ? SPACING.xs : SPACING.lg }}
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
              {passwordError ? (
                <Text style={{ ...TYPOGRAPHY.xs, color: colors.danger, marginBottom: SPACING.lg }}>
                  {passwordError}
                </Text>
              ) : null}

              <View style={{ position: "relative" }}>
                <Input
                  value={confirmPassword}
                  onChangeText={(text: string) => {
                    setConfirmPassword(text);
                    setErrorMessage("");
                  }}
                  placeholder="Confirm password *"
                  secureTextEntry={!showConfirmPassword}
                  style={{ paddingRight: 70, marginBottom: confirmError ? SPACING.xs : SPACING.lg }}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(prev => !prev)}
                  style={{ position: "absolute", right: SPACING.md, top: 14 }}
                >
                  <Text style={{ ...TYPOGRAPHY.sm, color: colors.accent, fontWeight: "600" }}>
                    {showConfirmPassword ? "Hide" : "Show"}
                  </Text>
                </TouchableOpacity>
              </View>
              {confirmError ? (
                <Text style={{ ...TYPOGRAPHY.xs, color: colors.danger, marginBottom: SPACING.lg }}>
                  {confirmError}
                </Text>
              ) : null}

              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: SPACING.sm }}>
                <TouchableOpacity onPress={handleChangeEmail}>
                  <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted }}>Change email</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSendCode} disabled={loading}>
                  <Text style={{ ...TYPOGRAPHY.xs, color: colors.accent, fontWeight: "600" }}>
                    Resend code
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginBottom: SPACING.lg }}>
                Didn’t get a code? Check spam or tap resend. If it still doesn’t arrive, change the email and try again.
              </Text>
            </>
          ) : null}
        </View>

        {infoMessage ? (
          <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, textAlign: "center", marginBottom: SPACING.md }}>
            {infoMessage}
          </Text>
        ) : null}
        {errorMessage ? (
          <Text style={{ ...TYPOGRAPHY.xs, color: colors.danger, textAlign: "center", marginBottom: SPACING.md }}>
            {errorMessage}
          </Text>
        ) : null}

        {/* Signup Button */}
        {step === "email" ? (
          <Button
            title={loading ? "Sending code..." : "Send Code"}
            onPress={handleSendCode}
            disabled={!canSendCode || googleLoading}
            size="lg"
            style={{ marginBottom: SPACING.lg }}
          />
        ) : (
          <Button
            title={loading ? "Verifying..." : "Verify & Create Account"}
            onPress={handleVerify}
            disabled={!canVerify || googleLoading}
            size="lg"
            style={{ marginBottom: SPACING.lg }}
          />
        )}

        {/* Divider - only show on email step */}
        {step === "email" && onGoogleSignIn ? (
          <>
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: SPACING.lg,
            }}>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginHorizontal: SPACING.md }}>
                or
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            </View>

            {/* Google Sign In Button */}
            <TouchableOpacity
              onPress={handleGoogleSignIn}
              disabled={loading || googleLoading}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.cardBg,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: RADIUS.lg,
                paddingVertical: SPACING.md,
                paddingHorizontal: SPACING.xl,
                marginBottom: SPACING.xl,
                opacity: (loading || googleLoading) ? 0.6 : 1,
                ...SHADOWS.sm,
              }}
            >
              <Image
                source={{ uri: "https://www.google.com/favicon.ico" }}
                style={{ width: 20, height: 20, marginRight: SPACING.sm }}
              />
              <Text style={{
                ...TYPOGRAPHY.base,
                color: colors.text,
                fontWeight: "600",
              }}>
                {googleLoading ? "Signing up..." : "Continue with Google"}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={{ marginBottom: SPACING.xl }} />
        )}

        <View style={{ alignItems: "center", marginBottom: SPACING.xl }}>
          <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, textAlign: "center" }}>
            By continuing, you agree to our
          </Text>
          <View style={{ flexDirection: "row", marginTop: 4 }}>
            <TouchableOpacity onPress={() => Linking.openURL("https://meropaw.com/terms")}>
              <Text style={{ ...TYPOGRAPHY.xs, color: colors.accent, fontWeight: "600" }}>
                Terms
              </Text>
            </TouchableOpacity>
            <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginHorizontal: 6 }}>
              &amp;
            </Text>
            <TouchableOpacity onPress={() => Linking.openURL("https://meropaw.com/privacy")}>
              <Text style={{ ...TYPOGRAPHY.xs, color: colors.accent, fontWeight: "600" }}>
                Privacy Policy
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Login Link */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text
            style={{
              ...TYPOGRAPHY.base,
              color: colors.textMuted,
            }}
          >
            Already have an account?{" "}
          </Text>
          <TouchableOpacity onPress={onLogin}>
            <Text
              style={{
                ...TYPOGRAPHY.base,
                color: colors.accent,
                fontWeight: "600",
              }}
            >
              Sign In
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

