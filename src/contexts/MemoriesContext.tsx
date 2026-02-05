import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Alert } from "react-native";
import storage from "@src/utils/storage";
import { useAuth } from './AuthContext';
import { usePets } from "@src/contexts/PetContext";
import { getSupabaseClient } from "@src/services/supabaseClient";
import { getMemoryPublicUrl, uploadToBucket, insertNotification } from "@src/services/supabaseData";

export type MemoryType = "photo" | "video";

export interface MemoryItem {
  id: string;
  type: MemoryType;
  month: string;
  src: string;
  w: number;
  h: number;
  title?: string;
  note?: string; // Optional note/description
  petId?: string; // Optional owning pet
  isFavorite: boolean;
  isArchived: boolean;
  uploadedAt: number; // Timestamp for sorting
}

interface HighlightCard {
  id: string;
  uri: string;
  title: string;
  subtitle?: string;
  badge?: string;
  isNew?: boolean;
}

interface MemoriesContextType {
  memories: MemoryItem[];
  onboardingHighlights: string[];
  addMemory: (
    memory: Omit<MemoryItem, 'id' | 'isFavorite' | 'isArchived' | 'uploadedAt' | 'month'>,
    options?: { isFavorite?: boolean; isOnboarding?: boolean }
  ) => Promise<void>;
  updateMemory: (id: string, updates: Partial<Pick<MemoryItem, "title" | "note">>) => void;
  toggleFavorite: (id: string) => void;
  deleteMemory: (id: string) => void;
  archiveMemory: (id: string) => void;
  getRecentMemories: (limit?: number) => MemoryItem[];
  getFavoriteMemories: (limit?: number) => MemoryItem[];
  getIntelligentHighlights: () => HighlightCard[];
}

const MemoriesContext = createContext<MemoriesContextType | undefined>(undefined);

const defaultMemories: MemoryItem[] = [];

