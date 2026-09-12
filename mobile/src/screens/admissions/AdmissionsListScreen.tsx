import React, { useState } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Searchbar, Card, Text, useTheme, SegmentedButtons, Button, IconButton } from 'react-native-paper';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../services/api';
import { NativeStackNavigationProp as StackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { showAlert, showConfirm } from '../../utils/alerts';
import { invalidateHostelData } from '../../utils/queryInvalidation';
import ManualRefreshControl from '../../components/ManualRefreshControl';

type AdmissionsListScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Main'>;

interface AdmissionsListScreenProps {
  navigation: AdmissionsListScreenNavigationProp;
}

export default function AdmissionsListScreen({ navigation }: AdmissionsListScreenProps) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch admission applications
  const { data: applications, isLoading, refetch } = useQuery<any[]>({
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
    refetchOnMount: 'always',
  });

  const deleteApplication = (application: any) => {
    showConfirm(
      `Delete ${application.name}’s application? Its fee and document records will be removed. Any linked advance booking will stay reserved so they can correct and resubmit the form.`,
      async () => {
        setDeletingId(application.id);
        try {
          const response = await apiClient.delete(`/admissions/${application.id}`);
          await invalidateHostelData(queryClient, {
            branchId: application.branchId,
            applicationId: application.id,
          });
          await queryClient.invalidateQueries({ queryKey: ['bookings'] });
          await refetch();
          showAlert(response.data?.message || 'Application deleted.', 'Application deleted');
        } catch (err: any) {
          showAlert(err.response?.data?.error || 'Could not delete this application.');
        } finally {
          setDeletingId(null);
        }
      },
      { title: 'Delete application?', confirmText: 'Delete application', destructive: true },
    );
  };

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
                🏠 {item.branch?.name || 'Branch not available'} • {item.preferredRoomType || 'Room type not selected'}
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
                Joining fee: {item.paymentStatus === 'PAID' ? 'Paid' : 'Not paid'}
              </Text>
            </View>
            <View style={styles.cardActions}>
              {item.status !== 'APPROVED' && (
                <IconButton
                  icon="delete-outline"
                  iconColor={theme.colors.error}
                  size={21}
                  disabled={deletingId === item.id}
                  loading={deletingId === item.id}
                  accessibilityLabel={`Delete ${item.name}'s application`}
                  onPress={() => deleteApplication(item)}
                />
              )}
              <Icon name="chevron-right" size={24} color="#94A3B8" />
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.introBox}>
        <Text style={styles.introTitle}>Admissions and advance bookings</Text>
        <Text style={styles.introText}>Review completed admission forms below. To reserve a room before the person fills the form, open advance bookings.</Text>
        <Button mode="contained" icon="bed" style={styles.bookingButton} onPress={() => navigation.navigate('BookingList')}>Manage advance bookings</Button>
      </View>
      <Searchbar
        placeholder="Search people who applied…"
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
            { value: 'PENDING', label: 'Waiting' },
            { value: 'APPROVED', label: 'Accepted' },
            { value: 'REJECTED', label: 'Not accepted' },
          ]}
        />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <Text>Loading applications…</Text>
        </View>
      ) : (
        <FlatList
          data={applications}
          keyExtractor={(item) => item.id}
          renderItem={renderApplicationItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <ManualRefreshControl onRefresh={refetch} color={theme.colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="account-arrow-right-outline" size={64} color="#94A3B8" />
              <Text variant="titleMedium" style={styles.emptyTitle}>No applications found</Text>
              <Text variant="bodyMedium" style={styles.emptyDesc}>Try another name or choose a different option above.</Text>
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
  introBox: { marginHorizontal: 16, marginTop: 16, padding: 16, backgroundColor: '#FEF3C7', borderRadius: 16 },
  introTitle: { color: '#78350F', fontSize: 18, fontWeight: '800' },
  introText: { color: '#57534E', fontSize: 14, lineHeight: 20, marginTop: 4 },
  bookingButton: { borderRadius: 12, marginTop: 12, minHeight: 46, justifyContent: 'center' },
  searchBar: {
    marginHorizontal: 16,
    marginTop: 12,
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
    paddingVertical: 14,
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
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
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
