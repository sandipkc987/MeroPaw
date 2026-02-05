import React, { createContext, useContext, useState, useEffect } from "react";
import { Platform } from "react-native";
import storage from "@src/utils/storage";
import { useAuth } from "@src/contexts/AuthContext";
import { getSupabaseClient } from "@src/services/supabaseClient";

export interface Pet {
  id: string;
  name: string;
  bio?: string;
  breed?: string;
  age?: string;
  birthDate?: string;
  color?: string;
  microchip?: string;
  allergies?: string;
  photos: string[];
  createdAt: number;
}

interface PetContextType {
  pets: Pet[];
  activePetId: string | null;
  addPet: (pet: Omit<Pet, 'id' | 'createdAt'>) => Promise<string>;
  updatePet: (id: string, updates: Partial<Pet>) => Promise<void>;
  deletePet: (id: string) => Promise<void>;
  setActivePet: (id: string) => Promise<void>;
  getActivePet: () => Pet | null;
}

const PetContext = createContext<PetContextType | undefined>(undefined);

const PETS_STORAGE_KEY = "@kasper_pets";
const ACTIVE_PET_KEY = "@kasper_active_pet";

const isUuid = (value: string | null | undefined) =>
  !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const normalizePhotos = (photos: string[] = []) => {
  return photos.filter(uri => uri && uri.trim() !== "").slice(0, 10);
};

const sanitizePhotosForStorage = (photos: string[] = []) => {
  const normalized = normalizePhotos(photos);
  const withoutDataUris = normalized.filter(uri => !uri.startsWith("data:"));
  if (Platform.OS === "web") {
    return withoutDataUris;
  }
  return withoutDataUris;
};

