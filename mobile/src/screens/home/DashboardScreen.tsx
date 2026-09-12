import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Surface, useTheme } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { NativeStackNavigationProp as StackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import apiClient from '../../services/api';
import { RootStackParamList } from '../../navigation';
import { showAlert } from '../../utils/alerts';
import ManualRefreshControl from '../../components/ManualRefreshControl';

type DashboardScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Main'>;
interface DashboardScreenProps { navigation: DashboardScreenNavigationProp; }
type SummaryCardProps = { icon: keyof typeof Icon.glyphMap; value: string | number; label: string; help: string; color: string; onPress: () => void; };

function SummaryCard({ icon, value, label, help, color, onPress }: SummaryCardProps) {
  return (
    <TouchableOpacity style={styles.summaryCard} onPress={onPress} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={`${label}: ${value}. ${help}`}>
      <View style={[styles.summaryIcon, { backgroundColor: `${color}18` }]}><Icon name={icon} size={27} color={color} /></View>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryHelp}>{help}</Text>
      <View style={styles.openRow}><Text style={[styles.openText, { color }]}>Open</Text><Icon name="chevron-right" size={20} color={color} /></View>
    </TouchableOpacity>
  );
}

export default function DashboardScreen({ navigation }: DashboardScreenProps) {
  const theme = useTheme();
  const { data: dashboardData, isLoading, refetch } = useQuery({
    queryKey: ['dashboardMetrics'],
    queryFn: async () => (await apiClient.get('/dashboard')).data,
    placeholderData: (previousData) => previousData,
  });
  const metrics = dashboardData?.metrics || { totalBranches: 0, totalRooms: 0, totalCapacity: 0, occupiedBeds: 0, reservedBeds: 0, vacantBeds: 0, monthlyCollection: 0, pendingCollection: 0, overdueCollection: 0, pendingAdmissions: 0 };
  const legacyMovement = dashboardData?.residentMovement || { joined: 0, left: 0 };
  const residentMovementHistory = dashboardData?.residentMovementHistory?.length
    ? dashboardData.residentMovementHistory
    : Array.from({ length: 12 }, (_, index) => {
        const date = new Date(new Date().getFullYear(), new Date().getMonth() - index, 1);
        return { month: date.getMonth() + 1, year: date.getFullYear(), joined: index === 0 ? legacyMovement.joined : 0, left: index === 0 ? legacyMovement.left : 0 };
      });
  const highestMovement = residentMovementHistory.reduce(
    (highest: number, item: any) => Math.max(highest, Number(item.joined) || 0, Number(item.left) || 0),
    1,
  );
  const openTab = (screen: 'Branches' | 'Admissions') => navigation.navigate('Main', { screen } as any);

  if (isLoading) return <View style={styles.center}><Text style={styles.loadingText}>Loading home page…</Text></View>;

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} contentContainerStyle={styles.content} refreshControl={<ManualRefreshControl onRefresh={refetch} color={theme.colors.primary} />}>
      <Text variant="headlineSmall" style={styles.welcome}>Hostel at a glance</Text>
      <Text style={styles.intro}>Tap any box below to see the full details.</Text>

      <TouchableOpacity style={styles.occupancyCard} onPress={() => openTab('Branches')} activeOpacity={0.8} accessibilityRole="button">
        <View style={styles.occupancyTop}>
          <View><Text style={styles.occupancyLabel}>Beds currently in use</Text><Text style={styles.occupancyValue}>{metrics.occupiedBeds} of {metrics.totalCapacity}</Text></View>
          <View style={styles.bedIcon}><Icon name="bed" size={28} color="#7DD3FC" /></View>
        </View>
        <View style={styles.occupancyBottom}><Text style={styles.vacantText}>{metrics.vacantBeds} available · {metrics.reservedBeds || 0} reserved</Text><Text style={styles.viewText}>View branches  ›</Text></View>
      </TouchableOpacity>

      <View style={styles.summaryGrid}>
        <SummaryCard icon="office-building-outline" value={metrics.totalBranches} label="Hostel branches" help="View all locations" color="#4F46E5" onPress={() => openTab('Branches')} />
        <SummaryCard icon="door-open" value={metrics.totalRooms} label="Rooms" help="Find rooms by branch" color="#0284C7" onPress={() => openTab('Branches')} />
        <SummaryCard icon="account-clock-outline" value={metrics.pendingAdmissions} label="Applications waiting" help="Review new requests" color="#D97706" onPress={() => openTab('Admissions')} />
        <SummaryCard icon="cash-check" value={`₹${metrics.monthlyCollection}`} label="Rent received" help={`₹${metrics.pendingCollection} still due`} color="#059669" onPress={() => navigation.navigate('PaymentsDashboard', {})} />
      </View>

      <Text variant="titleLarge" style={styles.sectionTitle}>Common tasks</Text>
      <Surface style={styles.actionsCard} elevation={1}>
        <ActionRow icon="office-building-plus-outline" color="#4F46E5" background="#EEF2FF" title="Add a hostel branch" help="Create a new location" onPress={() => navigation.navigate('BranchForm', {})} />
        <View style={styles.divider} />
        <ActionRow icon="bed" color="#7C3AED" background="#F3E8FF" title="Book a bed" help="Reserve a place using basic details" onPress={() => navigation.navigate('BookingForm')} />
        <View style={styles.divider} />
        <ActionRow icon="door-open" color="#0284C7" background="#E0F2FE" title="Add or view rooms" help="Choose a branch to continue" onPress={() => metrics.totalBranches ? openTab('Branches') : showAlert('Please add a hostel branch first.')} />
        <View style={styles.divider} />
        <ActionRow icon="file-account-outline" color="#D97706" background="#FEF3C7" title="Review applications" help="Approve or reject requests" onPress={() => openTab('Admissions')} />
        <View style={styles.divider} />
        <ActionRow icon="cash-multiple" color="#059669" background="#D1FAE5" title="Manage rent payments" help="See paid, due, and late rent" onPress={() => navigation.navigate('PaymentsDashboard', {})} />
      </Surface>

      <Surface style={styles.movementCard} elevation={1}>
        <View style={styles.movementHeader}>
          <View style={styles.movementHeaderIcon}><Icon name="chart-bar" size={25} color="#4F46E5" /></View>
          <View style={styles.movementHeaderCopy}>
            <Text style={styles.movementTitle}>Resident movement</Text>
            <Text style={styles.movementHint}>Latest months first. Swipe sideways to see older months.</Text>
          </View>
        </View>
        <View style={styles.chartLegend}>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#10B981' }]} /><Text style={styles.legendText}>Joined</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#F97316' }]} /><Text style={styles.legendText}>Moved out</Text></View>
        </View>
        <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartContent} style={styles.chartScroll}>
          {residentMovementHistory.map((item: any) => {
            const joined = Number(item.joined) || 0;
            const left = Number(item.left) || 0;
            const joinedHeight = joined === 0 ? 5 : Math.max(14, Math.round((joined / highestMovement) * 82));
            const leftHeight = left === 0 ? 5 : Math.max(14, Math.round((left / highestMovement) * 82));
            const monthName = new Date(item.year, item.month - 1, 1).toLocaleDateString('en-IN', { month: 'short' });
            return (
              <View key={`${item.year}-${item.month}`} style={styles.chartMonth} accessibilityLabel={`${monthName} ${item.year}: ${joined} joined and ${left} moved out`}>
                <View style={styles.barArea}>
                  <View style={styles.barColumn}><Text style={styles.barValue}>{joined}</Text><View style={[styles.bar, { height: joinedHeight, backgroundColor: '#10B981' }]} /></View>
                  <View style={styles.barColumn}><Text style={styles.barValue}>{left}</Text><View style={[styles.bar, { height: leftHeight, backgroundColor: '#F97316' }]} /></View>
                </View>
                <Text style={styles.chartMonthName}>{monthName}</Text>
                <Text style={styles.chartYear}>{item.year}</Text>
              </View>
            );
          })}
        </ScrollView>
      </Surface>
    </ScrollView>
  );
}

