import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SPACING, TYPOGRAPHY, RADIUS } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@src/contexts/AuthContext";
import { useProfile } from "@src/contexts/ProfileContext";
import { fetchFeedComments, addFeedComment, type FeedComment } from "@src/services/feedService";
import { timeAgo } from "@src/utils/helpers";

interface CommentSheetProps {
  visible: boolean;
  onClose: () => void;
  itemType: "memory" | "status";
  itemId: string;
  onCommentAdded?: () => void;
}

function CommentRow({ item }: { item: FeedComment }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", marginBottom: SPACING.lg, paddingRight: SPACING.sm }}>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: colors.surface,
          marginRight: SPACING.sm,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="person" size={16} color={colors.textMuted} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
          <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: colors.text }}>
            {item.commenter_name || "Pet parent"}
          </Text>
          <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted }}>
            {timeAgo(new Date(item.created_at).getTime())}
          </Text>
        </View>
        <Text
          style={{
            ...TYPOGRAPHY.sm,
            color: colors.textSecondary,
            lineHeight: 20,
            marginTop: 2,
          }}
        >
          {item.comment_text}
        </Text>
      </View>
    </View>
  );
}

export default function CommentSheet({
  visible,
  onClose,
  itemType,
  itemId,
  onCommentAdded,
}: CommentSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { profile } = useProfile();
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const avatarUrl = profile?.avatarUrl;
  const canPost = !!draft.trim() && !submitting;

  useEffect(() => {
    if (!visible || !itemId) return;
    setLoading(true);
    fetchFeedComments(itemType, itemId)
      .then(setComments)
      .catch(() => setComments([]))
      .finally(() => setLoading(false));
  }, [visible, itemType, itemId]);

  const handleSubmit = async () => {
    const text = draft.trim();
    if (!text || !user?.id || submitting) return;

    setSubmitting(true);
    try {
      const newComment = await addFeedComment(user.id, itemType, itemId, text);
      setComments((prev) => [
        ...prev,
        { ...newComment, commenter_name: "You" },
      ]);
      setDraft("");
      onCommentAdded?.();
    } catch {
      // Could show toast
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: "flex-end" }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: RADIUS.xxl,
            borderTopRightRadius: RADIUS.xxl,
            maxHeight: "85%",
            paddingBottom: insets.bottom || SPACING.md,
          }}
        >
          {/* Handle bar */}
          <View
            style={{
              alignItems: "center",
              paddingTop: SPACING.sm,
              paddingBottom: SPACING.xs,
            }}
          >
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border,
              }}
            />
          </View>

          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: SPACING.lg,
              paddingVertical: SPACING.sm,
            }}
          >
            <View style={{ width: 28 }} />
            <Text
              style={{
                ...TYPOGRAPHY.base,
                fontWeight: "700",
                color: colors.text,
              }}
            >
              Comments
            </Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={16}
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: colors.surface,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="close" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={{ paddingVertical: SPACING.xxl, alignItems: "center" }}>
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(c) => c.id}
              contentContainerStyle={{
                paddingHorizontal: SPACING.lg,
                paddingBottom: SPACING.lg,
                flexGrow: 1,
              }}
              ListEmptyComponent={
                <View
                  style={{
                    paddingVertical: SPACING.xxxl,
                    alignItems: "center",
                  }}
                >
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      backgroundColor: colors.surface,
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: SPACING.md,
                    }}
                  >
                    <Ionicons name="chatbubbles-outline" size={28} color={colors.textMuted} />
                  </View>
                  <Text
                    style={{
                      ...TYPOGRAPHY.base,
                      fontWeight: "600",
                      color: colors.text,
                      marginBottom: SPACING.xs,
                    }}
                  >
                    No comments yet
                  </Text>
                  <Text
                    style={{
                      ...TYPOGRAPHY.sm,
                      color: colors.textMuted,
                      textAlign: "center",
                    }}
                  >
                    Start the conversation by adding the first comment
                  </Text>
                </View>
              }
              renderItem={({ item }) => <CommentRow item={item} />}
            />
          )}

          {/* Input area - Instagram/Facebook style */}
          {user && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-end",
                paddingHorizontal: SPACING.lg,
                paddingTop: SPACING.sm,
                paddingBottom: SPACING.xs,
                gap: SPACING.sm,
                borderTopWidth: 1,
                borderTopColor: colors.borderLight,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  overflow: "hidden",
                  backgroundColor: colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {avatarUrl ? (
                  <Image
                    source={{ uri: avatarUrl }}
                    style={{ width: 36, height: 36 }}
                    resizeMode="cover"
                  />
                ) : (
                  <Ionicons name="person" size={18} color={colors.textMuted} />
                )}
              </View>
              <View
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: colors.surface,
                  borderRadius: 20,
                  paddingLeft: SPACING.md,
                  paddingRight: SPACING.sm,
                  paddingVertical: SPACING.xs,
                  minHeight: 36,
                  maxHeight: 100,
                }}
              >
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Add a comment..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  maxLength={500}
                  editable={!submitting}
                  style={{
                    flex: 1,
                    ...TYPOGRAPHY.sm,
                    color: colors.text,
                    paddingVertical: SPACING.sm,
                    maxHeight: 84,
                  }}
                />
                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={!canPost}
                  style={{ padding: SPACING.xs }}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : (
                    <Text
                      style={{
                        ...TYPOGRAPHY.sm,
                        fontWeight: "600",
                        color: canPost ? colors.accent : colors.textMuted,
                      }}
                    >
                      Post
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
