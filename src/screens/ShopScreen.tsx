import React, { useCallback, useEffect, useRef, useState } from "react";
import { Text, TouchableOpacity, View, FlatList, ScrollView, Image } from "react-native";
import { RADIUS, SPACING, TYPOGRAPHY, SHADOWS } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import { usePets } from "@src/contexts/PetContext";
import { Button, Card, Chip, Input } from "@src/components/UI";
import ScreenHeader from "@src/components/ScreenHeader";
import { useNavigation } from "@src/contexts/NavigationContext";

interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
  rating: number;
  inStock: boolean;
}

const mockProducts: Product[] = [
  {
    id: "1",
    name: "Premium Dog Food",
    price: 29.99,
    image: "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=300&h=300&fit=crop",
    category: "Food",
    rating: 4.8,
    inStock: true
  },
  {
    id: "2", 
    name: "Interactive Toy",
    price: 15.99,
    image: "https://images.unsplash.com/photo-1551717743-49959800b1f6?w=300&h=300&fit=crop",
    category: "Toys",
    rating: 4.5,
    inStock: true
  },
  {
    id: "3",
    name: "Comfortable Bed",
    price: 45.99,
    image: "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=300&h=300&fit=crop",
    category: "Bedding",
    rating: 4.9,
    inStock: false
  },
  {
    id: "4",
    name: "Training Treats",
    price: 8.99,
    image: "https://images.unsplash.com/photo-1551717743-49959800b1f6?w=300&h=300&fit=crop",
    category: "Food",
    rating: 4.3,
    inStock: true
  }
];

const categories = ["All", "Food", "Toys", "Bedding", "Health"];

const ProductCard = ({
  product,
  isInCart,
  onAddToCart,
}: {
  product: Product;
  isInCart: boolean;
  onAddToCart: (productId: string) => void;
}) => {
  const { colors } = useTheme();
  const canPurchase = product.inStock;

  return (
    <Card style={{ 
      flex: 1, 
      margin: SPACING.xs,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...SHADOWS.sm
    }}>
      <View style={{ 
        height: 120, 
        backgroundColor: colors.bgSecondary,
        borderRadius: RADIUS.md,
        marginBottom: SPACING.sm,
        alignItems: "center",
        justifyContent: "center"
      }}>
        <Image
          source={{ uri: product.image }}
          style={{ width: "100%", height: "100%", borderRadius: RADIUS.md }}
          resizeMode="cover"
        />
        {!canPurchase && (
          <View style={{
            position: "absolute",
            left: 8,
            bottom: 8,
            backgroundColor: "rgba(0,0,0,0.6)",
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: RADIUS.sm,
          }}>
            <Text style={{ ...TYPOGRAPHY.xs, color: colors.white, fontWeight: "700" }}>
              Out of stock
            </Text>
          </View>
        )}
      </View>
      
      <Text style={{ 
        ...TYPOGRAPHY.sm, 
        fontWeight: "600", 
        color: colors.text,
        marginBottom: SPACING.xs
      }} numberOfLines={2}>
        {product.name}
      </Text>
      
      <Text style={{ 
        ...TYPOGRAPHY.lg, 
        fontWeight: "700", 
        color: colors.accent,
        marginBottom: SPACING.sm
      }}>
        ${product.price}
      </Text>
      
      <View style={{ 
        flexDirection: "row", 
        alignItems: "center", 
        marginBottom: SPACING.sm 
      }}>
        <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted }}>
          ⭐ {product.rating}
        </Text>
      </View>
      
      <Button
        title={!canPurchase ? "Out of Stock" : isInCart ? "In Cart" : "Add to Cart"}
        onPress={() => onAddToCart(product.id)}
        style={{ width: "100%" }}
        kind={!canPurchase || isInCart ? "secondary" : "primary"}
        disabled={!canPurchase}
      />
    </Card>
  );
};

