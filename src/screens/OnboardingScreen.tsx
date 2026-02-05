import React, { useMemo, useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Alert, ScrollView, TextInput, StyleSheet, Image, ActivityIndicator, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import ConfettiCannon from "react-native-confetti-cannon";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@src/contexts/ThemeContext";
import { Banner, Button, Input } from "@src/components/UI";
import { SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from "@src/theme";
import { usePets } from "@src/contexts/PetContext";
import { useMemories } from "@src/contexts/MemoriesContext";
import { useAuth } from "@src/contexts/AuthContext";
import { compressImage } from "@src/utils/imageCompression";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type OnboardingStep = 'intro' | 'petName' | 'bio' | 'photos' | 'profile' | 'success';

export interface OnboardingPhoto {
  uri: string;
  title: string;
  caption: string;
}

export interface OnboardingResult {
  petName: string;
  bio?: string;
  photos: OnboardingPhoto[];
  profilePhoto?: string;
  breed?: string;
  birthDate?: string;
  color?: string;
  microchip?: string;
  allergies?: string;
}

interface OnboardingScreenProps {
  onComplete?: (data: OnboardingResult) => void;
  onSuccessContinue?: () => void;
}

const MAX_PHOTOS = 4;
const ONBOARDING_DRAFT_KEY = "@kasper_onboarding_draft";

const STEP_DETAILS: Record<
  Exclude<OnboardingStep, "success">,
  { icon: keyof typeof Ionicons.glyphMap; gradient: [string, string]; subtitle: string }
> = {
  intro: {
    icon: "sparkles",
    gradient: ["#a78bfa", "#7c3aed"],
    subtitle: "Track health, save memories, and celebrate every wag.",
  },
  petName: {
    icon: "paw",
    gradient: ["#f472b6", "#ec4899"],
    subtitle: "Let's personalize your Meropaw experience.",
  },
  bio: {
    icon: "document-text",
    gradient: ["#60a5fa", "#2563eb"],
    subtitle: "Share personality traits, quirks, and favorites.",
  },
  photos: {
    icon: "camera",
    gradient: ["#f97316", "#ef4444"],
    subtitle: "Add up to four memories with titles and captions.",
  },
  profile: {
    icon: "id-card",
    gradient: ["#10b981", "#059669"],
    subtitle: "Round out the essentials so vets and sitters are ready.",
  },
};

export default function OnboardingScreen({ onComplete, onSuccessContinue }: OnboardingScreenProps) {
  const { colors } = useTheme();
  const { addPet, setActivePet } = usePets();
  const { addMemory } = useMemories();
  const { completeOnboarding, user } = useAuth();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("intro");
  const [petName, setPetName] = useState("");
  const [bio, setBio] = useState("");
  const [photos, setPhotos] = useState<OnboardingPhoto[]>([]);
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);
  const [breed, setBreed] = useState("");
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [color, setColor] = useState("");
  const [microchip, setMicrochip] = useState("");
  const [allergies, setAllergies] = useState("");
  const [loading, setLoading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isMediaProcessing, setIsMediaProcessing] = useState(false);
  const [mediaProcessingLabel, setMediaProcessingLabel] = useState("");
  const [inlineMessage, setInlineMessage] = useState<{ tone: "info" | "success" | "warning" | "error"; text: string } | null>(null);
  const [isRestoringDraft, setIsRestoringDraft] = useState(true);

  const steps: OnboardingStep[] = ["intro", "petName", "bio", "photos", "profile", "success"];
  const currentIndex = steps.indexOf(currentStep);
  useEffect(() => {
    const restoreDraft = async () => {
      try {
        const stored = await AsyncStorage.getItem(ONBOARDING_DRAFT_KEY);
        if (!stored) return;
        const draft = JSON.parse(stored);
        if (draft.currentStep && draft.currentStep === "success") {
          await AsyncStorage.removeItem(ONBOARDING_DRAFT_KEY);
          return;
        }
        if (draft.petName) setPetName(draft.petName);
        if (draft.bio) setBio(draft.bio);
        if (Array.isArray(draft.photos)) setPhotos(draft.photos);
        if (draft.profilePhotoUri) setProfilePhotoUri(draft.profilePhotoUri);
        if (draft.breed) setBreed(draft.breed);
        if (draft.color) setColor(draft.color);
        if (draft.microchip) setMicrochip(draft.microchip);
        if (draft.allergies) setAllergies(draft.allergies);
        if (draft.birthDate) {
          const parsed = new Date(draft.birthDate);
          if (!Number.isNaN(parsed.getTime())) setBirthDate(parsed);
        }
        if (draft.currentStep && steps.includes(draft.currentStep)) {
          setCurrentStep(draft.currentStep);
        }
        setInlineMessage({ tone: "info", text: "We restored your onboarding progress." });
      } catch (error) {
        console.error("OnboardingScreen: Failed to restore draft", error);
      } finally {
        setIsRestoringDraft(false);
      }
    };
    restoreDraft();
  }, []);

  useEffect(() => {
    if (isRestoringDraft || currentStep === "success") return;
    const timer = setTimeout(() => {
      const payload = {
        currentStep,
        petName,
        bio,
        photos,
        profilePhotoUri,
        breed,
        birthDate: birthDate ? birthDate.toISOString() : null,
        color,
        microchip,
        allergies,
      };
      AsyncStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(payload)).catch((error) => {
        console.error("OnboardingScreen: Failed to save draft", error);
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [
    currentStep,
    petName,
    bio,
    photos,
    profilePhotoUri,
    breed,
    birthDate,
    color,
    microchip,
    allergies,
    isRestoringDraft,
  ]);

  const progressRatio = useMemo(() => {
    if (currentStep === "success") return 1;
    const stepCount = steps.length - 1; // exclude success
    return currentIndex / (stepCount - 1);
  }, [currentStep, currentIndex, steps.length]);

  const WebDatePicker = ({
    value,
    onChange,
    onClose,
  }: {
    value: Date;
    onChange: (date: Date) => void;
    onClose: () => void;
  }) => {
    const [localDate, setLocalDate] = useState(value);
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    const year = localDate.getFullYear();
    const month = localDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const calendarDays: Array<number | null> = [];
    for (let i = 0; i < firstDay; i++) {
      calendarDays.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      calendarDays.push(i);
    }

    const changeMonth = (delta: number) => {
      const newDate = new Date(localDate);
      newDate.setMonth(month + delta);
      setLocalDate(newDate);
    };

    const selectDate = (day: number) => {
      const newDate = new Date(year, month, day);
      onChange(newDate);
    };

    return (
      <View style={{ padding: SPACING.md, backgroundColor: colors.bgSecondary, borderRadius: RADIUS.lg, marginTop: SPACING.md }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.md }}>
          <TouchableOpacity onPress={() => changeMonth(-1)}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ ...TYPOGRAPHY.base, fontWeight: "700", color: colors.text }}>
            {months[month]} {year}
          </Text>
          <TouchableOpacity onPress={() => changeMonth(1)}>
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: SPACING.sm }}>
          {days.map(day => (
            <View key={day} style={{ width: "14.28%", alignItems: "center", paddingVertical: SPACING.xs }}>
              <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, fontWeight: "600" }}>{day}</Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {calendarDays.map((day, idx) => {
            if (day === null) {
              return <View key={`empty-${idx}`} style={{ width: "14.28%", paddingVertical: SPACING.sm }} />;
            }
            const dayDate = new Date(year, month, day);
            dayDate.setHours(0, 0, 0, 0);
            const valueDate = new Date(value);
            valueDate.setHours(0, 0, 0, 0);
            const isSelected = dayDate.getTime() === valueDate.getTime();

            return (
              <TouchableOpacity
                key={day}
                onPress={() => selectDate(day)}
                style={{
                  width: "14.28%",
                  alignItems: "center",
                  paddingVertical: SPACING.sm,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: isSelected ? colors.accent : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      ...TYPOGRAPHY.sm,
                      color: isSelected ? colors.white : colors.text,
                      fontWeight: isSelected ? "700" : "500",
                    }}
                  >
                    {day}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity
          onPress={onClose}
          style={{
            marginTop: SPACING.md,
            paddingVertical: SPACING.sm,
            alignItems: "center",
            backgroundColor: colors.accent,
            borderRadius: RADIUS.md,
          }}
        >
          <Text style={{ color: colors.white, fontWeight: "600" }}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permissions Required", "Please grant photo library permissions to add photos.");
      return false;
    }
    return true;
  };

  const pickPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert("Limit reached", `You can add up to ${MAX_PHOTOS} photos.`);
      return;
    }

    const permitted = await requestPermissions();
    if (!permitted) return;

    try {
      setIsMediaProcessing(true);
      setMediaProcessingLabel("Processing photo...");
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets?.[0]) {
        const originalUri = result.assets[0].uri;
        
        console.log('OnboardingScreen: Compressing image...', { originalUri: originalUri.substring(0, 50) + '...' });
        const compressedUri = await compressImage(originalUri, {
          maxWidth: 1080,
          maxHeight: 1080,
          quality: 0.75,
        });
        
        console.log('OnboardingScreen: Image compressed', { compressedUri: compressedUri.substring(0, 50) + '...' });
        
        if (!compressedUri || compressedUri.trim() === '') {
          console.error('OnboardingScreen: Invalid compressed URI', { compressedUri });
          Alert.alert("Error", "Failed to process image. Please try again.");
          return;
        }
        
        const newPhoto = { uri: compressedUri, title: "", caption: "" };
        console.log('OnboardingScreen: Adding photo to state', { uri: compressedUri.substring(0, 50) + '...', photoCount: photos.length + 1 });
        setPhotos((prev) => {
          const updated = [...prev, newPhoto];
          console.log('OnboardingScreen: Photos state updated', { count: updated.length });
          return updated;
        });
      }
    } catch (error) {
      console.error("OnboardingScreen.pickPhoto error", error);
      Alert.alert("Error", "Unable to pick photo. Please try again.");
    } finally {
      setIsMediaProcessing(false);
      setMediaProcessingLabel("");
    }
  };

  const pickSinglePhoto = async (aspect: [number, number], onPick: (uri: string) => void) => {
    const permitted = await requestPermissions();
    if (!permitted) return;

    try {
      setIsMediaProcessing(true);
      setMediaProcessingLabel("Processing photo...");
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect,
        quality: 0.85,
      });

      if (!result.canceled && result.assets?.[0]) {
        const originalUri = result.assets[0].uri;
        const compressedUri = await compressImage(originalUri, {
          maxWidth: aspect[0] >= aspect[1] ? 1600 : 1080,
          maxHeight: aspect[0] >= aspect[1] ? 900 : 1080,
          quality: 0.75,
        });

        if (!compressedUri || compressedUri.trim() === "") {
          Alert.alert("Error", "Failed to process image. Please try again.");
          return;
        }

        onPick(compressedUri);
      }
    } catch (error) {
      console.error("OnboardingScreen.pickSinglePhoto error", error);
      Alert.alert("Error", "Unable to pick photo. Please try again.");
    } finally {
      setIsMediaProcessing(false);
      setMediaProcessingLabel("");
    }
  };

  const handlePickProfilePhoto = () => pickSinglePhoto([1, 1], setProfilePhotoUri);
  const handleRemoveProfilePhoto = () => setProfilePhotoUri(null);

  const updatePhotoField = (index: number, field: "title" | "caption", value: string) => {
    setPhotos((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const canProceedFromCurrentStep = () => {
    switch (currentStep) {
      case "petName":
        return petName.trim().length > 0;
      case "photos":
        return photos.length > 0;
      case "profile":
        return true;
      default:
        return true;
    }
  };

  const canSkipStep = () => {
    // Bio, photos, and profile can be skipped
    return currentStep === "bio" || currentStep === "photos" || currentStep === "profile";
  };

  const handleBack = () => {
    if (currentIndex === 0) return;
    setCurrentStep(steps[currentIndex - 1]);
  };

  const handleSkip = () => {
    if (currentStep === "bio") {
      // Skip bio, go to photos
      setCurrentStep("photos");
    } else if (currentStep === "profile") {
      // Skip profile, finish onboarding
      finalizeOnboarding();
    } else if (currentStep === "photos") {
      Alert.alert("Skip photos?", "You can always add them later.", [
        { text: "Cancel", style: "cancel" },
        { text: "Skip", style: "default", onPress: () => {
          if (currentIndex < steps.length - 2) {
            setCurrentStep(steps[currentIndex + 1]);
          } else {
            finalizeOnboarding();
          }
        }},
      ]);
    }
  };

  const finalizeOnboarding = async () => {
    if (loading) return;
    setLoading(true);
    setInlineMessage(null);

    try {
      // Prepare payload once
      const trimmedPetName = petName.trim();
      const trimmedBio = bio.trim() || undefined;
      const validPhotos = photos.filter(p => p.uri);
      
      if (!trimmedPetName) {
        setInlineMessage({ tone: "error", text: "Please enter your pet's name." });
        setLoading(false);
        return;
      }

      // Extract photo URIs once (reused multiple times)
      const photoUris = validPhotos.map(photo => photo.uri);
      const profilePhotoUris = [profilePhotoUri].filter(Boolean) as string[];
      const combinedPhotos = [...profilePhotoUris, ...photoUris.filter(uri => !profilePhotoUris.includes(uri))];
      
      // Prepare pet data
      const petData = {
        name: trimmedPetName,
        bio: trimmedBio,
        photos: combinedPhotos,
        breed: breed.trim() || undefined,
        birthDate: birthDate ? birthDate.toISOString() : undefined,
        color: color.trim() || undefined,
        microchip: microchip.trim() || undefined,
        allergies: allergies.trim() || undefined,
      };

      // Step 1: Create pet (critical - must succeed)
      const petId = await addPet(petData);
      await setActivePet(petId);

      // Step 2: Add photos as memories (non-critical - continue even if some fail)
      const month = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (profilePhotoUri && !photoUris.includes(profilePhotoUri)) {
        try {
          addMemory({
            type: 'photo',
            title: "Profile Photo",
            note: "Profile photo",
            src: profilePhotoUri,
            w: 1000,
            h: 1000,
            petId,
          }, { isFavorite: true, isOnboarding: true });
        } catch (memoryError) {
          console.error('OnboardingScreen: Error adding profile photo memory:', memoryError);
        }
      }
      for (const photo of validPhotos) {
        try {
          addMemory({
            type: 'photo',
            title: photo.title?.trim() || `Welcome Photo`,
            note: photo.caption?.trim() || undefined,
            src: photo.uri,
            w: 1000,
            h: 1000,
            petId,
          }, { isFavorite: true, isOnboarding: true });
        } catch (memoryError) {
          console.error('OnboardingScreen: Error adding memory:', memoryError);
          // Continue even if memory addition fails (non-critical)
        }
      }
      
      // Step 3: Complete onboarding (update user profile)
      const profileDetails = {
        breed: petData.breed,
        birthDate: petData.birthDate,
        color: petData.color,
        microchip: petData.microchip,
        allergies: petData.allergies,
        profilePhoto: profilePhotoUri || undefined,
        photos: validPhotos.map(photo => ({
          uri: photo.uri,
          title: photo.title,
          caption: photo.caption,
        })),
      };

      await completeOnboarding(
        trimmedPetName,
        trimmedBio,
        photoUris,
        profileDetails
      );

      // Step 4: Call completion callback
      if (onComplete) {
        const payload: OnboardingResult = {
          petName: trimmedPetName,
          bio: trimmedBio,
          photos: validPhotos,
          profilePhoto: profilePhotoUri || undefined,
          breed: petData.breed,
          birthDate: petData.birthDate,
          color: petData.color,
          microchip: petData.microchip,
          allergies: petData.allergies,
        };
        await onComplete(payload);
      }

      // Step 5: Show success
      await AsyncStorage.removeItem(ONBOARDING_DRAFT_KEY);
      setShowConfetti(true);
      setCurrentStep("success");
    } catch (error) {
      console.error("OnboardingScreen.finalizeOnboarding error", error);
      setInlineMessage({ tone: "error", text: "We couldn't finish onboarding. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (!canProceedFromCurrentStep()) {
      if (currentStep === "petName") {
        setInlineMessage({ tone: "error", text: "Please enter your pet's name." });
      } else if (currentStep === "photos") {
        setInlineMessage({ tone: "error", text: "Please add at least one photo." });
      }
      return;
    }

    if (currentStep === "profile") {
      finalizeOnboarding();
    } else {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const renderHero = (step: Exclude<OnboardingStep, "success">, title: string) => {
    const stepNumber = step === "intro" ? 0 : step === "petName" ? 1 : step === "bio" ? 2 : step === "photos" ? 3 : 4;
    const progressPercent = Math.round(((stepNumber + 1) / (steps.length - 1)) * 100);
    
    return (
      <View style={styles.modernHeroCard}>
        <View style={styles.progressHeader}>
          <Text style={[styles.progressText, { color: colors.textMuted }]}>
            {progressPercent}% Complete
          </Text>
          <View style={[styles.progressBarContainer, { backgroundColor: colors.borderLight }]}>
            <View 
              style={[
                styles.progressBarFill, 
                { 
                  width: `${progressPercent}%`,
                  backgroundColor: colors.accent 
                }
              ]} 
            />
          </View>
        </View>
        <View style={[styles.iconCircle, { backgroundColor: colors.accent + '15' }]}>
          <Ionicons name={STEP_DETAILS[step].icon} size={32} color={colors.accent} />
        </View>
        <Text style={[styles.modernTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.modernSubtitle, { color: colors.textMuted }]}>
          {STEP_DETAILS[step].subtitle}
        </Text>
      </View>
    );
  };

  const renderIntro = () => (
    <View style={styles.centeredBlock}>
      {renderHero("intro", "Give your pet the care they deserve")}
      <View style={styles.featurePreview}>
        <View style={styles.featureItem}>
          <Ionicons name="heart" size={24} color={colors.accent} />
          <Text style={[styles.featureText, { color: colors.text }]}>Track Health</Text>
        </View>
        <View style={styles.featureItem}>
          <Ionicons name="images" size={24} color={colors.accent} />
          <Text style={[styles.featureText, { color: colors.text }]}>Save Memories</Text>
        </View>
        <View style={styles.featureItem}>
          <Ionicons name="calendar" size={24} color={colors.accent} />
          <Text style={[styles.featureText, { color: colors.text }]}>Vet Reminders</Text>
        </View>
      </View>
    </View>
  );

  const renderPetName = () => (
    <View style={styles.centeredBlock}>
      {renderHero("petName", `What's your pet's name?`)}
      <View style={styles.card}>
        <Input
          value={petName}
          onChangeText={setPetName}
          placeholder="Enter pet name"
          autoFocus
        />
      </View>
    </View>
  );

  const renderBio = () => (
    <View style={styles.centeredBlock}>
      {renderHero("bio", `Tell us about ${petName || "your pet"}`)}
      <View style={styles.card}>
        <Input
          value={bio}
          onChangeText={setBio}
          placeholder="Personality, favorite toy, quirks..."
          multiline
          numberOfLines={4}
          style={{ width: "100%", minHeight: 110, textAlignVertical: "top" }}
        />
      </View>
    </View>
  );

  const renderPhotos = () => {
    return (
      <View style={{ width: "100%" }}>
        {renderHero("photos", `Add photos of ${petName || "your pet"}`)}

        {inlineMessage && (
          <Banner text={inlineMessage.text} tone={inlineMessage.tone} style={{ marginBottom: SPACING.md }} />
        )}

        {isMediaProcessing && (
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: SPACING.lg }}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginLeft: SPACING.sm }}>
              {mediaProcessingLabel || "Processing..."}
            </Text>
          </View>
        )}

        {/* Instagram-style profile photo card */}
        <View style={[styles.profilePhotoCardLarge, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
          <TouchableOpacity activeOpacity={0.9} onPress={handlePickProfilePhoto} style={styles.profilePhotoAction}>
            {profilePhotoUri ? (
              <Image source={{ uri: profilePhotoUri }} style={styles.profilePhotoLargeImage} />
            ) : (
              <View style={[styles.profilePhotoPlaceholder, { backgroundColor: colors.accent + "12" }]}>
                <Ionicons name="person-circle-outline" size={44} color={colors.accent} />
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.profilePhotoMeta}>
            <Text style={[styles.profilePhotoTitle, { color: colors.text }]}>Profile photo</Text>
            <Text style={[styles.profilePhotoHint, { color: colors.textMuted }]}>
              This shows up on the profile header and memories.
            </Text>
          </View>
          {profilePhotoUri && (
            <TouchableOpacity
              onPress={handleRemoveProfilePhoto}
              style={[styles.profilePhotoRemove, { backgroundColor: "rgba(0,0,0,0.45)" }]}
            >
              <Ionicons name="close" size={12} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        {/* Bumble / Tinder style photo cards */}
        <View style={styles.photoCardList}>
          {photos.map((photo, index) => (
            <View key={photo.uri || index} style={[styles.photoStackCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Image source={{ uri: photo.uri }} style={styles.photoStackImage} resizeMode="cover" />
              <TouchableOpacity
                style={styles.photoRemoveButton}
                onPress={() => removePhoto(index)}
              >
                <Ionicons name="close-circle" size={26} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={styles.photoStackInputs}>
                <TextInput
                  placeholder={`Title for photo ${index + 1}`}
                  value={photo.title}
                  onChangeText={(text) => updatePhotoField(index, "title", text)}
                  placeholderTextColor={colors.textMuted}
                  style={[styles.photoStackInput, { color: colors.text, borderColor: colors.border }]}
                />
                <TextInput
                  placeholder="Caption (optional)"
                  value={photo.caption}
                  onChangeText={(text) => updatePhotoField(index, "caption", text)}
                  placeholderTextColor={colors.textMuted}
                  style={[styles.photoStackInput, { color: colors.text, borderColor: colors.border }]}
                />
              </View>
            </View>
          ))}
          {photos.length < MAX_PHOTOS && (
            <TouchableOpacity
              style={[styles.photoAddCardWide, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={pickPhoto}
              activeOpacity={0.7}
            >
              <View style={[styles.photoAddIcon, { backgroundColor: colors.accent + "20" }]}>
                <Ionicons name="camera" size={26} color={colors.accent} />
              </View>
              <Text style={[styles.photoAddText, { color: colors.textMuted }]}>
                Add another photo ({photos.length}/{MAX_PHOTOS})
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderProfile = () => (
    <View style={{ width: "100%" }}>
      {renderHero("profile", `Complete ${petName || "your pet"}'s profile`)}
      <Text style={[styles.optionalHint, { color: colors.textMuted }]}>
        All fields are optional - you can add these details later
      </Text>
      <View style={[styles.card, { marginTop: SPACING.md }]}>
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.text }]}>Basic Info</Text>
          <Input value={breed} onChangeText={setBreed} placeholder="Breed (optional)" />
          <Input value={color} onChangeText={setColor} placeholder="Coat color (optional)" />
          <TouchableOpacity
            style={[styles.datePicker, { borderColor: colors.border, backgroundColor: colors.surface }]}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={{ color: birthDate ? colors.text : colors.textMuted }}>
              {birthDate ? birthDate.toLocaleDateString() : "Birth Date (optional)"}
            </Text>
            <Ionicons name="calendar-outline" size={18} color={colors.accent} />
          </TouchableOpacity>
        </View>
        
        <View style={[styles.fieldGroup, { marginTop: SPACING.lg }]}>
          <Text style={[styles.fieldLabel, { color: colors.text }]}>Health Info</Text>
          <Input
            value={microchip}
            onChangeText={setMicrochip}
            placeholder="Microchip ID (optional)"
            keyboardType="numeric"
          />
          <Input value={allergies} onChangeText={setAllergies} placeholder="Allergies (optional)" />
        </View>
      </View>
      {showDatePicker &&
        (Platform.OS === "web" ? (
          <WebDatePicker
            value={birthDate || new Date()}
            onChange={(date) => {
              setBirthDate(date);
              setShowDatePicker(false);
            }}
            onClose={() => setShowDatePicker(false)}
          />
        ) : (
          <DateTimePicker
            value={birthDate || new Date()}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "calendar"}
            onChange={(event, date) => {
              if (Platform.OS !== "ios") {
                setShowDatePicker(false);
              }
              if (event?.type === "dismissed") {
                setShowDatePicker(false);
                return;
              }
              if (date) setBirthDate(date);
              if (Platform.OS === "ios") {
                setShowDatePicker(false);
              }
            }}
          />
        ))}
    </View>
  );

  const renderSuccess = () => (
    <View style={styles.centeredBlock}>
      {showConfetti && <ConfettiCannon count={200} origin={{ x: -10, y: 0 }} fadeOut />}
      <View style={styles.modernHeroCard}>
        <View style={[styles.iconCircle, { backgroundColor: colors.accent + '15' }]}>
          <Ionicons name="sparkles" size={36} color={colors.accent} />
        </View>
        <Text style={[styles.modernTitle, { color: colors.text }]}>All set!</Text>
        <Text style={[styles.modernSubtitle, { color: colors.textMuted }]}>
          Your profile is ready. Let the adventures begin!
        </Text>
      </View>
      <Text style={[styles.title, { color: colors.text, textAlign: "center", marginTop: SPACING.xl }]}>
        Welcome, {petName || "friend"}!
      </Text>
      <Button
        title="Go to Home"
        onPress={() => {
          if (onSuccessContinue) {
            onSuccessContinue();
          }
        }}
        style={{ marginTop: SPACING.xl }}
      />
    </View>
  );

  const renderStep = () => {
    switch (currentStep) {
      case "intro":
        return renderIntro();
      case "petName":
        return renderPetName();
      case "bio":
        return renderBio();
      case "photos":
        return renderPhotos();
      case "profile":
        return renderProfile();
      case "success":
        return renderSuccess();
      default:
        return null;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: SPACING.xl, paddingBottom: SPACING.xxxl }}
        keyboardShouldPersistTaps="handled"
      >
        {inlineMessage && currentStep !== "photos" && (
          <Banner text={inlineMessage.text} tone={inlineMessage.tone} style={{ marginBottom: SPACING.md }} />
        )}
        {renderStep()}

        {currentStep !== "success" && (
          <View style={styles.buttonContainer}>
            <View style={{ flexDirection: "row", gap: SPACING.sm }}>
              {currentIndex > 0 && (
                <TouchableOpacity
                  style={[
                    styles.secondaryButton,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                    },
                  ]}
                  onPress={handleBack}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: colors.text, fontWeight: "600" }}>Back</Text>
                </TouchableOpacity>
              )}
              <Button
                title={
                  currentStep === "profile"
                    ? loading
                      ? "Finishing..."
                      : "Complete"
                    : "Continue"
                }
                onPress={handleNext}
                style={{ flex: 1 }}
                disabled={loading}
              />
            </View>
            {canSkipStep() && currentStep !== "profile" && (
              <TouchableOpacity 
                onPress={handleSkip}
                style={styles.skipButtonBottom}
              >
                <Text style={[styles.skipText, { color: colors.textMuted }]}>
                  Skip this step
                </Text>
              </TouchableOpacity>
            )}
            {loading && (
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: SPACING.md }}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginLeft: SPACING.sm }}>
                  Finishing onboarding...
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  centeredBlock: {
    alignItems: "center",
    width: "100%",
    gap: SPACING.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    marginTop: SPACING.md,
    fontSize: 16,
    lineHeight: 22,
  },
  modernHeroCard: {
    width: "100%",
    alignItems: "center",
    marginBottom: SPACING.lg,
  },
  progressHeader: {
    width: "100%",
    marginBottom: SPACING.xl,
  },
  progressText: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: SPACING.xs,
    textAlign: "right",
  },
  progressBarContainer: {
    width: "100%",
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.lg,
  },
  modernTitle: {
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: SPACING.sm,
    letterSpacing: -0.5,
  },
  modernSubtitle: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: SPACING.md,
  },
  featurePreview: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },
  featureItem: {
    alignItems: "center",
    gap: SPACING.xs,
  },
  featureText: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: SPACING.xs,
  },
  optionalHint: {
    fontSize: 14,
    textAlign: "center",
    marginTop: SPACING.sm,
    fontStyle: "italic",
  },
  fieldGroup: {
    gap: SPACING.md,
  },
  profilePhotoRow: {
    flexDirection: "row",
    gap: SPACING.md,
  },
  profilePhotoCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.lg,
    gap: SPACING.xs,
    minHeight: 110,
    overflow: "hidden",
  },
  profilePhotoImage: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  profilePhotoImageWide: {
    width: "100%",
    height: 54,
    borderRadius: RADIUS.md,
  },
  profilePhotoLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  profilePhotoRemove: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  profilePhotoCardLarge: {
    borderWidth: 1,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  profilePhotoAction: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  profilePhotoLargeImage: {
    width: "100%",
    height: "100%",
  },
  profilePhotoPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  profilePhotoBadge: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#0b1220",
  },
  profilePhotoMeta: {
    flex: 1,
    gap: 4,
  },
  profilePhotoTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  profilePhotoHint: {
    fontSize: 12,
    lineHeight: 16,
  },
  photoCardList: {
    gap: SPACING.lg,
  },
  photoStackCard: {
    borderWidth: 1,
    borderRadius: RADIUS.xl,
    overflow: "hidden",
  },
  photoStackImage: {
    width: "100%",
    height: 220,
  },
  photoStackInputs: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  photoStackInput: {
    fontSize: 15,
    padding: SPACING.sm,
    borderWidth: 1,
    borderRadius: RADIUS.md,
  },
  photoAddCardWide: {
    width: "100%",
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: RADIUS.xl,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
    paddingVertical: SPACING.xl,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: SPACING.xs,
  },
  skipButton: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
    alignItems: "center",
  },
  skipButtonBottom: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
    alignItems: "center",
  },
  skipText: {
    fontSize: 15,
    fontWeight: "500",
  },
  buttonContainer: {
    marginTop: SPACING.xl,
  },
  progressContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: SPACING.sm / 2,
    marginBottom: SPACING.xl,
  },
  progressDot: {
    height: 6,
    flex: 1,
    borderRadius: 3,
  },
  photoRemoveButton: {
    position: "absolute",
    top: SPACING.xs,
    right: SPACING.xs,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 12,
  },
  photoAddIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  photoAddText: {
    fontSize: 13,
    fontWeight: "600",
  },
  card: {
    width: "100%",
    backgroundColor: "transparent",
    gap: SPACING.md,
  },
  datePicker: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  secondaryButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
