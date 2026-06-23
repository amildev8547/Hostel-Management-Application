import React from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, Surface, Card, Button, useTheme, Avatar, List, Divider, IconButton } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../services/api';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { occupancyColors, occupancyLabels } from '../../theme';
import { showAlert, showConfirm } from '../../utils/alerts';

type RoomDetailsRouteProp = RouteProp<RootStackParamList, 'RoomDetails'>;
type RoomDetailsNavigationProp = StackNavigationProp<RootStackParamList, 'RoomDetails'>;

interface RoomDetailsScreenProps {
  route: RoomDetailsRouteProp;
  navigation: RoomDetailsNavigationProp;
}

export default function RoomDetailsScreen({ route, navigation }: RoomDetailsScreenProps) {
  const { roomId } = route.params;
  const theme = useTheme();

  const { data: room, isLoading, refetch, isRefetching } = useQuery<any>({
    queryKey: ['roomDetails', roomId],
    queryFn: async () => {
      const response = await apiClient.get(`/rooms/${roomId}`);
      return response.data;
    },
  });

  const handleDeleteRoom = () => {
    if (room.occupied > 0) {
      showAlert('Cannot delete room with active tenants. Vacate or move them first.');
      return;
    }

    showConfirm(
      `Are you sure you want to delete Room ${room.roomNumber}? This cannot be undone.`,
      async () => {
        try {
          await apiClient.delete(`/rooms/${roomId}`);
          showAlert('Room deleted successfully', 'Success', () => navigation.goBack());
        } catch (err: any) {
          console.error(err);
          showAlert(err.response?.data?.error || 'Failed to delete room');
        }
      },
      { title: 'Delete Room', confirmText: 'Delete', destructive: true }
    );
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Text>Loading Room Details...</Text>
      </View>
    );
  }

  const statusColor = occupancyColors[room.status as keyof typeof occupancyColors] || '#64748B';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[theme.colors.primary]} />
      }
    >
      {/* 1. Header Card */}
      <Surface style={styles.headerCard} elevation={1}>
        <View style={styles.headerRow}>
          <View style={styles.headerRowText}>
            <Text variant="headlineMedium" style={styles.roomName}>Room {room.roomNumber}</Text>
            <Text variant="bodyMedium" style={{ color: '#64748B' }}>
              📍 {room.branch.name} • {room.floor}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: statusColor }]}>
            <Text style={styles.badgeText}>
              {occupancyLabels[room.status as keyof typeof occupancyLabels]}
            </Text>
          </View>
        </View>

        <Divider style={{ marginVertical: 16 }} />

        <View style={styles.roomSpecs}>
          <View style={styles.specCell}>
            <Text variant="bodySmall" style={styles.specLabel}>Sharing Type</Text>
            <Text variant="titleMedium" style={styles.specVal}>{room.roomType}</Text>
          </View>
          <View style={styles.specCell}>
            <Text variant="bodySmall" style={styles.specLabel}>Beds Occupied</Text>
            <Text variant="titleMedium" style={styles.specVal}>{room.occupied} / {room.capacity}</Text>
          </View>
          <View style={styles.specCell}>
            <Text variant="bodySmall" style={styles.specLabel}>Monthly Rent</Text>
            <Text variant="titleMedium" style={[styles.specVal, { color: theme.colors.primary }]}>₹{room.monthlyRent}</Text>
          </View>
        </View>
      </Surface>

      {/* 2. Active Tenants List */}
      <Text variant="titleMedium" style={styles.sectionTitle}>Current Tenants</Text>
      <Card style={styles.listCard}>
        <Card.Content style={{ padding: 8 }}>
          {room.tenants && room.tenants.length > 0 ? (
            room.tenants.map((tenant: any) => (
              <List.Item
                key={tenant.id}
                title={tenant.name}
                description={`📞 ${tenant.phone}`}
                left={(props) => (
                  <Avatar.Image
                    size={40}
                    source={{ uri: tenant.profilePhotoUrl || 'https://via.placeholder.com/150' }}
                    style={{ marginTop: 4, marginRight: 8 }}
                  />
                )}
                right={(props) => <IconButton icon="chevron-right" onPress={() => navigation.navigate('TenantProfile', { tenantId: tenant.id })} />}
                style={styles.listItem}
              />
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Icon name="account-multiple-remove-outline" size={40} color="#94A3B8" />
              <Text style={{ marginTop: 8, color: '#64748B', fontWeight: '500' }}>No active tenants in this room</Text>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* 3. Payment History */}
      <Text variant="titleMedium" style={styles.sectionTitle}>Recent Payments</Text>
      <Card style={styles.listCard}>
        <Card.Content style={{ padding: 8 }}>
          {room.paymentHistory && room.paymentHistory.length > 0 ? (
            room.paymentHistory.map((pay: any, idx: number) => (
              <View key={pay.id}>
                {idx > 0 && <Divider />}
                <View style={styles.paymentRow}>
                  <View>
                    <Text style={{ fontWeight: '700', color: '#334155' }}>
                      ₹{pay.amount} ({pay.paymentType})
                    </Text>
                    <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                      Due: {new Date(pay.dueDate).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text
                      style={[
                        styles.paymentStatus,
                        {
                          color:
                            pay.status === 'PAID'
                              ? (theme.colors as any).success
                              : pay.status === 'OVERDUE'
                              ? theme.colors.error
                              : (theme.colors as any).warning,
                        },
                      ]}
                    >
                      {pay.status}
                    </Text>
                    {pay.paidDate && (
                      <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
                        {new Date(pay.paidDate).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Icon name="cash-register" size={40} color="#94A3B8" />
              <Text style={{ marginTop: 8, color: '#64748B', fontWeight: '500' }}>No payments logged yet</Text>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* 4. Admin Actions */}
      <View style={styles.adminActions}>
        <Button
          mode="contained"
          icon="pencil"
          style={styles.actionBtn}
          onPress={() => navigation.navigate('RoomForm', { branchId: room.branchId, roomId: room.id })}
        >
          Edit Room
        </Button>
        <Button
          mode="outlined"
          icon="delete"
          textColor={theme.colors.error}
          style={[styles.actionBtn, { borderColor: theme.colors.error }]}
          onPress={handleDeleteRoom}
        >
          Delete Room
        </Button>
      </View>
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCard: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerRowText: {
    flex: 1,
    marginRight: 8,
  },
  roomName: {
    fontWeight: '800',
    color: '#0F172A',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  roomSpecs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  specCell: {
    alignItems: 'center',
    flex: 1,
  },
  specLabel: {
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 4,
  },
  specVal: {
    fontWeight: '800',
    color: '#1E293B',
  },
  sectionTitle: {
    fontWeight: '800',
    color: '#0F172A',
    marginHorizontal: 16,
    marginBottom: 10,
    marginTop: 8,
  },
  listCard: {
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
  },
  listItem: {
    paddingVertical: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  paymentStatus: {
    fontWeight: '800',
    fontSize: 13,
  },
  adminActions: {
    flexDirection: 'row',
    marginHorizontal: 16,
    gap: 12,
    marginTop: 8,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 8,
  },
});