function ActionRow({ icon, color, background, title, help, onPress }: { icon: keyof typeof Icon.glyphMap; color: string; background: string; title: string; help: string; onPress: () => void }) {
  return <TouchableOpacity style={styles.actionRow} onPress={onPress} accessibilityRole="button"><View style={[styles.actionIcon, { backgroundColor: background }]}><Icon name={icon} size={26} color={color} /></View><View style={styles.actionCopy}><Text style={styles.actionTitle}>{title}</Text><Text style={styles.actionHelp}>{help}</Text></View><Icon name="chevron-right" size={26} color="#64748B" /></TouchableOpacity>;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, content: { padding: 18, paddingBottom: 36 }, center: { flex: 1, justifyContent: 'center', alignItems: 'center' }, loadingText: { fontSize: 17, color: '#475569' },
  welcome: { fontWeight: '800', color: '#0F172A' }, intro: { color: '#64748B', fontSize: 15, marginTop: 4, marginBottom: 18 },
  occupancyCard: { backgroundColor: '#172554', borderRadius: 20, padding: 20, marginBottom: 16 }, occupancyTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, occupancyLabel: { color: '#DBEAFE', fontSize: 15, fontWeight: '600' }, occupancyValue: { color: '#FFFFFF', fontSize: 27, lineHeight: 34, fontWeight: '900', marginTop: 2 }, bedIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#FFFFFF20', justifyContent: 'center', alignItems: 'center' }, occupancyBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }, vacantText: { color: '#E0F2FE', fontWeight: '600' }, viewText: { color: '#7DD3FC', fontWeight: '800' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, summaryCard: { width: '48%', minHeight: 184, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' }, summaryIcon: { width: 46, height: 46, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 10 }, summaryValue: { color: '#0F172A', fontSize: 24, lineHeight: 30, fontWeight: '900' }, summaryLabel: { color: '#1E293B', fontSize: 15, fontWeight: '800', marginTop: 2 }, summaryHelp: { color: '#64748B', fontSize: 12, lineHeight: 17, marginTop: 4, flex: 1 }, openRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 }, openText: { fontSize: 14, fontWeight: '800' },
  movementCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 15, marginTop: 26 },
  movementHeader: { flexDirection: 'row', alignItems: 'center' },
  movementHeaderIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  movementHeaderCopy: { flex: 1, marginLeft: 12 },
  movementTitle: { color: '#0F172A', fontSize: 17, fontWeight: '800' },
  movementHint: { color: '#64748B', fontSize: 13, lineHeight: 18, marginTop: 2 },
  chartLegend: { flexDirection: 'row', gap: 18, marginTop: 15 },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  legendText: { color: '#475569', fontSize: 13, fontWeight: '700' },
  chartScroll: { marginTop: 13 },
  chartContent: { gap: 8, paddingRight: 8 },
  chartMonth: { width: 90, alignItems: 'center', borderRadius: 12, backgroundColor: '#F8FAFC', paddingTop: 8, paddingBottom: 9 },
  barArea: { height: 110, flexDirection: 'row', alignItems: 'flex-end', gap: 7 },
  barColumn: { width: 27, height: 104, justifyContent: 'flex-end', alignItems: 'center' },
  barValue: { color: '#334155', fontSize: 12, fontWeight: '800', marginBottom: 4 },
  bar: { width: 24, borderRadius: 7 },
  chartMonthName: { color: '#1E293B', fontSize: 13, fontWeight: '800', marginTop: 7 },
  chartYear: { color: '#94A3B8', fontSize: 11, marginTop: 1 },
  sectionTitle: { fontWeight: '800', color: '#0F172A', marginTop: 26, marginBottom: 12 }, actionsCard: { backgroundColor: '#FFFFFF', borderRadius: 18, overflow: 'hidden' }, actionRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 }, actionIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' }, actionCopy: { flex: 1, marginHorizontal: 13 }, actionTitle: { color: '#1E293B', fontSize: 16, fontWeight: '800' }, actionHelp: { color: '#64748B', fontSize: 13, marginTop: 3 }, divider: { height: 1, backgroundColor: '#E2E8F0', marginLeft: 75 },
});
