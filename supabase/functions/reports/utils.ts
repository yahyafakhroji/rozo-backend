/**
 * Report Utilities
 * Optimized dashboard report generation with efficient data processing
 */

import type { TypedSupabaseClient } from "../../_shared/types/common.types.ts";

// ============================================================================
// Types
// ============================================================================

export interface ReportRequest {
  from: string;
  to: string;
  group_by?: "day" | "week" | "month";
}

export interface ChartData {
  merchant_id: string;
  date_range: { from: string; to: string };
  summary: {
    total_completed_orders: number;
    total_required_amount_usd: number;
    total_display_amounts: Record<string, number>;
  };
  charts: {
    daily_trends: DailyTrend[];
    currency_breakdown: CurrencyBreakdown[];
    order_volume: OrderVolume[];
  };
}

export interface DailyTrend {
  date: string;
  orders_count: number;
  usd_amount: number;
  display_amounts: Record<string, number>;
}

export interface CurrencyBreakdown {
  currency: string;
  amount: number;
  percentage: number;
}

export interface OrderVolume {
  date: string;
  count: number;
}

interface OrderRow {
  created_at: string;
  required_amount_usd: number | null;
  display_amount: number | null;
  display_currency: string | null;
}

interface DateGroup {
  count: number;
  usdAmount: number;
  displayAmounts: Record<string, number>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get date key based on grouping
 */
function getDateKey(dateString: string, groupBy: "day" | "week" | "month"): string {
  const date = new Date(dateString);

  switch (groupBy) {
    case "week": {
      // Get start of week (Monday)
      const startOfWeek = new Date(date);
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      return startOfWeek.toISOString().split("T")[0];
    }
    case "month": {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
    }
    default: // day
      return date.toISOString().split("T")[0];
  }
}

/**
 * Process all report data in a single pass for efficiency
 * This eliminates the need for multiple iterations over the data
 */
function processReportData(
  orders: OrderRow[],
  groupBy: "day" | "week" | "month",
): {
  summary: ChartData["summary"];
  charts: ChartData["charts"];
} {
  // Initialize accumulators
  const dateGroups = new Map<string, DateGroup>();
  const currencyTotals: Record<string, number> = {};
  let totalCount = 0;
  let totalUsd = 0;
  let totalDisplayAmount = 0;

  // Single pass through all orders
  for (const order of orders) {
    totalCount++;
    const usdAmount = order.required_amount_usd || 0;
    const displayAmount = order.display_amount || 0;
    const currency = order.display_currency || "USD";

    totalUsd += usdAmount;
    totalDisplayAmount += displayAmount;

    // Update currency totals for breakdown
    currencyTotals[currency] = (currencyTotals[currency] || 0) + displayAmount;

    // Update date groups for trends
    const dateKey = getDateKey(order.created_at, groupBy);

    if (!dateGroups.has(dateKey)) {
      dateGroups.set(dateKey, { count: 0, usdAmount: 0, displayAmounts: {} });
    }

    const group = dateGroups.get(dateKey)!;
    group.count++;
    group.usdAmount += usdAmount;
    group.displayAmounts[currency] = (group.displayAmounts[currency] || 0) + displayAmount;
  }

  // Build summary
  const totalDisplayAmounts: Record<string, number> = {};
  for (const [currency, amount] of Object.entries(currencyTotals)) {
    totalDisplayAmounts[currency] = parseFloat(amount.toFixed(2));
  }

  const summary: ChartData["summary"] = {
    total_completed_orders: totalCount,
    total_required_amount_usd: parseFloat(totalUsd.toFixed(2)),
    total_display_amounts: totalDisplayAmounts,
  };

  // Build charts
  const dailyTrends: DailyTrend[] = [];
  const orderVolume: OrderVolume[] = [];

  // Sort dates for ordered output
  const sortedDates = Array.from(dateGroups.keys()).sort();

  for (const date of sortedDates) {
    const group = dateGroups.get(date)!;

    dailyTrends.push({
      date,
      orders_count: group.count,
      usd_amount: parseFloat(group.usdAmount.toFixed(2)),
      display_amounts: group.displayAmounts,
    });

    orderVolume.push({
      date,
      count: group.count,
    });
  }

  // Build currency breakdown
  const currencyBreakdown: CurrencyBreakdown[] = totalDisplayAmount > 0
    ? Object.entries(currencyTotals)
        .map(([currency, amount]) => ({
          currency,
          amount: parseFloat(amount.toFixed(2)),
          percentage: parseFloat(((amount / totalDisplayAmount) * 100).toFixed(2)),
        }))
        .sort((a, b) => b.amount - a.amount)
    : [];

  return {
    summary,
    charts: {
      daily_trends: dailyTrends,
      currency_breakdown: currencyBreakdown,
      order_volume: orderVolume,
    },
  };
}

// ============================================================================
// Main Report Generation
// ============================================================================

/**
 * Generate dashboard report data for charts
 * Optimized to fetch data once and process efficiently
 */
export async function generateDashboardReport(
  supabase: TypedSupabaseClient,
  merchantId: string,
  request: ReportRequest,
): Promise<{ success: boolean; data?: ChartData; error?: string }> {
  try {
    // Validate date range
    const fromDate = new Date(request.from);
    const toDate = new Date(request.to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return { success: false, error: "Invalid date format" };
    }

    if (fromDate > toDate) {
      return { success: false, error: "Invalid date range: 'from' must be before 'to'" };
    }

    // Check if date range is too large (max 1 year)
    const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 365) {
      return { success: false, error: "Date range cannot exceed 1 year" };
    }

    // Set time boundaries to cover full days
    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);

