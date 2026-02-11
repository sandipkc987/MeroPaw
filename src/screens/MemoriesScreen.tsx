import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, Modal, Alert, Dimensions, StatusBar } from "react-native";
import { SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import ScreenHeader from "@src/components/ScreenHeader";
import { Button, Input } from "@src/components/UI";
import ActionSheet, { ActionSheetOption } from "@src/components/ActionSheet";
import EmptyState from "@src/components/EmptyState";
import MediaPicker from "@src/components/MediaPicker";
import MemoryDetailsModal from "@src/components/MemoryDetailsModal";
import { useMemories, MemoryItem, MemoryType } from "@src/contexts/MemoriesContext";
import { usePets } from "@src/contexts/PetContext";
import { Ionicons } from "@expo/vector-icons";

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

// Uniform Grid Component (like iPhone/Samsung galleries)
const UniformGrid = ({ 
  items, 
  columns = 3, 
  gap = 6, 
  onPressItem 
}: { 
  items: MemoryItem[]; 
  columns?: number; 
  gap?: number; 
  onPressItem?: (index: number) => void; 
}) => {
  const { colors } = useTheme();
  const screenWidth = Dimensions.get('window').width;
  const horizontalPadding = SPACING.lg * 2; // Padding from parent container
  const availableWidth = screenWidth - horizontalPadding;
  const itemWidth = (availableWidth - (gap * (columns - 1))) / columns;
  
  return (
    <View style={{ 
      flexDirection: "row", 
      flexWrap: "wrap", 
      marginHorizontal: -gap/2 
    }}>
      {items.map((m, index) => {
        const isVideo = m.type === "video";
        const isFavorite = m.isFavorite;
        
        return (
          <TouchableOpacity 
            key={m.id} 
            onPress={() => onPressItem && onPressItem(index)} 
            activeOpacity={0.85}
            style={{
              width: itemWidth,
              paddingHorizontal: gap/2,
              paddingBottom: gap,
            }}
          >
            <View style={{ 
              position: "relative", 
              borderRadius: RADIUS.lg, 
              overflow: "hidden", 
              backgroundColor: colors.bgSecondary,
              aspectRatio: 1,
              ...SHADOWS.sm
            }}>
              <Image 
                source={{ uri: m.src }} 
                style={{ width: "100%", height: "100%" }} 
                resizeMode="cover" 
              />
              {isVideo && (
                <View style={{ 
                  position: "absolute", 
                  right: 8, 
                  top: 8, 
                  width: 26, 
                  height: 26, 
                  borderRadius: 13, 
                  backgroundColor: "rgba(0,0,0,0.45)", 
                  alignItems: "center", 
                  justifyContent: "center" 
                }}>
                  <Ionicons name="play" size={14} color="#fff" />
                </View>
              )}
              {isFavorite && (
                <View style={{ 
                  position: "absolute", 
                  right: 8, 
                  top: 8, 
                  width: 26, 
                  height: 26, 
                  borderRadius: 13, 
                  backgroundColor: "rgba(255, 59, 48, 0.9)", 
                  alignItems: "center", 
                  justifyContent: "center" 
                }}>
                  <Ionicons name="heart" size={14} color="#fff" />
                </View>
              )}
              {!!m.title && (
                <View style={{ 
                  position: "absolute", 
                  left: 8, 
                  bottom: 8, 
                  backgroundColor: "rgba(0,0,0,0.35)", 
                  paddingHorizontal: 8, 
                  paddingVertical: 4, 
                  borderRadius: RADIUS.sm 
                }}>
                  <Text style={{ color: "#fff", ...TYPOGRAPHY.sm }}>{m.title}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
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
      <View style={{ flex: 1, backgroundColor: "#000", justifyContent: "center" }}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        {/* Header with Close and Actions */}
        <View style={{ 
          position: "absolute", 
          top: 0,
          left: 0, 
          right: 0, 
          flexDirection: "row", 
          justifyContent: "space-between", 
          paddingHorizontal: 20,
          paddingTop: 40,
          paddingBottom: SPACING.sm,
          backgroundColor: "rgba(0,0,0,0.35)",
          zIndex: 10
        }}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {/* Favorite Button */}
            <TouchableOpacity 
              onPress={() => onToggleFavorite(item.id)}
              style={{ marginRight: SPACING.md }}
            >
              <Ionicons 
                name={item.isFavorite ? "heart" : "heart-outline"} 
                size={24} 
                color={item.isFavorite ? "#FF3B30" : "#fff"} 
              />
            </TouchableOpacity>
            
            {/* More Options (Edit/Archive/Delete) */}
            <TouchableOpacity onPress={() => onOpenActions(item)}>
              <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {!!item && (
          <View style={{ flex: 1, justifyContent: "center" }}>
            <Image 
              source={{ uri: item.src }} 
              style={{ width: "100%", height: "100%" }} 
              resizeMode="contain" 
            />
          </View>
        )}

        {/* Navigation Arrows */}
        <View style={{ 
          position: "absolute", 
          left: 0, 
          right: 0, 
          bottom: 24, 
          flexDirection: "row", 
          justifyContent: "space-between", 
          paddingHorizontal: 20 
        }}>
          <TouchableOpacity 
            disabled={!canPrev} 
            onPress={() => { 
              if (canPrev) { 
                const ni = i - 1; 
                setI(ni); 
                onChangeIndex(ni); 
              } 
            }}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: "rgba(0,0,0,0.4)",
              alignItems: "center",
              justifyContent: "center",
              opacity: canPrev ? 1 : 0.4
            }}
          >
            <Ionicons 
              name="chevron-back" 
              size={28} 
              color="#fff"
            />
          </TouchableOpacity>
          <TouchableOpacity 
            disabled={!canNext} 
            onPress={() => { 
              if (canNext) { 
                const ni = i + 1; 
                setI(ni); 
                onChangeIndex(ni); 
              } 
            }}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: "rgba(0,0,0,0.4)",
              alignItems: "center",
              justifyContent: "center",
              opacity: canNext ? 1 : 0.4
            }}
          >
            <Ionicons 
              name="chevron-forward" 
              size={28} 
              color="#fff"
            />
          </TouchableOpacity>
        </View>
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
  const [editingMemory, setEditingMemory] = useState<MemoryItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNote, setEditNote] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [actionSheetOptions, setActionSheetOptions] = useState<ActionSheetOption[]>([]);
  const [actionSheetTitle, setActionSheetTitle] = useState<string | undefined>(undefined);

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

  const byMonth = useMemo(() => {
    const map: Record<string, MemoryItem[]> = {};
    filtered.forEach(m => { (map[m.month] ||= []).push(m); });
    
    // Sort months in descending order (most recent first)
    const sortedMonths = Object.keys(map).sort((a, b) => {
      const dateA = new Date(a);
      const dateB = new Date(b);
      return dateB.getTime() - dateA.getTime();
    });
    
    return sortedMonths.map(month => ({ month, items: map[month] }));
  }, [filtered]);

  const handleMediaSelected = (media: { uri: string; type: 'photo' | 'video'; width: number; height: number }) => {
    // Store selected media and show details modal
    setSelectedMedia(media);
    setShowDetailsModal(true);
  };

  const handleSaveMemoryDetails = ({ title, note }: { title: string; note?: string }) => {
    if (!selectedMedia) return;
    
    addMemory({
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
        titleStyle={{ ...TYPOGRAPHY.base, fontWeight: "600", letterSpacing: -0.2 }}
        paddingTop={SPACING.lg}
        paddingBottom={SPACING.lg}
      />
      
      <ScrollView 
        contentContainerStyle={{ paddingBottom: 140 }} 
        showsVerticalScrollIndicator={false} 
        bounces
      >
        <View style={{ 
          paddingHorizontal: SPACING.lg, 
          paddingTop: SPACING.lg, 
          paddingBottom: SPACING.sm 
        }}>
          <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted }}>
            Relive {petNamePossessive} best moments 🐶
          </Text>
        </View>
        
        <View style={{ paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md }}>
          <FilterSegment value={filter} onChange={setFilter} />
        </View>
        
        {byMonth.length > 0 ? (
          byMonth.map(({ month, items }) => (
            <View key={month} style={{ 
              paddingHorizontal: SPACING.lg, 
              marginBottom: SPACING.lg 
            }}>
              <Text style={{ 
                ...TYPOGRAPHY.xl, 
                fontWeight: "800", 
                color: colors.text, 
                marginBottom: SPACING.sm 
              }}>
                {month}
              </Text>
              <UniformGrid 
                items={items} 
                columns={3} 
                gap={6} 
                onPressItem={(index) => {
                  const currentItems = filtered.filter(m => m.month === month);
                  setLightbox({ visible: true, index, items: currentItems });
                }} 
              />
            </View>
          ))
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
    </View>
  );
}
