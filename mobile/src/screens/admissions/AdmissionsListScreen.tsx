import React, { useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Searchbar, Card, Text, useTheme, SegmentedButtons } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../services/api';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

type AdmissionsListScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Main'>;

interface AdmissionsListScreenProps {
  navigation: AdmissionsListScreenNavigationProp;
}

export default function AdmissionsListScreen({ navigation }: AdmissionsListScreenProps) {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('PENDING');

  // Fetch admission applications
  const { data: applications, isLoading, refetch, isRefetching } = useQuery<any[]>({
    queryKey: ['admissionsList', searchQuery, statusFilter],
    queryFn: async () => {
      const response = await apiClient.get('/admissions', {
        params: {
          search: searchQuery || undefined,
          status: statusFilter,
        },
      });
      return response.data;
    },
  });

  const renderApplicationItem = ({ item }: { item: any }) => {
    return (
      <Card
        style={styles.card}
        onPress={() => navigation.navigate('AdmissionReview', { applicationId: item.id })}
      >
        <Card.Content style={styles.cardContent}>
          <View style={styles.leftSection}>
            <View style={styles.infoSection}>
              <Text variant="titleMedium" style={styles.applicantName}>{item.name}</Text>
              <Text variant="bodySmall" style={styles.applicantSub}>📞 {item.phone}</Text>
              <Text variant="bodySmall" style={styles.applicantSub}>
                🏠 {item.branch.name} • {item.preferredRoomType} Sharing
              </Text>
              <Text variant="bodySmall" style={{ color: '#94A3B8', marginTop: 4 }}>
                Join Date: {new Date(item.joiningDate).toLocaleDateString()}
              </Text>
            </View>
          </View>

          <View style={styles.rightSection}>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: item.paymentStatus === 'PAID' ? '#D1FAE5' : '#FEF3C7',
                },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  {
                    color: item.paymentStatus === 'PAID' ? '#065F46' : '#D97706',
                  },
                ]}
              >
                Fee: {item.paymentStatus}
              </Text>
            </View>
            <Icon name="chevron-right" size={24} color="#94A3B8" style={{ marginTop: 14 }} />
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Searchbar
        placeholder="Search applications..."
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
            { value: 'PENDING', label: 'Pending' },
            { value: 'APPROVED', label: 'Approved' },
            { value: 'REJECTED', label: 'Rejected' },
          ]}
        />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <Text>Loading applications...</Text>
        </View>
      ) : (
        <FlatList
          data={applications}
          keyExtractor={(item) => item.id}
          renderItem={renderApplicationItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[theme.colors.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="account-arrow-right-outline" size={64} color="#94A3B8" />
              <Text variant="titleMedium" style={styles.emptyTitle}>No Applications Found</Text>
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
    flex: 1,
  },
  applicantName: {
    fontWeight: '800',
    color: '#0F172A',
  },
  applicantSub: {
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
    fontSize: 9,
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