export function MemoriesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activePetId } = usePets();
  const [memories, setMemories] = useState<MemoryItem[]>(defaultMemories);
  const [isInitialized, setIsInitialized] = useState(false);
  const [onboardingHighlights, setOnboardingHighlights] = useState<string[]>([]);
  const [seenFlashbacks, setSeenFlashbacks] = useState<Record<string, number>>({});
  const isAddingOnboardingMemoriesRef = useRef(false);
  const getHighlightsStorageKey = () =>
    activePetId ? `@kasper_onboarding_highlights_${activePetId}` : '@kasper_onboarding_highlights';
  const SEEN_FLASHBACKS_KEY = '@kasper_seen_flashbacks';
  const seededUsersRef = useRef<Set<string>>(new Set());
  const hasHydratedRef = useRef(false);

  useEffect(() => {
    const loadMemories = async () => {
      try {
        const [highlights, seen] = await Promise.all([
          storage.getItem(getHighlightsStorageKey()),
          storage.getItem(SEEN_FLASHBACKS_KEY),
        ]);

        if (highlights) {
          try {
            const parsedHighlights: string[] = JSON.parse(highlights);
            setOnboardingHighlights(parsedHighlights);
          } catch {
            setOnboardingHighlights([]);
          }
        }

        if (seen) {
          try {
            const parsedSeen = JSON.parse(seen);
            setSeenFlashbacks(parsedSeen);
          } catch {
            setSeenFlashbacks({});
          }
        }

        if (!user?.id) {
          setMemories(defaultMemories);
          return;
        }
        if (!activePetId) {
          setMemories(defaultMemories);
          setIsInitialized(true);
          return;
        }

        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from("memories")
          .select("*")
          .eq("owner_id", user.id)
          .eq("pet_id", activePetId)
          .order("uploaded_at", { ascending: false });
        if (error) throw error;

        const mapped = (data || []).map((row: any) => {
          const uploadedAt = row.uploaded_at ? new Date(row.uploaded_at).getTime() : Date.now();
          return {
            id: row.id,
            type: row.media_type || row.type,
            month: new Date(uploadedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
            src: getMemoryPublicUrl(row.storage_path) || row.storage_path,
            w: row.width || 1000,
            h: row.height || 1000,
            title: row.title || undefined,
            note: row.note || undefined,
            petId: row.pet_id || undefined,
            isFavorite: !!row.is_favorite,
            isArchived: !!row.is_archived,
            uploadedAt,
          } as MemoryItem;
        });

        setMemories(prev => {
          const pending = prev.filter(m => m.id.startsWith("temp_"));
          return pending.length ? [...pending, ...mapped] : mapped;
        });
        hasHydratedRef.current = true;
      } catch (error) {
        console.error('MemoriesProvider: Failed to load memories from Supabase', error);
        setMemories(defaultMemories);
      } finally {
        setIsInitialized(true);
      }
    };
    loadMemories();
  }, [activePetId, user?.id]);

  const addMemory = useCallback(async (
    memory: Omit<MemoryItem, 'id' | 'isFavorite' | 'isArchived' | 'uploadedAt' | 'month'>,
    options: { isFavorite?: boolean; isOnboarding?: boolean } = {}
  ) => {
    if (!hasHydratedRef.current) {
      hasHydratedRef.current = true;
    }
    console.log('MemoriesProvider.addMemory: called', { memory, options, isInitialized });
    const { isFavorite = false, isOnboarding = false } = options;
    
    // Set flag to prevent seeding effect from running during onboarding
    if (isOnboarding) {
      isAddingOnboardingMemoriesRef.current = true;
      // Clear flag after a delay to allow state updates to flush
      setTimeout(() => {
        isAddingOnboardingMemoriesRef.current = false;
        console.log('MemoriesProvider.addMemory: Cleared isAddingOnboardingMemories flag');
      }, 1500);
    }
    
    const now = Date.now();
    const month = new Date(now).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const resolvedPetId = memory.petId || activePetId || undefined;
    const tempId = `temp_${now}_${Math.random().toString(36).substr(2, 9)}`;
    const newMemory: MemoryItem = {
      ...memory,
      petId: resolvedPetId,
      id: tempId,
      month,
      isFavorite,
      isArchived: false,
      uploadedAt: now,
    };

    setMemories(prev => {
      // Check if memory already exists (by src URI) to avoid duplicates
      const exists = prev.some(m => m.src === newMemory.src);
      if (exists) {
        console.log('MemoriesProvider.addMemory: Memory already exists, skipping', { src: newMemory.src });
        return prev;
      }
      const updated = [newMemory, ...prev];
      console.log('MemoriesProvider.addMemory: updating state', { 
        newCount: updated.length, 
        memoryId: newMemory.id,
        src: newMemory.src?.substring(0, 50) + '...',
        isFavorite: newMemory.isFavorite,
        isOnboarding
      });
      return updated;
    });

    if (isOnboarding && newMemory.src) {
      setOnboardingHighlights(prev => {
        if (prev.includes(newMemory.src)) {
          console.log('MemoriesProvider.addMemory: Highlight already exists, skipping', { src: newMemory.src });
          return prev;
        }
        const updated = [...prev, newMemory.src].slice(0, 4);
        console.log('MemoriesProvider.addMemory: updating onboarding highlights', { newCount: updated.length, src: newMemory.src });
        // Persist immediately
        storage.setItem(getHighlightsStorageKey(), JSON.stringify(updated)).catch(err =>
          console.error('MemoriesProvider: failed to persist highlights', err)
        );
        return updated;
      });
    }

    if (!user?.id || !memory.src) return;
    try {
      const supabase = getSupabaseClient();
      const fileExt = memory.type === "video" ? "mp4" : "jpg";
      const safePetId = resolvedPetId || "general";
      const filePath = `${user.id}/${safePetId}/${now}-${Math.random().toString(36).slice(2)}.${fileExt}`;
      const { path, url } = await uploadToBucket("memories", memory.src, filePath);

      const { data, error } = await supabase
        .from("memories")
        .insert({
          owner_id: user.id,
          pet_id: resolvedPetId || null,
          media_type: memory.type,
          type: memory.type, // legacy column used by existing schema
          storage_path: path,
          title: memory.title || null,
          note: memory.note || null,
          width: memory.w || null,
          height: memory.h || null,
          is_favorite: isFavorite,
          is_archived: false,
          uploaded_at: new Date(now).toISOString(),
        })
        .select()
        .single();

      if (error || !data) throw error;

      setMemories(prev =>
        prev.map(m =>
          m.id === tempId
            ? {
                ...m,
                id: data.id,
                src: url,
                uploadedAt: data.uploaded_at ? new Date(data.uploaded_at).getTime() : now,
              }
            : m
        )
      );

      if (!isOnboarding) {
        const typeLabel = memory.type === "video" ? "Video" : "Photo";
        insertNotification(user.id, {
          petId: resolvedPetId,
          kind: "memories",
          title: `${typeLabel} uploaded`,
          message: memory.title ? memory.title : `Your ${typeLabel.toLowerCase()} is ready to view.`,
          ctaLabel: "View memory",
          thumbUrl: url,
          metadata: { type: "memory_uploaded", memoryId: data.id },
        }).catch(error => {
          console.error("MemoriesProvider.addMemory: Failed to create notification", error);
        });
      }
    } catch (error) {
      console.error("MemoriesProvider.addMemory: Supabase insert failed", error);
      setMemories(prev => prev.filter(m => m.id !== tempId));
      if (!isOnboarding) {
        const message =
          error instanceof Error ? error.message : "Upload failed. Please check your connection and try again.";
        Alert.alert("Upload failed", message);
      }
    }
  }, [activePetId, isInitialized, user?.id]);

  // Reset seeded users when user changes to allow re-seeding for new signups
  useEffect(() => {
    if (!user) {
      seededUsersRef.current.clear();
      return;
    }
  }, [user?.id, user?.email]);

  useEffect(() => {
    if (!isInitialized || !user) return;
    const userId = user.id || user.email || 'anonymous';
    
    // CRITICAL: Skip seeding if memories are currently being added during onboarding
    // This prevents race condition where seeding tries to add same photos
    if (isAddingOnboardingMemoriesRef.current) {
      console.log('MemoriesProvider: Skipping seed - onboarding memories are being added', { userId });
      return;
    }
    
    const profileDetails: any = (user as any)?.profileDetails || {};
    const photoUris: string[] = [];

    if (Array.isArray(profileDetails.photoDetails)) {
      profileDetails.photoDetails.forEach((photo: any) => {
        if (photo?.uri) photoUris.push(photo.uri);
      });
    }

    if (Array.isArray(profileDetails.photos)) {
      profileDetails.photos.forEach((uri: string) => {
        if (uri) photoUris.push(uri);
      });
    }

    if (!photoUris.length) {
      // If user was already seeded but no photos found, allow re-seeding when photos appear
      if (seededUsersRef.current.has(userId) && profileDetails.photoDetails) {
        console.log('MemoriesProvider: Clearing seeded flag to allow re-seeding when photos appear');
        seededUsersRef.current.delete(userId);
      }
      return;
    }

    const existingUris = new Set(memories.map(m => m.src));
    const missing = photoUris.filter(uri => uri && !existingUris.has(uri));

    // If no missing photos, check if we should mark as seeded
    // Only mark as seeded if we actually have memories for all photos
    if (!missing.length) {
      const hasAllPhotos = photoUris.every(uri => existingUris.has(uri));
      if (hasAllPhotos && !seededUsersRef.current.has(userId)) {
        console.log('MemoriesProvider: All photos already exist in memories, marking user as seeded');
        seededUsersRef.current.add(userId);
      }
      return;
    }

    // Only seed if user hasn't been seeded yet for this set of photos
    if (seededUsersRef.current.has(userId)) {
      console.log('MemoriesProvider: User already seeded, skipping', { userId, missingCount: missing.length });
      return;
    }

    const petName = user.petName || profileDetails.petName;
    console.log('MemoriesProvider: Seeding missing onboarding photos from profile', { 
      userId, 
      missingCount: missing.length,
      photoUris: photoUris.length,
      existingMemories: memories.length
    });
    
    missing.forEach((uri, index) => {
      console.log('MemoriesProvider: Adding missing onboarding photo', { uri, index });
      addMemory({
        type: "photo",
        src: uri,
        w: 1000,
        h: 1000,
        petId: profileDetails.petId,
        title: profileDetails.photoDetails?.[photoUris.indexOf(uri)]?.title || 
               (petName ? `${petName} Photo ${index + 1}` : `Onboarding Photo ${index + 1}`),
        note: profileDetails.photoDetails?.[photoUris.indexOf(uri)]?.caption || 
              profileDetails.bio || undefined,
      }, { isFavorite: true, isOnboarding: true });
    });
    
    // Mark as seeded after adding (with delay to ensure state updates)
    setTimeout(() => {
      seededUsersRef.current.add(userId);
      console.log('MemoriesProvider: User marked as seeded', { userId });
    }, 100);
  }, [isInitialized, user, memories, addMemory, isAddingOnboardingMemoriesRef]);

  const scopedMemories = useMemo(
    () => (activePetId ? memories.filter(m => m.petId === activePetId) : memories),
    [memories, activePetId]
  );

  const getOnThisDayMemory = useCallback(() => {
    const now = new Date();
    const targetDay = now.getDate();
    const targetMonth = now.getMonth();
    const targetYear = now.getFullYear() - 1;

    return scopedMemories.find(memory => {
      const date = new Date(memory.uploadedAt);
      return (
        date.getDate() === targetDay &&
        date.getMonth() === targetMonth &&
        date.getFullYear() === targetYear &&
        !memory.isArchived
      );
    }) || null;
  }, [scopedMemories]);

  const toggleFavorite = useCallback((id: string) => {
    if (!hasHydratedRef.current) {
      hasHydratedRef.current = true;
    }
    const target = memories.find(m => m.id === id);
    const nextFavorite = target ? !target.isFavorite : false;
    setMemories(prev =>
      prev.map(m => (m.id === id ? { ...m, isFavorite: !m.isFavorite } : m))
    );
    if (!user?.id || id.startsWith("temp_") || !target) return;
    const supabase = getSupabaseClient();
    supabase
      .from("memories")
      .update({ is_favorite: nextFavorite })
      .eq("id", id)
      .eq("owner_id", user.id)
      .then(({ error }) => error && console.error("MemoriesProvider.toggleFavorite: Supabase update failed", error));
  }, [memories, user?.id]);

  const updateMemory = useCallback((id: string, updates: Partial<Pick<MemoryItem, "title" | "note">>) => {
    if (!hasHydratedRef.current) {
      hasHydratedRef.current = true;
    }
    setMemories(prev =>
      prev.map(m => (m.id === id ? { ...m, ...updates } : m))
    );
    if (!user?.id || id.startsWith("temp_")) return;
    const supabase = getSupabaseClient();
    const payload: any = {
      title: updates.title,
      note: updates.note,
    };
    Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);
    supabase
      .from("memories")
      .update(payload)
      .eq("id", id)
      .eq("owner_id", user.id)
      .then(({ error }) => error && console.error("MemoriesProvider.updateMemory: Supabase update failed", error));
  }, [user?.id]);

  const deleteMemory = useCallback((id: string) => {
    if (!hasHydratedRef.current) {
      hasHydratedRef.current = true;
    }
    setMemories(prev => prev.filter(m => m.id !== id));
    if (!user?.id || id.startsWith("temp_")) return;
    const supabase = getSupabaseClient();
    supabase
      .from("memories")
      .delete()
      .eq("id", id)
      .eq("owner_id", user.id)
      .then(({ error }) => error && console.error("MemoriesProvider.deleteMemory: Supabase delete failed", error));
  }, [user?.id]);

  const archiveMemory = useCallback((id: string) => {
    if (!hasHydratedRef.current) {
      hasHydratedRef.current = true;
    }
    setMemories(prev =>
      prev.map(m => (m.id === id ? { ...m, isArchived: true } : m))
    );
    if (!user?.id || id.startsWith("temp_")) return;
    const supabase = getSupabaseClient();
    supabase
      .from("memories")
      .update({ is_archived: true })
      .eq("id", id)
      .eq("owner_id", user.id)
      .then(({ error }) => error && console.error("MemoriesProvider.archiveMemory: Supabase update failed", error));
  }, [user?.id]);

  const getRecentMemories = useCallback((limit: number = 5) => {
    return scopedMemories
      .filter(m => !m.isArchived)
      .sort((a, b) => {
        // Prioritize favorites first, then by recency
        if (a.isFavorite && !b.isFavorite) return -1;
        if (b.isFavorite && !a.isFavorite) return 1;
        return b.uploadedAt - a.uploadedAt;
      })
      .slice(0, limit);
  }, [scopedMemories]);
  
  // Get favorite memories for highlights
  const getFavoriteMemories = useCallback((limit: number = 6) => {
    return scopedMemories
      .filter(m => !m.isArchived && m.isFavorite)
      .sort((a, b) => b.uploadedAt - a.uploadedAt)
      .slice(0, limit);
  }, [scopedMemories]);

  const [intelligentHighlights, setIntelligentHighlights] = useState<HighlightCard[]>([]);

  useEffect(() => {
    if (!isInitialized) {
      console.log('MemoriesProvider: Highlights calculation skipped - not initialized yet');
      return;
    }

    console.log('MemoriesProvider: Recalculating highlights', { 
      memoriesCount: scopedMemories.length, 
      onboardingHighlightsCount: onboardingHighlights.length,
      activePetId
    });

    const MAX_HIGHLIGHTS = 4;
    const usedUris = new Set<string>();
    const results: HighlightCard[] = [];
    let seenUpdated: Record<string, number> | null = null;

    const pushHighlight = (payload: HighlightCard | null | undefined) => {
      if (!payload?.uri || usedUris.has(payload.uri) || results.length >= MAX_HIGHLIGHTS) return;
      usedUris.add(payload.uri);
      results.push(payload);
    };

    onboardingHighlights.forEach((uri, index) => {
      const belongsToActivePet = scopedMemories.some(memory => memory.src === uri);
      if (!activePetId || belongsToActivePet) {
        pushHighlight({
          id: `onboarding_${index}`,
          uri,
          title: "Welcome highlight",
          subtitle: "Pinned memory",
          badge: "Onboarding",
        });
      }
    });

    const onThisDay = results.length < MAX_HIGHLIGHTS ? getOnThisDayMemory() : null;
    if (onThisDay) {
      pushHighlight({
        id: `onthisday_${onThisDay.id}`,
        uri: onThisDay.src,
        title: onThisDay.title || "This day last year",
        subtitle: new Date(onThisDay.uploadedAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }),
        badge: "On This Day",
      });
    }

    const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    if (results.length < MAX_HIGHLIGHTS) {
      const eligibleFlashbacks = scopedMemories.filter(memory => {
        if (memory.isArchived) return false;
        if (memory.uploadedAt >= sixtyDaysAgo) return false;
        const lastSeen = seenFlashbacks[memory.id];
        if (lastSeen && lastSeen > sevenDaysAgo) return false;
        return !usedUris.has(memory.src);
      });

      if (eligibleFlashbacks.length > 0) {
        const todaySeed = new Date().toDateString().split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const flashback = eligibleFlashbacks[todaySeed % eligibleFlashbacks.length];

        pushHighlight({
          id: `flashback_${flashback.id}`,
          uri: flashback.src,
          title: flashback.title || "Flashback favorite",
          subtitle: new Date(flashback.uploadedAt).toLocaleDateString(undefined, { month: "long", year: "numeric" }),
          badge: "New memory!",
          isNew: true,
        });

        seenUpdated = { ...seenFlashbacks, [flashback.id]: Date.now() };
      }
    }

    if (results.length < MAX_HIGHLIGHTS) {
      const fallback = scopedMemories
        .filter(m => m.isFavorite && !m.isArchived && !usedUris.has(m.src))
        .sort((a, b) => b.uploadedAt - a.uploadedAt)[0];
      if (fallback) {
        pushHighlight({
          id: `favorite_${fallback.id}`,
          uri: fallback.src,
          title: fallback.title || "Favorite moment",
          subtitle: new Date(fallback.uploadedAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }),
        });
      }
    }

    const remaining = scopedMemories
      .filter(m => !m.isArchived && !usedUris.has(m.src))
      .sort((a, b) => b.uploadedAt - a.uploadedAt);

    for (const memory of remaining) {
      if (results.length >= MAX_HIGHLIGHTS) break;
      pushHighlight({
        id: `recent_${memory.id}`,
        uri: memory.src,
        title: memory.title || "Recent memory",
        subtitle: new Date(memory.uploadedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      });
    }

    const finalHighlights = results.slice(0, MAX_HIGHLIGHTS);
    console.log('MemoriesProvider: Highlights calculated', { 
      count: finalHighlights.length,
      highlights: finalHighlights.map(h => ({ id: h.id, title: h.title, uri: h.uri?.substring(0, 50) + '...' }))
    });
    setIntelligentHighlights(finalHighlights);

    if (seenUpdated) {
      setSeenFlashbacks(seenUpdated);
      storage.setItem(SEEN_FLASHBACKS_KEY, JSON.stringify(seenUpdated)).catch(err =>
        console.error('MemoriesProvider: failed to persist seen flashbacks', err)
      );
    }
  }, [scopedMemories, onboardingHighlights, seenFlashbacks, getOnThisDayMemory, isInitialized, activePetId]);

  const getIntelligentHighlights = useCallback(() => intelligentHighlights, [intelligentHighlights]);

  const value = {
    memories,
    onboardingHighlights,
    addMemory,
    updateMemory,
    toggleFavorite,
    deleteMemory,
    archiveMemory,
    getRecentMemories,
    getFavoriteMemories,
    getIntelligentHighlights,
  };

  return (
    <MemoriesContext.Provider value={value}>
      {children}
    </MemoriesContext.Provider>
  );
}

export function useMemories() {
  const context = useContext(MemoriesContext);
  if (context === undefined) {
    throw new Error('useMemories must be used within a MemoriesProvider');
  }
  return context;
}

