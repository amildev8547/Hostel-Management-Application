import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Share, Clipboard } from 'react-native';
import { Text, Surface, Card, Button, useTheme } from 'react-native-paper';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../services/api';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp as StackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { occupancyColors, occupancyLabels } from '../../theme';
import { showAlert, showConfirm } from '../../utils/alerts';
import { getApplyUrl } from '../../utils/backendUrl';
import { invalidateHostelData } from '../../utils/queryInvalidation';
import ManualRefreshControl from '../../components/ManualRefreshControl';
import { formatRoomType } from '../../utils/roomType';

type BranchDashboardRouteProp = RouteProp<RootStackParamList, 'BranchDashboard'>;
type BranchDashboardNavigationProp = StackNavigationProp<RootStackParamList, 'BranchDashboard'>;

interface BranchDashboardScreenProps {
  route: BranchDashboardRouteProp;
  navigation: BranchDashboardNavigationProp;
}

type RoomFilter = 'all' | 'occupiedBeds' | 'vacantBeds' | 'AVAILABLE' | 'PARTIAL' | 'FULL';

const roomFilterLabels: Record<RoomFilter, string> = {
  all: 'All rooms',
  occupiedBeds: 'Beds in use',
  vacantBeds: 'Rooms with free beds',
  AVAILABLE: 'Empty rooms',
  PARTIAL: 'Some beds free',
  FULL: 'Full rooms',
};