export function PetProvider({ children }: { children: React.ReactNode }) {
  const [pets, setPets] = useState<Pet[]>([]);
  const [activePetId, setActivePetId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  const persistPets = async (nextPets: Pet[]) => {
    const petsForStorage = nextPets.map(pet => ({
      ...pet,
      photos: sanitizePhotosForStorage(pet.photos),
    }));
    try {
      await storage.setItem(PETS_STORAGE_KEY, JSON.stringify(petsForStorage));
      return;
    } catch (error) {
      console.warn("PetContext: Failed to persist pets with photos, retrying without photos", error);
    }

    try {
      const petsWithoutPhotos = nextPets.map(pet => ({ ...pet, photos: [] }));
      await storage.setItem(PETS_STORAGE_KEY, JSON.stringify(petsWithoutPhotos));
    } catch (error) {
      console.warn("PetContext: Failed to persist pets without photos", error);
    }
  };

  // Load pets and active pet from storage or Supabase
  useEffect(() => {
    const loadPets = async () => {
      try {
        if (user?.id) {
          const supabase = getSupabaseClient();
          const { data, error } = await supabase
            .from("pets")
            .select("*")
            .eq("owner_id", user.id)
            .order("created_at", { ascending: true });

          if (error) {
            console.error("PetContext: Failed to load pets from Supabase", error.message);
          }
          if (data && data.length > 0) {
            const remotePets: Pet[] = data.map((row: any) => ({
              id: row.id,
              name: row.name,
              bio: row.bio || undefined,
              breed: row.breed || undefined,
              age: row.age || undefined,
              birthDate: row.birth_date || undefined,
              color: row.color || undefined,
              microchip: row.microchip || undefined,
              allergies: row.allergies || undefined,
              photos: Array.isArray(row.photos) ? row.photos : [],
              createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
            }));
            setPets(remotePets);
            const active = remotePets[0].id;
            setActivePetId(active);
            await storage.setItem(ACTIVE_PET_KEY, JSON.stringify(active));
            await persistPets(remotePets);
          } else {
            setPets([]);
            setActivePetId(null);
            await storage.removeItem(ACTIVE_PET_KEY);
            await storage.removeItem(PETS_STORAGE_KEY);
          }
            return;
        }

        const [storedPets, storedActivePet] = await Promise.all([
          storage.getItem(PETS_STORAGE_KEY),
          storage.getItem(ACTIVE_PET_KEY),
        ]);

        if (storedPets) {
          const parsedPets = JSON.parse(storedPets);
          setPets(parsedPets);

          if (storedActivePet) {
            const activeId = JSON.parse(storedActivePet);
            if (parsedPets.find((p: Pet) => p.id === activeId)) {
              setActivePetId(activeId);
            } else if (parsedPets.length > 0) {
              setActivePetId(parsedPets[0].id);
            }
          } else if (parsedPets.length > 0) {
            setActivePetId(parsedPets[0].id);
            await storage.setItem(ACTIVE_PET_KEY, JSON.stringify(parsedPets[0].id));
          }
        } else {
          setPets([]);
          setActivePetId(null);
        }
      } catch (error) {
        console.error("Failed to load pets:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPets();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.profileDetails) return;
    if (user?.id) return;
    if (pets.length > 0) return;
    if (isLoading) return;

    const details = user.profileDetails;
    const signupPhotos: string[] = Array.isArray(details.photos)
      ? details.photos
      : details.photoDetails?.map((p: any) => p.uri).filter(Boolean) || [];
    const defaultPet: Pet = {
      id: `pet_${Date.now()}`,
      name: user.petName || "Your pet",
      bio: details.bio,
      breed: details.breed,
      photos: normalizePhotos(signupPhotos),
      createdAt: Date.now(),
    };
    setPets([defaultPet]);
    setActivePetId(defaultPet.id);
    persistPets([defaultPet]).catch(err =>
      console.error("PetContext: failed to seed pets", err)
    );
    storage.setItem(ACTIVE_PET_KEY, JSON.stringify(defaultPet.id)).catch(err =>
      console.error("PetContext: failed to store active pet", err)
    );
  }, [user, pets.length, isLoading]);

  const addPet = async (petData: Omit<Pet, 'id' | 'createdAt'>): Promise<string> => {
    const newPet: Pet = {
      ...petData,
      photos: normalizePhotos(petData.photos),
      id: `pet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
    };

    let finalPet = newPet;
    if (user?.id) {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("pets")
        .insert({
          owner_id: user.id,
          name: newPet.name,
          bio: newPet.bio || null,
          breed: newPet.breed || null,
          age: newPet.age || null,
          birth_date: newPet.birthDate || null,
          color: newPet.color || null,
          microchip: newPet.microchip || null,
          allergies: newPet.allergies || null,
          photos: sanitizePhotosForStorage(newPet.photos),
        })
        .select()
        .single();

      if (error) {
        console.error("PetContext: Failed to add pet in Supabase", error.message);
      } else if (data) {
        finalPet = {
          ...newPet,
          id: data.id,
          createdAt: data.created_at ? new Date(data.created_at).getTime() : newPet.createdAt,
        };
      }
    }

    const updatedPets = [...pets, finalPet];
    setPets(updatedPets);
    await persistPets(updatedPets);
    
    // Set as active pet if it's the first one
    if (pets.length === 0) {
      await setActivePet(finalPet.id);
    }

    return finalPet.id;
  };

  const updatePet = async (id: string, updates: Partial<Pet>) => {
    const updatedPets = pets.map(pet => {
      if (pet.id !== id) return pet;
      const nextPhotos = updates.photos ? normalizePhotos(updates.photos) : pet.photos;
      return { ...pet, ...updates, photos: nextPhotos };
    });
    setPets(updatedPets);
    await persistPets(updatedPets);

    if (user?.id) {
      const supabase = getSupabaseClient();
      const payload: any = {
        name: updates.name,
        bio: updates.bio,
        breed: updates.breed,
        age: updates.age,
        birth_date: updates.birthDate,
        color: updates.color,
        microchip: updates.microchip,
        allergies: updates.allergies,
        photos: updates.photos ? sanitizePhotosForStorage(updates.photos) : undefined,
      };
      Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
      const { error } = await supabase.from("pets").update(payload).eq("id", id).eq("owner_id", user.id);
      if (error) {
        console.error("PetContext: Failed to update pet in Supabase", error.message);
      }
    }
  };

  const deletePet = async (id: string) => {
    const updatedPets = pets.filter(pet => pet.id !== id);
    setPets(updatedPets);
    await persistPets(updatedPets);

    if (user?.id) {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("pets").delete().eq("id", id).eq("owner_id", user.id);
      if (error) {
        console.error("PetContext: Failed to delete pet in Supabase", error.message);
      }
    }
    
    // If deleted pet was active, set first pet as active
    if (activePetId === id && updatedPets.length > 0) {
      await setActivePet(updatedPets[0].id);
    } else if (updatedPets.length === 0) {
      setActivePetId(null);
      await storage.removeItem(ACTIVE_PET_KEY);
    }
  };

  const setActivePet = async (id: string) => {
    if (user?.id && !isUuid(id)) {
      console.warn("PetContext: Ignoring non-UUID active pet id for authed user", id);
      return;
    }
    setActivePetId(id);
    try {
      await storage.setItem(ACTIVE_PET_KEY, JSON.stringify(id));
    } catch (error) {
      console.warn("PetContext: Failed to persist active pet", error);
    }
  };

  const getActivePet = (): Pet | null => {
    return pets.find(pet => pet.id === activePetId) || null;
  };

  return (
    <PetContext.Provider
      value={{
        pets,
        activePetId,
        addPet,
        updatePet,
        deletePet,
        setActivePet,
        getActivePet,
      }}
    >
      {children}
    </PetContext.Provider>
  );
}

export function usePets() {
  const context = useContext(PetContext);
  if (context === undefined) {
    throw new Error("usePets must be used within a PetProvider");
  }
  return context;
}



