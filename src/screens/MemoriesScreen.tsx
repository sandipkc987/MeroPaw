import React, { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, Modal, Alert, Dimensions, StatusBar, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import ScreenHeader from "@src/components/ScreenHeader";
import { Button, Input } from "@src/components/UI";
import ActionSheet, { ActionSheetOption } from "@src/components/ActionSheet";
import EmptyState from "@src/components/EmptyState";
import MediaPicker from "@src/components/MediaPicker";
import MemoryDetailsModal from "@src/components/MemoryDetailsModal";
import PinchZoomableImage from "@src/components/PinchZoomableImage";
import { useMemories, MemoryItem, MemoryType } from "@src/contexts/MemoriesContext";
import { usePets } from "@src/contexts/PetContext";
import { Ionicons } from "@expo/vector-icons";
import { compressImage } from "@src/utils/imageCompression";

// Filter Segment Component
const FilterSegment = ({ 
  value, 
  onChange 
}: { 
  value: MemoryType | "all" | "favorite"; 
  onChange: (v: MemoryType | "all" | "favorite") => void; 
}) => {
  const { colors } = useTheme();
  const tabs: (MemoryType | "all" | "favorite")[] = ["all", "photo", "video", "favorite"];
  const labels: Record<string, string> = { 
    all: "All", 
    photo: "Photos", 
    video: "Videos", 
    favorite: "Favorites" 
  };
  
  return (
    <View style={{ 
      flexDirection: "row", 
      backgroundColor: colors.bgSecondary, 
      borderRadius: 999, 
      padding: 4 
    }}>
      {tabs.map(t => {
        const active = value === t;
        return (
          <TouchableOpacity 
            key={t} 
            onPress={() => onChange(t)} 
            style={{ 
              paddingVertical: 8, 
              paddingHorizontal: 14, 
              borderRadius: 999, 
              backgroundColor: active ? colors.card : "transparent", 
              marginRight: 4 
            }}
          >
            <Text style={{ 
              ...TYPOGRAPHY.base, 
              color: active ? colors.accent : colors.text,
              fontWeight: active ? "600" : "500"
            }}>
              {labels[t]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

type ThemeColors = ReturnType<typeof useTheme>["colors"];

function MemoryGridThumb({
  uri,
  itemWidth,
  gap,
  isLastInRow,
  colors,
  onPress,
  isVideo,
  isFavorite,
}: {
  uri: string;
  itemWidth: number;
  gap: number;
  isLastInRow: boolean;
  colors: ThemeColors;
  onPress: () => void;
  isVideo: boolean;
  isFavorite: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const missingUri = !uri?.trim();
  useEffect(() => {
    setFailed(missingUri);
  }, [uri, missingUri]);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={{
        width: itemWidth,
        height: itemWidth,
        marginRight: isLastInRow ? 0 : gap,
        marginBottom: gap,
        borderRadius: RADIUS.md,
        overflow: "hidden",
      }}
    >
      {failed || missingUri ? (
        <View
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: colors.bgSecondary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="image-outline" size={28} color={colors.textMuted} />
        </View>
      ) : (
        <Image
          source={{ uri }}
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: colors.bgSecondary,
          }}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      )}
      {isVideo && (
        <View
          style={{
            position: "absolute",
            right: 6,
            top: 6,
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: "rgba(0,0,0,0.6)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="play" size={12} color="#fff" />
        </View>
      )}
      {isFavorite && (
        <View
          style={{
            position: "absolute",
            right: 6,
            top: 6,
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: "rgba(255, 59, 48, 0.9)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="heart" size={12} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );
}

// Uniform Grid Component (like iPhone/Samsung galleries)
const UniformGrid = ({ 
  items, 
  columns = 3, 
  gap = 3, 
  onPressItem 
}: { 
  items: MemoryItem[]; 
  columns?: number; 
  gap?: number; 
  onPressItem?: (index: number) => void; 
}) => {
  const { colors } = useTheme();
  const screenWidth = Dimensions.get('window').width;
  const horizontalPadding = SPACING.lg * 2;
  const availableWidth = screenWidth - horizontalPadding;
  const itemWidth = (availableWidth - (gap * (columns - 1))) / columns;
  
  return (
    <View style={{ 
      flexDirection: "row", 
      flexWrap: "wrap",
    }}>
      {items.map((m, index) => {
        const isVideo = m.type === "video";
        const isFavorite = m.isFavorite;
        const isLastInRow = (index + 1) % columns === 0;
        
        return (
          <MemoryGridThumb
            key={m.id}
            uri={m.src}
            itemWidth={itemWidth}
            gap={gap}
            isLastInRow={isLastInRow}
            colors={colors}
            onPress={() => onPressItem && onPressItem(index)}
            isVideo={isVideo}
            isFavorite={isFavorite}
          />
        );
      })}
    </View>
  );
};

// Lightbox Modal Component with Actions (like Instagram)
const LightboxModal = ({ 
  visible, 
  items, 
  index = 0, 
  onClose, 
  onChangeIndex,
  onToggleFavorite,
  onDelete,
  onArchive,
  onEdit,
  onOpenActions
}: { 
  visible: boolean; 
  items: MemoryItem[]; 
  index?: number; 
  onClose: () => void; 
  onChangeIndex: (i: number) => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onEdit: (item: MemoryItem) => void;
  onOpenActions: (item: MemoryItem) => void;
}) => {
  const { colors } = useTheme();
  const [i, setI] = useState(index);
  React.useEffect(() => { setI(index); }, [index, visible]);
  
  if (!visible) return null;
  
  const item = items[i];
  const canPrev = i > 0;
  const canNext = i < items.length - 1;

  const handleDelete = () => {
    Alert.alert(
      "Delete Memory",
      "Are you sure you want to delete this memory? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            onDelete(item.id);
            if (items.length === 1) {
              onClose();
            } else if (i === items.length - 1) {
              onChangeIndex(i - 1);
            } else {
              onChangeIndex(i);
            }
          }
        }
      ]
    );
  };

  const handleArchive = () => {
    Alert.alert(
      "Archive Memory",
      "This memory will be moved to archive. You can restore it later.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Archive",
          onPress: () => {
            onArchive(item.id);
            if (items.length === 1) {
              onClose();
            } else if (i === items.length - 1) {
              onChangeIndex(i - 1);
            } else {
              onChangeIndex(i);
            }
          }
        }
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        
        {/* Header with Close and Actions */}
        <View style={{ 
          position: "absolute", 
          top: 0,
          left: 0, 
          right: 0, 
          flexDirection: "row", 
          justifyContent: "space-between", 
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: 50,
          paddingBottom: 12,
          zIndex: 10
        }}>
          <TouchableOpacity 
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: "rgba(255,255,255,0.15)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>
          
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TouchableOpacity 
              onPress={() => onToggleFavorite(item.id)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: item.isFavorite ? "rgba(255,59,48,0.9)" : "rgba(255,255,255,0.15)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons 
                name={item.isFavorite ? "heart" : "heart-outline"} 
                size={18} 
                color="#fff" 
              />
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => onOpenActions(item)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: "rgba(255,255,255,0.15)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Image / video (pinch-zoom for photos) */}
        {!!item && (
          <View style={{ flex: 1, justifyContent: "center" }}>
            {item.type === "photo" ? (
              <PinchZoomableImage uri={item.src} resetKey={item.id} />
            ) : (
              <Image
                source={{ uri: item.src }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="contain"
              />
            )}
          </View>
        )}

        {/* Left Arrow - Vertically Centered */}
        {canPrev && (
          <TouchableOpacity 
            onPress={() => { 
              const ni = i - 1; 
              setI(ni); 
              onChangeIndex(ni); 
            }}
            hitSlop={{ top: 20, bottom: 20, left: 10, right: 10 }}
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              marginTop: -24,
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: "rgba(255,255,255,0.12)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Right Arrow - Vertically Centered */}
        {canNext && (
          <TouchableOpacity 
            onPress={() => { 
              const ni = i + 1; 
              setI(ni); 
              onChangeIndex(ni); 
            }}
            hitSlop={{ top: 20, bottom: 20, left: 10, right: 10 }}
            style={{
              position: "absolute",
              right: 12,
              top: "50%",
              marginTop: -24,
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: "rgba(255,255,255,0.12)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="chevron-forward" size={24} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Photo Counter */}
        {items.length > 1 && (
          <View style={{
            position: "absolute",
            bottom: 40,
            left: 0,
            right: 0,
            alignItems: "center",
          }}>
            <View style={{
              backgroundColor: "rgba(0,0,0,0.5)",
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 14,
            }}>
              <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>
                {i + 1} / {items.length}
              </Text>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};

export default function MemoriesScreen() {
  const { colors } = useTheme();
  const { memories, addMemory, toggleFavorite, deleteMemory, archiveMemory, updateMemory } = useMemories();
  const { activePetId, getActivePet } = usePets();
  const activePet = getActivePet();
  const petName = activePet?.name?.trim() || "your pet";
  const petNamePossessive = petName === "your pet" ? "your pet's" : petName.endsWith("s") ? `${petName}'` : `${petName}'s`;
  const [filter, setFilter] = useState<MemoryType | "all" | "favorite">("all");
  const [lightbox, setLightbox] = useState<{
    visible: boolean; 
    index: number; 
    items: MemoryItem[]
  }>({
    visible: false, 
    index: 0, 
    items: []
  });
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{ uri: string; type: 'photo' | 'video'; width: number; height: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingMemory, setEditingMemory] = useState<MemoryItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNote, setEditNote] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [actionSheetOptions, setActionSheetOptions] = useState<ActionSheetOption[]>([]);
  const [actionSheetTitle, setActionSheetTitle] = useState<string | undefined>(undefined);

  const [headerCompact, setHeaderCompact] = useState(false);
  const headerCompactRef = useRef(false);
  const SCROLL_DOWN_THRESHOLD = 50;
  const SCROLL_UP_THRESHOLD = 35;
  const handleMemoriesScroll = useCallback((event: any) => {
    const y = event.nativeEvent?.contentOffset?.y ?? 0;
    if (y <= 0) {
      if (headerCompactRef.current) {
        headerCompactRef.current = false;
        setHeaderCompact(false);
      }
    } else {
      const nextCompact = y >= SCROLL_DOWN_THRESHOLD ? true : y <= SCROLL_UP_THRESHOLD ? false : headerCompactRef.current;
      if (nextCompact !== headerCompactRef.current) {
        headerCompactRef.current = nextCompact;
        setHeaderCompact(nextCompact);
      }
    }
  }, []);

  // Filter memories based on selected filter
  const filtered = useMemo(() => {
    // First scope by active pet (if any). Legacy memories without petId remain visible for all pets.
    let filteredMemories = memories.filter(m => !m.isArchived && (!activePetId || !m.petId || m.petId === activePetId));
    
    if (filter === "favorite") {
      filteredMemories = filteredMemories.filter(m => m.isFavorite);
    } else if (filter !== "all") {
      filteredMemories = filteredMemories.filter(m => m.type === filter);
    }
    
    return filteredMemories;
  }, [memories, filter, activePetId]);

  const sortedMemories = useMemo(() => {
    return [...filtered].sort((a, b) => b.uploadedAt - a.uploadedAt);
  }, [filtered]);

  const handleMediaSelected = async (media: { uri: string; type: 'photo' | 'video'; width: number; height: number }) => {
    // Compress image before showing details modal (videos don't need compression)
    if (media.type === 'photo') {
      setIsProcessing(true);
      try {
        const compressedUri = await compressImage(media.uri, {
          maxWidth: 1080,
          maxHeight: 1080,
          quality: 0.75,
        });
        setSelectedMedia({ ...media, uri: compressedUri });
      } catch (error) {
        console.error('MemoriesScreen: Failed to compress image', error);
        setSelectedMedia(media); // Use original if compression fails
      } finally {
        setIsProcessing(false);
      }
    } else {
      setSelectedMedia(media);
    }
    setShowDetailsModal(true);
  };

  const handleSaveMemoryDetails = async ({ title, note }: { title: string; note?: string }) => {
    if (!selectedMedia || isSaving) return;
    
    setIsSaving(true);
    try {
      await addMemory({
        type: selectedMedia.type,
        src: selectedMedia.uri,
        w: selectedMedia.width,
        h: selectedMedia.height,
        title: title,
        note: note,
        petId: activePetId || undefined,
      });
      
      setShowDetailsModal(false);
      setSelectedMedia(null);
      Alert.alert('Success', 'Memory added successfully!');
    } catch (error) {
      console.error('MemoriesScreen: Failed to save memory', error);
      Alert.alert('Error', 'Failed to save memory. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    deleteMemory(id);
    // Update lightbox if current item was deleted
    const currentItems = lightbox.items.filter(m => m.id !== id);
    if (currentItems.length === 0) {
      setLightbox({ ...lightbox, visible: false });
    } else {
      setLightbox({ ...lightbox, items: currentItems });
    }
  };

  const handleArchive = (id: string) => {
    archiveMemory(id);
    // Update lightbox if current item was archived
    const currentItems = lightbox.items.filter(m => m.id !== id);
    if (currentItems.length === 0) {
      setLightbox({ ...lightbox, visible: false });
    } else {
      setLightbox({ ...lightbox, items: currentItems });
    }
  };

  const openEditMemory = (item: MemoryItem) => {
    setEditingMemory(item);
    setEditTitle(item.title || "");
    setEditNote(item.note || "");
    setShowEditModal(true);
  };

  const closeEditMemory = () => {
    setShowEditModal(false);
    setEditingMemory(null);
    setEditTitle("");
    setEditNote("");
  };

  const saveEditMemory = () => {
    if (!editingMemory) return;
    updateMemory(editingMemory.id, {
      title: editTitle.trim() || editingMemory.title,
      note: editNote.trim() || undefined,
    });
    setLightbox(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === editingMemory.id
          ? { ...item, title: editTitle.trim() || item.title, note: editNote.trim() || undefined }
          : item
      )
    }));
    closeEditMemory();
  };

  const openMemoryActions = (item: MemoryItem) => {
    setActionSheetTitle("Memory");
    setActionSheetOptions([
      {
        label: "Edit",
        icon: "create-outline",
        onPress: () => openEditMemory(item),
      },
      {
        label: "Archive",
        icon: "archive-outline",
        onPress: () => handleArchive(item.id),
      },
      {
        label: "Delete",
        icon: "trash-outline",
        onPress: () => handleDelete(item.id),
      },
    ]);
    setActionSheetVisible(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title="Memories"
        actionIcon="paw"
        onActionPress={() => setShowMediaPicker(true)}
        centerTitle={headerCompact}
        titleStyle={headerCompact ? { ...TYPOGRAPHY.sm, fontWeight: "400" } : { ...TYPOGRAPHY.base, fontWeight: "400" }}
        paddingTop={SPACING.lg}
        paddingBottom={headerCompact ? SPACING.sm : SPACING.lg}
        insetSeparator
      />
      
      <ScrollView 
        contentContainerStyle={{ paddingBottom: 140, paddingTop: SPACING.lg }} 
        showsVerticalScrollIndicator={false} 
        bounces
        onScroll={handleMemoriesScroll}
        scrollEventThrottle={0}
      >
        <View style={{ marginHorizontal: SPACING.lg, marginBottom: SPACING.md }}>
          <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginBottom: SPACING.sm }}>
            Relive {petNamePossessive} best moments 🐶
          </Text>
          <FilterSegment value={filter} onChange={setFilter} />
        </View>

        {sortedMemories.length > 0 ? (
          <View style={{ paddingHorizontal: SPACING.lg }}>
            <UniformGrid 
              items={sortedMemories} 
              columns={3} 
              gap={3} 
              onPressItem={(index) => {
                setLightbox({ visible: true, index, items: sortedMemories });
              }} 
            />
          </View>
        ) : (
          <View style={{ paddingHorizontal: SPACING.lg, paddingTop: SPACING.xl }}>
            <EmptyState
              icon={filter === "favorite" ? "heart-outline" : "images-outline"}
              title={filter === "favorite" ? "No favorites yet" : "No memories yet"}
              subtitle="Add a photo or video to get started."
              ctaLabel="Add memory"
              onPress={() => setShowMediaPicker(true)}
            />
          </View>
        )}
      </ScrollView>
      
      {/* Floating add button intentionally removed to avoid duplication */}
      
      <LightboxModal 
        visible={lightbox.visible} 
        items={lightbox.items} 
        index={lightbox.index} 
        onClose={() => setLightbox({ ...lightbox, visible: false })} 
        onChangeIndex={(i) => setLightbox(s => ({ ...s, index: i }))}
        onToggleFavorite={toggleFavorite}
        onDelete={handleDelete}
        onArchive={handleArchive}
        onEdit={openEditMemory}
        onOpenActions={openMemoryActions}
      />

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

      <Modal visible={showEditModal} transparent animationType="fade">
        <View style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.6)",
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
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Title"
              style={{ marginBottom: SPACING.md }}
            />
            <Input
              value={editNote}
              onChangeText={setEditNote}
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

      {/* Processing Overlay */}
      <Modal visible={isProcessing || isSaving} transparent animationType="fade">
        <View style={{
          flex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          justifyContent: "center",
          alignItems: "center",
        }}>
          <View style={{
            backgroundColor: colors.card,
            borderRadius: RADIUS.xl,
            padding: SPACING.xl,
            alignItems: "center",
            ...SHADOWS.lg,
          }}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={{ ...TYPOGRAPHY.base, color: colors.text, marginTop: SPACING.md, fontWeight: "600" }}>
              {isProcessing ? "Processing photo..." : "Saving memory..."}
            </Text>
            <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginTop: SPACING.xs }}>
              Please wait
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}
