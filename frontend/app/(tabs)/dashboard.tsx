import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api, DashboardStats, Lead, Task } from '../../src/api';
import { colors, formatINR, radius, spacing, tempColor, typography } from '../../src/theme';
import { useAuth } from '../../src/auth';

export default function Dashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentLeads, setRecentLeads] = useState<Lead[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, l, t] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/leads'),
        api.get('/tasks'),
      ]);
      setStats(s.data);
      setRecentLeads((l.data as Lead[]).slice(0, 4));
      setUpcomingTasks((t.data as Task[]).filter((x) => !x.completed).slice(0, 4));
    } catch (e) {
      console.warn('dashboard load', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loaderWrap}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        testID="dashboard-scroll"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Hi, {user?.name?.split(' ')[0] || 'Agent'} 👋</Text>
            <Text style={styles.greetingSub}>Here&apos;s what&apos;s happening today</Text>
          </View>
          <TouchableOpacity style={styles.avatar} onPress={() => router.push('/(tabs)/more')} testID="open-profile">
            <Text style={styles.avatarText}>{(user?.name?.[0] || 'A').toUpperCase()}</Text>
          </TouchableOpacity>
        </View>

        {/* KPI cards */}
        <View style={styles.kpiGrid}>
          <KpiCard
            label="Total Leads"
            value={String(stats?.total_leads ?? 0)}
            icon="people"
            tint={colors.primary}
            testID="kpi-leads"
          />
          <KpiCard
            label="Hot Leads"
            value={String(stats?.hot_leads ?? 0)}
            icon="flame"
            tint={colors.hot}
            testID="kpi-hot"
          />
          <KpiCard
            label="Revenue"
            value={formatINR(stats?.revenue || 0)}
            icon="trending-up"
            tint={colors.won}
            testID="kpi-revenue"
          />
          <KpiCard
            label="Pipeline"
            value={formatINR(stats?.pipeline_value || 0)}
            icon="layers"
            tint={colors.cold}
            testID="kpi-pipeline"
          />
        </View>

        {/* Conversion strip */}
        <View style={styles.strip}>
          <View style={styles.stripItem}>
            <Text style={styles.stripLabel}>Properties</Text>
            <Text style={styles.stripValue}>{stats?.available_properties}/{stats?.properties}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.stripItem}>
            <Text style={styles.stripLabel}>Conversion</Text>
            <Text style={[styles.stripValue, { color: colors.primary }]}>{stats?.conversion_rate}%</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.stripItem}>
            <Text style={styles.stripLabel}>Today&apos;s tasks</Text>
            <Text style={styles.stripValue}>{stats?.tasks_today}</Text>
          </View>
        </View>

        {/* Lead temperature bar */}
        <View style={styles.section}>
          <Text style={typography.h3}>Lead Temperature</Text>
          <View style={styles.tempCard} testID="temp-bar">
            {(['hot', 'warm', 'cold'] as const).map((t) => {
              const v = stats?.leads_by_temperature[t] || 0;
              const total = stats?.total_leads || 1;
              const pct = Math.round((v / total) * 100);
              const c = tempColor(t);
              return (
                <View key={t} style={styles.tempRow}>
                  <View style={[styles.tempDot, { backgroundColor: c.fg }]} />
                  <Text style={styles.tempLabel}>{t.toUpperCase()}</Text>
                  <View style={styles.tempBarBg}>
                    <View style={[styles.tempBarFg, { backgroundColor: c.fg, width: `${pct}%` }]} />
                  </View>
                  <Text style={styles.tempCount}>{v}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Recent leads */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={typography.h3}>Recent Leads</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/leads')} testID="see-all-leads">
              <Text style={styles.linkText}>See all</Text>
            </TouchableOpacity>
          </View>
          {recentLeads.map((l) => (
            <TouchableOpacity
              key={l.id}
              style={styles.leadRow}
              onPress={() => router.push(`/lead/${l.id}`)}
              testID={`dashboard-lead-${l.id}`}
            >
              <View style={[styles.leadAvatar, { backgroundColor: tempColor(l.temperature).bg }]}>
                <Text style={[styles.leadInitial, { color: tempColor(l.temperature).fg }]}>
                  {l.name[0]?.toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.leadName}>{l.name}</Text>
                <Text style={styles.leadSub}>{l.interest || l.source}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: tempColor(l.temperature).bg }]}>
                <Text style={[styles.badgeText, { color: tempColor(l.temperature).fg }]}>{l.temperature}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Upcoming tasks */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={typography.h3}>Upcoming Tasks</Text>
            <TouchableOpacity onPress={() => router.push('/tasks')} testID="see-all-tasks">
              <Text style={styles.linkText}>See all</Text>
            </TouchableOpacity>
          </View>
          {upcomingTasks.length === 0 ? (
            <Text style={typography.body}>You&apos;re all caught up 🎉</Text>
          ) : (
            upcomingTasks.map((t) => (
              <View key={t.id} style={styles.taskRow} testID={`dashboard-task-${t.id}`}>
                <View style={[styles.taskIcon, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons
                    name={t.type === 'Call' ? 'call' : t.type === 'Site Visit' ? 'location' : 'briefcase'}
                    size={16}
                    color={colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.leadName}>{t.title}</Text>
                  <Text style={styles.leadSub}>
                    {t.related_to ? `${t.related_to} • ` : ''}
                    {new Date(t.due_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: t.priority === 'high' ? colors.hotBg : colors.glass }]}>
                  <Text style={[styles.badgeText, { color: t.priority === 'high' ? colors.hot : colors.textSecondary }]}>
                    {t.priority}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function KpiCard({
  label, value, icon, tint, testID,
}: { label: string; value: string; icon: any; tint: string; testID?: string }) {
  return (
    <View style={styles.kpi} testID={testID}>
      <View style={[styles.kpiIcon, { backgroundColor: `${tint}22` }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  scroll: { padding: spacing.md, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, paddingTop: 8 },
  greeting: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  greetingSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: spacing.md },
  kpi: {
    width: '48%',
    backgroundColor: colors.bg2,
    borderRadius: radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kpiIcon: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  kpiValue: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  kpiLabel: { fontSize: 12, color: colors.textMuted, marginTop: 4, fontWeight: '600' },
  strip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bg2,
    borderRadius: radius.xl,
    padding: 16,
    borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  stripItem: { flex: 1, alignItems: 'center' },
  stripLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  stripValue: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 4 },
  divider: { width: 1, height: 30, backgroundColor: colors.border },
  section: { marginBottom: spacing.lg },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  linkText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  tempCard: {
    backgroundColor: colors.bg2,
    borderRadius: radius.xl,
    padding: 16,
    borderWidth: 1, borderColor: colors.border,
    marginTop: 8,
    gap: 12,
  },
  tempRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tempDot: { width: 8, height: 8, borderRadius: 4 },
  tempLabel: { width: 50, fontSize: 11, fontWeight: '700', color: colors.textSecondary, letterSpacing: 1 },
  tempBarBg: { flex: 1, height: 6, backgroundColor: colors.surface, borderRadius: 3, overflow: 'hidden' },
  tempBarFg: { height: 6, borderRadius: 3 },
  tempCount: { color: colors.text, fontWeight: '800', minWidth: 24, textAlign: 'right' },
  leadRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bg2,
    borderRadius: radius.lg,
    padding: 12,
    borderWidth: 1, borderColor: colors.border,
    marginBottom: 8,
    gap: 12,
  },
  leadAvatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  leadInitial: { fontWeight: '800', fontSize: 16 },
  leadName: { color: colors.text, fontWeight: '700', fontSize: 14 },
  leadSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  taskRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bg2,
    borderRadius: radius.lg,
    padding: 12,
    borderWidth: 1, borderColor: colors.border,
    marginBottom: 8,
    gap: 12,
  },
  taskIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
