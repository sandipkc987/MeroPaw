import React, { useState, useEffect, memo } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import { useProfile } from "@src/contexts/ProfileContext";
import { useAuth } from "@src/contexts/AuthContext";
import { usePets } from "@src/contexts/PetContext";
import { Ionicons } from "@expo/vector-icons";
import { timeAgo } from "@src/utils/helpers";
import {
  fetchFeedComments,
  addFeedComment,
  type DiscoverFeedItem,
  type FeedComment,
} from "@src/services/feedService";
import ImageZoomLightbox from "@src/components/ImageZoomLightbox";

interface FeedCardProps {
  item: DiscoverFeedItem;
  onLike: (item: DiscoverFeedItem) => void;
  onCommentPress: (item: DiscoverFeedItem) => void;
  onCommentAdded: (item: DiscoverFeedItem) => void;
  isLiking?: boolean;
  isCommentsExpanded?: boolean;
}

function FeedCard({
  item,
  onLike,
  onCommentPress,
  onCommentAdded,
  isLiking = false,
  isCommentsExpanded = false,
}: FeedCardProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { getActivePet } = usePets();
  const activePet = getActivePet();
  const myAvatarUrl = activePet?.photos?.[0] || profile?.avatarUrl;
  const [avatarError, setAvatarError] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);

  useEffect(() => {
    if (!isCommentsExpanded || !item.id) return;
    setCommentsLoading(true);
    fetchFeedComments(item.type, item.id)
      .then(setComments)
      .catch(() => setComments([]))
      .finally(() => setCommentsLoading(false));
  }, [isCommentsExpanded, item.type, item.id]);

  const handleSubmitComment = async () => {
    const text = draft.trim();
    if (!text || !user?.id || submitting) return;
    setSubmitting(true);
    try {
      const newComment = await addFeedComment(user.id, item.type, item.id, text);
      setComments((prev) => [...prev, { ...newComment, commenter_name: "You" }]);
      setDraft("");
      onCommentAdded(item);
    } catch {
      /* ignore */
    } finally {
      setSubmitting(false);
    }
  };

  const ts = item.created_at ? new Date(item.created_at).getTime() : Date.now();
  const timeLabel = timeAgo(ts);

  const safeImageUrl = (url: string | null | undefined): string | null => {
    if (!url || typeof url !== "string") return null;
    if (!url.startsWith("http://") && !url.startsWith("https://")) return null;
    if (/\.\./.test(url) || /\/\./.test(url)) return null;
    if (/\/memories\/\./.test(url)) return null;
    try {
      const parsed = new URL(url);
      if (/\/\.\./.test(parsed.pathname) || /\/\.(?:\/|$)/.test(parsed.pathname)) return null;
      return url;
    } catch {
      return null;
    }
  };

  const mediaUrl = safeImageUrl(item.media_url);
  const petPhotoUrl = safeImageUrl(item.pet_photo_url);

  return (
    <>
    <View
      style={{
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.xl,
        backgroundColor: colors.card,
        borderRadius: RADIUS.xl,
        overflow: "hidden",
        ...SHADOWS.md,
      }}
    >
      {/* Header: pet avatar + name + time - top of card */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: SPACING.md,
          paddingVertical: SPACING.sm,
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
          {petPhotoUrl && !avatarError ? (
            <Image
              source={{ uri: petPhotoUrl }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
              onError={() => setAvatarError(true)}
            />
          ) : (
            <Ionicons name="paw" size={18} color={colors.textMuted} />
          )}
        </View>
        <View style={{ flex: 1, marginLeft: SPACING.sm }}>
          <Text
            style={{
              ...TYPOGRAPHY.sm,
              fontWeight: "600",
              color: colors.text,
            }}
          >
            {item.pet_name}
          </Text>
          <Text
            style={{
              ...TYPOGRAPHY.xs,
              color: colors.textMuted,
              marginTop: 1,
            }}
          >
            {item.pet_breed || item.pet_age ? [item.pet_breed, item.pet_age].filter(Boolean).join(" • ") : "Pet"}
            {" · "}
            {timeLabel}
          </Text>
        </View>
      </View>

      {/* Content: media - full width, rounded bottom on image container */}
      {item.media_type !== "text" && mediaUrl && !mediaError && (
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => {
            if (item.media_type === "photo") setZoomOpen(true);
          }}
          style={{
            backgroundColor: colors.bgSecondary,
            aspectRatio: 1,
            width: "100%",
          }}
        >
          <Image
            source={{ uri: mediaUrl }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
            onError={() => setMediaError(true)}
          />
        </TouchableOpacity>
      )}
      {item.media_type !== "text" && (mediaUrl && mediaError) && (
        <View
          style={{
            backgroundColor: colors.bgSecondary,
            aspectRatio: 1,
            width: "100%",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="image-outline" size={40} color={colors.textMuted} />
        </View>
      )}

      {/* Caption + actions - compact footer */}
      <View style={{ paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: SPACING.md }}>
        <Text
          style={{
            ...TYPOGRAPHY.sm,
            fontWeight: "500",
            color: colors.text,
            lineHeight: 20,
          }}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        {item.note && (
          <Text
            style={{
              ...TYPOGRAPHY.xs,
              color: colors.textSecondary,
              marginTop: 4,
              lineHeight: 18,
            }}
            numberOfLines={2}
          >
            {item.note}
          </Text>
        )}

        {/* Like + Comment - minimal inline actions */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: SPACING.sm,
            gap: SPACING.lg,
          }}
        >
          <TouchableOpacity
            onPress={() => onLike(item)}
            disabled={isLiking}
            style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            {isLiking ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Ionicons
                name={item.liked_by_me ? "heart" : "heart-outline"}
                size={20}
                color={item.liked_by_me ? "#ef4444" : colors.textMuted}
              />
            )}
            <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted }}>
              {item.like_count > 0 ? item.like_count : "Like"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => onCommentPress(item)}
            style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            <Ionicons
              name={isCommentsExpanded ? "chatbubbles" : "chatbubble-outline"}
              size={18}
              color={isCommentsExpanded ? colors.accent : colors.textMuted}
            />
            <Text
              style={{
                ...TYPOGRAPHY.xs,
                color: isCommentsExpanded ? colors.accent : colors.textMuted,
              }}
            >
              {item.comment_count > 0 ? item.comment_count : "Comment"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Inline comments - expandable */}
        {isCommentsExpanded && (
          <View
            style={{
              marginTop: SPACING.md,
              paddingTop: SPACING.md,
              borderTopWidth: 1,
              borderTopColor: colors.borderLight,
            }}
          >
            {commentsLoading ? (
              <View style={{ paddingVertical: SPACING.md, alignItems: "center" }}>
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            ) : (
              <>
                {comments.map((c) => {
                  const isMe = c.user_id === user?.id || c.commenter_name === "You";
                  const avatarUri = isMe ? safeImageUrl(myAvatarUrl) : null;
                  return (
                  <View
                    key={c.id}
                    style={{
                      flexDirection: "row",
                      marginBottom: SPACING.sm,
                      paddingRight: SPACING.xs,
                    }}
                  >
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        overflow: "hidden",
                        backgroundColor: colors.surface,
                        marginRight: SPACING.sm,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {avatarUri ? (
                        <Image
                          source={{ uri: avatarUri }}
                          style={{ width: 24, height: 24 }}
                          resizeMode="cover"
                        />
                      ) : (
                        <Ionicons name="person" size={12} color={colors.textMuted} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "baseline",
                          flexWrap: "wrap",
                          gap: 6,
                        }}
                      >
                        <Text
                          style={{
                            ...TYPOGRAPHY.xs,
                            fontWeight: "600",
                            color: colors.text,
                          }}
                        >
                          {c.commenter_name || "Pet parent"}
                        </Text>
                        <Text
                          style={{
                            ...TYPOGRAPHY.xs,
                            fontSize: 11,
                            color: colors.textMuted,
                          }}
                        >
                          {timeAgo(new Date(c.created_at).getTime())}
                        </Text>
                      </View>
                      <Text
                        style={{
                          ...TYPOGRAPHY.xs,
                          color: colors.textSecondary,
                          lineHeight: 18,
                          marginTop: 1,
                        }}
                      >
                        {c.comment_text}
                      </Text>
                    </View>
                  </View>
                );
                })}
              </>
            )}

            {user && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: SPACING.sm,
                  gap: SPACING.sm,
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    overflow: "hidden",
                    backgroundColor: colors.surface,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {safeImageUrl(myAvatarUrl) ? (
                    <Image
                      source={{ uri: safeImageUrl(myAvatarUrl)! }}
                      style={{ width: 28, height: 28 }}
                      resizeMode="cover"
                    />
                  ) : (
                    <Ionicons name="person" size={14} color={colors.textMuted} />
                  )}
                </View>
                <View
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: colors.surface,
                    borderRadius: 14,
                    paddingLeft: SPACING.sm,
                    paddingRight: SPACING.xs,
                    paddingVertical: 4,
                    minHeight: 28,
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
                      ...TYPOGRAPHY.xs,
                      fontSize: 13,
                      color: colors.text,
                      paddingVertical: 6,
                    }}
                  />
                  <TouchableOpacity
                    onPress={handleSubmitComment}
                    disabled={!draft.trim() || submitting}
                    style={{ padding: SPACING.xs }}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color={colors.accent} />
                    ) : (
                      <Text
                        style={{
                          ...TYPOGRAPHY.xs,
                          fontWeight: "600",
                          color: draft.trim() ? colors.accent : colors.textMuted,
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
        )}
      </View>
    </View>
    {item.media_type === "photo" && mediaUrl ? (
      <ImageZoomLightbox
        visible={zoomOpen}
        uri={mediaUrl}
        onClose={() => setZoomOpen(false)}
      />
    ) : null}
    </>
  );
}

export default memo(FeedCard);
