import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, FlatList, RefreshControl,
  TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api, Lead } from '../../src/api';
import { colors, formatINR, radius, spacing, tempColor, typography } from '../../src/theme';

const FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'hot', label: 'Hot' },
  { key: 'warm', label: 'Warm' },
  { key: 'cold', label: 'Cold' },
];

export default function LeadsList() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const params: any = {};
      if (filter !== 'all') params.temperature = filter;
      const { data } = await api.get('/leads', { params });
      setLeads(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = leads.filter(
    (l) => !search || l.name.toLowerCase().includes(search.toLowerCase()) || (l.interest || '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={typography.h1}>Leads</Text>
        <TouchableOpacity style={styles.fabBtn} onPress={() => router.push('/lead/new')} testID="add-lead-fab">
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search leads…"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          testID="leads-search-input"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.chip, active && styles.chipActive]}
              testID={`leads-filter-${f.key}`}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 80 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={<Text style={[typography.body, { textAlign: 'center', marginTop: 40 }]}>No leads found</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/lead/${item.id}`)}
              testID={`lead-card-${item.id}`}
            >
              <View style={styles.cardTop}>
                <View style={[styles.avatar, { backgroundColor: tempColor(item.temperature).bg }]}>
                  <Text style={[styles.avatarText, { color: tempColor(item.temperature).fg }]}>
                    {item.name[0]?.toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.sub}>{item.phone}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: tempColor(item.temperature).bg }]}>
                  <Text style={[styles.badgeText, { color: tempColor(item.temperature).fg }]}>{item.temperature}</Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <View style={styles.meta}>
                  <Ionicons name="pricetag" size={12} color={colors.textMuted} />
                  <Text style={styles.metaText}>{item.source}</Text>
                </View>
                <View style={styles.meta}>
                  <Ionicons name="cash" size={12} color={colors.textMuted} />
                  <Text style={styles.metaText}>{formatINR(item.budget)}</Text>
                </View>
                <View style={styles.meta}>
                  <Ionicons name="checkmark-circle" size={12} color={colors.textMuted} />
                  <Text style={styles.metaText}>{item.status}</Text>
                </View>
              </View>

              {item.interest ? (
                <Text style={styles.interest} numberOfLines={1}>📍 {item.interest}</Text>
              ) : null}
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingTop: 8 },
  fabBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.bg2, borderRadius: radius.pill,
    marginHorizontal: spacing.md, marginTop: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, color: colors.text, paddingVertical: 12, fontSize: 14 },
  chipsRow: { padding: spacing.md, gap: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999,
    backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontWeight: '700', fontSize: 12 },
  chipTextActive: { color: '#fff' },
  card: {
    backgroundColor: colors.bg2,
    borderRadius: radius.xl,
    padding: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '800', fontSize: 16 },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  metaRow: { flexDirection: 'row', gap: 14, marginTop: 12, flexWrap: 'wrap' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: colors.textSecondary, fontSize: 11 },
  interest: { color: colors.textSecondary, fontSize: 13, marginTop: 8 },
});
