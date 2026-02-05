import React, { useMemo, useCallback } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Line, Path, G, Text as SvgText, TSpan } from "react-native-svg";
import { SPACING, TYPOGRAPHY, SHADOWS } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";

interface ChartTabsProps {
  activeTab: "categories" | "weekly";
  onTabChange: (tab: "categories" | "weekly") => void;
}

export const ChartTabs: React.FC<ChartTabsProps> = ({ activeTab, onTabChange }) => {
  const { colors } = useTheme();
  const tabs = [
    { id: "categories", label: "Categories", iconName: "grid" as const },
    { id: "weekly", label: "Monthly Trend", iconName: "bar-chart" as const },
  ] as const;

  return (
    <View style={{
      flexDirection: "row",
      backgroundColor: colors.bgSecondary,
      borderRadius: 12,
      padding: 4,
      marginBottom: SPACING.md,
    }}>
      {tabs.map((tab, index) => (
        <TouchableOpacity
          key={tab.id}
          onPress={() => onTabChange(tab.id)}
          style={{
            flex: 1,
            paddingVertical: SPACING.md,
            paddingHorizontal: SPACING.sm,
            borderRadius: 10,
            backgroundColor: activeTab === tab.id ? colors.white : "transparent",
            alignItems: "center",
            marginLeft: index > 0 ? 4 : 0,
            ...(activeTab === tab.id ? SHADOWS.sm : {})
          }}
        >
          <Ionicons 
            name={tab.iconName} 
            size={18} 
            color={activeTab === tab.id ? colors.accent : colors.textMuted}
            style={{ marginBottom: 2 }}
          />
          <Text style={{
            ...TYPOGRAPHY.sm,
            fontWeight: activeTab === tab.id ? "700" : "600",
            color: activeTab === tab.id ? colors.accent : colors.textMuted,
            fontSize: 11
          }}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

// Donut Chart Component
interface DonutChartProps {
  data: Array<{ category: string; amount: number; percentage: number }>;
  getCategoryColor: (category: string) => string;
  dateRange?: { start: Date; end: Date };
  totalAmount?: number;
}

export const DonutChart: React.FC<DonutChartProps> = React.memo(({ data, getCategoryColor, dateRange, totalAmount }) => {
  const { colors } = useTheme();
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const calculatedTotal = useMemo(() => data.reduce((sum, item) => sum + item.amount, 0), [data]);
  const total = totalAmount !== undefined ? totalAmount : calculatedTotal;
  
  // Format date range
  const formatDateRange = useMemo(() => {
    if (!dateRange) return "";
    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };
    const startStr = formatDate(dateRange.start);
    const endStr = dateRange.end.toDateString() === new Date().toDateString() 
      ? "Today" 
      : formatDate(dateRange.end);
    return `${startStr} - ${endStr}`;
  }, [dateRange]);
  
  // Calculate cumulative offsets for proper segment positioning
  const segments = useMemo(() => {
    if (!data || data.length === 0) return [];
    let cumulativeOffset = 0;
    return data.map((item) => {
      const segmentLength = (item.percentage / 100) * circumference;
      const segment = {
        ...item,
        dashArray: `${segmentLength} ${circumference}`,
        dashOffset: -cumulativeOffset,
      };
      cumulativeOffset += segmentLength;
      return segment;
    });
  }, [data, circumference]);
  
  // If no data, show empty state (check after all hooks)
  if (!data || data.length === 0 || total === 0) {
    return (
      <View style={{ alignItems: "center", paddingVertical: SPACING.xl }}>
        <Text style={{ ...TYPOGRAPHY.base, color: colors.textMuted }}>
          No expenses data available
        </Text>
      </View>
    );
  }

  // Format category name
  const formatCategoryName = (category: string) => {
    const categoryMap: Record<string, string> = {
      food: "Food",
      medical: "Medical",
      toys: "Toys",
      grooming: "Grooming",
      other: "Other"
    };
    return categoryMap[category] || category.charAt(0).toUpperCase() + category.slice(1);
  };

  return (
    <View style={{ paddingVertical: SPACING.md }}>
      {/* Centered Chart */}
      <View style={{ alignItems: "center", marginBottom: SPACING.xl }}>
        <View style={{ position: "relative", width: 200, height: 200, justifyContent: "center", alignItems: "center" }}>
          <View style={{ transform: [{ rotate: '-90deg' }] }}>
            <Svg width="200" height="200" viewBox="0 0 200 200">
              {segments.map((segment, index) => (
                <Circle
                  key={index}
                  cx="100"
                  cy="100"
                  r={radius}
                  fill="none"
                  stroke={getCategoryColor(segment.category)}
                  strokeWidth="24"
                  strokeDasharray={segment.dashArray}
                  strokeDashoffset={segment.dashOffset}
                  strokeLinecap="round"
                />
              ))}
            </Svg>
          </View>

          {/* Center Text */}
          <View style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: "center",
            alignItems: "center"
          }}>
            <Text style={{ 
              fontSize: 14, 
              fontWeight: "700", 
              color: colors.text,
              marginBottom: 4
            }}>
              Total Spend
            </Text>
            {formatDateRange && (
              <Text style={{ 
                fontSize: 10, 
                color: colors.textMuted,
                marginBottom: 8
              }}>
                {formatDateRange}
              </Text>
            )}
            <Text style={{ 
              fontSize: 28, 
              fontWeight: "800", 
              color: colors.text,
              letterSpacing: -0.5
            }}>
              ${total.toFixed(2)}
            </Text>
          </View>
        </View>
      </View>

      {/* Summary Section */}
      <View>
        <Text style={{ 
          ...TYPOGRAPHY.base, 
          fontWeight: "700", 
          color: colors.text,
          marginBottom: SPACING.md
        }}>
          {formatDateRange ? `Recent Activity (${formatDateRange})` : "Summary"}
        </Text>
        
        {data.map((item, index) => (
          <View 
            key={item.category} 
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: SPACING.sm,
              borderBottomWidth: index < data.length - 1 ? 1 : 0,
              borderBottomColor: colors.borderLight,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
              <View style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: getCategoryColor(item.category),
                marginRight: SPACING.md,
              }} />
              <Text style={{ 
                ...TYPOGRAPHY.base,
                fontWeight: "500", 
                color: colors.text,
              }}>
                {formatCategoryName(item.category)}
              </Text>
            </View>
            <Text style={{ 
              ...TYPOGRAPHY.base,
              fontWeight: "700", 
              color: colors.text,
            }}>
              ${item.amount.toFixed(2)}
            </Text>
          </View>
        ))}
      </View>

      {/* Total Spend at Bottom */}
      <View style={{
        marginTop: SPACING.lg,
        paddingTop: SPACING.lg,
        borderTopWidth: 1,
        borderTopColor: colors.borderLight,
      }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ 
            ...TYPOGRAPHY.base,
            fontWeight: "700", 
            color: colors.text,
          }}>
            Total Spend
          </Text>
          <Text style={{ 
            ...TYPOGRAPHY.lg,
            fontWeight: "800", 
            color: colors.text,
          }}>
            ${total.toFixed(2)}
          </Text>
        </View>
        <Text style={{ 
          ...TYPOGRAPHY.xs,
          color: colors.textMuted,
          marginTop: SPACING.xs,
          fontStyle: "italic"
        }}>
          Total Spend does not include any payments made during this time frame.
        </Text>
      </View>
    </View>
  );
});

