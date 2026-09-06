import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Share, Clipboard, FlatList } from 'react-native';
import { Text, Surface, Card, Button, useTheme, SegmentedButtons, List, Divider } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../services/api';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp as StackNavigationProp } from '@react-navigation/native-stack';
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

type RoomFilter = 'all' | 'occupiedBeds' | 'vacantBeds' | 'AVAILABLE' | 'PARTIAL' | 'FULL';

const roomFilterLabels: Record<RoomFilter, string> = {
  all: 'All rooms',
  occupiedBeds: 'Rooms with people staying',
  vacantBeds: 'Rooms with a free bed',
  AVAILABLE: 'Empty rooms',
  PARTIAL: 'Rooms with some beds free',
  FULL: 'Rooms with no beds free',
};

export default function BranchDashboardScreen({ route, navigation }: BranchDashboardScreenProps) {
  const { branchId } = route.params;
  const theme = useTheme();
  const [activeSegment, setActiveSegment] = useState('overview');
  const [roomFilter, setRoomFilter] = useState<RoomFilter>('all');

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
    reservedBeds: 0,
    vacantBeds: 0,
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

  const showRooms = (filter: RoomFilter) => {
    setRoomFilter(filter);
    setActiveSegment('rooms');
  };

  const filteredRooms = (rooms || []).filter((room: any) => {
    if (roomFilter === 'all') return true;
    if (roomFilter === 'occupiedBeds') return room.occupied > 0;
    if (roomFilter === 'vacantBeds') return room.vacant > 0;
    return room.status === roomFilter;
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.tabContainer}>
        <SegmentedButtons
          value={activeSegment}
          onValueChange={setActiveSegment}
          buttons={[
            { value: 'overview', label: 'Overview', icon: 'view-dashboard-outline' },
            { value: 'rooms', label: 'View Rooms', icon: 'door-open' },
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
              <Text variant="titleMedium" style={styles.cardTitle}>Beds</Text>
              <Text style={styles.cardHint}>Tap a number to see matching rooms.</Text>
              <View style={styles.bedsStatRow}>
                <TouchableOpacity style={styles.bedsStatCell} onPress={() => showRooms('all')} accessibilityRole="button">
                  <Text variant="titleLarge" style={{ fontWeight: '800', color: theme.colors.primary }}>
                    {metrics.totalBeds}
                  </Text>
                  <Text variant="bodySmall" style={styles.bedsStatLabel}>All beds</Text>
                  <Text style={styles.tapLabel}>View rooms</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.bedsStatCell} onPress={() => showRooms('occupiedBeds')} accessibilityRole="button">
                  <Text variant="titleLarge" style={{ fontWeight: '800', color: (theme.colors as any).success }}>
                    {metrics.occupiedBeds}
                  </Text>
                  <Text variant="bodySmall" style={styles.bedsStatLabel}>Beds in use</Text>
                  <Text style={styles.tapLabel}>View rooms</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.bedsStatCell} onPress={() => showRooms('vacantBeds')} accessibilityRole="button">
                  <Text variant="titleLarge" style={{ fontWeight: '800', color: (theme.colors as any).warning }}>
                    {metrics.vacantBeds}
                  </Text>
                  <Text variant="bodySmall" style={styles.bedsStatLabel}>Free beds</Text>
                  <Text style={styles.tapLabel}>View rooms</Text>
                </TouchableOpacity>
              </View>
            </Surface>

            {/* 2. Room States */}
            <Surface style={styles.statsCard} elevation={1}>
              <Text variant="titleMedium" style={styles.cardTitle}>Rooms by availability</Text>
              <Text style={styles.cardHint}>Tap a type to open that list.</Text>
              <View style={styles.roomsStateRow}>
                <TouchableOpacity style={styles.roomCell} onPress={() => showRooms('all')} accessibilityRole="button">
                  <Text variant="titleMedium" style={{ fontWeight: '800', color: theme.colors.primary }}>{metrics.totalRooms}</Text>
                  <Text variant="bodySmall" style={styles.roomCellLabel}>All</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.roomCell} onPress={() => showRooms('AVAILABLE')} accessibilityRole="button">
                  <Text variant="titleMedium" style={{ fontWeight: '800', color: (theme.colors as any).success }}>
                    {metrics.vacantRooms}
                  </Text>
                  <Text variant="bodySmall" style={styles.roomCellLabel}>Empty</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.roomCell} onPress={() => showRooms('PARTIAL')} accessibilityRole="button">
                  <Text variant="titleMedium" style={{ fontWeight: '800', color: (theme.colors as any).warning }}>
                    {metrics.partialRooms}
                  </Text>
                  <Text variant="bodySmall" style={styles.roomCellLabel}>Some free</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.roomCell} onPress={() => showRooms('FULL')} accessibilityRole="button">
                  <Text variant="titleMedium" style={{ fontWeight: '800', color: theme.colors.error }}>
                    {metrics.occupiedRooms}
                  </Text>
                  <Text variant="bodySmall" style={styles.roomCellLabel}>No beds</Text>
                </TouchableOpacity>
              </View>
            </Surface>

            {/* 3. Payments */}
            <Surface style={styles.statsCard} elevation={1}>
              <Text variant="titleMedium" style={styles.cardTitle}>Branch Collections</Text>
              <View style={styles.paymentsGrid}>
                <View style={styles.paymentCell}>
                  <Text style={[styles.paymentLabel, { color: (theme.colors as any).success }]}>Received</Text>
                  <Text variant="titleMedium" style={{ fontWeight: '700' }}>₹{metrics.thisMonthPaid}</Text>
                </View>
                <View style={[styles.paymentCell, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#E2E8F0' }]}>
                  <Text style={[styles.paymentLabel, { color: (theme.colors as any).warning }]}>Still due</Text>
                  <Text variant="titleMedium" style={{ fontWeight: '700' }}>₹{metrics.pendingPayments}</Text>
                </View>
                <View style={styles.paymentCell}>
                  <Text style={[styles.paymentLabel, { color: theme.colors.error }]}>Late</Text>
                  <Text variant="titleMedium" style={{ fontWeight: '700' }}>₹{metrics.overduePayments}</Text>
                </View>
              </View>
            </Surface>

            {/* 4. Quick Actions */}
            <Text variant="titleMedium" style={styles.sectionTitle}>Branch Actions</Text>
            <Surface style={styles.actionPanel} elevation={1}>
              <ActionRow icon="bed" title="Book a bed" detail="Reserve a place for someone" onPress={() => navigation.navigate('BookingForm', { branchId })} />
              <ActionRow icon="qrcode" title="Show application QR code" detail="Let a person scan and apply" onPress={handleShowQRCode} />
              <ActionRow icon="share-variant" title="Share application form" detail="Send the form using another app" onPress={handleShareAdmissionLink} />
              <ActionRow icon="link-variant" title="Copy application link" detail="Copy the form address" onPress={handleCopyLink} />
              <ActionRow icon="plus" title="Add a room" detail="Create another room in this branch" onPress={() => navigation.navigate('RoomForm', { branchId })} />
              <ActionRow icon="cash-multiple" title="Rent payments" detail="Check received and pending rent" onPress={() => navigation.navigate('PaymentsDashboard', { branchId })} />
              <ActionRow icon="pencil" title="Edit branch" detail="Change branch information" onPress={() => navigation.navigate('BranchForm', { branchId })} last />
            </Surface>
          </>
        ) : (
          /* Rooms List Segment */
          <View>
            <View style={styles.resultsHeader}>
              <View style={styles.resultsTitleWrap}>
                <Text variant="titleLarge" style={styles.resultsTitle}>{roomFilterLabels[roomFilter]}</Text>
                <Text style={styles.resultsCount}>{filteredRooms.length} {filteredRooms.length === 1 ? 'room' : 'rooms'} found</Text>
              </View>
              {roomFilter !== 'all' && <Button mode="text" onPress={() => setRoomFilter('all')}>Show all</Button>}
            </View>
            {metrics.reservedBeds > 0 && (
              <TouchableOpacity style={styles.reservedNotice} onPress={() => navigation.navigate('BookingList')} accessibilityRole="button">
                <Icon name="bed" size={21} color="#7C3AED" />
                <Text style={styles.reservedNoticeText}>{metrics.reservedBeds} {metrics.reservedBeds === 1 ? 'bed is' : 'beds are'} reserved · View bookings</Text>
                <Icon name="chevron-right" size={21} color="#7C3AED" />
              </TouchableOpacity>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {(['all', 'AVAILABLE', 'PARTIAL', 'FULL'] as RoomFilter[]).map((filter) => (
                <Button key={filter} mode={roomFilter === filter ? 'contained' : 'outlined'} compact={false} onPress={() => setRoomFilter(filter)} style={styles.filterButton}>
                  {filter === 'all' ? 'All' : filter === 'AVAILABLE' ? 'Empty' : filter === 'PARTIAL' ? 'Some free' : 'No beds free'}
                </Button>
              ))}
            </ScrollView>
            {roomsLoading ? (
              <Text>Loading Rooms...</Text>
            ) : filteredRooms.length > 0 ? (
              filteredRooms.map((room: any) => {
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

                      <View style={styles.roomRight}><Text variant="bodyMedium" style={{ fontWeight: '700', color: theme.colors.primary }}>Rent: ₹{room.monthlyRent} / month</Text><Icon name="chevron-right" size={23} color="#94A3B8" /></View>
                      <Text variant="bodySmall" style={styles.bedSummary}>{room.occupied} in use · {room.reserved || 0} reserved · {room.vacant} free</Text>
                    </Card.Content>
                  </Card>
                );
              })
            ) : (
              <View style={styles.emptyRooms}>
                <Icon name="door-closed" size={48} color="#94A3B8" />
                <Text style={{ marginTop: 8, color: '#64748B', fontWeight: '600' }}>{rooms?.length ? 'No rooms match this filter.' : 'No rooms in this branch.'}</Text>
                {!!rooms?.length && <Button mode="outlined" style={{ marginTop: 12 }} onPress={() => setRoomFilter('all')}>Show all rooms</Button>}
                {!rooms?.length && (
                <Button
                  mode="contained"
                  style={{ marginTop: 12 }}
                  onPress={() => navigation.navigate('RoomForm', { branchId })}
                >
                  Create First Room
                </Button>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function ActionRow({ icon, title, detail, onPress, last = false }: { icon: keyof typeof Icon.glyphMap; title: string; detail: string; onPress: () => void; last?: boolean }) {
  return <TouchableOpacity style={[styles.actionRow, !last && styles.actionRowBorder]} onPress={onPress} accessibilityRole="button">
    <View style={styles.actionIcon}><Icon name={icon} size={23} color="#4F46E5" /></View>
    <View style={styles.actionText}><Text style={styles.actionTitle}>{title}</Text><Text style={styles.actionDetail}>{detail}</Text></View>
    <Icon name="chevron-right" size={24} color="#94A3B8" />
  </TouchableOpacity>;
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
    marginBottom: 2,
  },
  cardHint: { color: '#64748B', fontSize: 13, marginBottom: 14 },
  bedsStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bedsStatCell: {
    flex: 1,
    alignItems: 'center',
    minHeight: 82,
    justifyContent: 'center',
    borderRadius: 12,
    paddingHorizontal: 4,
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
    minHeight: 68,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  roomCellLabel: {
    color: '#64748B',
    marginTop: 4,
    fontWeight: '600',
    textAlign: 'center',
  },
  tapLabel: { color: '#4F46E5', fontSize: 11, fontWeight: '700', marginTop: 5 },
  reservedNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F3E8FF', padding: 12, borderRadius: 12, marginBottom: 12 },
  reservedNoticeText: { flex: 1, color: '#6B21A8', fontSize: 13, fontWeight: '800' },
  resultsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  resultsTitleWrap: { flex: 1, minWidth: 0 },
  resultsTitle: { color: '#0F172A', fontWeight: '800' },
  resultsCount: { color: '#64748B', fontSize: 14, marginTop: 3 },
  filterRow: { gap: 8, paddingBottom: 16 },
  filterButton: { borderRadius: 12 },
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
  actionPanel: { backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden', marginBottom: 8 },
  actionRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11 },
  actionRowBorder: { borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  actionIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  actionText: { flex: 1, minWidth: 0, marginHorizontal: 12 },
  actionTitle: { color: '#0F172A', fontSize: 15, fontWeight: '800' },
  actionDetail: { color: '#64748B', fontSize: 12, lineHeight: 17, marginTop: 2 },
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
    flexWrap: 'wrap',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bedSummary: { color: '#64748B', width: '100%', paddingLeft: 24, marginTop: 8, lineHeight: 18 },
  emptyRooms: {
    alignItems: 'center',
    paddingVertical: 40,
  },
});
