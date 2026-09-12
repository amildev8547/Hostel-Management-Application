import React from 'react';
import { View, StyleSheet, FlatList, Linking, useWindowDimensions } from 'react-native';
import { Button, Card, FAB, Modal, Portal, Text, useTheme } from 'react-native-paper';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { NativeStackNavigationProp as StackNavigationProp } from '@react-navigation/native-stack';
import QRCode from 'react-native-qrcode-svg';
import { RootStackParamList } from '../../navigation';
import apiClient from '../../services/api';
import { getBackendBaseUrl } from '../../utils/backendUrl';
import { showAlert, showConfirm } from '../../utils/alerts';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import ManualRefreshControl from '../../components/ManualRefreshControl';

type Props = { navigation: StackNavigationProp<RootStackParamList, 'BookingList'> };

export default function BookingListScreen({ navigation }: Props) {
  const theme = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const queryClient = useQueryClient();
  const [qrBooking, setQrBooking] = React.useState<any | null>(null);
  const { data: bookings = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ['bookings'],
    queryFn: async () => (await apiClient.get('/bookings')).data,
  });

  const getAdmissionFormUrl = (booking: any) =>
    booking.admissionFormUrl || `${getBackendBaseUrl()}/book/${booking.secureToken}`;
  const qrSize = Math.min(220, Math.max(120, (windowWidth * 0.9) - 72));

  const getAdmissionMessage = (booking: any) => [
    `Hello ${booking.name},`,
    '',
    `Your bed is reserved at ${booking.branch?.name || 'our hostel'}, Room ${booking.room?.roomNumber || ''}, Bed ${booking.bedNumber}.`,
    'Please complete your admission details using this secure link:',
    getAdmissionFormUrl(booking),
    '',
    '— HostelHub',
  ].join('\n');

  const sendOnWhatsApp = async (booking: any) => {
    const digits = String(booking.phone || '').replace(/\D/g, '');
    const phone = digits.length === 10 ? `91${digits}` : digits;
    if (!phone) {
      showAlert('No phone number is saved for this booking.');
      return;
    }

    const message = encodeURIComponent(getAdmissionMessage(booking));
    const appUrl = `whatsapp://send?phone=${phone}&text=${message}`;
    const webUrl = `https://wa.me/${phone}?text=${message}`;
    try {
      if (await Linking.canOpenURL(appUrl)) await Linking.openURL(appUrl);
      else await Linking.openURL(webUrl);
    } catch {
      showAlert('Could not open WhatsApp. Please check that WhatsApp is installed and try again.');
    }
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
          refreshControl={<ManualRefreshControl onRefresh={refetch} color={theme.colors.primary} />}
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
                    {item.status === 'RESERVED' ? (
                      <>
                        <Button mode="contained" icon="whatsapp" buttonColor="#16A34A" onPress={() => sendOnWhatsApp(item)} style={styles.action}>Send form on WhatsApp</Button>
                        <Button mode="outlined" icon="qrcode" onPress={() => setQrBooking(item)} style={styles.action}>Show QR code</Button>
                      </>
                    ) : item.admissionApplication?.id ? (
                      <Button mode="contained" icon="file-check-outline" onPress={() => navigation.navigate('AdmissionReview', { applicationId: item.admissionApplication.id })} style={styles.action}>Review submitted form</Button>
                    ) : null}
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
      <Portal>
        <Modal visible={!!qrBooking} onDismiss={() => setQrBooking(null)} contentContainerStyle={styles.qrModal}>
          {qrBooking && (
            <>
              <View style={styles.qrTitleRow}>
                <View style={styles.qrIcon}><Icon name="qrcode-scan" size={27} color={theme.colors.primary} /></View>
                <View style={styles.qrTitleCopy}>
                  <Text style={styles.qrTitle}>Scan admission form</Text>
                  <Text style={styles.qrSubtitle}>{qrBooking.name} · Room {qrBooking.room?.roomNumber}</Text>
                </View>
              </View>
              <View style={styles.qrCodeBox}>
                <QRCode value={getAdmissionFormUrl(qrBooking)} size={qrSize} color="#0F172A" backgroundColor="#FFFFFF" />
              </View>
              <Text style={styles.qrHelp}>Ask the person to scan this code with their phone camera. It opens their secure, pre-filled admission form.</Text>
              <Button mode="contained" icon="whatsapp" buttonColor="#16A34A" onPress={() => sendOnWhatsApp(qrBooking)} style={styles.qrButton}>Send on WhatsApp instead</Button>
              <Button mode="text" onPress={() => setQrBooking(null)}>Close</Button>
            </>
          )}
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, infoBox: { margin: 16, marginBottom: 4, padding: 16, borderRadius: 16, backgroundColor: '#EEF2FF' }, infoTitle: { color: '#1E1B4B', fontSize: 19, fontWeight: '800' }, infoText: { color: '#475569', fontSize: 14, lineHeight: 20, marginTop: 4 }, center: { flex: 1, justifyContent: 'center', alignItems: 'center' }, list: { padding: 16, paddingBottom: 100 }, card: { backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 14 }, row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, name: { color: '#0F172A', fontWeight: '800' }, phone: { color: '#64748B', marginTop: 3 }, badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 }, badgeText: { color: '#334155', fontSize: 11, fontWeight: '800' }, placeBox: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, marginTop: 14 }, placeText: { color: '#1E293B', fontSize: 15, fontWeight: '700', marginBottom: 3 }, joinText: { color: '#64748B', marginTop: 4 }, notes: { color: '#475569', lineHeight: 20, marginTop: 12 }, actions: { gap: 9, marginTop: 14 }, action: { borderRadius: 12, minHeight: 48, justifyContent: 'center' }, empty: { alignItems: 'center', paddingVertical: 70, paddingHorizontal: 30 }, emptyTitle: { color: '#334155', fontSize: 19, fontWeight: '800', marginTop: 12 }, emptyText: { color: '#64748B', textAlign: 'center', lineHeight: 20, marginTop: 5 }, fab: { position: 'absolute', right: 16, bottom: 18 },
  qrModal: { backgroundColor: '#FFFFFF', padding: 22, borderRadius: 22, maxWidth: 420, width: '90%', alignSelf: 'center' },
  qrTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  qrIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  qrTitleCopy: { flex: 1, marginLeft: 12 },
  qrTitle: { color: '#0F172A', fontSize: 20, fontWeight: '800' },
  qrSubtitle: { color: '#64748B', marginTop: 2 },
  qrCodeBox: { alignSelf: 'center', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  qrHelp: { color: '#475569', textAlign: 'center', lineHeight: 20, marginVertical: 16 },
  qrButton: { borderRadius: 12, minHeight: 48, justifyContent: 'center' },
});
