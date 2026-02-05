import React, { useState, useMemo, useEffect, useRef } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, RefreshControl, ActivityIndicator, Modal } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { RADIUS, SPACING, TYPOGRAPHY, SHADOWS } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import { Button, Input } from "@src/components/UI";
import IconTile from "@src/components/IconTile";
import Label from "@src/components/Label";
import { navItems, sheetOptions } from "@src/data/seed";
import { filterItems, groupByDay, timeAgo, defaultTitle } from "@src/utils/helpers";
import type { FeedItem } from "@src/types";
import VoiceInput from "@src/components/VoiceInput";
import ReceiptUpload from "@src/components/ReceiptUpload";
import ReceiptViewer from "@src/components/ReceiptViewer";
import HighlightsCarousel from "@src/components/HighlightsCarousel";
import MediaPicker from "@src/components/MediaPicker";
import MemoryDetailsModal from "@src/components/MemoryDetailsModal";
import ActionSheet, { ActionSheetOption } from "@src/components/ActionSheet";
import ScreenHeader from "@src/components/ScreenHeader";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@src/contexts/NavigationContext";
import { useMemories } from "@src/contexts/MemoriesContext";
import { usePets } from "@src/contexts/PetContext";
import { useProfile } from "@src/contexts/ProfileContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@src/contexts/AuthContext";
import { fetchExpenses, fetchHealthRecords, deleteExpense, deleteHealthRecord } from "@src/services/supabaseData";
import storage from "@src/utils/storage";

interface HomeScreenProps {
  showAddModal?: boolean;
  onAddModalChange?: (show: boolean) => void;
}