export default function ShopScreen() {
  const { colors } = useTheme();
  const { setNavHidden } = useNavigation();
  const { getActivePet } = usePets();
  const activePet = getActivePet();
  const petName = activePet?.name?.trim() || "your pet";
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [cartItems, setCartItems] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const lastScrollYRef = useRef(0);

  const addToCart = useCallback((productId: string) => {
    setCartItems(prev => (prev.includes(productId) ? prev : [...prev, productId]));
  }, []);

  const filteredProducts = mockProducts.filter(product => {
    const matchesCategory = selectedCategory === "All" || product.category === selectedCategory;
    const matchesQuery = query.trim().length === 0
      || product.name.toLowerCase().includes(query.trim().toLowerCase());
    return matchesCategory && matchesQuery;
  });

  // Create data array for FlatList
  const listData = [
    { type: 'categories', id: 'categories' },
    ...filteredProducts.map(product => ({ type: 'product', id: product.id, data: product }))
  ];

  const renderItem = ({ item }: { item: any }) => {
    switch (item.type) {
      case 'categories':
        return (
          <View style={{ 
            paddingHorizontal: SPACING.lg,
            paddingBottom: SPACING.lg,
          }}>
            <FlatList 
              horizontal 
              showsHorizontalScrollIndicator={false}
              data={categories}
              keyExtractor={(category) => category}
              renderItem={({ item: category }) => (
                <Chip
                  label={category}
                  selected={selectedCategory === category}
                  onPress={() => setSelectedCategory(category)}
                />
              )}
              ItemSeparatorComponent={() => <View style={{ width: SPACING.sm }} />}
            />
          </View>
        );
      
      case 'product':
        return (
          <View style={{ 
            paddingHorizontal: SPACING.lg,
            paddingBottom: SPACING.md,
          }}>
            <ProductCard
              product={item.data}
              isInCart={cartItems.includes(item.data.id)}
              onAddToCart={addToCart}
            />
          </View>
        );
      
      default:
        return null;
    }
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title="Shop"
        showBackButton={false}
        actionIcon={showSearch ? "close" : "search"}
        onActionPress={() => {
          if (showSearch) {
            setQuery("");
            setShowSearch(false);
          } else {
            setShowSearch(true);
          }
        }}
      />
      <View style={{ paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.md }}>
        <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginBottom: showSearch ? SPACING.md : 0 }}>
          Find the best products for {petName}
        </Text>
        {showSearch && (
          <View style={{
            backgroundColor: colors.cardSecondary,
            borderRadius: RADIUS.lg,
            borderWidth: 1,
            borderColor: colors.borderLight,
            paddingHorizontal: SPACING.md,
            paddingVertical: 2,
          }}>
            <Input
              value={query}
              onChangeText={setQuery}
              placeholder="Search products"
              autoCapitalize="none"
              style={{
                backgroundColor: "transparent",
                borderWidth: 0,
                paddingHorizontal: 0,
                paddingVertical: 8,
              }}
            />
          </View>
        )}
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: 120,
          backgroundColor: colors.bg,
        }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={true}
        bounces={true}
        alwaysBounceVertical={false}
        nestedScrollEnabled={true}
        keyboardShouldPersistTaps="handled"
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {listData.map((item) => (
          <View key={item.id}>
            {renderItem({ item })}
          </View>
        ))}
        {filteredProducts.length === 0 && (
          <View style={{ paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg }}>
            <Card style={{ alignItems: "center", paddingVertical: SPACING.xl }}>
              <Text style={{ ...TYPOGRAPHY.base, color: colors.textMuted }}>
                No products match your search
              </Text>
              <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginTop: SPACING.xs }}>
                Try a different keyword or category.
              </Text>
            </Card>
          </View>
        )}
      </ScrollView>
      
      {/* Cart FAB */}
      {cartItems.length > 0 && (
        <TouchableOpacity 
          style={{
            position: "absolute",
            bottom: 100,
            right: SPACING.lg,
            backgroundColor: colors.accent,
            borderRadius: RADIUS.pill,
            paddingHorizontal: SPACING.lg,
            paddingVertical: SPACING.md,
            flexDirection: "row",
            alignItems: "center",
            ...SHADOWS.lg
          }}
        >
          <Text style={{ color: colors.white, fontSize: 18, marginRight: SPACING.sm }}>🛒</Text>
          <Text style={{ color: colors.white, fontWeight: "600", ...TYPOGRAPHY.base }}>
            {cartItems.length} item{cartItems.length > 1 ? 's' : ''}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}