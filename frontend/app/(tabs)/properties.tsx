import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api, Property } from '../../src/api';
import { colors, formatINR, radius, spacing, typography } from '../../src/theme';

export default function PropertiesList() {
  const router = useRouter();
  const [items, setItems] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await api.get('/properties');
    setItems(data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={typography.h1}>Properties</Text>
        <TouchableOpacity style={styles.fabBtn} onPress={() => router.push('/property/new')} testID="add-property-fab">
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loaderWrap}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 80 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
          ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
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
                  <Feature icon="bed" v={`${item.bedrooms} BHK`} />
                  <Feature icon="water" v={`${item.bathrooms} bath`} />
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
  card: {
    backgroundColor: colors.bg2,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1, borderColor: colors.border,
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
  featuresRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  featureText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
});
