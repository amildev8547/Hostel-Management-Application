import React from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, Surface, Button, useTheme, ActivityIndicator } from 'react-native-paper';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../services/api';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

type NotificationsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Notifications'>;

interface NotificationsScreenProps {
  navigation: NotificationsScreenNavigationProp;
}

const ICONS: Record<string, { name: keyof typeof Icon.glyphMap; color: string }> = {
  RENT_OVERDUE: { name: 'alert-circle', color: '#EF4444' },
  RENT_DUE_TODAY: { name: 'calendar-clock', color: '#F59E0B' },
  TENANT_VACATING_TODAY: { name: 'logout', color: '#0EA5E9' },
  RENT_PAYMENT_RECEIVED: { name: 'cash-check', color: '#10B981' },
  ADMISSION_PAYMENT_RECEIVED: { name: 'cash-check', color: '#10B981' },
  NEW_ADMISSION: { name: 'account-plus', color: '#4F46E5' },
  ADMISSION_APPROVED: { name: 'check-decagram', color: '#10B981' },
  TENANT_VACATED: { name: 'door-open', color: '#64748B' },
};

export default function NotificationsScreen({ navigation }: NotificationsScreenProps) {
  const theme = useTheme();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery<{ notifications: any[]; unreadCount: number }>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await apiClient.get('/notifications');
      return response.data;
    },
  });

  const notifications = data?.notifications || [];

  const handleMarkAllRead = async () => {
    await apiClient.post('/notifications/all/read');
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const handlePressItem = async (item: any) => {
    if (item.isLive) {
      if (item.type === 'TENANT_VACATING_TODAY' && item.tenantId) {
        navigation.navigate('TenantProfile', { tenantId: item.tenantId });
      } else if ((item.type === 'RENT_DUE_TODAY' || item.type === 'RENT_OVERDUE') && item.paymentId) {
        navigation.navigate('PaymentsDashboard', {});
      }
      return;
    }

    if (!item.isRead) {
      await apiClient.post(`/notifications/${item.id}/read`);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.listContainer}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[theme.colors.primary]} />}
    >
      {notifications.length > 0 && (
        <View style={styles.headerRow}>
          <Text variant="bodySmall" style={{ color: '#64748B' }}>
            {data?.unreadCount || 0} unread
          </Text>
          <Button mode="text" compact onPress={handleMarkAllRead}>
            Mark all as read
          </Button>
        </View>
      )}

      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="bell-check-outline" size={48} color="#94A3B8" />
          <Text style={{ marginTop: 8, color: '#64748B', fontWeight: '500' }}>You're all caught up.</Text>
        </View>
      ) : (
        notifications.map((item: any) => {
          const iconInfo = ICONS[item.type] || { name: 'bell-outline', color: '#64748B' };
          return (
            <TouchableOpacity key={item.id} onPress={() => handlePressItem(item)}>
              <Surface style={[styles.card, !item.isRead && styles.cardUnread]} elevation={1}>
                <View style={[styles.iconWrap, { backgroundColor: `${iconInfo.color}1A` }]}>
                  <Icon name={iconInfo.name} size={20} color={iconInfo.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardMessage}>{item.message}</Text>
                  <Text style={styles.cardTime}>{new Date(item.createdAt).toLocaleString('en-IN')}</Text>
                </View>
                {!item.isRead && <View style={styles.unreadDot} />}
              </Surface>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContainer: { padding: 16 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyContainer: { alignItems: 'center', paddingVertical: 80 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  cardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: '#4F46E5',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontWeight: '700',
    fontSize: 14,
    color: '#0F172A',
  },
  cardMessage: {
    fontSize: 13,
    color: '#475569',
    marginTop: 2,
  },
  cardTime: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 6,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4F46E5',
    marginTop: 4,
  },
});
