import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Platform, AppState } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import storage from "@src/utils/storage";
import { getSupabaseClient } from "@src/services/supabaseClient";
import { insertNotification } from "@src/services/supabaseData";
import { registerPushToken, subscribeToTokenRefresh } from "@src/services/pushNotifications";
import { isAdminEmail } from "@src/utils/admin";

WebBrowser.maybeCompleteAuthSession();

interface StoredPhotoDetail {
  uri?: string;
  title?: string;
  caption?: string;
}

interface PetProfileDetails {
  bio?: string;
  breed?: string;
  birthDate?: string;
  color?: string;
  microchip?: string;
  allergies?: string;
  photos?: string[];
  photoDetails?: StoredPhotoDetail[];
}

interface User {
  id: string;
  email: string;
  petName: string;
  profileDetails?: PetProfileDetails;
}

interface CompleteOnboardingProfile {
  bio?: string;
  breed?: string;
  birthDate?: string;
  color?: string;
  microchip?: string;
  allergies?: string;
  profilePhoto?: string;
  photos?: StoredPhotoDetail[];
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isBootstrapping: boolean;
  hasCompletedOnboarding: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  requestEmailOtp: (email: string) => Promise<void>;
  verifyEmailOtp: (email: string, code: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  completeOnboarding: (petName: string, bio?: string, photos?: string[], profileDetails?: CompleteOnboardingProfile) => Promise<void>;
  logout: () => Promise<void>;
  markOnboardingComplete: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEVICE_ID_KEY = "@kasper_device_id";

const buildDeviceLabel = () => {
  const version = typeof Platform.Version !== "undefined" ? ` ${Platform.Version}` : "";
  return `${Platform.OS}${version}`;
};

const generateDeviceId = () =>
  `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  const registerDevice = useCallback(async (userId: string) => {
    try {
      const supabase = getSupabaseClient();
      let deviceId = await storage.getItem(DEVICE_ID_KEY);
      if (!deviceId) {
        deviceId = generateDeviceId();
        await storage.setItem(DEVICE_ID_KEY, deviceId);
      }
      const deviceLabel = buildDeviceLabel();
      const { data, error } = await supabase
        .from("auth_devices")
        .select("id")
        .eq("owner_id", userId)
        .eq("device_id", deviceId)
        .maybeSingle();
      if (error) {
        console.warn("AuthContext: Failed to fetch device info", error.message);
        return;
      }
      if (!data) {
        const { error: insertError } = await supabase
          .from("auth_devices")
          .insert({
            owner_id: userId,
            device_id: deviceId,
            device_label: deviceLabel,
            last_seen_at: new Date().toISOString(),
          });
        if (insertError) {
          console.warn("AuthContext: Failed to store device", insertError.message);
          return;
        }
        insertNotification(userId, {
          kind: "system",
          title: "New device sign-in",
          message: `Signed in on ${deviceLabel}. If this wasn't you, update your password.`,
          ctaLabel: "Review security",
          metadata: { type: "new_device", deviceId },
        }).catch(err => {
          console.warn("AuthContext: Failed to create device notification", err);
        });
      } else {
        await supabase
          .from("auth_devices")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("owner_id", userId)
          .eq("device_id", deviceId);
      }
    } catch (error) {
      console.warn("AuthContext: Device registration failed", error);
    }
  }, []);

  // Check for existing session on app start
  useEffect(() => {
    const checkStoredUser = async () => {
      try {
        console.log("AuthContext: Checking for stored user...");
        const storedUser = await storage.getItem("kasper_user");
        const onboardingComplete = await storage.getItem("kasper_onboarding_complete");

        console.log("AuthContext: storedUser =", storedUser);
        console.log("AuthContext: onboardingComplete =", onboardingComplete);

        const supabase = getSupabaseClient();
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) {
          console.warn("AuthContext: Supabase session check failed", authError.message);
        }

        if (authData?.user) {
          const onboardingFromSupabase = authData.user.user_metadata?.onboarding_complete === true;
          const onboardingFromStorage = onboardingComplete === "true";
          const resolvedOnboarding = onboardingFromSupabase || onboardingFromStorage;

          const parsedUser = storedUser ? JSON.parse(storedUser) : null;
          const mergedUser: User = {
            id: authData.user.id,
            email: authData.user.email || parsedUser?.email || "",
            petName: parsedUser?.petName || "",
            profileDetails: parsedUser?.profileDetails || {},
          };
          setUser(mergedUser);
          setHasCompletedOnboarding(resolvedOnboarding);
          registerDevice(mergedUser.id);

          // Keep Supabase and storage flags in sync (best-effort)
          if (onboardingFromStorage && !onboardingFromSupabase) {
            supabase.auth.updateUser({ data: { onboarding_complete: true } }).catch(err =>
              console.warn("AuthContext: Failed to sync onboarding flag to Supabase", err)
            );
          } else if (onboardingFromSupabase && !onboardingFromStorage) {
            storage.setItem("kasper_onboarding_complete", "true").catch(err =>
              console.warn("AuthContext: Failed to sync onboarding flag to storage", err)
            );
          }
        } else {
          // No Supabase session: treat as logged out and clear cached auth data
          setUser(null);
          setHasCompletedOnboarding(false);
          await storage.multiRemove([
            "kasper_user",
            "kasper_onboarding_complete",
            "kasper_signup_data",
            "@kasper_pets",
            "@kasper_active_pet",
            "@kasper_memories",
            "@kasper_onboarding_highlights",
            "@kasper_seen_flashbacks"
          ]);
        }
      } catch (error) {
        console.error("Failed to load stored user:", error);
      } finally {
        console.log("AuthContext: Setting isBootstrapping = false");
        setIsBootstrapping(false);
      }
    };
    
    checkStoredUser();
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    registerPushToken(user.id);
    const unsubscribe = subscribeToTokenRefresh(user.id);
    return () => {
      unsubscribe?.();
    };
  }, [user?.id]);

  const login = async (email: string, password: string) => {
    console.log("AuthContext.login: Starting login with email:", email);
    setIsLoading(true);

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        const rawMessage = error?.message || "Login failed";
        const normalized = rawMessage.toLowerCase();
        if (normalized.includes("invalid login") || normalized.includes("invalid credentials")) {
          throw new Error("Email or password is incorrect.");
        }
        throw new Error(rawMessage);
      }

      const onboardingFromSupabase = data.user.user_metadata?.onboarding_complete === true;
      const storedUser = await storage.getItem("kasper_user");
      const parsedUser = storedUser ? JSON.parse(storedUser) : null;
      const updatedUser: User = {
        id: data.user.id,
        email: data.user.email || email,
        petName: parsedUser?.petName || "",
        profileDetails: parsedUser?.profileDetails || {},
      };

      setUser(updatedUser);
      await storage.setItem("kasper_user", JSON.stringify(updatedUser));

      const onboardingComplete = await storage.getItem("kasper_onboarding_complete");
      setHasCompletedOnboarding(onboardingFromSupabase || onboardingComplete === "true");
      registerDevice(updatedUser.id);
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    } finally {
      console.log("AuthContext.login: Setting isLoading = false");
      setIsLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    console.log("AuthContext.signInWithGoogle: Starting Google sign-in");
    setIsLoading(true);

    try {
      const supabase = getSupabaseClient();
      const isWeb = Platform.OS === "web";
      
      // Use different redirect URLs for web vs native
      const redirectUrl = isWeb 
        ? AuthSession.makeRedirectUri() 
        : "meropaw://google-auth";
      console.log("AuthContext.signInWithGoogle: Redirect URL:", redirectUrl, "Platform:", Platform.OS);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.url) {
        throw new Error("No OAuth URL returned");
      }

      console.log("AuthContext.signInWithGoogle: OAuth URL:", data.url);

      // Use in-app auth session on all platforms (ASWebAuthSession on iOS, Chrome Custom Tabs on Android, popup on web)
      // This keeps the user in-app instead of redirecting to the external browser — like Nextdoor's flow
      console.log("AuthContext.signInWithGoogle: Opening in-app auth session");
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
      await handleOAuthResult(result, supabase);
    } catch (error) {
      console.error("Google sign-in failed:", error);
      setIsLoading(false);
      throw error;
    }
  };

  const handleOAuthResult = async (result: WebBrowser.WebBrowserAuthSessionResult, supabase: any) => {
    if (result.type === "success" && result.url) {
      console.log("AuthContext.signInWithGoogle: Browser returned successfully");
      await processOAuthCallback(result.url, supabase);
    } else if (result.type === "cancel") {
      console.log("AuthContext.signInWithGoogle: User cancelled");
      setIsLoading(false);
    } else {
      console.log("AuthContext.signInWithGoogle: Auth session result:", result.type);
      setIsLoading(false);
    }
  };

  const processOAuthCallback = async (callbackUrl: string, supabase: any) => {
    console.log("AuthContext.signInWithGoogle: Processing callback URL:", callbackUrl);
    
    const url = new URL(callbackUrl);
    let accessToken: string | null = null;
    let refreshToken: string | null = null;
    
    // Try hash fragment first (most common for OAuth)
    if (url.hash) {
      const hashParams = new URLSearchParams(url.hash.substring(1));
      accessToken = hashParams.get("access_token");
      refreshToken = hashParams.get("refresh_token");
    }
    
    // Fall back to query params
    if (!accessToken) {
      accessToken = url.searchParams.get("access_token");
      refreshToken = url.searchParams.get("refresh_token");
    }

    if (accessToken && refreshToken) {
      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (sessionError || !sessionData.user) {
        setIsLoading(false);
        throw new Error(sessionError?.message || "Failed to set session");
      }

      const onboardingFromSupabase = sessionData.user.user_metadata?.onboarding_complete === true;
      const storedUser = await storage.getItem("kasper_user");
      const parsedUser = storedUser ? JSON.parse(storedUser) : null;

      const newUser: User = {
        id: sessionData.user.id,
        email: sessionData.user.email || "",
        petName: parsedUser?.petName || "",
        profileDetails: parsedUser?.profileDetails || {},
      };

      setUser(newUser);
      await storage.setItem("kasper_user", JSON.stringify(newUser));

      const onboardingComplete = await storage.getItem("kasper_onboarding_complete");
      setHasCompletedOnboarding(onboardingFromSupabase || onboardingComplete === "true");
      registerDevice(newUser.id);
      setIsLoading(false);

      console.log("AuthContext.signInWithGoogle: Sign-in successful", { userId: newUser.id });
    } else {
      console.error("AuthContext.signInWithGoogle: No tokens found in URL", callbackUrl);
      setIsLoading(false);
      throw new Error("No tokens in OAuth response");
    }
  };

  const requestEmailOtp = async (email: string) => {
    console.log("AuthContext.requestEmailOtp: Sending OTP to email:", email);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (error) {
        throw new Error(error.message);
      }
    } catch (error) {
      console.error("Request OTP failed:", error);
      throw error;
    }
  };

  const verifyEmailOtp = async (email: string, code: string, password: string) => {
    console.log("AuthContext.verifyEmailOtp: Verifying OTP for email:", email);
    setIsLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "signup",
      });
      if (error || !data?.user) {
        throw new Error(error?.message || "OTP verification failed");
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: { onboarding_complete: false },
      });
      if (updateError) {
        throw new Error(updateError.message);
      }

      const newUser: User = {
        id: data.user.id,
        email: data.user.email || email,
        petName: "",
        profileDetails: {},
      };

      setUser(newUser);
      await storage.setItem("kasper_user", JSON.stringify(newUser));
      setHasCompletedOnboarding(false);
      registerDevice(newUser.id);
    } catch (error) {
      console.error("Verify OTP failed:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    console.log("AuthContext.resetPassword: Starting reset for email:", email);
    setIsLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) {
        throw new Error(error.message);
      }
    } catch (error) {
      console.error("Reset password failed:", error);
      throw error;
    } finally {
      console.log("AuthContext.resetPassword: Setting isLoading = false");
      setIsLoading(false);
    }
  };


  const completeOnboarding = async (
    petName: string,
    bio?: string,
    photos: string[] = [],
    profileDetails?: CompleteOnboardingProfile
  ) => {
    console.log('AuthContext.completeOnboarding: Starting with petName:', petName);
    console.log('AuthContext.completeOnboarding: Current user state:', user);
    console.log('AuthContext.completeOnboarding: Current hasCompletedOnboarding:', hasCompletedOnboarding);
    
    try {
      // Ensure we have a user - if not, create one from storage or use defaults
      let currentUser = user;
      if (!currentUser) {
        const storedUser = await storage.getItem('kasper_user');
        if (storedUser) {
          currentUser = JSON.parse(storedUser);
          console.log('AuthContext.completeOnboarding: Loaded user from storage:', currentUser);
        } else {
          // Create a default user if none exists (shouldn't happen, but safety check)
          currentUser = { id: "1", email: "", petName: "" };
          console.log('AuthContext.completeOnboarding: WARNING - No user found, creating default');
        }
      }
      
      // Update user with pet name
      // IMPORTANT: Don't store full photo URIs in AsyncStorage - they exceed quota
      // Photos are already stored as memories, so we only store metadata (titles/captions)
      const photoDetailsWithoutUris: StoredPhotoDetail[] = (profileDetails?.photos || []).map(photo => ({
        title: photo.title,
        caption: photo.caption,
        // Don't store URI - it's already in memories and can be retrieved from there
      }));

      const profilePayload: PetProfileDetails = {
        bio: bio || profileDetails?.bio,
        breed: profileDetails?.breed,
        birthDate: profileDetails?.birthDate,
        color: profileDetails?.color,
        microchip: profileDetails?.microchip,
        allergies: profileDetails?.allergies,
        // Don't store photos array (full URIs) - they're too large for AsyncStorage
        // Photos are already stored as memories, retrieve from there instead
        // photos: photos, // REMOVED - causes QuotaExceededError
        photoDetails: photoDetailsWithoutUris.length > 0 ? photoDetailsWithoutUris : undefined,
      };

      if (!currentUser) {
        throw new Error("No user available for onboarding");
      }

      const updatedUser: User = {
        id: currentUser.id,
        email: currentUser.email || "",
        petName,
        profileDetails: profilePayload
      };
      
      console.log('AuthContext.completeOnboarding: Updated user:', updatedUser);
      
      // Store onboarding data (petName and bio ONLY - photos are too large for AsyncStorage)
      // Photos will be created as memories directly, not stored in AsyncStorage
      try {
        await storage.setItem('kasper_signup_data', JSON.stringify({
          petName,
          bio,
          breed: profilePayload.breed,
          birthDate: profilePayload.birthDate,
          color: profilePayload.color,
          microchip: profilePayload.microchip,
          allergies: profilePayload.allergies,
        }));
        console.log('AuthContext.completeOnboarding: Saved signup data metadata (without photos)');
      } catch (err) {
        console.warn('AuthContext.completeOnboarding: Failed to persist signup metadata (non-fatal)', err);
      }
      
      // Mark onboarding as complete FIRST in storage (best-effort)
      try {
        await storage.setItem('kasper_onboarding_complete', 'true');
        console.log('AuthContext.completeOnboarding: Set onboarding_complete = true in storage');
      } catch (error) {
        console.warn('AuthContext.completeOnboarding: Failed to persist onboarding flag', error);
      }
      
      // Save user to storage with petName (best-effort), then verify
      try {
        await storage.setItem('kasper_user', JSON.stringify(updatedUser));
        console.log('AuthContext.completeOnboarding: User saved to storage with petName:', petName);
      } catch (error) {
        console.warn('AuthContext.completeOnboarding: Failed to persist user', error);
      }
      
      try {
        const verifyUser = await storage.getItem('kasper_user');
        if (verifyUser) {
          const verified = JSON.parse(verifyUser);
          console.log('AuthContext.completeOnboarding: Verified saved user:', { 
            petName: verified.petName, 
            email: verified.email,
            hasProfileDetails: !!verified.profileDetails
          });
          if (verified.petName !== petName) {
            console.error('AuthContext.completeOnboarding: ERROR - petName mismatch!', { 
              expected: petName, 
              actual: verified.petName 
            });
          }
        }
      } catch (error) {
        console.warn('AuthContext.completeOnboarding: Failed to verify saved user', error);
      }
      
      // CRITICAL: Update state synchronously - set both user and hasCompletedOnboarding together
      // This ensures App.tsx detects both conditions immediately
      console.log('AuthContext.completeOnboarding: Setting user and hasCompletedOnboarding = true');
      console.log('AuthContext.completeOnboarding: Before state update - user:', user, 'hasCompletedOnboarding:', hasCompletedOnboarding);
      
      // Set both states together - React will batch these but they'll both be applied
      setUser(updatedUser);
      setHasCompletedOnboarding(true);
      
      // Force a re-render by updating state in a way that guarantees propagation
      // Use setTimeout to ensure state updates are processed in next tick
      await new Promise(resolve => setTimeout(resolve, 0));
      
      console.log('AuthContext.completeOnboarding: State update calls completed');
      console.log('AuthContext.completeOnboarding: Onboarding completed successfully - App.tsx should show HomeScreen');
      console.log('AuthContext.completeOnboarding: Final user state should have petName:', petName);
    } catch (error) {
      console.error('AuthContext.completeOnboarding: Onboarding completion failed:', error);
      throw error; // Re-throw to let caller handle it
    }
  };

  const logout = async () => {
    console.log('AuthContext.logout: Logging out user');
    console.log('AuthContext.logout: Current user state:', user);
    console.log('AuthContext.logout: Current isAuthenticated:', !!user);
    
    // Update state FIRST (synchronously) so UI updates immediately
    // This will trigger App.tsx to show AuthFlow right away
    setUser(null);
    setHasCompletedOnboarding(false);
    
    console.log('AuthContext.logout: State updated - user set to null, hasCompletedOnboarding set to false');
    console.log('AuthContext.logout: New isAuthenticated should be:', false);
    
    // Sign out from Supabase (non-blocking)
    try {
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
    } catch (error) {
      console.warn("AuthContext.logout: Supabase signOut failed", error);
    }

    // Clear storage asynchronously (non-blocking)
    try {
      const keys = [
        'kasper_user',
        'kasper_onboarding_complete',
        'kasper_signup_data',
        '@kasper_pets',
        '@kasper_active_pet',
        '@kasper_settings',
        '@kasper_memories',
        '@kasper_onboarding_highlights',
        '@kasper_seen_flashbacks'
      ];
      await storage.multiRemove(keys);
      console.log('AuthContext.logout: All data cleared from storage');
    } catch (error) {
      console.error('AuthContext.logout: Storage clear failed:', error);
      // Don't throw - state is already updated, so logout should still work
    }
    
    console.log('AuthContext.logout: Logout complete - App.tsx should now show AuthFlow');
  };

  // Debug function to clear all auth data (for testing)
  const clearAllAuthData = async () => {
    console.log('AuthContext.clearAllAuthData: Clearing all auth data');
    setUser(null);
    setHasCompletedOnboarding(false);
    setIsLoading(true);
    try {
      await storage.removeItem('kasper_user');
      await storage.removeItem('kasper_onboarding_complete');
      await storage.removeItem('kasper_signup_data');
      console.log('AuthContext.clearAllAuthData: All data cleared, isLoading = false');
      setIsLoading(false);
    } catch (error) {
      console.error('Clear auth data failed:', error);
      setIsLoading(false);
    }
  };

  // Memoize the context value to ensure it updates when state changes
  // Functions are stable references, so we only need to depend on state values
  const markOnboardingComplete = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      await supabase.auth.updateUser({ data: { onboarding_complete: true } });
      await storage.setItem('kasper_onboarding_complete', 'true');
    } catch (error) {
      console.error('AuthContext.markOnboardingComplete: Failed to persist flag', error);
    }
    setHasCompletedOnboarding(true);
  }, []);

  const value = useMemo(() => ({
    user,
    isAuthenticated: !!user,
    isLoading,
    isBootstrapping,
    hasCompletedOnboarding,
    isAdmin: isAdminEmail(user?.email),
    login,
    signInWithGoogle,
    requestEmailOtp,
    verifyEmailOtp,
    resetPassword,
    completeOnboarding,
    logout,
    markOnboardingComplete,
  }), [user, isLoading, isBootstrapping, hasCompletedOnboarding, markOnboardingComplete]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

