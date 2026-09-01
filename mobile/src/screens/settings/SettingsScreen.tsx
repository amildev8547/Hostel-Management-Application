import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Surface, Card, List, Switch, Divider, useTheme, Avatar, TextInput, Button } from 'react-native-paper';
import { useAuth } from '../../services/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../services/api';
import { showAlert } from '../../utils/alerts';

export default function SettingsScreen() {
  const { user } = useAuth();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [upiId, setUpiId] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [paymentWhatsapp, setPaymentWhatsapp] = useState('');

  // Load Settings
  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await apiClient.get('/settings');
      return response.data;
    },
  });

  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const response = await apiClient.post('/settings', { key, value });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  useEffect(() => {
    setUpiId(settings?.payment_upi_id || '');
    setReceiverName(settings?.payment_receiver_name || '');
    setPaymentWhatsapp(settings?.payment_whatsapp_number || '');
  }, [settings]);

  const handleToggleAutoRent = (value: boolean) => {
    updateSettingMutation.mutate({
      key: 'rent_auto_generate',
      value: String(value),
    });
  };

  const autoRentVal = settings?.rent_auto_generate === 'true';

  const handleToggleNotificationAlerts = (value: boolean) => {
    updateSettingMutation.mutate({
      key: 'notification_alerts_enabled',
      value: String(value),
    });
  };

  // Defaults to enabled until the owner explicitly turns it off.
  const notificationAlertsVal = settings?.notification_alerts_enabled !== 'false';

  const handleSavePaymentSettings = async () => {
    try {
      await Promise.all([
        updateSettingMutation.mutateAsync({ key: 'payment_upi_id', value: upiId.trim() }),
        updateSettingMutation.mutateAsync({ key: 'payment_receiver_name', value: receiverName.trim() }),
        updateSettingMutation.mutateAsync({
          key: 'payment_whatsapp_number',
          value: paymentWhatsapp.replace(/\D/g, '').slice(-10),
        }),
      ]);
      showAlert('Payment settings saved.');
    } catch (error: any) {
      showAlert(error.response?.data?.error || 'Failed to save payment settings');
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* 1. Profile Header */}
      <Surface style={styles.profileCard} elevation={1}>
        <Avatar.Icon size={64} icon="account" style={{ backgroundColor: theme.colors.primaryContainer }} color={theme.colors.primary} />
        <View style={styles.profileInfo}>
          <Text variant="titleLarge" style={styles.profileName}>{user?.name || 'Hostel Owner'}</Text>
          <Text variant="bodyMedium" style={{ color: '#64748B' }}>{user?.email}</Text>
          <Text variant="labelSmall" style={[styles.roleBadge, { backgroundColor: '#EEF2FF', color: theme.colors.primary }]}>
            {user?.role}
          </Text>
        </View>
      </Surface>

      {/* 2. Operations Prefs */}
      <Text variant="titleMedium" style={styles.sectionTitle}>System Preferences</Text>
      <Card style={styles.settingsCard}>
        <Card.Content style={{ padding: 0 }}>
          <List.Item
            title="Auto-Generate Monthly Rent"
            titleNumberOfLines={2}
            description="Generate rent invoices on the 1st of each month"
            left={(props) => <List.Icon {...props} icon="calendar-check" />}
            right={() => (
              <Switch
                value={autoRentVal}
                onValueChange={handleToggleAutoRent}
                color={theme.colors.primary}
              />
            )}
          />
          <Divider />
          <List.Item
            title="System Currency"
            description="Indian Rupee (₹)"
            left={(props) => <List.Icon {...props} icon="currency-inr" />}
          />
          <Divider />
          <List.Item
            title="Notification Alerts"
            titleNumberOfLines={2}
            description="Show rent due, overdue & vacating alerts in the notification bell"
            left={(props) => <List.Icon {...props} icon="bell-ring-outline" />}
            right={() => (
              <Switch
                value={notificationAlertsVal}
                onValueChange={handleToggleNotificationAlerts}
                color={theme.colors.primary}
              />
            )}
          />
        </Card.Content>
      </Card>

      <Text variant="titleMedium" style={styles.sectionTitle}>Manual Payment Details</Text>
      <Card style={styles.settingsCard}>
        <Card.Content>
          <TextInput
            label="UPI ID"
            value={upiId}
            onChangeText={setUpiId}
            mode="outlined"
            autoCapitalize="none"
            placeholder="name@bank"
            style={styles.input}
          />
          <TextInput
            label="Receiver Name"
            value={receiverName}
            onChangeText={setReceiverName}
            mode="outlined"
            placeholder="Hostel owner or business name"
            style={styles.input}
          />
          <TextInput
            label="WhatsApp Number for Screenshots"
            value={paymentWhatsapp}
            onChangeText={setPaymentWhatsapp}
            mode="outlined"
            keyboardType="phone-pad"
            placeholder="10 digit number"
            style={styles.input}
          />
          <Button
            mode="contained"
            icon="content-save"
            onPress={handleSavePaymentSettings}
            loading={updateSettingMutation.isPending}
            disabled={updateSettingMutation.isPending}
            style={styles.saveButton}
          >
            Save Payment Details
          </Button>
        </Card.Content>
      </Card>

      {/* 3. App Details */}
      <Text variant="titleMedium" style={styles.sectionTitle}>About App</Text>
      <Card style={styles.settingsCard}>
        <Card.Content style={{ padding: 0 }}>
          <List.Item
            title="Version"
            description="HostelHub V1.0.0 (Supabase)"
            left={(props) => <List.Icon {...props} icon="information-outline" />}
          />
          <Divider />
          <List.Item
            title="Single Owner Mode"
            description="Login is disabled for this installation"
            left={(props) => <List.Icon {...props} icon="cellphone-cog" />}
          />
        </Card.Content>
      </Card>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    marginBottom: 20,
  },
  profileInfo: {
    marginLeft: 20,
    flex: 1,
  },
  profileName: {
    fontWeight: '800',
    color: '#0F172A',
  },
  roleBadge: {
    fontSize: 9,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 6,
    alignSelf: 'flex-start',
    overflow: 'hidden',
  },
  sectionTitle: {
    fontWeight: '800',
    color: '#0F172A',
    marginHorizontal: 16,
    marginBottom: 10,
  },
  settingsCard: {
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 20,
    overflow: 'hidden',
  },
  input: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  saveButton: {
    borderRadius: 8,
    marginTop: 4,
  },
});
