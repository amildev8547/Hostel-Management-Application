import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Surface, Button, useTheme, Card, List, RadioButton } from 'react-native-paper';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../services/api';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp as StackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { showAlert } from '../../utils/alerts';
import { invalidateHostelData } from '../../utils/queryInvalidation';

type MoveTenantRouteProp = RouteProp<RootStackParamList, 'MoveTenant'>;
type MoveTenantNavigationProp = StackNavigationProp<RootStackParamList, 'MoveTenant'>;

interface MoveTenantScreenProps {
  route: MoveTenantRouteProp;
  navigation: MoveTenantNavigationProp;
}

export default function MoveTenantScreen({ route, navigation }: MoveTenantScreenProps) {
  const { tenantId, branchId } = route.params;
  const theme = useTheme();
  const queryClient = useQueryClient();
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
      showAlert('Please choose the new room first.');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.post(`/tenants/${tenantId}/move`, { newRoomId: selectedRoomId });
      await invalidateHostelData(queryClient, {
        branchId,
        tenantId,
        roomId: tenant?.roomId,
      });
      showAlert('The resident was moved to the selected room.', 'Success', () => navigation.pop(2)); // Go back to profile screen and refresh it
    } catch (err: any) {
      console.error(err);
      showAlert(err.response?.data?.error || 'Could not move this resident.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (tenantLoading || roomsLoading) {
    return (
      <View style={styles.center}>
        <Text>Loading available rooms…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Surface style={styles.summaryCard} elevation={1}>
          <Text variant="titleMedium" style={{ fontWeight: '800' }}>Moving this person</Text>
          <Text variant="bodyLarge" style={{ fontWeight: '600', color: theme.colors.primary, marginTop: 4 }}>
            {tenant.name}
          </Text>
          <Text variant="bodyMedium" style={{ color: '#64748B', marginTop: 2 }}>
            Current room: {tenant.room.roomNumber} ({String(tenant.room.roomType).replace('Share', 'people')})
          </Text>
        </Surface>

        <Text variant="titleMedium" style={styles.sectionTitle}>Choose the new room</Text>
        <Text style={styles.helpText}>Only rooms with a free bed are shown. Tap a room to select it.</Text>

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
                      🛏️ {room.occupied} of {room.capacity} beds in use
                    </Text>
                  </View>
                </Card.Content>
              </Card>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Icon name="door-closed-lock" size={48} color="#94A3B8" />
              <Text style={{ marginTop: 8, color: '#64748B', fontWeight: '500', textAlign: 'center' }}>
                No other rooms have a free bed in this branch
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
          Move to selected room
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
    marginBottom: 4,
  },
  helpText: { color: '#64748B', fontSize: 14, lineHeight: 20, marginBottom: 14 },
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
    paddingVertical: 9,
    borderRadius: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
});
