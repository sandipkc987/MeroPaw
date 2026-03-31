import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  Animated,
  useWindowDimensions,
  LayoutChangeEvent,
  PixelRatio,
} from "react-native";
import { SPACING, RADIUS, SHADOWS } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useMemories } from "@src/contexts/MemoriesContext";

const TABLET_BREAKPOINT = 768;

interface HighlightImage {
  id: string;
  uri: string;
  title: string;
  subtitle?: string;
  badge?: string;
  isNew?: boolean;
}

interface HighlightsCarouselProps {
  onItemPress?: (item: HighlightImage) => void;
  autoIntervalMs?: number;
  peekRightPercent?: number;
}

export default function HighlightsCarousel({
  onItemPress,
  autoIntervalMs = 6000,
  peekRightPercent = 10
}: HighlightsCarouselProps) {
  const { width: screenWidth } = useWindowDimensions();
  const { colors } = useTheme();
  const { getIntelligentHighlights } = useMemories();
  const [containerWidth, setContainerWidth] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const autoplayTimer = useRef<NodeJS.Timeout | null>(null);

  const highlightImages = useMemo(() => getIntelligentHighlights(), [getIntelligentHighlights]);

  const measuredWidth = containerWidth > 0 ? containerWidth : screenWidth;
  const isTablet = measuredWidth >= TABLET_BREAKPOINT;
  const carouselHeight = isTablet ? 360 : 260;
  const contentPaddingH = isTablet ? SPACING.lg : SPACING.md;

  // Edge-to-edge full-width slides: use measured container width for iOS accuracy
  const slideWidth = PixelRatio.roundToNearestPixel(measuredWidth);

  const onContainerLayout = useCallback((e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    if (width > 0) setContainerWidth(width);
  }, []);

  // Auto-advance functionality
  useEffect(() => {
    if (isPlaying && !isHovered && highlightImages.length > 1) {
      autoplayTimer.current = setTimeout(() => {
        const nextIndex = (currentIndex + 1) % highlightImages.length;
        setCurrentIndex(nextIndex);
        flatListRef.current?.scrollToOffset({
          offset: nextIndex * slideWidth,
          animated: true
        });
      }, autoIntervalMs);
    }

    return () => {
      if (autoplayTimer.current) {
        clearTimeout(autoplayTimer.current);
      }
    };
  }, [currentIndex, isPlaying, isHovered, highlightImages.length, autoIntervalMs]);

  // Progress bar animation
  useEffect(() => {
    if (isPlaying && !isHovered) {
      progressAnim.setValue(0);
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: autoIntervalMs,
        useNativeDriver: false,
      }).start();
    }
  }, [currentIndex, isPlaying, isHovered, autoIntervalMs]);


  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(contentOffsetX / slideWidth);
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < highlightImages.length) {
      setCurrentIndex(newIndex);
    }
  };

  const scrollToIndex = (index: number) => {
    const idx = Math.max(0, Math.min(index, highlightImages.length - 1));
    setCurrentIndex(idx);
    flatListRef.current?.scrollToOffset({ offset: idx * slideWidth, animated: true });
  };

  const handlePress = (item: HighlightImage) => {
    onItemPress?.(item);
  };

  const keyExtractor = useCallback((item: HighlightImage, index: number) => {
    return item.id || `${item.uri}-${index}`;
  }, []);

  const renderSlide = ({ item, index }: { item: HighlightImage; index: number }) => (
    <Pressable
      style={[
        styles.slide,
        { width: slideWidth, height: carouselHeight }
      ]}
      onPress={() => handlePress(item)}
      onPressIn={() => setIsHovered(true)}
      onPressOut={() => setIsHovered(false)}
    >
      <Image
        source={{ uri: item.uri }}
        style={styles.slideImage}
        resizeMode="cover"
      />

      {/* Enhanced gradient overlay */}
      <LinearGradient
        colors={["rgba(0,0,0,0.1)", "transparent", "rgba(0,0,0,0.8)"]}
        locations={[0, 0.5, 1]}
        style={styles.slideGradient}
      />

      {!!item.badge && (
        <View style={[styles.pillBadge, { left: SPACING.sm }]}>
          <Text style={styles.pillText}>{String(item.badge)}</Text>
        </View>
      )}

      {item.isNew && (
        <View style={[styles.pillBadge, { right: SPACING.sm, backgroundColor: "rgba(255,200,0,0.85)" }]}>
          <Text style={styles.pillText}>New memory!</Text>
        </View>
      )}

      {/* Content overlay */}
      <View style={styles.slideContent}>
        <View style={styles.slideHeader}>
          <Text style={styles.slideTitle} numberOfLines={2}>{item.title}</Text>
          {!!item.subtitle && <Text style={styles.slideDate}>{item.subtitle}</Text>}
        </View>
      </View>

      {/* Slide number indicator */}
      <View style={styles.slideIndicator}>
        <Text style={styles.slideNumber}>{index + 1}/{highlightImages.length}</Text>
      </View>
    </Pressable>
  );

  const renderProgressBar = () => (
    <View style={[styles.progressContainer, { left: contentPaddingH, right: contentPaddingH }]}>
      <TouchableOpacity
        onPress={() => scrollToIndex(currentIndex - 1)}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={styles.chevronButton}
      >
        <Ionicons name="chevron-back" size={24} color="#fff" />
      </TouchableOpacity>
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
        <View style={styles.progressDots}>
          {highlightImages.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                index === currentIndex && styles.activeProgressDot
              ]}
            />
          ))}
        </View>
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
      </View>
      <TouchableOpacity
        onPress={() => scrollToIndex(currentIndex + 1)}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={styles.chevronButton}
      >
        <Ionicons name="chevron-forward" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  if (highlightImages.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="images-outline" size={48} color={colors.textMuted} />
        <Text style={[styles.emptyText, { color: colors.text }]}>No highlights yet</Text>
        <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>Add some activities with photos to see them here</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingHorizontal: contentPaddingH }]}>
        <Text style={[styles.title, { color: colors.text }]}>Highlights</Text>
      </View>

      {/* Carousel - onLayout ensures accurate width on iOS (avoids useWindowDimensions mismatch) */}
      <View
        style={[styles.carouselContainer, { height: carouselHeight }]}
        onLayout={onContainerLayout}
      >
        <FlatList
          ref={flatListRef}
          data={highlightImages}
          renderItem={renderSlide}
          keyExtractor={keyExtractor}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={slideWidth}
          snapToAlignment="start"
          decelerationRate="fast"
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={styles.carouselContentFullWidth}
          getItemLayout={(_, index) => ({
            length: slideWidth,
            offset: slideWidth * index,
            index,
          })}
        />

        {/* Progress bar and chevrons */}
        {renderProgressBar()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
  },
  headerAddButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.sm,
  },
  carouselContainer: {
    height: 200,
    position: "relative",
  },
  carouselContent: {
    paddingHorizontal: SPACING.md,
  },
  carouselContentFullWidth: {
    paddingHorizontal: 0,
  },
  slide: {
    height: 200,
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    marginRight: 0,
    position: "relative",
    ...SHADOWS.md,
  },
  slideImage: {
    width: "100%",
    height: "100%",
    position: "absolute",
  },
  slideGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  pillBadge: {
    position: "absolute",
    top: SPACING.sm,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  pillText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  slideContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.md,
  },
  slideHeader: {
    marginBottom: SPACING.xs,
  },
  slideTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  slideDate: {
    color: "#fff",
    fontSize: 12,
    opacity: 0.9,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  slideIndicator: {
    position: "absolute",
    bottom: SPACING.sm,
    left: SPACING.sm,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
  },
  slideNumber: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
  progressContainer: {
    position: "absolute",
    bottom: SPACING.md,
    left: SPACING.md,
    right: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chevronButton: {
    padding: SPACING.xs,
  },
  progressDots: {
    flexDirection: "row",
    marginRight: SPACING.sm,
    gap: 4,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  activeProgressDot: {
    backgroundColor: "#fff",
    ...SHADOWS.sm,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 2,
    marginRight: SPACING.sm,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#fff",
    borderRadius: 2,
    ...SHADOWS.sm,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: SPACING.xxxl,
    paddingHorizontal: SPACING.lg,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.pill,
    ...SHADOWS.sm,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: SPACING.xs,
  },
});
