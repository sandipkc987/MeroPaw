import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from "react-native";
import { SPACING, TYPOGRAPHY } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "@src/components/ScreenHeader";
import FeedCard from "@src/components/FeedCard";
import { useNavigation } from "@src/contexts/NavigationContext";
import { useAuth } from "@src/contexts/AuthContext";
import { useDiscoverFeed } from "@src/contexts/DiscoverFeedContext";
import {
  likeFeedItem,
  unlikeFeedItem,
  type DiscoverFeedItem,
} from "@src/services/feedService";

export default function DiscoverScreen() {
  const { colors } = useTheme();
  const { goBack } = useNavigation();
  const { user } = useAuth();
  const { items, loading, refreshing, error, loadFeed, updateItem } = useDiscoverFeed();
  const [likingId, setLikingId] = useState<string | null>(null);
  const [expandedCommentsId, setExpandedCommentsId] = useState<string | null>(null);
  const [scrollY, setScrollY] = useState(0);
  const SCROLL_THRESHOLD = 50;
  const headerCenterTitle = scrollY > SCROLL_THRESHOLD;

  useEffect(() => {
    loadFeed(false);
  }, [loadFeed]);

  const onRefresh = () => loadFeed(true);

  const handleLike = async (item: DiscoverFeedItem) => {
    if (!user?.id) return;
    setLikingId(item.id);
    const wasLiked = item.liked_by_me;
    updateItem(item.id, item.type, (it) => ({
      ...it,
      liked_by_me: !wasLiked,
      like_count: Math.max(0, it.like_count + (wasLiked ? -1 : 1)),
    }));
    try {
      if (wasLiked) {
        await unlikeFeedItem(user.id, item.type, item.id);
      } else {
        await likeFeedItem(user.id, item.type, item.id);
      }
    } catch {
      updateItem(item.id, item.type, (it) => ({
        ...it,
        liked_by_me: wasLiked,
        like_count: Math.max(0, it.like_count + (wasLiked ? 1 : -1)),
      }));
    } finally {
      setLikingId(null);
    }
  };

  const handleCommentToggle = (item: DiscoverFeedItem) => {
    setExpandedCommentsId((prev) =>
      prev === `${item.type}-${item.id}` ? null : `${item.type}-${item.id}`
    );
  };

  const handleCommentAdded = (item: DiscoverFeedItem) => {
    updateItem(item.id, item.type, (it) => ({
      ...it,
      comment_count: it.comment_count + 1,
    }));
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title="Discover"
        showBackButton
        onBackPress={goBack}
        centerTitle={headerCenterTitle}
        titleStyle={{ ...TYPOGRAPHY.base, fontWeight: "400" }}
        insetSeparator
      />
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: SPACING.lg }}>
          <Text style={{ ...TYPOGRAPHY.base, color: colors.textMuted, textAlign: "center" }}>
            {error}
          </Text>
          <TouchableOpacity
            onPress={() => loadFeed(true)}
            style={{
              marginTop: SPACING.md,
              paddingHorizontal: SPACING.lg,
              paddingVertical: SPACING.sm,
              backgroundColor: colors.accent,
              borderRadius: 8,
            }}
          >
            <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: "#fff" }}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : items.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: SPACING.xl }}>
          <Ionicons name="paw" size={64} color={colors.textMuted} />
          <Text
            style={{
              ...TYPOGRAPHY.lg,
              fontWeight: "600",
              color: colors.text,
              marginTop: SPACING.md,
              textAlign: "center",
            }}
          >
            No posts yet
          </Text>
          <Text
            style={{
              ...TYPOGRAPHY.sm,
              color: colors.textMuted,
              marginTop: SPACING.sm,
              textAlign: "center",
            }}
          >
            Share your pet to see them here! Set your pet to public in Pet Settings.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          renderItem={({ item }) => (
            <FeedCard
              item={item}
              onLike={handleLike}
              onCommentPress={handleCommentToggle}
              onCommentAdded={handleCommentAdded}
              isLiking={likingId === item.id}
              isCommentsExpanded={expandedCommentsId === `${item.type}-${item.id}`}
            />
          )}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 120, paddingTop: SPACING.sm }}
          showsVerticalScrollIndicator={false}
          onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
          initialNumToRender={4}
          windowSize={7}
          maxToRenderPerBatch={5}
          removeClippedSubviews={Platform.OS === "android"}
        />
      )}
    </View>
  );
}