export default function BranchDashboardScreen({ route, navigation }: BranchDashboardScreenProps) {
  const { branchId } = route.params;
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [activeSegment, setActiveSegment] = useState('overview');
  const [roomFilter, setRoomFilter] = useState<RoomFilter>('all');

  // Fetch branch dashboard data
  const { data: dashboardData, isLoading: dashboardLoading, refetch: refetchDashboard } = useQuery({
    queryKey: ['branchDashboard', branchId],
    queryFn: async () => {
      const response = await apiClient.get(`/branches/${branchId}/dashboard`);
      return response.data;
    },
  });

  // Fetch rooms list for this branch
  const { data: rooms, isLoading: roomsLoading, refetch: refetchRooms } = useQuery<any[]>({
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

  useEffect(() => navigation.addListener('beforeRemove', (event) => {
    if (activeSegment !== 'rooms') return;
    event.preventDefault();
    setRoomFilter('all');
    setActiveSegment('overview');
  }), [activeSegment, navigation]);

  const handleDeleteBranch = () => {
    showConfirm(
      'Delete this hostel branch permanently? Its rooms, resident records, bookings, applications, and payments will also be removed.',
      async () => {
        try {
          await apiClient.delete(`/branches/${branchId}`);
          await invalidateHostelData(queryClient, { branchId });
          showAlert('Hostel branch deleted.', 'Success', () => navigation.navigate('Main', { screen: 'Branches' }));
        } catch (err: any) {
          showAlert(err.response?.data?.error || 'Could not delete this hostel branch.');
        }
      },
      { title: 'Delete hostel branch', confirmText: 'Delete', destructive: true },
    );
  };

  if (dashboardLoading) {
    return (
      <View style={styles.center}>
        <Text>Loading Branch Dashboard...</Text>
      </View>
    );
  }

  const handleRefreshAll = () => Promise.all([refetchDashboard(), refetchRooms()]);

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
        <View style={styles.mainTabs}>
          <TouchableOpacity
            style={[styles.mainTab, activeSegment === 'overview' && styles.mainTabActive]}
            onPress={() => setActiveSegment('overview')}
            accessibilityRole="tab"
          >
            <Icon name="view-dashboard-outline" size={20} color={activeSegment === 'overview' ? '#4F46E5' : '#64748B'} />
            <Text style={[styles.mainTabText, activeSegment === 'overview' && styles.mainTabTextActive]}>Overview</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.mainTab, activeSegment === 'rooms' && styles.mainTabActive]}
            onPress={() => setActiveSegment('rooms')}
            accessibilityRole="tab"
          >
            <Icon name="door-open" size={20} color={activeSegment === 'rooms' ? '#4F46E5' : '#64748B'} />
            <Text style={[styles.mainTabText, activeSegment === 'rooms' && styles.mainTabTextActive]}>Rooms</Text>
            <View style={[styles.mainTabCount, activeSegment === 'rooms' && styles.mainTabCountActive]}>
              <Text style={[styles.mainTabCountText, activeSegment === 'rooms' && styles.mainTabCountTextActive]}>{metrics.totalRooms}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <ManualRefreshControl onRefresh={handleRefreshAll} color={theme.colors.primary} />
        }
      >
        {activeSegment === 'overview' ? (
          <>
            {/* 1. Availability */}
            <Surface style={styles.statsCard} elevation={1}>
              <Text variant="titleMedium" style={styles.cardTitle}>Space available</Text>
              <Text style={styles.cardHint}>See where a new resident can stay.</Text>

              <TouchableOpacity style={styles.freeBedsBanner} onPress={() => showRooms('vacantBeds')} accessibilityRole="button">
                <View style={styles.freeBedsIcon}><Icon name="bed-empty" size={27} color="#047857" /></View>
                <View style={styles.freeBedsCopy}>
                  <Text style={styles.freeBedsTitle}>
                    {metrics.totalBeds === 0
                      ? 'No beds added yet'
                      : metrics.vacantBeds === 0
                        ? 'All beds are in use'
                        : `${metrics.vacantBeds} ${metrics.vacantBeds === 1 ? 'bed is' : 'beds are'} free`}
                  </Text>
                  <Text style={styles.freeBedsHint}>{metrics.vacantBeds > 0 ? 'Tap to find an available room' : 'Tap to view rooms'}</Text>
                </View>
                <Icon name="chevron-right" size={23} color="#047857" />
              </TouchableOpacity>

              <View style={styles.roomsHeader}>
                <Text style={styles.roomsTitle}>Rooms</Text>
                <TouchableOpacity onPress={() => showRooms('all')} accessibilityRole="button">
                  <Text style={styles.viewAllText}>View all</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.roomStatusList}>
                <TouchableOpacity style={styles.roomStatusRow} onPress={() => showRooms('AVAILABLE')} accessibilityRole="button">
                  <View style={[styles.roomStatusIcon, { backgroundColor: '#ECFDF5' }]}><Icon name="door-open" size={20} color="#059669" /></View>
                  <Text style={styles.roomStatusLabel}>Completely empty rooms</Text>
                  <Text style={styles.roomStatusCount}>{metrics.vacantRooms}</Text>
                  <Icon name="chevron-right" size={20} color="#94A3B8" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.roomStatusRow} onPress={() => showRooms('PARTIAL')} accessibilityRole="button">
                  <View style={[styles.roomStatusIcon, { backgroundColor: '#FFFBEB' }]}><Icon name="bed-outline" size={20} color="#D97706" /></View>
                  <Text style={styles.roomStatusLabel}>Rooms with some beds free</Text>
                  <Text style={styles.roomStatusCount}>{metrics.partialRooms}</Text>
                  <Icon name="chevron-right" size={20} color="#94A3B8" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.roomStatusRow, styles.lastRoomStatus]} onPress={() => showRooms('FULL')} accessibilityRole="button">
                  <View style={[styles.roomStatusIcon, { backgroundColor: '#FEF2F2' }]}><Icon name="door-closed" size={20} color="#DC2626" /></View>
                  <Text style={styles.roomStatusLabel}>Rooms Full</Text>
                  <Text style={styles.roomStatusCount}>{metrics.occupiedRooms}</Text>
                  <Icon name="chevron-right" size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            </Surface>

            {/* 2. Payments */}
            <Surface style={styles.statsCard} elevation={1}>
              <Text variant="titleMedium" style={styles.cardTitle}>Branch Collections</Text>
              <View style={styles.paymentsGrid}>
                <TouchableOpacity style={styles.paymentCell} onPress={() => navigation.navigate('PaymentsDashboard', { branchId, initialStatus: 'paid' })} accessibilityRole="button">
                  <Text style={[styles.paymentLabel, { color: (theme.colors as any).success }]}>Received</Text>
                  <Text variant="titleMedium" style={{ fontWeight: '700' }}>₹{metrics.thisMonthPaid}</Text>
                  <Text style={styles.tapSummary}>View</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.paymentCell, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#E2E8F0' }]} onPress={() => navigation.navigate('PaymentsDashboard', { branchId, initialStatus: 'pending' })} accessibilityRole="button">
                  <Text style={[styles.paymentLabel, { color: (theme.colors as any).warning }]}>Still due</Text>
                  <Text variant="titleMedium" style={{ fontWeight: '700' }}>₹{metrics.pendingPayments}</Text>
                  <Text style={styles.tapSummary}>View</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.paymentCell} onPress={() => navigation.navigate('PaymentsDashboard', { branchId, initialStatus: 'overdue' })} accessibilityRole="button">
                  <Text style={[styles.paymentLabel, { color: theme.colors.error }]}>Late</Text>
                  <Text variant="titleMedium" style={{ fontWeight: '700' }}>₹{metrics.overduePayments}</Text>
                  <Text style={styles.tapSummary}>View</Text>
                </TouchableOpacity>
              </View>
            </Surface>

            {/* 4. Quick Actions */}
            <Text variant="titleMedium" style={styles.sectionTitle}>Branch Actions</Text>
            <Surface style={styles.actionPanel} elevation={1}>
              <ActionRow icon="account-plus-outline" title="Add resident" detail="Enter details and assign a room" onPress={() => navigation.navigate('ExistingTenantForm', { branchId })} />
              <ActionRow icon="bed" title="Book a bed" detail="Reserve a place for someone" onPress={() => navigation.navigate('BookingForm', { branchId })} />
              <ActionRow icon="qrcode" title="Show application QR code" detail="Let a person scan and apply" onPress={handleShowQRCode} />
              <ActionRow icon="share-variant" title="Share application form" detail="Send the form using another app" onPress={handleShareAdmissionLink} />
              <ActionRow icon="link-variant" title="Copy application link" detail="Copy the form address" onPress={handleCopyLink} />
              <ActionRow icon="plus" title="Add a room" detail="Create another room in this branch" onPress={() => navigation.navigate('RoomForm', { branchId })} />
              <ActionRow icon="cash-multiple" title="Rent payments" detail="Check the current month's advance rent" onPress={() => navigation.navigate('PaymentsDashboard', { branchId })} />
              <ActionRow icon="pencil" title="Edit branch" detail="Change branch information" onPress={() => navigation.navigate('BranchForm', { branchId })} last />
            </Surface>
            <Button mode="outlined" icon="delete-outline" textColor={theme.colors.error} style={styles.deleteBranchButton} onPress={handleDeleteBranch}>
              Delete this hostel branch
            </Button>
          </>
        ) : (
          /* Rooms List Segment */
          <View>
            <View style={styles.resultsHeader}>
              <View style={styles.resultsTitleWrap}>
                <Text variant="titleLarge" style={styles.resultsTitle}>{roomFilterLabels[roomFilter]}</Text>
                <Text style={styles.resultsCount}>{filteredRooms.length} {filteredRooms.length === 1 ? 'room' : 'rooms'} found</Text>
              </View>
              <Button mode="contained" icon="plus" onPress={() => navigation.navigate('RoomForm', { branchId })}>Add room</Button>
            </View>
            {roomFilter !== 'all' && <Button mode="text" style={styles.showAllButton} onPress={() => setRoomFilter('all')}>Show all rooms</Button>}
            {metrics.reservedBeds > 0 && (
              <TouchableOpacity style={styles.reservedNotice} onPress={() => navigation.navigate('BookingList')} accessibilityRole="button">
                <Icon name="bed" size={21} color="#7C3AED" />
                <Text style={styles.reservedNoticeText}>{metrics.reservedBeds} {metrics.reservedBeds === 1 ? 'bed is' : 'beds are'} reserved · View bookings</Text>
                <Icon name="chevron-right" size={21} color="#7C3AED" />
              </TouchableOpacity>
            )}
            <View style={styles.filterRow}>
              {(['all', 'AVAILABLE', 'PARTIAL', 'FULL'] as RoomFilter[]).map((filter) => (
                <TouchableOpacity
                  key={filter}
                  style={[styles.filterTab, roomFilter === filter && styles.filterTabActive]}
                  onPress={() => setRoomFilter(filter)}
                  accessibilityRole="tab"
                >
                  <Text style={[styles.filterTabText, roomFilter === filter && styles.filterTabTextActive]}>
                    {filter === 'all' ? 'All' : filter === 'AVAILABLE' ? 'Empty' : filter === 'PARTIAL' ? 'Some free' : 'Full'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
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
                            {room.floor} • {formatRoomType(room.roomType, room.capacity)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.roomRight}><Text variant="titleMedium" style={{ fontWeight: '700', color: theme.colors.primary }}>₹{room.monthlyRent}</Text><Icon name="chevron-right" size={23} color="#94A3B8" /></View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  mainTabs: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 13, padding: 4, gap: 4 },
  mainTab: { flex: 1, minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 10 },
  mainTabActive: { backgroundColor: '#FFFFFF' },
  mainTabText: { color: '#64748B', fontSize: 14, fontWeight: '700' },
  mainTabTextActive: { color: '#312E81' },
  mainTabCount: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  mainTabCountActive: { backgroundColor: '#EEF2FF' },
  mainTabCountText: { color: '#64748B', fontSize: 11, fontWeight: '800' },
  mainTabCountTextActive: { color: '#4F46E5' },
  statsCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  cardTitle: {
    fontWeight: '700',
    color: '#334155',
    fontSize: 16,
    lineHeight: 21,
    marginBottom: 2,
  },
  cardHint: { color: '#64748B', fontSize: 13, marginBottom: 14 },
  freeBedsBanner: { minHeight: 76, flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', borderRadius: 14, padding: 13 },
  freeBedsIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  freeBedsCopy: { flex: 1, minWidth: 0 },
  freeBedsTitle: { color: '#065F46', fontSize: 16, lineHeight: 22, fontWeight: '800' },
  freeBedsHint: { color: '#047857', fontSize: 12, marginTop: 2 },
  roomsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 7 },
  roomsTitle: { color: '#334155', fontSize: 15, fontWeight: '800' },
  viewAllText: { color: '#4F46E5', fontSize: 12, fontWeight: '700' },
  roomStatusList: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, overflow: 'hidden' },
  roomStatusRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  lastRoomStatus: { borderBottomWidth: 0 },
  roomStatusIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  roomStatusLabel: { flex: 1, color: '#334155', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  roomStatusCount: { minWidth: 28, textAlign: 'center', color: '#0F172A', fontSize: 16, fontWeight: '800' },
  reservedNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F3E8FF', padding: 12, borderRadius: 12, marginBottom: 12 },
  reservedNoticeText: { flex: 1, color: '#6B21A8', fontSize: 13, fontWeight: '800' },
  resultsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  resultsTitleWrap: { flex: 1, minWidth: 0 },
  resultsTitle: { color: '#0F172A', fontSize: 18, lineHeight: 23, fontWeight: '800' },
  resultsCount: { color: '#64748B', fontSize: 14, marginTop: 3 },
  filterRow: { flexDirection: 'row', backgroundColor: '#E2E8F0', borderRadius: 12, padding: 3, gap: 3, marginBottom: 16 },
  filterTab: { flex: 1, minWidth: 0, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 9, paddingHorizontal: 2 },
  filterTabActive: { backgroundColor: '#4F46E5' },
  filterTabText: { color: '#475569', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  filterTabTextActive: { color: '#FFFFFF' },
  paymentsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  paymentCell: {
    flex: 1,
    alignItems: 'center',
    minHeight: 76,
    justifyContent: 'center',
  },
  paymentLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  tapSummary: { color: '#4F46E5', fontSize: 11, fontWeight: '700', marginTop: 4 },
  sectionTitle: {
    fontWeight: '800',
    color: '#0F172A',
    fontSize: 16,
    lineHeight: 21,
    marginBottom: 12,
    marginTop: 8,
  },
  actionPanel: { backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden', marginBottom: 8 },
  deleteBranchButton: { borderColor: '#EF4444', borderRadius: 12, marginTop: 10, marginBottom: 12 },
  showAllButton: { alignSelf: 'flex-start', marginBottom: 4 },
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