export default function HomeScreen({ showAddModal = false, onAddModalChange }: HomeScreenProps = {}) {
  const { colors } = useTheme();
  const { navigateTo, triggerAddReminder, triggerAddExpense, triggerAddHealthRecord, setNavHidden } = useNavigation();
  const { memories, getFavoriteMemories, addMemory, updateMemory, deleteMemory } = useMemories();
  const { activePetId, getActivePet } = usePets();
  const { profile } = useProfile();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<FeedItem[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<{ type: string; title: string; note: string }>({ type: "med", title: "", note: "" });
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [receipt, setReceipt] = useState<{ type: 'image' | 'pdf'; url: string; name: string; uri: string } | null>(null);
  const [showReceiptViewer, setShowReceiptViewer] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<{ type: 'image' | 'pdf'; url: string; name: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expenseFeedItems, setExpenseFeedItems] = useState<FeedItem[]>([]);
  const [healthFeedItems, setHealthFeedItems] = useState<FeedItem[]>([]);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{ uri: string; type: 'photo' | 'video'; width: number; height: number } | null>(null);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteTarget, setNoteTarget] = useState<FeedItem | null>(null);
  const [editMemoryOpen, setEditMemoryOpen] = useState(false);
  const [editMemoryTarget, setEditMemoryTarget] = useState<FeedItem | null>(null);
  const [editMemoryTitle, setEditMemoryTitle] = useState("");
  const [editMemoryNote, setEditMemoryNote] = useState("");
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [actionSheetTitle, setActionSheetTitle] = useState<string | undefined>(undefined);
  const [actionSheetOptions, setActionSheetOptions] = useState<ActionSheetOption[]>([]);
  const [imageAspectRatios, setImageAspectRatios] = useState<Record<string, number>>({});
  const lastScrollYRef = useRef(0);

  // Initialize feed with signup data (welcome post)
  useEffect(() => {
    const initializeFeed = async () => {
      if (isInitialized) return;

      try {
        const signupData = await AsyncStorage.getItem('kasper_signup_data');
        if (signupData) {
          const parsed = JSON.parse(signupData);
          const { petName, bio } = parsed; // photos are no longer stored here

          if (petName) {
            // Wait for memories to be loaded into state
            // This ensures favorite memories are available for the welcome post image
            // React state updates are async, so we wait multiple times to ensure state is flushed
            await new Promise(resolve => setTimeout(resolve, 200));
            await new Promise(resolve => requestAnimationFrame(resolve));
            await new Promise(resolve => setTimeout(resolve, 300));

            // Get first favorite memory for welcome post image (if available)
            // Retry a few times if memories aren't available yet (they might still be loading)
            let favoriteMemories = getFavoriteMemories(1);
            let attempts = 0;
            while (favoriteMemories.length === 0 && memories.length === 0 && attempts < 5) {
              console.log('HomeScreen: Waiting for memories to load...', { attempts, memoriesCount: memories.length });
              await new Promise(resolve => setTimeout(resolve, 200));
              favoriteMemories = getFavoriteMemories(1);
              attempts++;
            }
            const firstFavoriteImage = favoriteMemories.length > 0 ? favoriteMemories[0].src : undefined;

            console.log('HomeScreen: Initializing welcome post', {
              petName,
              hasFavoriteImage: !!firstFavoriteImage,
              favoriteMemoriesCount: favoriteMemories.length,
              totalMemories: memories.length
            });

            // Create welcome post from signup data
            const welcomePost: FeedItem = {
              id: `welcome_${Date.now()}`,
              type: "milestone",
              title: `Welcome to Meropaw, ${petName}! 🎉`,
              note: bio || `This is the start of ${petName}'s journey with Meropaw. Track health, expenses, and create lasting memories!`,
              ts: Date.now(),
              image: firstFavoriteImage // Use first favorite memory as image
            };

            // Add welcome post at the top of feed
            setItems(prev => [welcomePost, ...prev]);
            setIsInitialized(true);

            // Remove signup data after all components have read it
            // This is the last component to read it, so we can safely remove it
            try {
              await AsyncStorage.removeItem('kasper_signup_data');
              console.log('HomeScreen: Removed kasper_signup_data after initialization');
            } catch (error) {
              console.error('HomeScreen: Failed to remove signup data:', error);
            }
          } else {
            setIsInitialized(true);
          }
        } else {
          setIsInitialized(true);
        }
      } catch (error) {
        console.error('Failed to initialize feed:', error);
        setIsInitialized(true);
      }
    };

    initializeFeed();
  }, [isInitialized, memories.length, getFavoriteMemories]);

  // Load expenses and health records into feed
  useEffect(() => {
    const loadFeedSources = async () => {
      try {
        if (!user?.id || !activePetId) {
          setExpenseFeedItems([]);
          setHealthFeedItems([]);
          return;
        }

        const [remoteExpenses, remoteHealth] = await Promise.all([
          fetchExpenses(user.id, activePetId),
          fetchHealthRecords(user.id, activePetId),
        ]);

        const mappedExpenses = remoteExpenses.map(expense => {
          const createdAt = (expense as any).createdAt;
          const ts = createdAt
            ? new Date(createdAt).getTime()
            : expense.date
              ? new Date(expense.date).getTime()
              : Date.now();
          const receiptUrl = expense.receipt?.url || expense.receipt?.uri;
          const baseNote = `$${Number(expense.amount).toFixed(2)} • ${formatCategory(expense.category)}`;
          const combinedNote = expense.notes ? `${baseNote} — ${expense.notes}` : baseNote;
          return {
            id: `expense_${expense.id}`,
            type: "expense" as const,
            title: expense.title,
            note: combinedNote,
            ts: Number.isFinite(ts) ? ts : Date.now(),
            receipt: receiptUrl
              ? {
                  type: expense.receipt?.type || "image",
                  url: receiptUrl,
                  name: expense.receipt?.name || "Receipt",
                }
              : undefined,
          } as FeedItem;
        });
        setExpenseFeedItems(mappedExpenses);

        const mappedHealth = remoteHealth.map(record => {
          const createdAt = (record as any).createdAt;
          const ts = createdAt
            ? new Date(createdAt).getTime()
            : record.date
              ? new Date(record.date).getTime()
              : Date.now();
          const type =
            record.type === "medication" ? "med" :
            record.type === "vaccination" ? "vet" :
            record.type === "checkup" ? "vet" :
            "med";
          const subtitle = record.vet
            ? `${record.vet} • ${record.date || "No date"}`
            : `${record.date || "No date"}`;
          return {
            id: `health_${record.id}`,
            type,
            title: record.title,
            note: record.notes || subtitle,
            ts: Number.isFinite(ts) ? ts : Date.now(),
          } as FeedItem;
        });
        setHealthFeedItems(mappedHealth);
      } catch (error) {
        console.error("HomeScreen: Failed to load feed sources", error);
        setExpenseFeedItems([]);
        setHealthFeedItems([]);
      }
    };

    loadFeedSources();
  }, [activePetId, user?.id]);

  // Get recent memories and convert to feed items (prioritize favorites), scoped to active pet
  const recentMemories = useMemo(() => {
    console.log('HomeScreen: Calculating recentMemories', {
      totalMemories: memories.length,
      activePetId,
      memoriesWithPetId: memories.filter(m => m.petId).length,
      allMemories: memories.map(m => ({ id: m.id, title: m.title, petId: m.petId, isFavorite: m.isFavorite, src: m.src?.substring(0, 30) + '...' }))
    });

    // IMPORTANT: Show memories that either:
    // 1. Have no petId (legacy/onboarding memories)
    // 2. Match the activePetId
    // 3. Or if no activePetId is set, show all memories
    const scoped = memories.filter(m => {
      const matches = !activePetId || !m.petId || m.petId === activePetId;
      if (!matches) {
        console.log('HomeScreen: Memory filtered out', { id: m.id, memoryPetId: m.petId, activePetId });
      }
      return matches;
    });
    console.log('HomeScreen: Scoped memories', { count: scoped.length, scoped: scoped.map(m => ({ id: m.id, title: m.title })) });

    // Get favorites first, then recent memories
    const allFavorites = getFavoriteMemories(10); // Get more to filter after
    const favorites = allFavorites.filter(m => !activePetId || !m.petId || m.petId === activePetId).slice(0, 3);
    console.log('HomeScreen: Favorite memories', {
      count: favorites.length,
      favorites: favorites.map(m => ({ id: m.id, title: m.title, petId: m.petId }))
    });

    const recent = scoped
      .filter(m => !m.isArchived && !m.isFavorite)
      .sort((a, b) => b.uploadedAt - a.uploadedAt)
      .slice(0, 5);

    // Combine favorites first, then recent
    const combined = [...favorites, ...recent].slice(0, 5);
    console.log('HomeScreen: Combined memories for feed', {
      count: combined.length,
      combined: combined.map(m => ({ id: m.id, title: m.title }))
    });

    return combined.map(memory => ({
      id: memory.id,
      type: "memory" as const,
      title: memory.title || `${memory.type === 'video' ? 'Video' : 'Photo'}`,
      note: memory.note, // Show note if provided, otherwise undefined
      ts: memory.uploadedAt,
      image: memory.src
    }));
  }, [memories, getFavoriteMemories, activePetId]);

  // Merge recent memories at the top of feed items
  const allItems = useMemo(() => {
    return [...recentMemories, ...expenseFeedItems, ...healthFeedItems, ...items]
      .sort((a, b) => b.ts - a.ts);
  }, [recentMemories, expenseFeedItems, healthFeedItems, items]);

  const activePet = getActivePet();
  const petName = activePet?.name?.trim() || "your pet";
  const petNamePossessive = petName === "your pet" ? "your pet's" : petName.endsWith("s") ? `${petName}'` : `${petName}'s`;
  const petInitial = petName && petName !== "your pet" ? petName[0].toUpperCase() : "P";

  // Handle external modal trigger - now handled by App.tsx

  // Get category info based on type
  const getCategoryInfo = (type: string) => {
    switch (type) {
      case "med":
        return { iconName: "medkit-outline", color: "#ef4444", category: "Health" };
      case "vet":
        return { iconName: "medical-outline", color: "#3b82f6", category: "Health" };
      case "milestone":
        return { iconName: "trophy-outline", color: "#f59e0b", category: "Memories" };
      case "memory":
        return { iconName: "images-outline", color: "#ec4899", category: "Memories" };
      case "expense":
        return { iconName: "card-outline", color: "#8b5cf6", category: "Expenses" };
      default:
        return { iconName: "document-text-outline", color: "#6b7280", category: "General" };
    }
  };

  const formatCategory = (value?: string) => {
    if (!value) return "Other";
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  const formatReceiptName = (name?: string) => {
    if (!name) return "Receipt";
    if (name.length <= 28) return name;
    return `${name.slice(0, 24)}…`;
  };

  const isSameDay = (a: number, b: number) => {
    const da = new Date(a);
    const db = new Date(b);
    return da.getFullYear() === db.getFullYear()
      && da.getMonth() === db.getMonth()
      && da.getDate() === db.getDate();
  };

  const weekCounts = useMemo(() => {
    const now = Date.now();
    const weekStart = now - 7 * 24 * 60 * 60 * 1000;
    const memoriesWeek = recentMemories.filter((m) => m.ts >= weekStart).length;
    const expensesWeek = expenseFeedItems.filter((e) => e.ts >= weekStart).length;
    const healthWeek = healthFeedItems.filter((h) => h.ts >= weekStart).length;
    return { memoriesWeek, expensesWeek, healthWeek };
  }, [recentMemories, expenseFeedItems, healthFeedItems]);

  const handleMediaSelected = (media: { uri: string; type: 'photo' | 'video'; width: number; height: number }) => {
    setSelectedMedia(media);
    setShowMediaPicker(false);
    setShowDetailsModal(true);
  };

  const handleSaveMemoryDetails = ({ title, note }: { title: string; note?: string }) => {
    if (!selectedMedia) return;
    addMemory({
      type: selectedMedia.type,
      src: selectedMedia.uri,
      w: selectedMedia.width,
      h: selectedMedia.height,
      title: title || (selectedMedia.type === "video" ? "New Video" : "New Photo"),
      note,
      petId: activePetId || undefined,
    });
    setShowDetailsModal(false);
    setSelectedMedia(null);
  };

  const openNotesModal = (item: FeedItem) => {
    setNoteTarget(item);
    setNoteDraft(item.note || "");
    setNoteModalOpen(true);
  };

  const closeNotesModal = () => {
    setNoteModalOpen(false);
    setNoteDraft("");
    setNoteTarget(null);
  };

  const saveNotes = async () => {
    if (!noteTarget) return;
    const updatedNote = noteDraft.trim();

    if (noteTarget.type === "expense") {
      const expenseId = noteTarget.id.replace("expense_", "");
      try {
        const storageKey = getExpensesStorageKey();
        const stored = await AsyncStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            const updated = parsed.map((expense: any) => (
              expense.id === expenseId ? { ...expense, notes: updatedNote } : expense
            ));
            await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
            setExpenseFeedItems(prev => prev.map(item => {
              if (item.id !== noteTarget.id) return item;
              const baseNote = item.note?.split(" — ")[0] || "";
              return { ...item, note: updatedNote ? `${baseNote} — ${updatedNote}` : baseNote };
            }));
          }
        }
      } catch (error) {
        console.error("HomeScreen: Failed to save expense notes", error);
      }
      closeNotesModal();
      return;
    }

    if (noteTarget.type === "med" || noteTarget.type === "vet") {
      const recordId = noteTarget.id.replace("health_", "");
      try {
        const storageKey = getHealthStorageKey();
        const stored = await AsyncStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            const updated = parsed.map((record: any) => (
              record.id === recordId ? { ...record, notes: updatedNote } : record
            ));
            await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
            setHealthFeedItems(prev => prev.map(item => (
              item.id === noteTarget.id ? { ...item, note: updatedNote } : item
            )));
          }
        }
      } catch (error) {
        console.error("HomeScreen: Failed to save health notes", error);
      }
      closeNotesModal();
      return;
    }

    if (noteTarget.type === "memory" || noteTarget.type === "milestone") {
      updateMemory(noteTarget.id, { note: updatedNote });
      setItems(prev => prev.map(item => (
        item.id === noteTarget.id ? { ...item, note: updatedNote } : item
      )));
      closeNotesModal();
      return;
    }

    setItems(prev => prev.map(item => (
      item.id === noteTarget.id ? { ...item, note: updatedNote } : item
    )));
    closeNotesModal();
  };

  const openEditMemory = (item: FeedItem) => {
    setEditMemoryTarget(item);
    setEditMemoryTitle(item.title || "");
    setEditMemoryNote(item.note || "");
    setEditMemoryOpen(true);
  };

  const closeEditMemory = () => {
    setEditMemoryOpen(false);
    setEditMemoryTarget(null);
    setEditMemoryTitle("");
    setEditMemoryNote("");
  };

  const saveEditMemory = () => {
    if (!editMemoryTarget) return;
    updateMemory(editMemoryTarget.id, {
      title: editMemoryTitle.trim() || editMemoryTarget.title,
      note: editMemoryNote.trim() || undefined,
    });
    closeEditMemory();
  };

  const removeExpenseFromFeed = async (feedId: string) => {
    const expenseId = feedId.replace("expense_", "");
    setExpenseFeedItems(prev => prev.filter(item => item.id !== feedId));
    if (!user?.id) return;
    try {
      await deleteExpense(user.id, expenseId);
    } catch (error) {
      console.error("HomeScreen: Failed to delete expense", error);
    }
  };

  const removeHealthFromFeed = async (feedId: string) => {
    const recordId = feedId.replace("health_", "");
    setHealthFeedItems(prev => prev.filter(item => item.id !== feedId));
    if (!user?.id) return;
    try {
      await deleteHealthRecord(user.id, recordId);
    } catch (error) {
      console.error("HomeScreen: Failed to delete health record", error);
    }
  };

  const openFeedActions = (item: FeedItem) => {
    const options: ActionSheetOption[] = [];
    if (item.type === "expense") {
      options.push({
        label: "Edit",
        icon: "create-outline",
        onPress: async () => {
          await storage.setItem(
            "@kasper_notification_target",
            JSON.stringify({ type: "expense", id: item.id.replace("expense_", ""), action: "edit" })
          );
          navigateTo("Expenses");
        },
      });
      options.push({
        label: "Delete",
        icon: "trash-outline",
        onPress: () => removeExpenseFromFeed(item.id),
      });
    } else if (item.type === "med" || item.type === "vet") {
      options.push({
        label: "Edit",
        icon: "create-outline",
        onPress: async () => {
          await storage.setItem(
            "@kasper_notification_target",
            JSON.stringify({ type: "health", id: item.id.replace("health_", ""), action: "edit" })
          );
          navigateTo("Health");
        },
      });
      options.push({
        label: "Delete",
        icon: "trash-outline",
        onPress: () => removeHealthFromFeed(item.id),
      });
    } else if (item.type === "memory" || item.type === "milestone") {
      options.push({
        label: "Edit",
        icon: "create-outline",
        onPress: () => openEditMemory(item),
      });
      options.push({
        label: "Delete",
        icon: "trash-outline",
        onPress: () => {
          if (item.type === "memory") {
            deleteMemory(item.id);
          } else {
            setItems(prev => prev.filter(entry => entry.id !== item.id));
          }
        },
      });
    }

    setActionSheetTitle("Actions");
    setActionSheetOptions(options);
    setActionSheetVisible(true);
  };

  const filtered = useMemo(() => filterItems(allItems, query), [allItems, query]);
  const grouped = useMemo(() => groupByDay(filtered), [filtered]);

  const clampAspectRatio = (ratio: number) => Math.max(1.1, Math.min(ratio, 1.6));

  useEffect(() => {
    const imageUris = Array.from(new Set(filtered.map(item => item.image).filter(Boolean))) as string[];
    if (imageUris.length === 0) return;
    imageUris.forEach((uri) => {
      if (imageAspectRatios[uri]) return;
      Image.getSize(
        uri,
        (width, height) => {
          if (!width || !height) return;
          const ratio = width / height;
          setImageAspectRatios(prev => (prev[uri] ? prev : { ...prev, [uri]: ratio }));
        },
        () => {
          // Ignore failures and fall back to default ratio.
        }
      );
    });
  }, [filtered, imageAspectRatios]);

  // Pull to refresh functionality
  const onRefresh = async () => {
    setRefreshing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const handleScroll = (event: any) => {
    const y = event.nativeEvent.contentOffset?.y ?? 0;
    const delta = y - lastScrollYRef.current;
    if (y <= 0) {
      setNavHidden(false);
    } else if (delta > 12) {
      setNavHidden(true);
    } else if (delta < -12) {
      setNavHidden(false);
    }
    lastScrollYRef.current = y;
  };

  useEffect(() => {
    return () => setNavHidden(false);
  }, [setNavHidden]);

  function openNew(kind: string) {
    setForm({ type: kind, title: defaultTitle(kind), note: "" });
    setFormOpen(true);
  }

  function handleVoiceSave(data: { type: string; title: string; note: string; date?: string; time?: string }) {
    const newItem = {
      id: Date.now().toString(),
      type: data.type as any,
      title: data.title,
      note: data.note,
      ts: Date.now()
    };
    setItems(prev => [newItem, ...prev]);
    setVoiceOpen(false);
  }

  function handleQuickAction(screen: string) {
    navigateTo(screen);
  }

  // Show specific screen if selected
  const renderQuickScreen = (screen: any, setShow: (show: boolean) => void, title: string) => (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header with arrow and title */}
      <View style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 64,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: SPACING.lg,
        zIndex: 10,
        backgroundColor: colors.card,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderLight
      }}>
        <TouchableOpacity
          onPress={() => {
            setShow(false);
          }}
          style={{
            alignItems: "center",
            justifyContent: "center",
            width: 40,
            height: 40,
            backgroundColor: colors.surface,
            borderRadius: 20,
            marginRight: SPACING.md
          }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={{
            ...TYPOGRAPHY.xl,
            fontWeight: "700",
            color: colors.text
          }}>
            {title}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>
      <View style={{ flex: 1, marginTop: 64 }}>
        {screen}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: 120, // Add bottom padding to account for fixed nav
          backgroundColor: colors.bg
        }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={true}
        bounces={true}
        alwaysBounceVertical={false}
        nestedScrollEnabled={true}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        {/* Header */}
        <View
          style={{
            backgroundColor: colors.bg,
            paddingBottom: SPACING.lg,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderLight,
          }}
        >
          <View
            style={{
              paddingHorizontal: SPACING.lg,
              paddingBottom: SPACING.md,
            }}
          >
            <ScreenHeader
              title={petName === "your pet" ? "Home" : petName}
              showBackButton={false}
              avatarUri={activePet?.photos?.[0] || profile.avatarUrl}
              avatarFallback={petInitial}
              onAvatarPress={() => navigateTo("Profile")}
              actionIcon={query ? "close" : "search"}
              onActionPress={() => setQuery(query === "" ? "search" : "")}
            />

            {/* Search Input - appears when search is active */}
            {query ? (
              <View style={{
                marginTop: SPACING.md,
                marginBottom: SPACING.sm
              }}>
                <Input
                  placeholder="Search activities..."
                  value={query === "search" ? "" : query}
                  onChangeText={(text) => setQuery(text === "" ? "" : text)}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: RADIUS.lg,
                    borderWidth: 0
                  }}
                />
              </View>
            ) : null}

            {/* Quick actions - optimized spacing and alignment */}
            <ScrollView
              horizontal
              bounces
              decelerationRate="fast"
              snapToAlignment="start"
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: SPACING.sm, // Further reduced padding
                paddingRight: SPACING.lg // Extra padding on right to prevent cutoff
              }}
              style={{
                marginTop: SPACING.xs,
                marginBottom: SPACING.sm
              }}
            >
              {navItems.map((i, idx) => (
                <IconTile
                  key={i.label}
                  icon={i.label}
                  label={i.label}
                  onPress={() => handleQuickAction(i.screen)}
                  active={false}
                  style={{
                    marginRight: idx !== navItems.length - 1 ? SPACING.sm : SPACING.md,
                    minWidth: 85, // Slightly reduced for better fit
                    height: 40 // Slightly increased for better touch target
                  }}
                />
              ))}
            </ScrollView>

            {/* Highlights Section */}
            <HighlightsCarousel
              onItemPress={(item) => {
                console.log('Highlight pressed:', item);
              }}
            />

            {/* Weekly Summary */}
            <View style={{
              marginTop: SPACING.lg,
              padding: SPACING.md,
              backgroundColor: colors.cardSecondary,
              borderRadius: RADIUS.lg,
              borderWidth: 1,
              borderColor: colors.border,
              ...SHADOWS.xs
            }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ ...TYPOGRAPHY.base, fontWeight: "700", color: colors.text }}>
                  This week
                </Text>
                <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted }}>
                  Last 7 days
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.md }}>
                {[
                  { label: "Memories", value: weekCounts.memoriesWeek, icon: "images-outline" },
                  { label: "Expenses", value: weekCounts.expensesWeek, icon: "card-outline" },
                  { label: "Health", value: weekCounts.healthWeek, icon: "medkit-outline" },
                ].map((item) => (
                  <View key={item.label} style={{
                    flex: 1,
                    paddingVertical: SPACING.sm,
                    paddingHorizontal: SPACING.sm,
                    borderRadius: RADIUS.md,
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: "center"
                  }}>
                    <Ionicons name={item.icon as any} size={16} color={colors.accent} />
                    <Text style={{ ...TYPOGRAPHY.base, fontWeight: "700", color: colors.text, marginTop: 4 }}>
                      {item.value}
                    </Text>
                    <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: 2 }}>
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Quick Actions */}
            <View style={{ marginTop: SPACING.lg }}>
              <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginBottom: SPACING.sm }}>
                Quick actions
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: SPACING.sm }}
              >
                <TouchableOpacity
                  onPress={() => setShowMediaPicker(true)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: SPACING.sm,
                    paddingHorizontal: SPACING.md,
                    borderRadius: RADIUS.pill,
                    backgroundColor: colors.cardSecondary,
                    borderWidth: 1,
                    borderColor: colors.border,
                    ...SHADOWS.xs
                  }}
                >
                  <Ionicons name="camera-outline" size={16} color={colors.accent} />
                  <Text style={{ ...TYPOGRAPHY.sm, color: colors.text, marginLeft: SPACING.xs }}>Upload photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    navigateTo("Expenses");
                    triggerAddExpense();
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: SPACING.sm,
                    paddingHorizontal: SPACING.md,
                    borderRadius: RADIUS.pill,
                    backgroundColor: colors.cardSecondary,
                    borderWidth: 1,
                    borderColor: colors.border,
                    ...SHADOWS.xs
                  }}
                >
                  <Ionicons name="card-outline" size={16} color={colors.accent} />
                  <Text style={{ ...TYPOGRAPHY.sm, color: colors.text, marginLeft: SPACING.xs }}>Add expense</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    navigateTo("Health");
                    triggerAddHealthRecord();
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: SPACING.sm,
                    paddingHorizontal: SPACING.md,
                    borderRadius: RADIUS.pill,
                    backgroundColor: colors.cardSecondary,
                    borderWidth: 1,
                    borderColor: colors.border,
                    ...SHADOWS.xs
                  }}
                >
                  <Ionicons name="medkit-outline" size={16} color={colors.accent} />
                  <Text style={{ ...TYPOGRAPHY.sm, color: colors.text, marginLeft: SPACING.xs }}>Add health</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    navigateTo("Reminders");
                    triggerAddReminder();
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: SPACING.sm,
                    paddingHorizontal: SPACING.md,
                    borderRadius: RADIUS.pill,
                    backgroundColor: colors.cardSecondary,
                    borderWidth: 1,
                    borderColor: colors.border,
                    ...SHADOWS.xs
                  }}
                >
                  <Ionicons name="notifications-outline" size={16} color={colors.accent} />
                  <Text style={{ ...TYPOGRAPHY.sm, color: colors.text, marginLeft: SPACING.xs }}>Add reminder</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </View>

        {/* Feed */}
        <View style={{
          backgroundColor: colors.bg,
          paddingTop: SPACING.lg,
        }}>
          <View style={{
            paddingHorizontal: SPACING.lg,
            marginBottom: SPACING.md,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between"
          }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="time-outline" size={18} color={colors.textMuted} style={{ marginRight: SPACING.xs }} />
              <Text style={{ ...TYPOGRAPHY.base, fontWeight: "700", color: colors.text }}>
                Recent activity
              </Text>
            </View>
            <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted }}>
              {petNamePossessive}
            </Text>
          </View>
          {Object.values(grouped).flat().length === 0 ? (
            <View style={{
              alignItems: "center",
              paddingHorizontal: SPACING.lg,
              paddingVertical: SPACING.xxxl,
              marginHorizontal: SPACING.lg,
              backgroundColor: colors.card,
              borderRadius: RADIUS.lg,
              borderWidth: 1,
              borderColor: colors.borderLight,
              ...SHADOWS.sm
            }}>
              <Text style={{
                ...TYPOGRAPHY.lg,
                fontWeight: "600",
                color: colors.text,
                textAlign: "center",
                marginBottom: SPACING.sm
              }}>
                {query ? "No results found" : "Nothing here yet"}
              </Text>
              <Text style={{
                ...TYPOGRAPHY.base,
                color: colors.textMuted,
                textAlign: "center",
                lineHeight: 22,
                marginBottom: SPACING.lg
              }}>
                {query
                  ? "Try a different search term"
                  : `All of ${petNamePossessive} photos and activities will appear here once you start uploading memories and entries.`}
              </Text>
            </View>
          ) : (
            <View>
              {Object.values(grouped).flat().map((it: any) => {
                const categoryInfo = getCategoryInfo(it.type);

                return (
                  <View
                    key={it.id}
                    style={{
                      marginHorizontal: SPACING.lg,
                      marginBottom: SPACING.md,
                      paddingHorizontal: SPACING.lg,
                      paddingVertical: SPACING.lg,
                      backgroundColor: colors.card,
                      borderRadius: RADIUS.lg,
                      borderWidth: 1,
                      borderColor: colors.borderLight,
                      ...SHADOWS.sm
                    }}
                  >
                    {/* Feed header */}
                    <View style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: SPACING.md
                    }}>
                      <View style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: categoryInfo.color + "20",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: SPACING.sm
                      }}>
                        <Ionicons name={categoryInfo.iconName as any} size={18} color={categoryInfo.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "column", gap: 2 }}>
                          <Text style={{
                            fontWeight: "600",
                            color: colors.text,
                            ...TYPOGRAPHY.sm,
                          }}>
                            {categoryInfo.category === "Health" ? "Health record" : categoryInfo.category === "Expenses" ? "Expense" : "Memory"}
                          </Text>
                          <Text style={{
                            color: colors.textMuted,
                            ...TYPOGRAPHY.xs,
                          }}>
                            {(activePet?.name || "your pet")} <Text>{'•'}</Text> {timeAgo(it.ts)}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => openFeedActions(it)}
                        style={{ paddingLeft: SPACING.sm }}
                      >
                        <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>

                    {/* Content */}
                    <Text style={{
                      fontWeight: "500",
                      color: colors.text,
                      ...TYPOGRAPHY.base,
                      marginBottom: SPACING.sm,
                      lineHeight: 22
                    }}>
                      {it.title}
                    </Text>
                    {it.note ? (
                      <Text style={{
                        color: colors.textSecondary,
                        ...TYPOGRAPHY.sm,
                        lineHeight: 20,
                        marginBottom: it.image ? SPACING.sm : 0
                      }}>
                        {it.note}
                      </Text>
                    ) : null}

                    {/* Full-width image */}
                    {it.image ? (
                      <View style={{
                        marginHorizontal: -SPACING.lg, // Extend to full width
                        marginBottom: SPACING.sm,
                        borderRadius: RADIUS.md,
                        overflow: "hidden",
                        backgroundColor: colors.bgSecondary,
                      }}>
                        <Image
                          source={{ uri: it.image }}
                          style={{
                            width: '100%',
                            aspectRatio: clampAspectRatio(imageAspectRatios[it.image] || 1.2),
                            backgroundColor: colors.bgSecondary,
                          }}
                          resizeMode="cover"
                        />
                      </View>
                    ) : null}

                    {/* Receipt Display */}
                    {it.receipt && it.receipt.url ? (
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedReceipt(it.receipt);
                          setShowReceiptViewer(true);
                        }}
                        style={{
                          width: "100%",
                          marginBottom: SPACING.sm,
                          backgroundColor: colors.surface,
                          borderRadius: RADIUS.md,
                          borderWidth: 1,
                          borderColor: colors.borderLight,
                          overflow: "hidden",
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                          <View style={{ width: 64, height: 64, backgroundColor: colors.bgSecondary }}>
                            {it.receipt.type === "image" ? (
                              <Image
                                source={{ uri: it.receipt.url }}
                                style={{ width: "100%", height: "100%" }}
                                resizeMode="cover"
                              />
                            ) : (
                              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                                <Ionicons name="document-text-outline" size={24} color={colors.textMuted} />
                              </View>
                            )}
                          </View>
                          <View style={{ flex: 1, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm }}>
                            <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted }}>Receipt</Text>
                            <Text style={{ ...TYPOGRAPHY.base, color: colors.text, fontWeight: "600" }}>
                              {formatReceiptName(it.receipt.name)}
                            </Text>
                            <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: 2 }}>
                              Tap to view
                            </Text>
                          </View>
                          <View style={{ paddingRight: SPACING.md }}>
                            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                          </View>
                        </View>
                      </TouchableOpacity>
                    ) : null}

                    {/* Type chip */}
                    <View style={{ flexDirection: "row", marginTop: SPACING.sm }}>
                      <View style={{
                        paddingHorizontal: SPACING.sm,
                        paddingVertical: 4,
                        borderRadius: RADIUS.pill,
                        backgroundColor: categoryInfo.color + "15",
                        borderWidth: 1,
                        borderColor: categoryInfo.color + "30"
                      }}>
                        <Text style={{ ...TYPOGRAPHY.xs, color: categoryInfo.color, fontWeight: "600" }}>
                          {categoryInfo.category}
                        </Text>
                      </View>
                    </View>

                    {/* Notes action */}
                    <View style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginTop: SPACING.md,
                      paddingTop: SPACING.md,
                      borderTopWidth: 1,
                      borderTopColor: colors.borderLight
                    }}>
                      <TouchableOpacity
                        onPress={() => {
                          if (it.type === "expense") {
                            navigateTo("Expenses");
                            return;
                          }
                          if (it.type === "med" || it.type === "vet") {
                            navigateTo("Health");
                            return;
                          }
                          openNotesModal(it);
                        }}
                        style={{
                          flexDirection: "row",
                          alignItems: "center"
                        }}
                      >
                        <Ionicons name={it.type === "expense" || it.type === "med" || it.type === "vet" ? "open-outline" : "create-outline"} size={16} color={colors.textMuted} />
                        <Text style={{
                          color: colors.textMuted,
                          ...TYPOGRAPHY.sm,
                          marginLeft: SPACING.xs
                        }}>
                          {it.type === "expense" ? "View Expense" : it.type === "med" || it.type === "vet" ? "View Health" : "Add Notes"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>


      {/* Quick Add sheet + Form - now handled by App.tsx AddModal */}
      {false && (
        <View style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: colors.black + "80",
          justifyContent: "flex-end",
          zIndex: 1000
        }}>
          <View style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: RADIUS.xl,
            borderTopRightRadius: RADIUS.xl,
            paddingHorizontal: SPACING.lg,
            paddingTop: SPACING.lg,
            paddingBottom: SPACING.xl,
            maxHeight: "80%"
          }}>
            <Text style={{
              ...TYPOGRAPHY.xl,
              fontWeight: "700",
              color: colors.text,
              marginBottom: SPACING.lg,
              textAlign: "center"
            }}>
              Quick Add
            </Text>

            <View style={{ gap: SPACING.md, marginBottom: SPACING.xl }}>
              {/* Voice Input Option */}
              <TouchableOpacity
                onPress={() => {
                  setVoiceOpen(true);
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: SPACING.md,
                  backgroundColor: colors.accentLight,
                  borderRadius: RADIUS.lg,
                  borderWidth: 1,
                  borderColor: colors.accent
                }}
              >
                <Text style={{ fontSize: 24, marginRight: SPACING.md, color: colors.text }}>🎤</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{
                    ...TYPOGRAPHY.base,
                    fontWeight: "600",
                    color: colors.text
                  }}>
                    Voice Input
                  </Text>
                  <Text style={{
                    ...TYPOGRAPHY.sm,
                    color: colors.textMuted,
                    marginTop: 2
                  }}>
                    Speak to add entries quickly
                  </Text>
                </View>
              </TouchableOpacity>

              {sheetOptions.map(opt => (
                <TouchableOpacity
                  key={opt.kind}
                  onPress={() => openNew(opt.kind)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: SPACING.md,
                    backgroundColor: colors.surface,
                    borderRadius: RADIUS.lg,
                    borderWidth: 1,
                    borderColor: colors.borderLight
                  }}
                >
                  <Text style={{ fontSize: 24, marginRight: SPACING.md, color: colors.text }}>{opt.emoji}</Text>
                  <Text style={{
                    ...TYPOGRAPHY.base,
                    fontWeight: "600",
                    color: colors.text
                  }}>
                    {opt.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Button
              title="Cancel"
              onPress={() => {
                // Cancel functionality now handled by App.tsx AddModal
              }}
            />
          </View>
        </View>
      )}

      {/* Form Modal */}
      {formOpen && (
        <View style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: colors.black + "80",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1001,
          paddingHorizontal: SPACING.lg
        }}>
          <View style={{
            backgroundColor: colors.card,
            borderRadius: RADIUS.xl,
            paddingHorizontal: SPACING.lg,
            paddingTop: SPACING.lg,
            paddingBottom: SPACING.xl,
            width: "100%",
            maxWidth: 400
          }}>
            <Text style={{
              ...TYPOGRAPHY.xl,
              fontWeight: "700",
              color: colors.text,
              marginBottom: SPACING.lg,
              textAlign: "center"
            }}>
              Add Entry
            </Text>

            <View style={{ gap: SPACING.md, marginBottom: SPACING.xl }}>
              <Label label="Title">
                <Input
                  value={form.title}
                  onChangeText={(v) => setForm(p => ({ ...p, title: v }))}
                  placeholder="e.g., Meal • 1 cup kibble"
                />
              </Label>

              <Label label="Notes (optional)">
                <Input
                  value={form.note}
                  onChangeText={(v) => setForm(p => ({ ...p, note: v }))}
                  placeholder="Optional notes"
                  multiline
                  style={{ marginBottom: SPACING.sm }}
                />
              </Label>

              {/* Receipt Upload - Only show for expense type */}
              {form.type === "expense" && (
                <ReceiptUpload
                  onReceiptSelect={setReceipt}
                  currentReceipt={receipt || undefined}
                />
              )}
            </View>

            <View style={{ gap: SPACING.md }}>
              <Button
                title="Save Entry"
                onPress={() => {
                  const newItem = {
                    id: Date.now().toString(),
                    type: form.type as any,
                    title: form.title,
                    note: form.note,
                    ts: Date.now(),
                    ...(receipt && { receipt })
                  };
                  setItems(prev => [newItem, ...prev]);
                  setFormOpen(false);
                  setForm({ type: "med", title: "", note: "" });
                  setReceipt(null); // Reset receipt
                }}
              />
              <Button
                title="Cancel"
                onPress={() => {
                  setFormOpen(false);
                  setForm({ type: "meal", title: "", note: "" });
                }}
              />
            </View>
          </View>
        </View>
      )}

      {/* Voice Input Modal */}
      <VoiceInput
        visible={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        onSave={handleVoiceSave}
      />

      {/* Receipt Viewer Modal */}
      {selectedReceipt && (
        <ReceiptViewer
          visible={showReceiptViewer}
          onClose={() => {
            setShowReceiptViewer(false);
            setSelectedReceipt(null);
          }}
          receipt={selectedReceipt}
        />
      )}

      <MediaPicker
        visible={showMediaPicker}
        onClose={() => setShowMediaPicker(false)}
        onMediaSelected={handleMediaSelected}
      />

      {selectedMedia && (
        <MemoryDetailsModal
          visible={showDetailsModal}
          mediaUri={selectedMedia.uri}
          mediaType={selectedMedia.type}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedMedia(null);
          }}
          onSave={handleSaveMemoryDetails}
        />
      )}

      <Modal visible={editMemoryOpen} transparent animationType="fade">
        <View style={{
          flex: 1,
          backgroundColor: colors.black + "80",
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: SPACING.lg
        }}>
          <View style={{
            width: "100%",
            maxWidth: 420,
            backgroundColor: colors.card,
            borderRadius: RADIUS.xl,
            padding: SPACING.lg
          }}>
            <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "700", color: colors.text, marginBottom: SPACING.md }}>
              Edit memory
            </Text>
            <Input
              value={editMemoryTitle}
              onChangeText={setEditMemoryTitle}
              placeholder="Title"
              style={{ marginBottom: SPACING.md }}
            />
            <Input
              value={editMemoryNote}
              onChangeText={setEditMemoryNote}
              placeholder="Notes"
              multiline
              numberOfLines={4}
              style={{ minHeight: 110, textAlignVertical: "top", marginBottom: SPACING.md }}
            />
            <View style={{ flexDirection: "row", gap: SPACING.sm }}>
              <Button
                title="Cancel"
                onPress={closeEditMemory}
                style={{ flex: 1, backgroundColor: colors.bgSecondary }}
                titleStyle={{ color: colors.text }}
              />
              <Button
                title="Save"
                onPress={saveEditMemory}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      <ActionSheet
        visible={actionSheetVisible}
        title={actionSheetTitle}
        options={actionSheetOptions}
        onClose={() => setActionSheetVisible(false)}
      />

      <Modal visible={noteModalOpen} transparent animationType="fade">
        <View style={{
          flex: 1,
          backgroundColor: colors.black + "80",
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: SPACING.lg
        }}>
          <View style={{
            width: "100%",
            maxWidth: 420,
            backgroundColor: colors.card,
            borderRadius: RADIUS.xl,
            padding: SPACING.lg
          }}>
            <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "700", color: colors.text, marginBottom: SPACING.md }}>
              {noteTarget?.type === "memory" || noteTarget?.type === "milestone" ? "Add Notes" : "Update Notes"}
            </Text>
            <Input
              value={noteDraft}
              onChangeText={setNoteDraft}
              placeholder="Add a note..."
              multiline
              numberOfLines={4}
              style={{ minHeight: 110, textAlignVertical: "top", marginBottom: SPACING.md }}
            />
            <View style={{ flexDirection: "row", gap: SPACING.sm }}>
              <Button
                title="Cancel"
                onPress={closeNotesModal}
                style={{ flex: 1, backgroundColor: colors.bgSecondary }}
                titleStyle={{ color: colors.text }}
              />
              <Button
                title="Save"
                onPress={saveNotes}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
