import React, { useMemo, useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Alert, ScrollView, Image, TextInput, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { RADIUS, SPACING, TYPOGRAPHY, SHADOWS } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import { Button, Input } from "@src/components/UI";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import ScreenHeader from "@src/components/ScreenHeader";
import { usePets } from "@src/contexts/PetContext";
import { useMemories } from "@src/contexts/MemoriesContext";
import { useNavigation } from "@src/contexts/NavigationContext";
import { compressImage } from "@src/utils/imageCompression";
import AsyncStorage from "@react-native-async-storage/async-storage";

type AddPetStep = 'intro' | 'petName' | 'bio' | 'photos' | 'profile';

type AddPetPhoto = {
  uri: string;
  title: string;
  caption: string;
};

const MAX_PHOTOS = 4;
const ADD_PET_DRAFT_KEY = "@kasper_add_pet_draft";

const STEP_META: Record<AddPetStep, { title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap; gradient: [string, string] }> = {
  intro: {
    title: "Add a new pet",
    subtitle: "Let’s build a profile you can grow over time.",
    icon: "sparkles",
    gradient: ["#a78bfa", "#7c3aed"],
  },
  petName: {
    title: "What's your pet's name?",
    subtitle: "Let’s personalize their profile.",
    icon: "paw",
    gradient: ["#f472b6", "#ec4899"],
  },
  bio: {
    title: "Tell us about your pet",
    subtitle: "Share personality traits, quirks, and favorites.",
    icon: "document-text",
    gradient: ["#60a5fa", "#2563eb"],
  },
  photos: {
    title: "Add photos",
    subtitle: "Add up to four memories with titles and captions.",
    icon: "camera",
    gradient: ["#f97316", "#ef4444"],
  },
  profile: {
    title: "Complete the profile",
    subtitle: "Round out the essentials so vets and sitters are ready.",
    icon: "id-card",
    gradient: ["#10b981", "#059669"],
  },
};

export default function AddPetScreen() {
  const { colors } = useTheme();
  const { addPet, setActivePet } = usePets();
  const { addMemory } = useMemories();
  const { navigateTo } = useNavigation();
  const [currentStep, setCurrentStep] = useState<AddPetStep>('intro');
  const [petName, setPetName] = useState("");
  const [bio, setBio] = useState("");
  const [photos, setPhotos] = useState<AddPetPhoto[]>([]);
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);
  const [breed, setBreed] = useState("");
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [color, setColor] = useState("");
  const [microchip, setMicrochip] = useState("");
  const [allergies, setAllergies] = useState("");
  const [loading, setLoading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isMediaProcessing, setIsMediaProcessing] = useState(false);
  const [mediaProcessingLabel, setMediaProcessingLabel] = useState("");
  const [isRestoringDraft, setIsRestoringDraft] = useState(true);
  const steps: AddPetStep[] = ["intro", "petName", "bio", "photos", "profile"];
  const currentIndex = steps.indexOf(currentStep);
  const progressPercent = Math.round(((currentIndex + 1) / steps.length) * 100);
  useEffect(() => {
    const restoreDraft = async () => {
      try {
        const stored = await AsyncStorage.getItem(ADD_PET_DRAFT_KEY);
        if (!stored) return;
        const draft = JSON.parse(stored);
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
      } catch (error) {
        console.error("AddPetScreen: Failed to restore draft", error);
      } finally {
        setIsRestoringDraft(false);
      }
    };
    restoreDraft();
  }, []);

  useEffect(() => {
    if (isRestoringDraft || isCompleted) return;
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
      AsyncStorage.setItem(ADD_PET_DRAFT_KEY, JSON.stringify(payload)).catch((error) => {
        console.error("AddPetScreen: Failed to save draft", error);
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
    isCompleted,
  ]);
  const stepMeta = useMemo(() => {
    const meta = STEP_META[currentStep];
    const displayName = petName.trim() || "your pet";
    if (currentStep === "bio") {
      return { ...meta, title: `Tell us about ${displayName}` };
    }
    if (currentStep === "photos") {
      return { ...meta, title: `Add photos of ${displayName}` };
    }
    if (currentStep === "profile") {
      return { ...meta, title: `Complete ${displayName}'s profile` };
    }
    return meta;
  }, [currentStep, petName]);

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
    if (status !== 'granted') {
      Alert.alert(
        'Permissions Required',
        'Please grant photo library permissions to add photos.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const pickPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert("Limit reached", `You can add up to ${MAX_PHOTOS} photos.`);
      return;
    }

    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      setIsMediaProcessing(true);
      setMediaProcessingLabel("Processing photo...");
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets[0]) {
        const compressedUri = await compressImage(result.assets[0].uri, {
          maxWidth: 1080,
          maxHeight: 1080,
          quality: 0.75,
        });
        if (!compressedUri || compressedUri.trim() === "") {
          Alert.alert("Error", "Failed to process image. Please try again.");
          return;
        }
        setPhotos(prev => [...prev, { uri: compressedUri, title: "", caption: "" }]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick photo. Please try again.');
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
        const compressedUri = await compressImage(result.assets[0].uri, {
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
      Alert.alert('Error', 'Failed to pick profile photo. Please try again.');
    } finally {
      setIsMediaProcessing(false);
      setMediaProcessingLabel("");
    }
  };

  const pickProfilePhoto = () => pickSinglePhoto([1, 1], setProfilePhotoUri);
  const removeProfilePhoto = () => setProfilePhotoUri(null);

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const updatePhotoField = (index: number, field: "title" | "caption", value: string) => {
    setPhotos(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleNext = () => {
    if (currentStep === 'intro') {
      setCurrentStep('petName');
      return;
    }
    if (currentStep === 'petName') {
      if (!petName.trim()) {
        Alert.alert("Error", "Please enter your pet's name");
        return;
      }
      setCurrentStep('bio');
    } else if (currentStep === 'bio') {
      setCurrentStep('photos');
    } else if (currentStep === 'photos') {
      setCurrentStep('profile');
    }
  };

  const handleBack = () => {
    if (currentStep === 'petName') {
      setCurrentStep('intro');
    } else if (currentStep === 'bio') {
      setCurrentStep('petName');
    } else if (currentStep === 'photos') {
      setCurrentStep('bio');
    } else if (currentStep === 'profile') {
      setCurrentStep('photos');
    }
  };

  const canSkipStep = () => currentStep === 'bio' || currentStep === 'profile';

  const handleSkip = () => {
    if (currentStep === 'bio') {
      setCurrentStep('photos');
      return;
    }
    if (currentStep === 'profile') {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    if (isCompleted) {
      console.log('AddPetScreen: Already completed, ignoring duplicate call');
      return;
    }

    if (!petName.trim()) {
      Alert.alert("Error", "Please enter your pet's name");
      return;
    }

    if (photos.length === 0 && !profilePhotoUri) {
      Alert.alert("Error", "Please add at least one photo");
      return;
    }

    setIsCompleted(true);
    setLoading(true);

    try {
      console.log("AddPetScreen: Starting to add pet...");
      
      // Add pet to context
      const combinedPhotos = [profilePhotoUri, ...photos.map(p => p.uri)].filter(Boolean) as string[];
      const petId = await addPet({
        name: petName.trim(),
        bio: bio.trim() || undefined,
        photos: combinedPhotos,
        breed: breed.trim() || undefined,
        birthDate: birthDate ? birthDate.toISOString() : undefined,
        color: color.trim() || undefined,
        microchip: microchip.trim() || undefined,
        allergies: allergies.trim() || undefined,
      });
      
      console.log("AddPetScreen: Pet added with ID:", petId);

      // Add photos as memories (favorites) scoped to this pet
      if (profilePhotoUri) {
        try {
          await addMemory({
            type: 'photo',
            title: "Profile Photo",
            note: "Profile photo",
            src: profilePhotoUri,
            month: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
            w: 1000,
            h: 1000,
            petId,
          }, { isFavorite: true });
        } catch (memoryError) {
          console.error("AddPetScreen: Error adding profile photo memory:", memoryError);
        }
      }

      for (const photo of photos) {
        try {
          await addMemory({
            type: 'photo',
            title: photo.title?.trim() || `${petName}'s Photo`,
            note: photo.caption?.trim() || `Photo of ${petName}`,
            src: photo.uri,
            month: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
            w: 1000,
            h: 1000,
            petId,
          }, { isFavorite: true });
        } catch (memoryError) {
          console.error("AddPetScreen: Error adding memory:", memoryError);
          // Continue even if memory addition fails
        }
      }

      // Set as active pet
      await setActivePet(petId);
      console.log("AddPetScreen: Active pet set to:", petId);

      // Navigate back to Settings (where user came from)
      console.log("AddPetScreen: Navigating back to Settings...");
      
      // Use requestAnimationFrame to ensure state updates are processed
      requestAnimationFrame(() => {
        navigateTo("Home");
        // Show success alert after navigation
        setTimeout(() => {
          Alert.alert(
            "Welcome to Meropaw!",
            `${petName} has been added successfully!\n\nYou can now track meals, health, and create memories.`,
            [{ text: "Let's Go!", style: "default" }]
          );
        }, 300);
      });
      AsyncStorage.removeItem(ADD_PET_DRAFT_KEY).catch((error) => {
        console.error("AddPetScreen: Failed to clear draft", error);
      });
    } catch (error) {
      console.error("AddPetScreen: Error adding pet:", error);
      Alert.alert("Error", "Failed to add pet. Please try again.");
      setIsCompleted(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Add Pet" />
      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero */}
        <View style={{ marginBottom: SPACING.xl }}>
          <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, fontWeight: "600", textAlign: "right" }}>
            {progressPercent}% Complete
          </Text>
          <View style={{ height: 6, backgroundColor: colors.borderLight, borderRadius: 3, overflow: "hidden", marginTop: SPACING.xs }}>
            <View style={{ height: "100%", width: `${progressPercent}%`, backgroundColor: colors.accent }} />
          </View>
          <View style={{
            marginTop: SPACING.lg,
            alignItems: "center",
          }}>
            <View style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: colors.accent + "15",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: SPACING.md,
            }}>
              <Ionicons name={stepMeta.icon} size={32} color={colors.accent} />
            </View>
            <Text style={{ ...TYPOGRAPHY.xl, fontWeight: "800", color: colors.text, textAlign: "center" }}>
              {stepMeta.title}
            </Text>
            <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, textAlign: "center", marginTop: SPACING.xs }}>
              {stepMeta.subtitle}
            </Text>
          </View>
        </View>

        {/* Step 0: Intro */}
        {currentStep === 'intro' && (
          <View style={{ alignItems: "center" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-around", width: "100%", marginTop: SPACING.lg }}>
              {[
                { icon: "heart", label: "Track Health" },
                { icon: "images", label: "Save Memories" },
                { icon: "calendar", label: "Vet Reminders" },
              ].map((item) => (
                <View key={item.label} style={{ alignItems: "center", gap: SPACING.xs }}>
                  <Ionicons name={item.icon as any} size={20} color={colors.accent} />
                  <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, fontWeight: "600" }}>
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Step 1: Pet Name */}
        {currentStep === 'petName' && (
          <>
            <Input
              value={petName}
              onChangeText={setPetName}
              placeholder="e.g. Luna"
              style={{ marginBottom: SPACING.xl }}
            />
          </>
        )}

        {/* Step 2: Bio */}
        {currentStep === 'bio' && (
          <>
            <Input
              value={bio}
              onChangeText={setBio}
              placeholder="Personality, favorite toy, quirks..."
              multiline
              numberOfLines={4}
              style={{ height: 100, textAlignVertical: "top", paddingTop: SPACING.md, marginBottom: SPACING.xl }}
            />
          </>
        )}

        {/* Step 3: Photos */}
        {currentStep === 'photos' && (
          <>
            {isMediaProcessing && (
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: SPACING.lg }}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginLeft: SPACING.sm }}>
                  {mediaProcessingLabel || "Processing..."}
                </Text>
              </View>
            )}

            <View style={[styles.profilePhotoCardLarge, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
              <TouchableOpacity activeOpacity={0.9} onPress={pickProfilePhoto} style={styles.profilePhotoAction}>
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
                  onPress={removeProfilePhoto}
                  style={[styles.profilePhotoRemove, { backgroundColor: "rgba(0,0,0,0.45)" }]}
                >
                  <Ionicons name="close" size={12} color="#fff" />
                </TouchableOpacity>
              )}
            </View>

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
                      placeholderTextColor={colors.textMuted}
                      value={photo.title}
                      onChangeText={(text) => updatePhotoField(index, "title", text)}
                      style={[styles.photoStackInput, { color: colors.text, borderColor: colors.border }]}
                    />
                    <TextInput
                      placeholder="Caption (optional)"
                      placeholderTextColor={colors.textMuted}
                      value={photo.caption}
                      onChangeText={(text) => updatePhotoField(index, "caption", text)}
                      style={[styles.photoStackInput, { color: colors.text, borderColor: colors.border }]}
                    />
                  </View>
                </View>
              ))}
            </View>

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
          </>
        )}

        {/* Step 4: Profile */}
        {currentStep === 'profile' && (
          <>
            <Text style={[styles.optionalHint, { color: colors.textMuted }]}>
              All fields are optional - you can add these details later
            </Text>
            <View style={{ marginTop: SPACING.md }}>
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
          </>
        )}

        {/* Navigation Buttons */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: SPACING.xl }}>
          {currentStep !== 'intro' && (
            <Button title="Back" onPress={handleBack} size="md" style={{ flex: 1, marginRight: SPACING.sm }} />
          )}
          {currentStep === 'profile' ? (
            <Button
              title={loading ? "Adding..." : "Complete"}
              onPress={handleComplete}
              disabled={loading}
              size="md"
              style={{ flex: 1, marginLeft: currentStep === 'intro' ? 0 : SPACING.sm }}
            />
          ) : (
            <Button
              title="Continue"
              onPress={handleNext}
              size="md"
              style={{ flex: 1, marginLeft: currentStep === 'intro' ? 0 : SPACING.sm }}
            />
          )}
        </View>
        {canSkipStep() && (
          <TouchableOpacity onPress={handleSkip} style={{ marginTop: SPACING.md, alignItems: "center" }}>
            <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, fontWeight: "600" }}>
              Skip this step
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
  optionalHint: {
    fontSize: 14,
    textAlign: "center",
    marginTop: SPACING.sm,
    fontStyle: "italic",
  },
  fieldGroup: {
    gap: SPACING.md,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: SPACING.xs,
  },
  datePicker: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
});

