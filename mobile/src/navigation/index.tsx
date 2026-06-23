import React from 'react';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../services/AuthContext';
import apiClient from '../services/api';

// Screens
import LoginScreen from '../screens/auth/LoginScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import DashboardScreen from '../screens/home/DashboardScreen';
import BranchListScreen from '../screens/branches/BranchListScreen';
import BranchDashboardScreen from '../screens/branches/BranchDashboardScreen';
import QRCodeScreen from '../screens/branches/QRCodeScreen';
import BranchFormScreen from '../screens/branches/BranchFormScreen';
import RoomDetailsScreen from '../screens/rooms/RoomDetailsScreen';
import RoomFormScreen from '../screens/rooms/RoomFormScreen';
import TenantListScreen from '../screens/tenants/TenantListScreen';
import TenantProfileScreen from '../screens/tenants/TenantProfileScreen';
import MoveTenantScreen from '../screens/tenants/MoveTenantScreen';
import AdmissionsListScreen from '../screens/admissions/AdmissionsListScreen';
import AdmissionReviewScreen from '../screens/admissions/AdmissionReviewScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import PaymentsDashboardScreen from '../screens/payments/PaymentsDashboardScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';

// Stack Navigation Type Definitions
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  BranchDashboard: { branchId: string; branchName: string };
  QRCode: { branchId: string; branchName: string };
  BranchForm: { branchId?: string };
  RoomDetails: { roomId: string };
  RoomForm: { branchId: string; roomId?: string };
  TenantProfile: { tenantId: string };
  MoveTenant: { tenantId: string; branchId: string };
  AdmissionReview: { applicationId: string };
  PaymentsDashboard: { branchId?: string };
  Notifications: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
};

export type TabParamList = {
  Home: undefined;
  Branches: undefined;
  Admissions: undefined;
  Tenants: undefined;
  Settings: undefined;
};

const RootStack = createStackNavigator<RootStackParamList>();
const AuthStack = createStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

// Unauthenticated auth stack
function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </AuthStack.Navigator>
  );
}

// Bell icon shown in every tab's header, badged with the live unread count, that
// jumps to the Notifications screen (today's vacating tenants, rent due/overdue alerts).
function NotificationBell() {
  const navigation = useNavigation<any>();

  const { data } = useQuery<{ unreadCount: number }>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await apiClient.get('/notifications');
      return response.data;
    },
    refetchInterval: 60000,
  });

  const unreadCount = data?.unreadCount || 0;

  return (
    <TouchableOpacity
      style={styles.bellButton}
      onPress={() => navigation.navigate('Notifications')}
    >
      <Icon name="bell-outline" size={24} color="#0F172A" />
      {unreadCount > 0 && (
        <View style={styles.bellBadge}>
          <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// Authenticated tabs
function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName: keyof typeof Icon.glyphMap = 'home-analytics';
          if (route.name === 'Home') iconName = 'home-analytics';
          else if (route.name === 'Branches') iconName = 'office-building';
          else if (route.name === 'Admissions') iconName = 'account-clock';
          else if (route.name === 'Tenants') iconName = 'account-group';
          else if (route.name === 'Settings') iconName = 'cog-outline';

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#4F46E5',
        tabBarInactiveTintColor: '#64748B',
        headerShown: true,
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerTitleStyle: { fontWeight: '700', fontSize: 18, color: '#0F172A' },
        headerRight: () => <NotificationBell />,
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} options={{ title: 'Dashboard' }} />
      <Tab.Screen name="Branches" component={BranchListScreen} options={{ title: 'Branches' }} />
      <Tab.Screen name="Admissions" component={AdmissionsListScreen} options={{ title: 'Admissions' }} />
      <Tab.Screen name="Tenants" component={TenantListScreen} options={{ title: 'Tenants' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </Tab.Navigator>
  );
}

// Global App Navigation Container
export default function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#FFFFFF' }, headerTitleStyle: { fontWeight: '600' } }}>
        {!isAuthenticated ? (
          <RootStack.Screen name="Auth" component={AuthNavigator} options={{ headerShown: false }} />
        ) : (
          <>
            <RootStack.Screen name="Main" component={TabNavigator} options={{ headerShown: false }} />
            <RootStack.Screen name="BranchDashboard" component={BranchDashboardScreen} options={({ route }) => ({ title: route.params.branchName })} />
            <RootStack.Screen name="QRCode" component={QRCodeScreen} options={{ title: 'Admission QR Code' }} />
            <RootStack.Screen name="BranchForm" component={BranchFormScreen} options={{ title: 'Branch Details' }} />
            <RootStack.Screen name="RoomDetails" component={RoomDetailsScreen} options={{ title: 'Room Details' }} />
            <RootStack.Screen name="RoomForm" component={RoomFormScreen} options={{ title: 'Room Details' }} />
            <RootStack.Screen name="TenantProfile" component={TenantProfileScreen} options={{ title: 'Tenant Profile' }} />
            <RootStack.Screen name="MoveTenant" component={MoveTenantScreen} options={{ title: 'Reallocate Room' }} />
            <RootStack.Screen name="AdmissionReview" component={AdmissionReviewScreen} options={{ title: 'Review Application' }} />
            <RootStack.Screen name="PaymentsDashboard" component={PaymentsDashboardScreen} options={{ title: 'Payments Summary' }} />
            <RootStack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  bellButton: {
    marginRight: 16,
    padding: 4,
  },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 11,
  },
});
