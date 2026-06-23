import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Surface, Button, useTheme, Card, List, RadioButton } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../services/api';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { showAlert } from '../../utils/alerts';

type MoveTenantRouteProp = RouteProp<RootStackParamList, 'MoveTenant'>;
type MoveTenantNavigationProp = StackNavigationProp<RootStackParamList, 'MoveTenant'>;

interface MoveTenantScreenProps {
  route: MoveTenantRouteProp;
  navigation: MoveTenantNavigationProp;
}

export default function MoveTenantScreen({ route, navigation }: MoveTenantScreenProps) {
  const { tenantId, branchId } = route.params;
  const theme = useTheme();
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch tenant profile details
  const { data: tenant, isLoading: tenantLoading } = useQuery<any>({
    queryKey: ['tenantMoveProfile', tenantId],
    queryFn: async () => {
      const response = await apiClient.get(`/tenants/${tenantId}`);
      return response.data;
    },
  });

  // Fetch vacant/partial rooms in this branch
  const { data: rooms, isLoading: roomsLoading } = useQuery<any[]>({
    queryKey: ['moveRoomsList', branchId],
    queryFn: async () => {
      const response = await apiClient.get('/rooms', { params: { branchId } });
      // Only show rooms that are not full or maintenance, and are different from current room
      return response.data.filter(
        (room: any) =>
          room.id !== tenant?.roomId &&
          room.status !== 'FULL' &&
          room.status !== 'MAINTENANCE'
      );
    },
    enabled: !!tenant,
  });

  const handleMoveRoom = async () => {
    if (!selectedRoomId) {
      showAlert('Please select a room to move the tenant to.');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.post(`/tenants/${tenantId}/move`, { newRoomId: selectedRoomId });
      showAlert('Tenant moved successfully', 'Success', () => navigation.pop(2)); // Go back to profile screen and refresh it
    } catch (err: any) {
      console.error(err);
      showAlert(err.response?.data?.error || 'Failed to move tenant');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (tenantLoading || roomsLoading) {
    return (
      <View style={styles.center}>
        <Text>Loading Room Transfer Details...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Surface style={styles.summaryCard} elevation={1}>
          <Text variant="titleMedium" style={{ fontWeight: '800' }}>Reallocating Tenant</Text>
          <Text variant="bodyLarge" style={{ fontWeight: '600', color: theme.colors.primary, marginTop: 4 }}>
            {tenant.name}
          </Text>
          <Text variant="bodyMedium" style={{ color: '#64748B', marginTop: 2 }}>
            Current Room: Room {tenant.room.roomNumber} ({tenant.room.roomType})
          </Text>
        </Surface>

        <Text variant="titleMedium" style={styles.sectionTitle}>Select New Room</Text>

        <RadioButton.Group onValueChange={(val) => setSelectedRoomId(val)} value={selectedRoomId}>
          {rooms && rooms.length > 0 ? (
            rooms.map((room: any) => (
              <Card key={room.id} style={styles.roomCard} onPress={() => setSelectedRoomId(room.id)}>
                <Card.Content style={styles.roomCardContent}>
                  <View style={styles.roomInfo}>
                    <RadioButton.Android value={room.id} color={theme.colors.primary} />
                    <View style={{ marginLeft: 8 }}>
                      <Text style={{ fontWeight: '700', fontSize: 15 }}>Room {room.roomNumber}</Text>
                      <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                        {room.floor} • {room.roomType}
                      </Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontWeight: '700', color: theme.colors.primary }}>₹{room.monthlyRent}</Text>
                    <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                      🛏️ {room.occupied} / {room.capacity} occupied
                    </Text>
                  </View>
                </Card.Content>
              </Card>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Icon name="door-closed-lock" size={48} color="#94A3B8" />
              <Text style={{ marginTop: 8, color: '#64748B', fontWeight: '500', textAlign: 'center' }}>
                No other available rooms in this branch
              </Text>
            </View>
          )}
        </RadioButton.Group>

        <Button
          mode="contained"
          style={styles.submitBtn}
          onPress={handleMoveRoom}
          disabled={isSubmitting || !selectedRoomId}
          loading={isSubmitting}
        >
          Confirm Reallocation
        </Button>
      </ScrollView>
    </View>
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
  summaryCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    marginBottom: 20,
  },
  sectionTitle: {
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  roomCard: {
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  roomCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  roomInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  submitBtn: {
    marginTop: 20,
    paddingVertical: 6,
    borderRadius: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
});