// Trend Chart Component
interface TrendChartProps {
  data: Array<{ week: string; amount: number }>;
}

export const TrendChart: React.FC<TrendChartProps> = React.memo(({ data }) => {
  const { colors } = useTheme();
  const chartDimensions = useMemo(() => ({
    svgWidth: 320,
    svgHeight: 200,
    paddingTop: 20,
    paddingBottom: 40,
    paddingLeft: 40,
    paddingRight: 20,
  }), []);

  const { maxAmount, minAmount, range, avgAmount, totalAmount, yAxisValues } = useMemo(() => {
    const maxAmount = Math.max(...data.map(d => d.amount), 1);
    const minAmount = 0;
    const range = maxAmount || 1;
    const avgAmount = data.reduce((sum, d) => sum + d.amount, 0) / data.length;
    const totalAmount = data.reduce((sum, d) => sum + d.amount, 0);
    
    const yAxisSteps = 4;
    const yStepValue = Math.ceil(maxAmount / yAxisSteps / 50) * 50;
    const yAxisValues: number[] = [];
    for (let i = 0; i <= yAxisSteps; i++) {
      yAxisValues.push(i * yStepValue);
    }
    
    return { maxAmount, minAmount, range, avgAmount, totalAmount, yAxisValues };
  }, [data]);

  const graphHeight = chartDimensions.svgHeight - chartDimensions.paddingTop - chartDimensions.paddingBottom;
  const graphWidth = chartDimensions.svgWidth - chartDimensions.paddingLeft - chartDimensions.paddingRight;
  
  // Calculate points for the line
  const points = useMemo(() => {
    return data.map((item, index) => {
      const xPos = chartDimensions.paddingLeft + (index / (data.length - 1 || 1)) * graphWidth;
      const normalizedAmount = item.amount / range;
      const yPos = chartDimensions.paddingTop + graphHeight - (normalizedAmount * graphHeight);
      return { 
        x: xPos, 
        y: yPos, 
        amount: item.amount,
        week: item.week.split(' ')[1] || item.week
      };
    });
  }, [data, range, graphWidth, graphHeight, chartDimensions.paddingLeft, chartDimensions.paddingTop]);

  // Generate smooth curve path using quadratic Bezier curves
  const generatePath = useCallback(() => {
    if (points.length === 0) return "";
    if (points.length === 1) {
      return `M ${points[0].x} ${points[0].y}`;
    }

    let path = `M ${points[0].x} ${points[0].y}`;
    
    for (let i = 1; i < points.length; i++) {
      const curr = points[i];
      const prev = points[i - 1];
      const controlX = (prev.x + curr.x) / 2;
      const controlY = (prev.y + curr.y) / 2;
      path += ` Q ${controlX} ${controlY} ${curr.x} ${curr.y}`;
    }
    
    return path;
  }, [points]);

  const yAxisSteps = 4;

  return (
    <View style={{ paddingVertical: SPACING.md }}>
      {/* Chart Container */}
      <View style={{
        backgroundColor: colors.white,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.borderLight,
        marginBottom: SPACING.md,
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.md,
      }}>
        {/* SVG Chart */}
        <View style={{ alignItems: "center" }}>
          <Svg width={chartDimensions.svgWidth} height={chartDimensions.svgHeight} viewBox={`0 0 ${chartDimensions.svgWidth} ${chartDimensions.svgHeight}`}>
            {/* Y-Axis */}
            <Line
              x1={chartDimensions.paddingLeft}
              y1={chartDimensions.paddingTop}
              x2={chartDimensions.paddingLeft}
              y2={chartDimensions.svgHeight - chartDimensions.paddingBottom}
              stroke={colors.borderLight}
              strokeWidth="1"
            />
            
            {/* X-Axis */}
            <Line
              x1={chartDimensions.paddingLeft}
              y1={chartDimensions.svgHeight - chartDimensions.paddingBottom}
              x2={chartDimensions.svgWidth - chartDimensions.paddingRight}
              y2={chartDimensions.svgHeight - chartDimensions.paddingBottom}
              stroke={colors.borderLight}
              strokeWidth="1"
            />

            {/* Horizontal Grid Lines */}
            {yAxisValues.map((value, index) => {
              const yPos = chartDimensions.paddingTop + (graphHeight * (1 - index / yAxisSteps));
              return (
                <Line
                  key={`grid-${index}`}
                  x1={chartDimensions.paddingLeft}
                  y1={yPos}
                  x2={chartDimensions.svgWidth - chartDimensions.paddingRight}
                  y2={yPos}
                  stroke={colors.borderLight}
                  strokeWidth="1"
                  strokeDasharray="4,4"
                  opacity={0.5}
                />
              );
            })}

            {/* Trend Line */}
            <Path
              d={generatePath()}
              fill="none"
              stroke={colors.accent}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data Points */}
            {points.map((point, index) => (
              <G key={`point-${index}`}>
                <Circle
                  cx={point.x}
                  cy={point.y}
                  r="5"
                  fill={colors.white}
                  stroke={colors.accent}
                  strokeWidth="2"
                />
              </G>
            ))}

            {/* Y-Axis Labels */}
            {yAxisValues.map((value, index) => {
              const yPos = chartDimensions.paddingTop + (graphHeight * (1 - index / yAxisSteps));
              return (
                <SvgText
                  key={`y-label-${index}`}
                  x={chartDimensions.paddingLeft - 8}
                  y={yPos + 4}
                  fontSize={10}
                  fill={colors.textMuted}
                  textAnchor="end"
                >
                  <TSpan fontWeight="500">${value.toLocaleString()}</TSpan>
                </SvgText>
              );
            })}

            {/* X-Axis Labels */}
            {points.map((point, index) => (
              <SvgText
                key={`x-label-${index}`}
                x={point.x}
                y={chartDimensions.svgHeight - chartDimensions.paddingBottom + 16}
                fontSize={10}
                fill={colors.textMuted}
                textAnchor="middle"
              >
                <TSpan fontWeight="500">{point.week}</TSpan>
              </SvgText>
            ))}
          </Svg>
        </View>
      </View>

      {/* Stats Cards */}
      <View style={{
        flexDirection: "row",
        marginBottom: SPACING.sm,
      }}>
        {data.map((item, index) => (
          <View key={index} style={{
            flex: 1,
            paddingVertical: SPACING.sm,
            paddingHorizontal: SPACING.xs,
            backgroundColor: colors.bgSecondary,
            borderRadius: 8,
            alignItems: "center",
            marginLeft: index > 0 ? SPACING.xs : 0
          }}>
            <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, fontSize: 9, marginBottom: 2 }}>
              {item.week.split(' ')[1] || item.week}
            </Text>
            <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "700", color: colors.text, fontSize: 12 }}>
              ${item.amount.toFixed(0)}
            </Text>
          </View>
        ))}
      </View>

      {/* Summary Stats */}
      <View style={{
        flexDirection: "row",
        marginTop: SPACING.xs,
      }}>
        <View style={{
          flex: 1,
          paddingVertical: SPACING.sm,
          paddingHorizontal: SPACING.sm,
          backgroundColor: colors.bgSecondary,
          borderRadius: 8,
          alignItems: "center"
        }}>
          <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginBottom: 2, fontSize: 10 }}>
            Average
          </Text>
          <Text style={{ ...TYPOGRAPHY.base, fontWeight: "700", color: colors.text, fontSize: 14 }}>
            ${avgAmount.toFixed(2)}
          </Text>
        </View>
        <View style={{
          flex: 1,
          paddingVertical: SPACING.sm,
          paddingHorizontal: SPACING.sm,
          backgroundColor: colors.bgSecondary,
          borderRadius: 8,
          alignItems: "center",
          marginLeft: SPACING.sm
        }}>
          <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginBottom: 2, fontSize: 10 }}>
            Total
          </Text>
          <Text style={{ ...TYPOGRAPHY.base, fontWeight: "700", color: colors.text, fontSize: 14 }}>
            ${totalAmount.toFixed(2)}
          </Text>
        </View>
      </View>
    </View>
  );
});
