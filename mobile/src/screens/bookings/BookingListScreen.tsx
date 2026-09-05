import React from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Share } from 'react-native';
import { Button, Card, FAB, Text, useTheme } from 'react-native-paper';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { NativeStackNavigationProp as StackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation';
import apiClient from '../../services/api';
import { getBackendBaseUrl } from '../../utils/backendUrl';
import { showAlert, showConfirm } from '../../utils/alerts';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

type Props = { navigation: StackNavigationProp<RootStackParamList, 'BookingList'> };

export default function BookingListScreen({ navigation }: Props) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { data: bookings = [], isLoading, refetch, isRefetching } = useQuery<any[]>({
    queryKey: ['bookings'],
    queryFn: async () => (await apiClient.get('/bookings')).data,
  });

  const shareForm = async (booking: any) => {
    const url = `${getBackendBaseUrl()}/book/${booking.secureToken}`;
    await Share.share({
      title: 'Complete hostel admission',
      message: `Hello ${booking.name}, your bed is reserved at ${booking.branch.name}, Room ${booking.room.roomNumber}, Bed ${booking.bedNumber}. Please complete your admission details here:\n${url}`,
    });
  };

  const cancel = (booking: any) => showConfirm(
    `Cancel ${booking.name}'s booking? Room ${booking.room.roomNumber}, Bed ${booking.bedNumber} will become available again.`,
    async () => {
      try {
        await apiClient.delete(`/bookings/${booking.id}`);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['bookings'] }),
          queryClient.invalidateQueries({ queryKey: ['branchRooms'] }),
          queryClient.invalidateQueries({ queryKey: ['branchDashboard'] }),
          queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] }),
        ]);
        showAlert('Booking cancelled. The bed is available again.');
      } catch (error: any) {
        showAlert(error.response?.data?.error || 'Could not cancel this booking.');
      }
    },
    { title: 'Cancel booking', confirmText: 'Cancel booking', destructive: true },
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Reserved beds</Text>
        <Text style={styles.infoText}>A reserved bed cannot be given to anyone else. Share the form when the person is ready.</Text>
      </View>
      {isLoading ? <View style={styles.center}><Text>Loading bookings…</Text></View> : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[theme.colors.primary]} />}
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text variant="titleLarge" style={styles.name}>{item.name}</Text>
                    <Text style={styles.phone}>📞 {item.phone}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: item.status === 'OCCUPIED' ? '#D1FAE5' : item.status === 'FORM_SUBMITTED' ? '#DBEAFE' : '#FEF3C7' }]}>
                    <Text style={styles.badgeText}>{item.status === 'OCCUPIED' ? 'Admitted' : item.status === 'FORM_SUBMITTED' ? 'Form received' : 'Reserved'}</Text>
                  </View>
                </View>
                <View style={styles.placeBox}>
                  <Text style={styles.placeText}>{item.branch.name}</Text>
                  <Text style={styles.placeText}>Room {item.room.roomNumber} · Bed {item.bedNumber}</Text>
                  <Text style={styles.joinText}>Expected: {new Date(item.expectedJoiningDate).toLocaleDateString('en-IN')}</Text>
                </View>
                {!!item.notes && <Text style={styles.notes}>Note: {item.notes}</Text>}
                {item.status !== 'OCCUPIED' && (
                  <View style={styles.actions}>
                    <Button mode="contained" icon="share-variant" onPress={() => shareForm(item)} style={styles.action}>Share admission form</Button>
                    <Button mode="outlined" textColor={theme.colors.error} onPress={() => cancel(item)} style={styles.action}>Cancel booking</Button>
                  </View>
                )}
              </Card.Content>
            </Card>
          )}
          ListEmptyComponent={<View style={styles.empty}><Icon name="bed-empty" size={58} color="#94A3B8" /><Text style={styles.emptyTitle}>No reserved beds</Text><Text style={styles.emptyText}>Tap “Book a bed” to reserve a place for someone.</Text></View>}
        />
      )}
      <FAB icon="plus" label="Book a bed" color="#FFFFFF" style={[styles.fab, { backgroundColor: theme.colors.primary }]} onPress={() => navigation.navigate('BookingForm', {})} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, infoBox: { margin: 16, marginBottom: 4, padding: 16, borderRadius: 16, backgroundColor: '#EEF2FF' }, infoTitle: { color: '#1E1B4B', fontSize: 19, fontWeight: '800' }, infoText: { color: '#475569', fontSize: 14, lineHeight: 20, marginTop: 4 }, center: { flex: 1, justifyContent: 'center', alignItems: 'center' }, list: { padding: 16, paddingBottom: 100 }, card: { backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 14 }, row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, name: { color: '#0F172A', fontWeight: '800' }, phone: { color: '#64748B', marginTop: 3 }, badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 }, badgeText: { color: '#334155', fontSize: 11, fontWeight: '800' }, placeBox: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, marginTop: 14 }, placeText: { color: '#1E293B', fontSize: 15, fontWeight: '700', marginBottom: 3 }, joinText: { color: '#64748B', marginTop: 4 }, notes: { color: '#475569', lineHeight: 20, marginTop: 12 }, actions: { gap: 9, marginTop: 14 }, action: { borderRadius: 12, minHeight: 48, justifyContent: 'center' }, empty: { alignItems: 'center', paddingVertical: 70, paddingHorizontal: 30 }, emptyTitle: { color: '#334155', fontSize: 19, fontWeight: '800', marginTop: 12 }, emptyText: { color: '#64748B', textAlign: 'center', lineHeight: 20, marginTop: 5 }, fab: { position: 'absolute', right: 16, bottom: 18 },
});
