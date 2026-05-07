import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator, Image,
  TextInput, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api, Property } from '../../src/api';
import { colors, formatINR, radius, spacing, typography } from '../../src/theme';

const TYPES = ['All', 'Apartment', 'Villa', 'Plot', 'Office'];

export default function PropertiesList() {
  const router = useRouter();
  const [items, setItems] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [bedrooms, setBedrooms] = useState('');

  const load = useCallback(async () => {
    try {
      const params: any = {};
      if (search) params.search = search;
      if (type !== 'All') params.type = type;
      if (minPrice) params.min_price = Number(minPrice);
      if (maxPrice) params.max_price = Number(maxPrice);
      if (bedrooms) params.bedrooms = Number(bedrooms);
      const { data } = await api.get('/properties', { params });
      setItems(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, type, minPrice, maxPrice, bedrooms]);

  useEffect(() => {
    const t = setTimeout(load, 250); // debounce search
    return () => clearTimeout(t);
  }, [load]);

  const activeFilters = [
    minPrice && `≥${formatINR(Number(minPrice))}`,
    maxPrice && `≤${formatINR(Number(maxPrice))}`,
    bedrooms && `${bedrooms} BHK`,
  ].filter(Boolean);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={typography.h1}>Properties</Text>
        <TouchableOpacity style={styles.fabBtn} onPress={() => router.push('/property/new')} testID="add-property-fab">
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by title, location…"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          testID="properties-search-input"
        />
        <TouchableOpacity
          onPress={() => setShowFilters((s) => !s)}
          style={[styles.filterBtn, (activeFilters.length > 0 || showFilters) && { backgroundColor: colors.primaryLight }]}
          testID="properties-filter-btn"
        >
          <Ionicons name="options" size={16} color={activeFilters.length > 0 ? colors.primary : colors.textSecondary} />
          {activeFilters.length > 0 ? <View style={styles.filterDot} /> : null}
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        {TYPES.map((t) => {
          const active = type === t;
          return (
            <TouchableOpacity
              key={t}
              onPress={() => setType(t)}
              style={[styles.chip, active && styles.chipActive]}
              testID={`prop-type-${t}`}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{t}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {showFilters ? (
        <View style={styles.filterPanel}>
          <Text style={styles.filterTitle}>Advanced filters</Text>
          <View style={styles.filterRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.filterLabel}>Min price (₹)</Text>
              <TextInput
                style={styles.filterInput}
                value={minPrice}
                onChangeText={setMinPrice}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                testID="filter-min-price"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.filterLabel}>Max price (₹)</Text>
              <TextInput
                style={styles.filterInput}
                value={maxPrice}
                onChangeText={setMaxPrice}
                placeholder="∞"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                testID="filter-max-price"
              />
            </View>
          </View>
          <View>
            <Text style={styles.filterLabel}>Bedrooms (exact)</Text>
            <View style={styles.bedRow}>
              {['', '1', '2', '3', '4', '5'].map((b) => (
                <TouchableOpacity
                  key={b || 'any'}
                  style={[styles.bedChip, bedrooms === b && styles.chipActive]}
                  onPress={() => setBedrooms(b)}
                  testID={`filter-bed-${b || 'any'}`}
                >
                  <Text style={[styles.chipText, bedrooms === b && styles.chipTextActive]}>{b || 'Any'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={() => { setMinPrice(''); setMaxPrice(''); setBedrooms(''); }}
            testID="filter-clear"
          >
            <Text style={styles.clearText}>Clear filters</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loaderWrap}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 80 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
          ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
          ListEmptyComponent={<Text style={[typography.body, { textAlign: 'center', marginTop: 40 }]}>No properties match</Text>}
          ListHeaderComponent={
            <Text style={styles.count}>
              {items.length} {items.length === 1 ? 'property' : 'properties'}
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/property/${item.id}`)}
              testID={`property-card-${item.id}`}
            >
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.image} resizeMode="cover" />
              ) : (
                <View style={[styles.image, styles.imagePlaceholder]}>
                  <Ionicons name="business" size={36} color={colors.textMuted} />
                </View>
              )}
              <View style={styles.statusBadge}>
                <View style={[styles.statusDot, {
                  backgroundColor: item.status === 'Available' ? colors.won : item.status === 'Sold' ? colors.hot : colors.warm,
                }]} />
                <Text style={styles.statusText}>{item.status}</Text>
              </View>

              <View style={styles.body}>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                <View style={styles.locRow}>
                  <Ionicons name="location" size={12} color={colors.textMuted} />
                  <Text style={styles.loc}>{item.location}</Text>
                </View>
                <Text style={styles.price}>{formatINR(item.price)}</Text>
                <View style={styles.featuresRow}>
                  {item.bedrooms > 0 ? <Feature icon="bed" v={`${item.bedrooms} BHK`} /> : null}
                  {item.bathrooms > 0 ? <Feature icon="water" v={`${item.bathrooms} bath`} /> : null}
                  <Feature icon="resize" v={`${item.area_sqft} sqft`} />
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function Feature({ icon, v }: { icon: any; v: string }) {
  return (
    <View style={styles.feature}>
      <Ionicons name={icon} size={12} color={colors.primary} />
      <Text style={styles.featureText}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingTop: 8, marginBottom: 8 },
  fabBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.bg2, borderRadius: radius.pill,
    marginHorizontal: spacing.md, marginTop: 4, paddingHorizontal: 14, paddingRight: 4,
    borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, color: colors.text, paddingVertical: 12, fontSize: 14 },
  filterBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  filterDot: { position: 'absolute', top: 6, right: 6, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  chipsRow: { paddingHorizontal: spacing.md, paddingVertical: 12, gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontWeight: '700', fontSize: 12 },
  chipTextActive: { color: '#fff' },
  filterPanel: {
    backgroundColor: colors.bg2, borderRadius: radius.xl,
    marginHorizontal: spacing.md, padding: 16,
    borderWidth: 1, borderColor: colors.border,
    gap: 12, marginBottom: 8,
  },
  filterTitle: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
  filterRow: { flexDirection: 'row', gap: 12 },
  filterLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '600', marginBottom: 6 },
  filterInput: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 10,
    color: colors.text, fontSize: 13,
    borderWidth: 1, borderColor: colors.border,
  },
  bedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  bedChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  clearBtn: { alignSelf: 'flex-end', padding: 6 },
  clearText: { color: colors.textMuted, fontWeight: '600', fontSize: 12 },
  count: { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 12, marginLeft: 4 },
  card: {
    backgroundColor: colors.bg2, borderRadius: radius.xl,
    overflow: 'hidden', borderWidth: 1, borderColor: colors.border,
  },
  image: { width: '100%', height: 180, backgroundColor: colors.surface },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  statusBadge: {
    position: 'absolute', top: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { color: colors.text, fontWeight: '700', fontSize: 11 },
  body: { padding: 14 },
  title: { color: colors.text, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  loc: { color: colors.textMuted, fontSize: 12 },
  price: { color: colors.primary, fontSize: 20, fontWeight: '800', marginTop: 8 },
  featuresRow: { flexDirection: 'row', gap: 12, marginTop: 8, flexWrap: 'wrap' },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  featureText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
});
