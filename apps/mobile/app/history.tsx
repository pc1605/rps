import { useState } from "react";
import { Pressable, RefreshControl, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { BackIcon, ForwardIcon } from "../components/ui/BackIcon";
import { Banner } from "../components/ui/Banner";
import { Card } from "../components/ui/Card";
import { Screen } from "../components/ui/Screen";
import { ScreenHeader } from "../components/ui/ScreenHeader";
import { Skeleton } from "../components/ui/Skeleton";
import { Stat } from "../components/ui/Stat";
import { addMonths, parseDay, parseMonth, todayString } from "../features/me/dates";
import { useMyHistory } from "../features/me/hooks";
import { useStrings } from "../lib/language";
import { useOnline } from "../lib/use-online";

function HistorySkeleton() {
  return (
    <View style={styles.skeleton}>
      <Skeleton width="30%" height={44} />
      <Skeleton width="45%" height={16} />
      <Card style={styles.skeletonRows}>
        {[0, 1, 2, 3].map((key) => (
          <View key={key} style={styles.skeletonRow}>
            <Skeleton width="30%" height={18} />
            <Skeleton width="12%" height={18} />
          </View>
        ))}
      </Card>
    </View>
  );
}

/**
 * Work history (M1, D42): the worker's own count per day of a month, opened from the home "My work" card.
 * The same numbers the admin sees for this worker. Counts only — never ₹ (D40).
 */
export default function History() {
  const strings = useStrings();
  const isOnline = useOnline();
  // null = the current month (the server says which one it is); a past month is "YYYY-MM".
  const [month, setMonth] = useState<string | null>(null);
  const current = useMyHistory(null);
  const { data, isPending, isError, isRefetching, refetch } = useMyHistory(month);

  const currentMonth = current.data?.month;
  const shownMonth = month ?? currentMonth;
  const firstMonth = data?.first_month ?? current.data?.first_month;
  const canGoBack = !!shownMonth && !!firstMonth && shownMonth > firstMonth;
  const canGoForward = month !== null;

  const goBack = () => {
    if (shownMonth) setMonth(addMonths(shownMonth, -1));
  };
  const goForward = () => {
    if (!month) return;
    const next = addMonths(month, 1);
    setMonth(currentMonth && next < currentMonth ? next : null);
  };

  let monthLabel = "";
  if (shownMonth) {
    const { year, monthIndex } = parseMonth(shownMonth);
    monthLabel = `${strings.history.months[monthIndex] ?? ""} ${year}`;
  }
  const today = todayString();
  const unit = data ? (strings.myWork.unit[data.station] ?? data.unit) : "";

  return (
    <Screen
      header={<ScreenHeader back title={strings.myWork.title} />}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
    >
      {!isOnline && <Banner kind="warning" text={strings.common.offline} />}

      <View style={styles.monthRow}>
        <Pressable
          onPress={goBack}
          disabled={!canGoBack}
          style={[styles.monthBtn, !canGoBack && styles.monthBtnOff]}
          accessibilityRole="button"
          accessibilityLabel={strings.history.previousMonth}
          accessibilityState={{ disabled: !canGoBack }}
        >
          <BackIcon />
        </Pressable>
        <Text style={styles.monthLabel} accessibilityRole="header">
          {monthLabel}
        </Text>
        <Pressable
          onPress={goForward}
          disabled={!canGoForward}
          style={[styles.monthBtn, !canGoForward && styles.monthBtnOff]}
          accessibilityRole="button"
          accessibilityLabel={strings.history.nextMonth}
          accessibilityState={{ disabled: !canGoForward }}
        >
          <ForwardIcon />
        </Pressable>
      </View>

      {data ? (
        <>
          <View style={styles.total}>
            <Stat big value={data.total} label={unit} />
            <Text style={styles.daysWorked}>{strings.history.daysWorked(data.days_worked)}</Text>
          </View>
          {data.days.length === 0 ? (
            <Text style={styles.empty}>{strings.history.empty}</Text>
          ) : (
            <Card style={styles.days}>
              {[...data.days].reverse().map((d, i) => {
                const { date, weekday } = parseDay(d.day);
                return (
                  <View key={d.day} style={[styles.dayRow, i > 0 && styles.dayRowBorder]}>
                    <View style={styles.dayLeft}>
                      <Text style={styles.dayText}>
                        {strings.history.weekdays[weekday] ?? ""} {date}
                      </Text>
                      {d.day === today && <Text style={styles.todayText}>{strings.myWork.today}</Text>}
                    </View>
                    <Text style={styles.dayCount}>{d.mats}</Text>
                  </View>
                );
              })}
            </Card>
          )}
        </>
      ) : isError ? (
        <Banner
          kind="danger"
          text={strings.history.loadFailed}
          actionLabel={strings.common.retry}
          onAction={() => refetch()}
        />
      ) : isPending && isOnline ? (
        <HistorySkeleton />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  monthRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
  monthBtn: {
    minWidth: theme.touch.min,
    minHeight: theme.touch.min,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
  },
  monthBtnOff: { opacity: 0.35 },
  monthLabel: { ...theme.text.heading, color: theme.colors.text, flex: 1, textAlign: "center" },
  total: { gap: theme.spacing.xxs },
  daysWorked: { ...theme.text.small, color: theme.colors.textMuted },
  empty: {
    ...theme.text.body,
    color: theme.colors.textMuted,
    textAlign: "center",
    paddingVertical: theme.spacing.lg,
  },
  days: { paddingVertical: theme.spacing.xxs },
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  dayRowBorder: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  dayLeft: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    columnGap: theme.spacing.xs,
    flexShrink: 1,
  },
  dayText: { ...theme.text.bodyMed, color: theme.colors.text },
  todayText: { ...theme.text.caption, color: theme.colors.accent },
  dayCount: { ...theme.text.heading, color: theme.colors.text, fontVariant: ["tabular-nums"] },
  skeleton: { gap: theme.spacing.sm },
  skeletonRows: { gap: theme.spacing.md },
  skeletonRow: { flexDirection: "row", justifyContent: "space-between" },
}));
