import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Share, Clipboard, FlatList } from 'react-native';
import { Text, Surface, Card, Button, useTheme, SegmentedButtons, List, Divider } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../services/api';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { occupancyColors, occupancyLabels } from '../../theme';
import { showAlert } from '../../utils/alerts';
import { getApplyUrl } from '../../utils/backendUrl';

type BranchDashboardRouteProp = RouteProp<RootStackParamList, 'BranchDashboard'>;
type BranchDashboardNavigationProp = StackNavigationProp<RootStackParamList, 'BranchDashboard'>;

interface BranchDashboardScreenProps {
  route: BranchDashboardRouteProp;
  navigation: BranchDashboardNavigationProp;
}

export default function BranchDashboardScreen({ route, navigation }: BranchDashboardScreenProps) {
  const { branchId } = route.params;
  const theme = useTheme();
  const [activeSegment, setActiveSegment] = useState('overview');

  // Fetch branch dashboard data
  const { data: dashboardData, isLoading: dashboardLoading, refetch: refetchDashboard, isRefetching: isRefetchingDashboard } = useQuery({
    queryKey: ['branchDashboard', branchId],
    queryFn: async () => {
      const response = await apiClient.get(`/branches/${branchId}/dashboard`);
      return response.data;
    },
  });

  // Fetch rooms list for this branch
  const { data: rooms, isLoading: roomsLoading, refetch: refetchRooms, isRefetching: isRefetchingRooms } = useQuery<any[]>({
    queryKey: ['branchRooms', branchId],
    queryFn: async () => {
      const response = await apiClient.get('/rooms', { params: { branchId } });
      return response.data;
    },
  });

  const metrics = dashboardData?.metrics || {
    totalRooms: 0,
    vacantRooms: 0,
    partialRooms: 0,
    occupiedRooms: 0,
    totalBeds: 0,
    occupiedBeds: 0,
    vacantBeds: 0,
    occupancyPercentage: 0,
    thisMonthPaid: 0,
    pendingPayments: 0,
    overduePayments: 0,
  };

  const handleShareAdmissionLink = async () => {
    const applyLink = getApplyUrl(branchId);

    try {
      const result = await Share.share({
        message: `Hello! Please apply for admission at our hostel using this link:\n${applyLink}`,
        title: 'HostelHub Admission Form',
      });
      if (result.action === Share.sharedAction) {
        console.log('Link shared successfully');
      }
    } catch (error) {
      console.error('Error sharing link:', error);
    }
  };

  const handleCopyLink = () => {
    const applyLink = getApplyUrl(branchId);
    Clipboard.setString(applyLink);
    showAlert('Admission link copied to clipboard!');
  };

  const handleShowQRCode = () => {
    navigation.navigate('QRCode', { branchId, branchName: dashboardData?.branch?.name || route.params.branchName });
  };

  if (dashboardLoading) {
    return (
      <View style={styles.center}>
        <Text>Loading Branch Dashboard...</Text>
      </View>
    );
  }

  const handleRefreshAll = () => {
    refetchDashboard();
    refetchRooms();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.tabContainer}>
        <SegmentedButtons
          value={activeSegment}
          onValueChange={setActiveSegment}
          buttons={[
            { value: 'overview', label: 'Overview', icon: 'view-dashboard-outline' },
            { value: 'rooms', label: 'Rooms List', icon: 'door-open' },
          ]}
          theme={{ colors: { primary: theme.colors.primary } }}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetchingDashboard || isRefetchingRooms}
            onRefresh={handleRefreshAll}
            colors={[theme.colors.primary]}
          />
        }
      >
        {activeSegment === 'overview' ? (
          <>
            {/* 1. Bed metrics */}
            <Surface style={styles.statsCard} elevation={1}>
              <Text variant="titleMedium" style={styles.cardTitle}>Bed Capacity</Text>
              <View style={styles.bedsStatRow}>
                <View style={styles.bedsStatCell}>
                  <Text variant="titleLarge" style={{ fontWeight: '800', color: theme.colors.primary }}>
                    {metrics.totalBeds}
                  </Text>
                  <Text variant="bodySmall" style={styles.bedsStatLabel}>Total Beds</Text>
                </View>
                <View style={styles.bedsStatCell}>
                  <Text variant="titleLarge" style={{ fontWeight: '800', color: (theme.colors as any).success }}>
                    {metrics.occupiedBeds}
                  </Text>
                  <Text variant="bodySmall" style={styles.bedsStatLabel}>Occupied</Text>
                </View>
                <View style={styles.bedsStatCell}>
                  <Text variant="titleLarge" style={{ fontWeight: '800', color: (theme.colors as any).warning }}>
                    {metrics.vacantBeds}
                  </Text>
                  <Text variant="bodySmall" style={styles.bedsStatLabel}>Vacant</Text>
                </View>
              </View>
            </Surface>

            {/* 2. Room States */}
            <Surface style={styles.statsCard} elevation={1}>
              <Text variant="titleMedium" style={styles.cardTitle}>Rooms Status</Text>
              <View style={styles.roomsStateRow}>
                <View style={[styles.roomCell, { borderColor: '#E2E8F0', borderRightWidth: 1 }]}>
                  <Text variant="titleMedium" style={{ fontWeight: '800', color: (theme.colors as any).success }}>
                    {metrics.vacantRooms}
                  </Text>
                  <Text variant="bodySmall" style={styles.roomCellLabel}>Vacant</Text>
                </View>
                <View style={[styles.roomCell, { borderColor: '#E2E8F0', borderRightWidth: 1 }]}>
                  <Text variant="titleMedium" style={{ fontWeight: '800', color: (theme.colors as any).warning }}>
                    {metrics.partialRooms}
                  </Text>
                  <Text variant="bodySmall" style={styles.roomCellLabel}>Partial</Text>
                </View>
                <View style={styles.roomCell}>
                  <Text variant="titleMedium" style={{ fontWeight: '800', color: theme.colors.error }}>
                    {metrics.occupiedRooms}
                  </Text>
                  <Text variant="bodySmall" style={styles.roomCellLabel}>Full</Text>
                </View>
              </View>
            </Surface>

            {/* 3. Payments */}
            <Surface style={styles.statsCard} elevation={1}>
              <Text variant="titleMedium" style={styles.cardTitle}>Branch Collections</Text>
              <View style={styles.paymentsGrid}>
                <View style={styles.paymentCell}>
                  <Text style={[styles.paymentLabel, { color: (theme.colors as any).success }]}>Paid</Text>
                  <Text variant="titleMedium" style={{ fontWeight: '700' }}>₹{metrics.thisMonthPaid}</Text>
                </View>
                <View style={[styles.paymentCell, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#E2E8F0' }]}>
                  <Text style={[styles.paymentLabel, { color: (theme.colors as any).warning }]}>Pending</Text>
                  <Text variant="titleMedium" style={{ fontWeight: '700' }}>₹{metrics.pendingPayments}</Text>
                </View>
                <View style={styles.paymentCell}>
                  <Text style={[styles.paymentLabel, { color: theme.colors.error }]}>Overdue</Text>
                  <Text variant="titleMedium" style={{ fontWeight: '700' }}>₹{metrics.overduePayments}</Text>
                </View>
              </View>
            </Surface>

            {/* 4. Quick Actions */}
            <Text variant="titleMedium" style={styles.sectionTitle}>Branch Actions</Text>
            <View style={styles.actionsGrid}>
              <Button
                mode="outlined"
                icon="qrcode"
                onPress={handleShowQRCode}
                style={styles.actionBtn}
                contentStyle={{ paddingVertical: 4 }}
              >
                Show QR Code
              </Button>
              <Button
                mode="outlined"
                icon="share-variant"
                onPress={handleShareAdmissionLink}
                style={styles.actionBtn}
                contentStyle={{ paddingVertical: 4 }}
              >
                Share Form
              </Button>
            </View>

            <View style={styles.actionsGrid}>
              <Button
                mode="outlined"
                icon="link-variant"
                onPress={handleCopyLink}
                style={styles.actionBtn}
                contentStyle={{ paddingVertical: 4 }}
              >
                Copy Apply Link
              </Button>
              <Button
                mode="outlined"
                icon="plus"
                onPress={() => navigation.navigate('RoomForm', { branchId })}
                style={styles.actionBtn}
                contentStyle={{ paddingVertical: 4 }}
              >
                Add Room
              </Button>
            </View>

            <View style={styles.actionsGrid}>
              <Button
                mode="outlined"
                icon="cash-multiple"
                onPress={() => navigation.navigate('PaymentsDashboard', { branchId })}
                style={styles.actionBtn}
                contentStyle={{ paddingVertical: 4 }}
              >
                Payments
              </Button>
            </View>

            {/* 5. Branch Settings */}
            <Button
              mode="contained-tonal"
              icon="pencil"
              onPress={() => navigation.navigate('BranchForm', { branchId })}
              style={{ marginTop: 8 }}
            >
              Edit Branch Information
            </Button>
          </>
        ) : (
          /* Rooms List Segment */
          <View>
            {roomsLoading ? (
              <Text>Loading Rooms...</Text>
            ) : rooms && rooms.length > 0 ? (
              rooms.map((room: any) => {
                const statusColor = occupancyColors[room.status as keyof typeof occupancyColors] || '#64748B';
                return (
                  <Card
                    key={room.id}
                    style={styles.roomCard}
                    onPress={() => navigation.navigate('RoomDetails', { roomId: room.id })}
                  >
                    <Card.Content style={styles.roomCardContent}>
                      <View style={styles.roomLeft}>
                        <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
                        <View style={styles.roomLeftText}>
                          <Text variant="titleMedium" style={{ fontWeight: '800' }}>
                            Room {room.roomNumber}
                          </Text>
                          <Text variant="bodySmall" style={{ color: '#64748B' }}>
                            {room.floor} • {room.roomType}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.roomRight}>
                        <Text variant="titleMedium" style={{ fontWeight: '700', color: theme.colors.primary }}>
                          ₹{room.monthlyRent}
                        </Text>
                        <Text variant="bodySmall" style={{ color: '#64748B' }}>
                          🛏️ {room.occupied} / {room.capacity} occupied
                        </Text>
                      </View>
                    </Card.Content>
                  </Card>
                );
              })
            ) : (
              <View style={styles.emptyRooms}>
                <Icon name="door-closed" size={48} color="#94A3B8" />
                <Text style={{ marginTop: 8, color: '#64748B', fontWeight: '600' }}>No rooms in this branch.</Text>
                <Button
                  mode="contained"
                  style={{ marginTop: 12 }}
                  onPress={() => navigation.navigate('RoomForm', { branchId })}
                >
                  Create First Room
                </Button>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  statsCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  cardTitle: {
    fontWeight: '700',
    color: '#334155',
    marginBottom: 12,
  },
  bedsStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bedsStatCell: {
    flex: 1,
    alignItems: 'center',
  },
  bedsStatLabel: {
    color: '#64748B',
    marginTop: 4,
    fontWeight: '600',
  },
  roomsStateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  roomCell: {
    flex: 1,
    alignItems: 'center',
  },
  roomCellLabel: {
    color: '#64748B',
    marginTop: 4,
    fontWeight: '600',
  },
  paymentsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  paymentCell: {
    flex: 1,
    alignItems: 'center',
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
    gap: 12,
    marginBottom: 12,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roomCard: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  roomCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  roomLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  roomLeftText: {
    flexShrink: 1,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  roomRight: {
    alignItems: 'flex-end',
  },
  emptyRooms: {
    alignItems: 'center',
    paddingVertical: 40,
  },
});
