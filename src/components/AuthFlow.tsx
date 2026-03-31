import React, { useState, useEffect } from "react";
import { useAuth } from "@src/contexts/AuthContext";
import WelcomeScreen from "@src/screens/WelcomeScreen";
import LoginScreen from "@src/screens/LoginScreen";
import SignupScreen from "@src/screens/SignupScreen";
import ForgotPasswordScreen from "@src/screens/ForgotPasswordScreen";
import OnboardingScreen, { OnboardingResult } from "@src/screens/OnboardingScreen";

type AuthStep = 'welcome' | 'login' | 'signup' | 'forgot' | 'onboarding';

export default function AuthFlow() {
  const {
    login,
    signInWithGoogle,
    requestEmailOtp,
    verifyEmailOtp,
    resetPassword,
    hasCompletedOnboarding,
    isAuthenticated,
    isLoading,
    markOnboardingComplete,
  } = useAuth();
  const [currentStep, setCurrentStep] = useState<AuthStep>('welcome');
  
  // Reset to welcome if user is not authenticated and we're not actively in auth flow
  // This handles logout without interrupting OTP/signup/login steps
  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      if (currentStep !== 'signup' && currentStep !== 'login' && currentStep !== 'forgot') {
        console.log('AuthFlow: User not authenticated, resetting to welcome (logout detected)');
        setCurrentStep('welcome');
      }
    }
  }, [isAuthenticated, isLoading, currentStep]);

  // Auto-transition to onboarding when user becomes authenticated after signup/login
  // This handles the case where AuthFlow gets remounted after isLoading changes
  useEffect(() => {
    if (isAuthenticated && !hasCompletedOnboarding && !isLoading) {
      // If we're on signup/login step, transition to onboarding
      if (currentStep === 'signup' || currentStep === 'login') {
        console.log('AuthFlow: User authenticated after signup/login, transitioning to onboarding');
        setCurrentStep('onboarding');
      }
      // If we're on welcome but user is authenticated, they just signed up (handled by checkAuthState above)
    }
  }, [isAuthenticated, hasCompletedOnboarding, currentStep, isLoading]);

  const handleGetStarted = () => {
    setCurrentStep('login');
  };

  const handleLogin = async (email: string, password: string) => {
    console.log('AuthFlow: Starting login...');
    await login(email, password);
    console.log('AuthFlow: Login completed, user is now authenticated');
    setCurrentStep('onboarding');
  };

  const handleGoogleSignIn = async () => {
    console.log('AuthFlow: Starting Google sign-in...');
    await signInWithGoogle();
    console.log('AuthFlow: Google sign-in completed');
    setCurrentStep('onboarding');
  };

  const handleRequestCode = async (email: string) => {
    console.log('AuthFlow: Requesting OTP code...');
    await requestEmailOtp(email);
  };

  const handleVerifyCode = async (data: { email: string; code: string; password: string }) => {
    console.log('AuthFlow: Verifying OTP code...');
    await verifyEmailOtp(data.email, data.code, data.password);
    console.log('AuthFlow: OTP verified, user is now authenticated');
    // Set step to onboarding - useEffect will also handle this if component remounts
    setCurrentStep('onboarding');
  };

  const handleOnboardingComplete = async (_data: OnboardingResult) => {
    await markOnboardingComplete();
  };

  const handleGoToSignup = () => {
    setCurrentStep('signup');
  };

  const handleGoToLogin = () => {
    setCurrentStep('login');
  };

  const handleGoToForgotPassword = () => {
    setCurrentStep('forgot');
  };

  const handleBack = () => {
    setCurrentStep('welcome');
  };

  console.log('AuthFlow render:', { isAuthenticated, hasCompletedOnboarding, currentStep });

  // PRIORITY 1: If onboarding is completed, App.tsx will show HomeScreen
  // But if we're still here, show welcome (shouldn't happen)
  if (hasCompletedOnboarding) {
    console.log('AuthFlow: Onboarding completed, should not be here - showing welcome');
    return <WelcomeScreen onGetStarted={handleGetStarted} />;
  }

  // PRIORITY 2: If user is NOT authenticated, show welcome/login/signup
  if (!isAuthenticated) {
    switch (currentStep) {
      case 'login':
        console.log('AuthFlow: Showing login screen');
        return (
          <LoginScreen
            onLogin={handleLogin}
            onGoogleSignIn={handleGoogleSignIn}
            onSignup={handleGoToSignup}
            onForgotPassword={handleGoToForgotPassword}
            onBack={handleBack}
          />
        );
      case 'signup':
        console.log('AuthFlow: Showing signup screen');
        return (
          <SignupScreen
            onRequestCode={handleRequestCode}
            onVerifyCode={handleVerifyCode}
            onGoogleSignIn={handleGoogleSignIn}
            onLogin={handleGoToLogin}
            onBack={handleBack}
          />
        );
      case 'forgot':
        console.log('AuthFlow: Showing forgot password screen');
        return (
          <ForgotPasswordScreen
            onReset={resetPassword}
            onBack={handleGoToLogin}
          />
        );
      default:
        console.log('AuthFlow: Showing welcome screen (not authenticated)');
        return (
          <WelcomeScreen
            onGetStarted={handleGetStarted}
            onCreateAccount={handleGoToSignup}
          />
        );
    }
  }

  // PRIORITY 3: If authenticated but onboarding not complete
  // Show onboarding if currentStep is 'onboarding' OR if we just initialized and found incomplete signup
  if (isAuthenticated && !hasCompletedOnboarding) {
    if (currentStep === 'onboarding') {
      console.log('AuthFlow: Showing onboarding screen (authenticated, step is onboarding)');
      return (
        <OnboardingScreen
          onComplete={handleOnboardingComplete}
          onSuccessContinue={async () => {
            await markOnboardingComplete();
            setCurrentStep('welcome');
          }}
        />
      );
    } else {
      // If authenticated but onboarding not complete, and we're not on onboarding step
      // This could mean:
      // 1. User just signed up but component remounted (checkAuthState should handle this)
      // 2. User is on signup/login screen (let them finish)
      // 3. Leftover data (shouldn't happen due to AuthContext cleanup)
      
      // If we're on signup/login, show those screens (transition might be in progress)
      if (currentStep === 'signup' || currentStep === 'login') {
        console.log('AuthFlow: Authenticated but on signup/login, showing current screen');
        if (currentStep === 'signup') {
          return (
            <SignupScreen
              onRequestCode={handleRequestCode}
              onVerifyCode={handleVerifyCode}
              onGoogleSignIn={handleGoogleSignIn}
              onLogin={handleGoToLogin}
              onBack={handleBack}
            />
          );
        } else {
          return (
            <LoginScreen
              onLogin={handleLogin}
              onGoogleSignIn={handleGoogleSignIn}
              onSignup={handleGoToSignup}
              onForgotPassword={handleGoToForgotPassword}
              onBack={handleBack}
            />
          );
        }
      }
      
      // Otherwise, if authenticated but onboarding incomplete, show onboarding
      // (This handles the case where checkAuthState found incomplete signup)
      console.log('AuthFlow: Authenticated but onboarding incomplete, showing onboarding');
      return (
        <OnboardingScreen
          onComplete={handleOnboardingComplete}
          onSuccessContinue={async () => {
            await markOnboardingComplete();
            setCurrentStep('welcome');
          }}
        />
      );
    }
  }

  // Fallback: show welcome screen
  console.log('AuthFlow: Fallback - showing welcome screen');
  return (
    <WelcomeScreen
      onGetStarted={handleGetStarted}
      onCreateAccount={handleGoToSignup}
    />
  );
}