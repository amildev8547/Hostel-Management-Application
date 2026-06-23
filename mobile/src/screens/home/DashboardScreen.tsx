import React from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, Surface, Card, Avatar, Button, useTheme, IconButton } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../services/api';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { showAlert } from '../../utils/alerts';

type DashboardScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Main'>;

interface DashboardScreenProps {
  navigation: DashboardScreenNavigationProp;
}

export default function DashboardScreen({ navigation }: DashboardScreenProps) {
  const theme = useTheme();

  const { data: dashboardData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['dashboardMetrics'],
    queryFn: async () => {
      const response = await apiClient.get('/dashboard');
      return response.data;
    },
  });

  const metrics = dashboardData?.metrics || {
    totalBranches: 0,
    totalRooms: 0,
    totalCapacity: 0,
    occupiedBeds: 0,
    vacantBeds: 0,
    occupancyPercentage: 0,
    monthlyCollection: 0,
    pendingCollection: 0,
    overdueCollection: 0,
    pendingAdmissions: 0,
  };

  const recentActivities = dashboardData?.recentActivities || {
    recentAdmissions: [],
    recentPayments: [],
    recentAllocations: [],
  };

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <Text>Loading Dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[theme.colors.primary]} />
      }
    >
      {/* 1. Occupancy Analytics Card */}
      <Card style={styles.heroCard}>
        <Card.Content>
          <View style={styles.heroHeader}>
            <View>
              <Text variant="titleMedium" style={{ color: '#E2E8F0', opacity: 0.8 }}>Overall Occupancy</Text>
              <Text variant="displaySmall" style={styles.heroOccupancyText}>
                {metrics.occupancyPercentage}%
              </Text>
            </View>
            <View style={styles.heroBedsStat}>
              <Text style={styles.heroBedSubText}>
                🛏️ {metrics.occupiedBeds} / {metrics.totalCapacity} Beds occupied
              </Text>
              <Text style={styles.heroBedSubText}>
                🔑 {metrics.vacantBeds} Beds vacant
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* 2. Basic Analytics Grid */}
      <View style={styles.grid}>
        <Surface style={styles.gridCell} elevation={1}>
          <Icon name="office-building" size={24} color={theme.colors.primary} />
          <Text variant="titleLarge" style={styles.gridVal}>{metrics.totalBranches}</Text>
          <Text variant="bodySmall" style={styles.gridLabel}>Branches</Text>
        </Surface>

        <Surface style={styles.gridCell} elevation={1}>
          <Icon name="door-open" size={24} color={theme.colors.primary} />
          <Text variant="titleLarge" style={styles.gridVal}>{metrics.totalRooms}</Text>
          <Text variant="bodySmall" style={styles.gridLabel}>Rooms</Text>
        </Surface>

        <Surface style={styles.gridCell} elevation={1}>
          <Icon name="account-clock" size={24} color={(theme.colors as any).warning} />
          <Text variant="titleLarge" style={[styles.gridVal, { color: (theme.colors as any).warning }]}>
            {metrics.pendingAdmissions}
          </Text>
          <Text variant="bodySmall" style={styles.gridLabel}>Pending Apply</Text>
        </Surface>
      </View>

      {/* 3. Rent Collections Surface */}
      <Surface style={styles.collectionCard} elevation={1}>
        <View style={styles.sectionHeader}>
          <Text variant="titleMedium" style={{ fontWeight: '700' }}>Rent Collections (This Month)</Text>
          <IconButton icon="chevron-right" size={20} onPress={() => navigation.navigate('PaymentsDashboard', {})} />
        </View>
        <View style={styles.paymentsGrid}>
          <View style={styles.paymentCell}>
            <Text style={[styles.paymentLabel, { color: (theme.colors as any).success }]}>Collected</Text>
            <Text variant="titleMedium" style={{ fontWeight: '700' }}>₹{metrics.monthlyCollection}</Text>
          </View>
          <View style={[styles.paymentCell, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#E2E8F0' }]}>
            <Text style={[styles.paymentLabel, { color: (theme.colors as any).warning }]}>Pending</Text>
            <Text variant="titleMedium" style={{ fontWeight: '700' }}>₹{metrics.pendingCollection}</Text>
          </View>
          <View style={styles.paymentCell}>
            <Text style={[styles.paymentLabel, { color: theme.colors.error }]}>Overdue</Text>
            <Text variant="titleMedium" style={{ fontWeight: '700' }}>₹{metrics.overdueCollection}</Text>
          </View>
        </View>
      </Surface>

      {/* 4. Quick Actions */}
      <Text variant="titleMedium" style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsGrid}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('BranchForm', {})}>
          <Surface style={styles.actionIconWrapper} elevation={1}>
            <Icon name="plus-box-outline" size={24} color={theme.colors.primary} />
          </Surface>
          <Text variant="labelMedium" style={styles.actionLabel}>Add Branch</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => {
            if (metrics.totalBranches === 0) {
              showAlert('Please create a branch first!');
            } else {
              navigation.navigate('Main', { screen: 'Branches' } as any);
            }
          }}
        >
          <Surface style={styles.actionIconWrapper} elevation={1}>
            <Icon name="door-closed-lock" size={24} color={theme.colors.primary} />
          </Surface>
          <Text variant="labelMedium" style={styles.actionLabel}>Add Room</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Main', { screen: 'Admissions' } as any)}>
          <Surface style={styles.actionIconWrapper} elevation={1}>
            <Icon name="file-account-outline" size={24} color={theme.colors.primary} />
          </Surface>
          <Text variant="labelMedium" style={styles.actionLabel}>Admissions</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('PaymentsDashboard', {})}>
          <Surface style={styles.actionIconWrapper} elevation={1}>
            <Icon name="cash-multiple" size={24} color={theme.colors.primary} />
          </Surface>
          <Text variant="labelMedium" style={styles.actionLabel}>Collections</Text>
        </TouchableOpacity>
      </View>

      {/* 5. Recent Activities */}
      <Text variant="titleMedium" style={styles.sectionTitle}>Recent Activity</Text>

      {/* New Admissions */}
      {recentActivities.recentAdmissions.length > 0 && (
        <Card style={styles.activityCard}>
          <Card.Content>
            <View style={styles.activityHeader}>
              <Icon name="account-arrow-right" size={20} color={theme.colors.primary} />
              <Text style={styles.activityHeading}>New Pending Admissions</Text>
            </View>
            {recentActivities.recentAdmissions.map((adm: any) => (
              <TouchableOpacity
                key={adm.id}
                style={styles.activityRow}
                onPress={() => navigation.navigate('AdmissionReview', { applicationId: adm.id })}
              >
                <View>
                  <Text style={styles.activityTextBold}>{adm.name}</Text>
                  <Text style={styles.activitySubText}>{adm.preferredRoomType} • {adm.branch.name}</Text>
                </View>
                <Text style={[styles.badge, { backgroundColor: '#FEE2E2', color: '#EF4444' }]}>
                  {adm.paymentStatus}
                </Text>
              </TouchableOpacity>
            ))}
          </Card.Content>
        </Card>
      )}

      {/* Payments Received */}
      {recentActivities.recentPayments.length > 0 && (
        <Card style={styles.activityCard}>
          <Card.Content>
            <View style={styles.activityHeader}>
              <Icon name="check-decagram-outline" size={20} color={(theme.colors as any).success} />
              <Text style={styles.activityHeading}>Payments Received</Text>
            </View>
            {recentActivities.recentPayments.map((pay: any) => (
              <View key={pay.id} style={styles.activityRow}>
                <View>
                  <Text style={styles.activityTextBold}>₹{pay.amount}</Text>
                  <Text style={styles.activitySubText}>
                    {pay.tenant?.name || pay.admissionApplication?.name || 'Tenant'} ({pay.paymentType})
                  </Text>
                </View>
                <Text style={[styles.badge, { backgroundColor: '#D1FAE5', color: '#065F46' }]}>
                  {pay.paymentMethod}
                </Text>
              </View>
            ))}
          </Card.Content>
        </Card>
      )}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    marginBottom: 16,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    rowGap: 8,
  },
  heroOccupancyText: {
    fontWeight: '900',
    color: '#38BDF8',
    marginTop: 4,
  },
  heroBedsStat: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 1,
    maxWidth: '58%',
  },
  heroBedSubText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'right',
    flexShrink: 1,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  gridCell: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  gridVal: {
    fontWeight: '800',
    marginVertical: 4,
  },
  gridLabel: {
    color: '#64748B',
    fontWeight: '500',
  },
  collectionCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  paymentsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  paymentCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  paymentLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionTitle: {
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
    marginTop: 8,
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  actionBtn: {
    alignItems: 'center',
    flex: 1,
  },
  actionIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginBottom: 6,
  },
  actionLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  activityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    paddingBottom: 8,
  },
  activityHeading: {
    fontWeight: '700',
    fontSize: 14,
    color: '#1E293B',
    marginLeft: 8,
  },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#F8FAFC',
  },
  activityTextBold: {
    fontWeight: '700',
    fontSize: 14,
    color: '#334155',
  },
  activitySubText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  badge: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
});
