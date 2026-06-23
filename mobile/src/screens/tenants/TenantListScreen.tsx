import React, { useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Searchbar, Card, Text, Avatar, useTheme, SegmentedButtons } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../services/api';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

type TenantListScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Main'>;

interface TenantListScreenProps {
  navigation: TenantListScreenNavigationProp;
}

export default function TenantListScreen({ navigation }: TenantListScreenProps) {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');

  // Fetch tenants
  const { data: tenants, isLoading, refetch, isRefetching } = useQuery<any[]>({
    queryKey: ['tenantsList', searchQuery, statusFilter],
    queryFn: async () => {
      const response = await apiClient.get('/tenants', {
        params: {
          search: searchQuery || undefined,
          status: statusFilter,
        },
      });
      return response.data;
    },
  });

  const renderTenantItem = ({ item }: { item: any }) => {
    return (
      <Card
        style={styles.card}
        onPress={() => navigation.navigate('TenantProfile', { tenantId: item.id })}
      >
        <Card.Content style={styles.cardContent}>
          <View style={styles.leftSection}>
            <Avatar.Image
              size={50}
              source={{ uri: item.profilePhotoUrl || 'https://via.placeholder.com/150' }}
            />
            <View style={styles.infoSection}>
              <Text variant="titleMedium" style={styles.tenantName}>{item.name}</Text>
              <Text variant="bodySmall" style={styles.tenantSub}>📞 {item.phone}</Text>
              <Text variant="bodySmall" style={styles.tenantSub}>
                🏠 {item.room.branch.name} • Room {item.room.roomNumber}
              </Text>
            </View>
          </View>

          <View style={styles.rightSection}>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: item.status === 'ACTIVE' ? '#D1FAE5' : '#FEE2E2',
                },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  {
                    color: item.status === 'ACTIVE' ? '#065F46' : '#B91C1C',
                  },
                ]}
              >
                {item.status}
              </Text>
            </View>
            <Icon name="chevron-right" size={24} color="#94A3B8" style={{ marginTop: 8 }} />
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Searchbar
        placeholder="Search tenants..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
        elevation={1}
      />

      <View style={styles.filterWrapper}>
        <SegmentedButtons
          value={statusFilter}
          onValueChange={setStatusFilter}
          buttons={[
            { value: 'ACTIVE', label: 'Active' },
            { value: 'VACATED', label: 'Vacated' },
          ]}
        />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <Text>Loading tenants...</Text>
        </View>
      ) : (
        <FlatList
          data={tenants}
          keyExtractor={(item) => item.id}
          renderItem={renderTenantItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[theme.colors.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="account-search-outline" size={64} color="#94A3B8" />
              <Text variant="titleMedium" style={styles.emptyTitle}>No Tenants Found</Text>
              <Text variant="bodyMedium" style={styles.emptyDesc}>Try adjusting search queries or status filters.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBar: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  filterWrapper: {
    marginHorizontal: 16,
    marginVertical: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  card: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  infoSection: {
    marginLeft: 16,
    flex: 1,
  },
  tenantName: {
    fontWeight: '800',
    color: '#0F172A',
  },
  tenantSub: {
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
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
});
