import React, { useMemo, useRef } from 'react';
import { Animated, PanResponder, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { ActivityIndicator, Button, Surface, Text, useTheme } from 'react-native-paper';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../services/api';
import { NativeStackNavigationProp as StackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { showAlert } from '../../utils/alerts';

type NotificationsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Notifications'>;
type NotificationData = { notifications: any[]; unreadCount: number };

const ICONS: Record<string, { name: keyof typeof Icon.glyphMap; color: string }> = {
  RENT_OVERDUE: { name: 'alert-circle', color: '#EF4444' }, RENT_DUE_TODAY: { name: 'calendar-clock', color: '#F59E0B' },
  TENANT_VACATING_TODAY: { name: 'logout', color: '#0EA5E9' }, RENT_PAYMENT_RECEIVED: { name: 'cash-check', color: '#10B981' },
  ADMISSION_PAYMENT_RECEIVED: { name: 'cash-check', color: '#10B981' }, NEW_ADMISSION: { name: 'account-plus', color: '#4F46E5' },
  ADMISSION_APPROVED: { name: 'check-decagram', color: '#10B981' }, TENANT_VACATED: { name: 'door-open', color: '#64748B' },
};

export default function NotificationsScreen({ navigation }: { navigation: NotificationsScreenNavigationProp }) {
  const theme = useTheme(); const queryClient = useQueryClient();
  const { data, isLoading, refetch, isRefetching } = useQuery<NotificationData>({ queryKey: ['notifications'], queryFn: async () => (await apiClient.get('/notifications')).data });
  const notifications = data?.notifications || [];
  const updateCache = (update: (current: NotificationData) => NotificationData) => queryClient.setQueryData<NotificationData>(['notifications'], (current) => update(current || { notifications: [], unreadCount: 0 }));

  const handleMarkAllRead = async () => {
    const previous = data;
    updateCache((current) => ({ notifications: current.notifications.filter((item) => !item.isLive).map((item) => ({ ...item, isRead: true })), unreadCount: 0 }));
    try { await apiClient.post('/notifications/all/read'); await queryClient.invalidateQueries({ queryKey: ['notifications'] }); }
    catch { if (previous) queryClient.setQueryData(['notifications'], previous); showAlert('Could not mark the reminders as seen. Please try again.'); }
  };

  const openNotification = (item: any) => {
    if ((item.type === 'TENANT_VACATING_TODAY' || item.type === 'TENANT_VACATED') && item.tenantId) navigation.navigate('TenantProfile', { tenantId: item.tenantId });
    else if (['RENT_DUE_TODAY', 'RENT_OVERDUE', 'RENT_PAYMENT_RECEIVED'].includes(item.type)) navigation.navigate('PaymentsDashboard', item.branchId ? { branchId: item.branchId } : {});
    else if (['NEW_ADMISSION', 'ADMISSION_PAYMENT_RECEIVED'].includes(item.type) && item.applicationId) navigation.navigate('AdmissionReview', { applicationId: item.applicationId });
    else if (['NEW_ADMISSION', 'ADMISSION_PAYMENT_RECEIVED'].includes(item.type)) navigation.navigate('Main', { screen: 'Admissions' });
    else if (item.type === 'ADMISSION_APPROVED' && item.tenantId) navigation.navigate('TenantProfile', { tenantId: item.tenantId });
    else if (item.type === 'ADMISSION_APPROVED' || item.type === 'TENANT_VACATED') navigation.navigate('Main', { screen: 'Tenants' });
    else navigation.navigate('Main', { screen: 'Home' });
  };

  const handlePress = async (item: any) => {
    openNotification(item);
    if (item.isRead) return;
    updateCache((current) => ({ notifications: current.notifications.map((entry) => entry.id === item.id ? { ...entry, isRead: true } : entry), unreadCount: Math.max(0, current.unreadCount - 1) }));
    try { await apiClient.post(`/notifications/${item.id}/read`); } catch { queryClient.invalidateQueries({ queryKey: ['notifications'] }); }
  };

  const handleRemove = async (item: any) => {
    const previous = queryClient.getQueryData<NotificationData>(['notifications']);
    updateCache((current) => ({ notifications: current.notifications.filter((entry) => entry.id !== item.id), unreadCount: Math.max(0, current.unreadCount - (item.isRead ? 0 : 1)) }));
    try { await apiClient.delete(`/notifications/${item.id}`); }
    catch { if (previous) queryClient.setQueryData(['notifications'], previous); showAlert('Could not remove this reminder. Please try again.'); }
  };

  if (isLoading) return <View style={[styles.center, { backgroundColor: theme.colors.background }]}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;
  return <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} contentContainerStyle={styles.listContainer} refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[theme.colors.primary]} />}>
    <Surface style={styles.infoBox} elevation={0}><Text style={styles.infoTitle}>Important reminders</Text><Text style={styles.infoText}>Tap a reminder to open it. Swipe either way to remove it.</Text></Surface>
    {notifications.length > 0 && <View style={styles.headerRow}><Text variant="bodySmall" style={styles.countText}>{data?.unreadCount || 0} new reminders</Text><Button mode="text" compact disabled={!data?.unreadCount} onPress={handleMarkAllRead}>Mark all seen</Button></View>}
    {notifications.length === 0 ? <View style={styles.emptyContainer}><Icon name="bell-check-outline" size={48} color="#94A3B8" /><Text style={styles.emptyText}>No reminders need your attention.</Text></View> : notifications.map((item) => <SwipeableNotification key={item.id} item={item} onPress={() => handlePress(item)} onRemove={() => handleRemove(item)} />)}
  </ScrollView>;
}

