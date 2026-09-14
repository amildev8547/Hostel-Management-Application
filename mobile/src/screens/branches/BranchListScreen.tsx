import React, { useState } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Searchbar, Card, Text, FAB, useTheme } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../services/api';
import { NativeStackNavigationProp as StackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import ManualRefreshControl from '../../components/ManualRefreshControl';

type BranchListScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Main'>;

interface BranchListScreenProps {
  navigation: BranchListScreenNavigationProp;
}

export default function BranchListScreen({ navigation }: BranchListScreenProps) {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: branches, isLoading, refetch } = useQuery<any[]>({
    queryKey: ['branchesList', searchQuery],
    queryFn: async () => {
      const response = await apiClient.get('/branches', {
        params: { search: searchQuery || undefined },
      });
      return response.data;
    },
  });

  const renderBranchItem = ({ item }: { item: any }) => {
    const hasPendingRent = Number(item.pendingPayments) > 0;
    const availableBeds = Number(item.vacantBeds) || 0;
    const totalBeds = Number(item.totalBeds) || 0;
    const hasAvailableBeds = availableBeds > 0;
    const bedsInUse = Math.max(0, totalBeds - availableBeds);
    const rooms = Number(item.totalRooms) || 0;
    return (
      <Card
        style={styles.card}
        onPress={() => navigation.navigate('BranchDashboard', { branchId: item.id, branchName: item.name })}
      >
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.branchIcon}>
              <Icon name="office-building-outline" size={23} color="#4F46E5" />
            </View>
            <View style={styles.cardHeaderText}>
              <Text variant="titleLarge" style={styles.branchName}>{item.name}</Text>
              <View style={styles.addressRow}>
                <Icon name="map-marker-outline" size={15} color="#64748B" />
                <Text variant="bodySmall" style={styles.branchAddress}>{item.address}</Text>
              </View>
            </View>
            <View style={[styles.badge, { backgroundColor: item.status === 'ACTIVE' ? '#D1FAE5' : '#F3F4F6' }]}>
              <Text style={[styles.badgeText, { color: item.status === 'ACTIVE' ? '#065F46' : '#475569' }]}>
                {item.status === 'ACTIVE' ? 'Open' : 'Closed'}
              </Text>
            </View>
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.availabilityRow}>
              <View style={[styles.bedIcon, !hasAvailableBeds && styles.bedIconFull]}>
                <Icon name="bed-empty" size={24} color={hasAvailableBeds ? '#059669' : '#64748B'} />
              </View>
              <View style={styles.availabilityCopy}>
                {totalBeds === 0 ? (
                  <Text style={styles.noAvailabilityLabel}>No beds added yet</Text>
                ) : hasAvailableBeds ? (
                  <Text style={styles.availabilitySentence}>
                    <Text style={styles.availabilityValue}>{availableBeds}</Text> {availableBeds === 1 ? 'bed is free' : 'beds are free'}
                  </Text>
                ) : (
                  <Text style={styles.noAvailabilityLabel}>All beds are in use</Text>
                )}
              </View>
            </View>
            <View style={styles.detailsRow}>
              <View style={styles.detailItem}>
                <Icon name="door-open" size={18} color="#64748B" />
                <Text style={styles.detailSentence}>{rooms} {rooms === 1 ? 'room' : 'rooms'}</Text>
              </View>
              <View style={styles.detailDivider} />
              <View style={styles.detailItem}>
                <Icon name="account-check-outline" size={18} color="#64748B" />
                <Text style={styles.detailSentence}>{bedsInUse === 0 ? 'No beds are in use' : `${bedsInUse} ${bedsInUse === 1 ? 'bed is' : 'beds are'} in use`}</Text>
              </View>
            </View>
          </View>

          <View style={styles.cardFooter}>
            <View style={styles.rentRow}>
              <Icon name={hasPendingRent ? 'cash-clock' : 'cash-check'} size={17} color={hasPendingRent ? '#DC2626' : '#059669'} />
              <Text style={[styles.footerText, { color: hasPendingRent ? '#DC2626' : '#047857' }]}>
                {hasPendingRent ? `Rent still due: ₹${item.pendingPayments}` : 'Rent is up to date'}
              </Text>
            </View>
            <View style={styles.chevron}><Icon name="chevron-right" size={20} color="#4F46E5" /></View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.introBox}>
        <View style={styles.introIcon}><Icon name="office-building-marker-outline" size={25} color="#4F46E5" /></View>
        <View style={styles.introCopy}>
          <Text style={styles.introTitle}>Your hostel branches</Text>
          <Text style={styles.introText}>View rooms, beds and rent status for every location.</Text>
        </View>
      </View>
      <Searchbar
        placeholder="Search hostel branches…"
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
        elevation={1}
      />

      {isLoading ? (
        <View style={styles.center}>
          <Text>Loading branches...</Text>
        </View>
      ) : (
        <FlatList
          data={branches}
          keyExtractor={(item) => item.id}
          renderItem={renderBranchItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <ManualRefreshControl onRefresh={refetch} color={theme.colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="office-building-marker-outline" size={64} color="#94A3B8" />
              <Text variant="titleMedium" style={styles.emptyTitle}>No hostel branches found</Text>
              <Text variant="bodyMedium" style={styles.emptyDesc}>Add your first hostel location to get started.</Text>
            </View>
          }
        />
      )}

      <FAB
        icon="plus"
        label="Add Branch"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color="#FFFFFF"
        onPress={() => navigation.navigate('BranchForm', {})}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBar: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  card: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  introBox: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 16, padding: 15, backgroundColor: '#EEF2FF', borderRadius: 16 },
  introIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  introCopy: { flex: 1 },
  introTitle: { color: '#312E81', fontSize: 17, fontWeight: '800' },
  introText: { color: '#64748B', fontSize: 13, lineHeight: 18, marginTop: 2 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  branchIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  cardHeaderText: {
    flex: 1,
    marginRight: 8,
  },
  branchName: {
    fontWeight: '800',
    color: '#0F172A',
  },
  branchAddress: {
    color: '#64748B',
    flex: 1,
    fontWeight: '500',
  },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statsContainer: {
    backgroundColor: '#F1F5F9',
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  availabilityRow: { flexDirection: 'row', alignItems: 'center' },
  bedIcon: { width: 46, height: 46, borderRadius: 13, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  bedIconFull: { backgroundColor: '#E2E8F0' },
  availabilityCopy: { flex: 1 },
  availabilitySentence: { color: '#065F46', fontSize: 16, fontWeight: '700' },
  availabilityValue: { color: '#047857', fontSize: 26, lineHeight: 32, fontWeight: '900' },
  noAvailabilityLabel: { color: '#475569', fontSize: 15, fontWeight: '700' },
  detailsRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#E2E8F0', marginTop: 12, paddingTop: 12 },
  detailItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailDivider: { width: 1, height: 22, backgroundColor: '#CBD5E1', marginHorizontal: 12 },
  detailSentence: { color: '#334155', fontSize: 12, lineHeight: 17, fontWeight: '700', flexShrink: 1 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    paddingTop: 12,
    marginTop: 4,
  },
  rentRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  chevron: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  footerText: {
    fontSize: 13,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontWeight: '700',
    color: '#475569',
    marginTop: 12,
  },
  emptyDesc: {
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
});