    const fromISO = fromDate.toISOString();
    const toISO = toDate.toISOString();
    const groupBy = request.group_by || "day";

    // Single optimized query - fetch only needed columns
    const { data: orders, error: queryError } = await supabase
      .from("orders")
      .select("created_at, required_amount_usd, display_amount, display_currency")
      .eq("merchant_id", merchantId)
      .eq("status", "COMPLETED")
      .gte("created_at", fromISO)
      .lte("created_at", toISO)
      .order("created_at", { ascending: true });

    if (queryError) {
      return { success: false, error: queryError.message };
    }

    // Process all data in a single pass
    const { summary, charts } = processReportData(orders || [], groupBy);

    const result: ChartData = {
      merchant_id: merchantId,
      date_range: {
        from: request.from,
        to: request.to,
      },
      summary,
      charts,
    };

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================================================
// Additional Report Helpers
// ============================================================================

/**
 * Get quick summary stats for dashboard widgets
 * Lightweight queries for real-time display
 */
export async function getQuickStats(
  supabase: TypedSupabaseClient,
  merchantId: string,
): Promise<{
  success: boolean;
  data?: {
    today_orders: number;
    today_revenue_usd: number;
    pending_orders: number;
    week_orders: number;
    week_revenue_usd: number;
  };
  error?: string;
}> {
  try {
    const now = new Date();

    // Today start
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // Week start (Monday)
    const weekStart = new Date(now);
    const day = weekStart.getDay();
    const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);

    // Run all queries in parallel
    const [todayResult, weekResult, pendingResult] = await Promise.all([
      // Today's completed orders
      supabase
        .from("orders")
        .select("required_amount_usd")
        .eq("merchant_id", merchantId)
        .eq("status", "COMPLETED")
        .gte("created_at", todayStart.toISOString()),

      // This week's completed orders
      supabase
        .from("orders")
        .select("required_amount_usd")
        .eq("merchant_id", merchantId)
        .eq("status", "COMPLETED")
        .gte("created_at", weekStart.toISOString()),

      // Pending orders count (lightweight count query)
      supabase
        .from("orders")
        .select("order_id", { count: "exact", head: true })
        .eq("merchant_id", merchantId)
        .in("status", ["PENDING", "PROCESSING"]),
    ]);

    if (todayResult.error) {
      return { success: false, error: todayResult.error.message };
    }

    if (weekResult.error) {
      return { success: false, error: weekResult.error.message };
    }

    const todayOrders = todayResult.data || [];
    const weekOrders = weekResult.data || [];

    return {
      success: true,
      data: {
        today_orders: todayOrders.length,
        today_revenue_usd: parseFloat(
          todayOrders.reduce((sum, o) => sum + (o.required_amount_usd || 0), 0).toFixed(2)
        ),
        pending_orders: pendingResult.count || 0,
        week_orders: weekOrders.length,
        week_revenue_usd: parseFloat(
          weekOrders.reduce((sum, o) => sum + (o.required_amount_usd || 0), 0).toFixed(2)
        ),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get top currencies for a merchant
 */
export async function getTopCurrencies(
  supabase: TypedSupabaseClient,
  merchantId: string,
  limit = 5,
): Promise<{
  success: boolean;
  data?: Array<{ currency: string; total_amount: number; order_count: number }>;
  error?: string;
}> {
  try {
    const { data: orders, error } = await supabase
      .from("orders")
      .select("display_currency, display_amount")
      .eq("merchant_id", merchantId)
      .eq("status", "COMPLETED");

    if (error) {
      return { success: false, error: error.message };
    }

    // Aggregate by currency
    const currencyStats: Record<string, { total: number; count: number }> = {};

    for (const order of orders || []) {
      const currency = order.display_currency || "USD";
      if (!currencyStats[currency]) {
        currencyStats[currency] = { total: 0, count: 0 };
      }
      currencyStats[currency].total += order.display_amount || 0;
      currencyStats[currency].count++;
    }

    // Convert to array and sort
    const result = Object.entries(currencyStats)
      .map(([currency, stats]) => ({
        currency,
        total_amount: parseFloat(stats.total.toFixed(2)),
        order_count: stats.count,
      }))
      .sort((a, b) => b.total_amount - a.total_amount)
      .slice(0, limit);

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
