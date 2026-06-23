import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Surface, Card, List, Button, Switch, Divider, useTheme, Avatar, Portal, Dialog, TextInput } from 'react-native-paper';
import { useAuth } from '../../services/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../services/api';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { showAlert } from '../../utils/alerts';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const theme = useTheme();
  const queryClient = useQueryClient();

  // Change Password dialog state
  const [passwordDialogVisible, setPasswordDialogVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const closePasswordDialog = () => {
    setPasswordDialogVisible(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showAlert('Please fill in all password fields.');
      return;
    }
    if (newPassword.length < 6) {
      showAlert('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert('New password and confirmation do not match.');
      return;
    }

    setIsChangingPassword(true);
    try {
      await apiClient.post('/auth/change-password', { currentPassword, newPassword });
      showAlert('Password changed successfully.');
      closePasswordDialog();
    } catch (err: any) {
      console.error(err);
      showAlert(err.response?.data?.error || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

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

      {/* 2. Account */}
      <Text variant="titleMedium" style={styles.sectionTitle}>Account</Text>
      <Card style={styles.settingsCard}>
        <Card.Content style={{ padding: 0 }}>
          <List.Item
            title="Change Password"
            description="Update your account login password"
            left={(props) => <List.Icon {...props} icon="lock-reset" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => setPasswordDialogVisible(true)}
          />
        </Card.Content>
      </Card>

      {/* 3. Operations Prefs */}
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

      {/* 4. App Details */}
      <Text variant="titleMedium" style={styles.sectionTitle}>About App</Text>
      <Card style={styles.settingsCard}>
        <Card.Content style={{ padding: 0 }}>
          <List.Item
            title="Version"
            description="HostelHub V1.0.0 (MongoDB & Cloudinary)"
            left={(props) => <List.Icon {...props} icon="information-outline" />}
          />
          <Divider />
          <List.Item
            title="SaaS Mode"
            description="Hostel Owner Administrative Dashboard"
            left={(props) => <List.Icon {...props} icon="cellphone-cog" />}
          />
        </Card.Content>
      </Card>

      {/* 5. Logout trigger */}
      <Button
        mode="contained"
        icon="logout"
        style={styles.logoutBtn}
        buttonColor={theme.colors.error}
        onPress={logout}
      >
        Sign Out Account
      </Button>

      <View style={{ height: 40 }} />

      {/* Change Password Dialog */}
      <Portal>
        <Dialog visible={passwordDialogVisible} onDismiss={closePasswordDialog}>
          <Dialog.Title>Change Password</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Current Password"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              mode="outlined"
              style={{ marginBottom: 12 }}
            />
            <TextInput
              label="New Password"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              mode="outlined"
              style={{ marginBottom: 12 }}
            />
            <TextInput
              label="Confirm New Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              mode="outlined"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closePasswordDialog} disabled={isChangingPassword}>Cancel</Button>
            <Button onPress={handleChangePassword} loading={isChangingPassword} disabled={isChangingPassword}>
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
  logoutBtn: {
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
});
