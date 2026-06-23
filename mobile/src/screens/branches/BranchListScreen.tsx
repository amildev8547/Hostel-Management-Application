import React, { useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { Searchbar, Card, Text, FAB, useTheme, Surface } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../services/api';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

type BranchListScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Main'>;

interface BranchListScreenProps {
  navigation: BranchListScreenNavigationProp;
}

export default function BranchListScreen({ navigation }: BranchListScreenProps) {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: branches, isLoading, refetch, isRefetching } = useQuery<any[]>({
    queryKey: ['branchesList', searchQuery],
    queryFn: async () => {
      const response = await apiClient.get('/branches', {
        params: { search: searchQuery || undefined },
      });
      return response.data;
    },
  });

  const renderBranchItem = ({ item }: { item: any }) => {
    return (
      <Card
        style={styles.card}
        onPress={() => navigation.navigate('BranchDashboard', { branchId: item.id, branchName: item.name })}
      >
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderText}>
              <Text variant="titleLarge" style={styles.branchName}>{item.name}</Text>
              <Text variant="bodySmall" style={styles.branchAddress}>📍 {item.address}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: item.status === 'ACTIVE' ? '#D1FAE5' : '#F3F4F6' }]}>
              <Text style={[styles.badgeText, { color: item.status === 'ACTIVE' ? '#065F46' : '#475569' }]}>
                {item.status}
              </Text>
            </View>
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text variant="titleMedium" style={styles.statVal}>{item.totalRooms}</Text>
              <Text variant="bodySmall" style={styles.statLabel}>Rooms</Text>
            </View>
            <View style={styles.statBox}>
              <Text variant="titleMedium" style={styles.statVal}>{item.occupancyPercentage}%</Text>
              <Text variant="bodySmall" style={styles.statLabel}>Occupancy</Text>
            </View>
            <View style={styles.statBox}>
              <Text variant="titleMedium" style={styles.statVal}>{item.vacantBeds}</Text>
              <Text variant="bodySmall" style={styles.statLabel}>Vacant Beds</Text>
            </View>
          </View>

          <View style={styles.cardFooter}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Icon name="cash-remove" size={16} color={theme.colors.error} />
              <Text style={[styles.footerText, { color: theme.colors.error, fontWeight: '700', marginLeft: 4 }]}>
                Unpaid: ₹{item.pendingPayments}
              </Text>
            </View>
            <Icon name="chevron-right" size={20} color="#64748B" />
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Searchbar
        placeholder="Search branches..."
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
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[theme.colors.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="office-building-marker-outline" size={64} color="#94A3B8" />
              <Text variant="titleMedium" style={styles.emptyTitle}>No Branches Found</Text>
              <Text variant="bodyMedium" style={styles.emptyDesc}>Get started by creating your first hostel branch.</Text>
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
    margin: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  card: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
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
    marginTop: 4,
    fontWeight: '500',
  },
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statVal: {
    fontWeight: '800',
    color: '#1E293B',
  },
  statLabel: {
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    paddingTop: 12,
    marginTop: 4,
  },
  footerText: {
    fontSize: 13,
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