function SwipeableNotification({ item, onPress, onRemove }: { item: any; onPress: () => void; onRemove: () => void }) {
  const translateX = useRef(new Animated.Value(0)).current; const removing = useRef(false); const { width } = useWindowDimensions();
  const iconInfo = ICONS[item.type] || { name: 'bell-outline' as const, color: '#64748B' };
  const responder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderMove: (_, gesture) => translateX.setValue(gesture.dx),
    onPanResponderRelease: (_, gesture) => { if (Math.abs(gesture.dx) >= 85) { removing.current = true; Animated.timing(translateX, { toValue: gesture.dx > 0 ? width : -width, duration: 180, useNativeDriver: true }).start(onRemove); } else Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start(); },
    onPanResponderTerminate: () => { if (!removing.current) Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start(); },
  }), [onRemove, translateX, width]);
  return <View style={styles.swipeContainer}><View style={styles.removeBackground}><Icon name="delete-outline" size={25} color="#FFFFFF" /><Text style={styles.removeText}>Remove</Text><View style={{ flex: 1 }} /><Text style={styles.removeText}>Remove</Text><Icon name="delete-outline" size={25} color="#FFFFFF" /></View><Animated.View style={{ transform: [{ translateX }] }} {...responder.panHandlers}><TouchableOpacity onPress={onPress} activeOpacity={0.78} accessibilityRole="button"><Surface style={[styles.card, !item.isRead && styles.cardUnread]} elevation={1}><View style={[styles.iconWrap, { backgroundColor: `${iconInfo.color}1A` }]}><Icon name={iconInfo.name} size={21} color={iconInfo.color} /></View><View style={styles.cardBody}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.cardMessage}>{item.message}</Text><Text style={styles.cardTime}>{new Date(item.createdAt).toLocaleString('en-IN')}</Text></View>{!item.isRead ? <View style={styles.unreadDot} /> : <Icon name="chevron-right" size={22} color="#94A3B8" />}</Surface></TouchableOpacity></Animated.View></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, center: { flex: 1, justifyContent: 'center', alignItems: 'center' }, listContainer: { padding: 16, paddingBottom: 40 }, infoBox: { backgroundColor: '#EEF2FF', borderRadius: 16, padding: 16, marginBottom: 14 }, infoTitle: { color: '#1E1B4B', fontSize: 18, fontWeight: '800' }, infoText: { color: '#475569', fontSize: 14, lineHeight: 20, marginTop: 4 },
  headerRow: { minHeight: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }, countText: { color: '#64748B', flexShrink: 1 }, emptyContainer: { alignItems: 'center', paddingVertical: 72 }, emptyText: { marginTop: 8, color: '#64748B', fontWeight: '600', textAlign: 'center' },
  swipeContainer: { borderRadius: 16, overflow: 'hidden', marginBottom: 10, backgroundColor: '#DC2626' }, removeBackground: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 7 }, removeText: { color: '#FFFFFF', fontWeight: '800' }, card: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 15, minHeight: 88, gap: 12 }, cardUnread: { borderLeftWidth: 4, borderLeftColor: '#4F46E5' }, cardBody: { flex: 1, minWidth: 0 }, iconWrap: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', flexShrink: 0 }, cardTitle: { fontWeight: '700', fontSize: 16, color: '#0F172A' }, cardMessage: { fontSize: 14, lineHeight: 20, color: '#475569', marginTop: 2 }, cardTime: { fontSize: 11, color: '#94A3B8', marginTop: 6 }, unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#4F46E5', marginTop: 5, flexShrink: 0 },
});
