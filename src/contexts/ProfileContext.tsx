import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Platform } from "react-native";
import { useAuth } from "@src/contexts/AuthContext";
import { useMemories } from "@src/contexts/MemoriesContext";
import { usePets } from "@src/contexts/PetContext";
import { fetchUserProfile, upsertUserProfile } from "@src/services/supabaseData";

interface ProfileData {
  petName: string;
  ownerEmail?: string;
  ownerName?: string;
  ownerPhone?: string;
  ownerLegalFirstName?: string;
  ownerLegalLastName?: string;
  ownerPreferredFirstName?: string;
  ownerResidentialAddress?: string;
  ownerMailingAddress?: string;
  ownerEmergencyContact?: string;
  bio?: string;
  avatarUrl?: string;
  coverUrl?: string;
  breed?: string;
  birthDate?: string;
  color?: string;
  microchip?: string;
  allergies?: string;
}

interface ProfileContextType {
  profile: ProfileData;
  updateProfile: (updates: Partial<ProfileData>) => Promise<void>;
  loadProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

const defaultProfile: ProfileData = {
  petName: "Your pet",
  ownerEmail: "",
  ownerName: "",
  ownerPhone: "",
  ownerLegalFirstName: "",
  ownerLegalLastName: "",
  ownerPreferredFirstName: "",
  ownerResidentialAddress: "",
  ownerMailingAddress: "",
  ownerEmergencyContact: "",
  bio: "",
  breed: "",
  birthDate: "",
  color: "",
  microchip: "",
  allergies: "",
};

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<ProfileData>(defaultProfile);
  const { user } = useAuth();
  const { memories, getFavoriteMemories } = useMemories();
  const { getActivePet, updatePet } = usePets();
  const isRemoteUrl = useCallback((uri?: string) => !!uri && /^https?:\/\//i.test(uri), []);

  const loadProfile = useCallback(async () => {
    try {
      if (!user?.id) return;
      const remote = await fetchUserProfile(user.id);
      if (remote) {
        setProfile(prev => ({
          ...prev,
          ownerName: remote.owner_name || prev.ownerName,
          ownerPhone: remote.owner_phone || prev.ownerPhone,
          ownerEmail: remote.owner_email || user.email || prev.ownerEmail,
          ownerLegalFirstName: remote.owner_legal_first_name || prev.ownerLegalFirstName,
          ownerLegalLastName: remote.owner_legal_last_name || prev.ownerLegalLastName,
          ownerPreferredFirstName: remote.owner_preferred_first_name || prev.ownerPreferredFirstName,
          ownerResidentialAddress: remote.owner_residential_address || prev.ownerResidentialAddress,
          ownerMailingAddress: remote.owner_mailing_address || prev.ownerMailingAddress,
          ownerEmergencyContact: remote.owner_emergency_contact || prev.ownerEmergencyContact,
        }));
      }
    } catch (error) {
      console.error("Failed to load profile:", error);
    }
  }, [user?.id, user?.email]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!user) return;
    const details = (user as any)?.profileDetails || {};
    const activePet = getActivePet();
    const petPhotos = Array.isArray(activePet?.photos) ? activePet?.photos : [];
    const safePetPhotos = Platform.OS === "web" ? petPhotos.filter(isRemoteUrl) : petPhotos;

    setProfile(prev => {
      const updated: ProfileData = {
        ...prev,
        petName: activePet?.name || user.petName || prev.petName,
        ownerEmail: user.email || prev.ownerEmail,
        bio: activePet?.bio ?? details.bio ?? prev.bio,
        breed: activePet?.breed ?? details.breed ?? prev.breed,
        birthDate: activePet?.birthDate ?? details.birthDate ?? prev.birthDate,
        color: activePet?.color ?? details.color ?? prev.color,
        microchip: activePet?.microchip ?? details.microchip ?? prev.microchip,
        allergies: activePet?.allergies ?? details.allergies ?? prev.allergies,
      };

      // Prefer active pet photos (explicit profile selection), then favorites, then profile details
      // This avoids storing large URIs in AsyncStorage (prevents QuotaExceededError)
      // Photos are stored as memories, so we can get them from there
      const favoriteMemories = getFavoriteMemories(4); // Get up to 4 favorite memories for avatar/cover
      const photosFromMemories: string[] = favoriteMemories.map(m => m.src).filter(Boolean);
      
      // Fallback: Try to get photos from user.profileDetails if memories aren't available yet
      // But don't rely on this since URIs aren't stored anymore to prevent quota errors
      const photosFromProfile: string[] | undefined = details.photos || 
        (Array.isArray(details.photoDetails) ? details.photoDetails.map((p: any) => p?.uri).filter(Boolean) : undefined);
      const safeProfilePhotos =
        Platform.OS === "web" && photosFromProfile ? photosFromProfile.filter(isRemoteUrl) : photosFromProfile;
      
      // Prefer photos from memories, fallback to profile if memories aren't loaded yet
      const photos =
        safePetPhotos.length > 0
          ? safePetPhotos
          : (photosFromMemories.length > 0 ? photosFromMemories : (safeProfilePhotos || []));
      
      if (photos?.length) {
        const newAvatarUrl = photos[0] || updated.avatarUrl;
        const newCoverUrl = photos[1] || photos[0] || updated.coverUrl;
        
        // Only update if photos actually changed to prevent unnecessary re-renders
        if (newAvatarUrl !== updated.avatarUrl || newCoverUrl !== updated.coverUrl) {
          updated.avatarUrl = newAvatarUrl;
          updated.coverUrl = newCoverUrl;
          console.log('ProfileContext: Updated photos from sources', { 
            avatarUrl: newAvatarUrl?.substring(0, 50) + '...',
            coverUrl: newCoverUrl?.substring(0, 50) + '...',
            photosCount: photos.length,
            fromMemories: photosFromMemories.length > 0,
            fromPet: petPhotos.length > 0
          });
        }
      }

      if (JSON.stringify(updated) === JSON.stringify(prev)) {
        return prev;
      }

      console.log('ProfileContext: Syncing profile from user', { 
        petName: updated.petName,
        hasPhotos: !!photos?.length,
        avatarUrl: updated.avatarUrl?.substring(0, 50) + '...'
      });

      return updated;
    });
  }, [
    user,
    user?.profileDetails,
    user?.profileDetails?.photoDetails,
    user?.profileDetails?.photos,
    memories,
    getFavoriteMemories,
    getActivePet,
    isRemoteUrl
  ]);

  const updateProfile = useCallback(
    async (updates: Partial<ProfileData>) => {
      const updatedProfile = { ...profile, ...updates };
      setProfile(updatedProfile);
      try {
        if (user?.id) {
          await upsertUserProfile(user.id, {
            ownerName: updatedProfile.ownerName,
            ownerPhone: updatedProfile.ownerPhone,
            ownerEmail: updatedProfile.ownerEmail || user.email,
            ownerLegalFirstName: updatedProfile.ownerLegalFirstName,
            ownerLegalLastName: updatedProfile.ownerLegalLastName,
            ownerPreferredFirstName: updatedProfile.ownerPreferredFirstName,
            ownerResidentialAddress: updatedProfile.ownerResidentialAddress,
            ownerMailingAddress: updatedProfile.ownerMailingAddress,
            ownerEmergencyContact: updatedProfile.ownerEmergencyContact,
          });
        }

        const activePet = getActivePet();
        if (activePet?.id) {
          await updatePet(activePet.id, {
            name: updatedProfile.petName,
          bio: updatedProfile.bio,
          breed: updatedProfile.breed,
          birthDate: updatedProfile.birthDate,
          color: updatedProfile.color,
          microchip: updatedProfile.microchip,
          allergies: updatedProfile.allergies,
          });
        }
      } catch (error) {
        console.error("Failed to save profile:", error);
      }
    },
    [profile, user?.id, user?.email, getActivePet, updatePet]
  );

  const value = {
    profile,
    updateProfile,
    loadProfile,
  };

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return context;
}
