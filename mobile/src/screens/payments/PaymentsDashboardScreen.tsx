import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Linking, Alert, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, Surface, Card, Button, useTheme, SegmentedButtons, Divider, IconButton, ActivityIndicator, Portal, Modal } from 'react-native-paper';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../services/api';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { showAlert } from '../../utils/alerts';
import { getBackendBaseUrl } from '../../utils/backendUrl';

type PaymentsDashboardRouteProp = RouteProp<RootStackParamList, 'PaymentsDashboard'>;
type PaymentsDashboardNavigationProp = StackNavigationProp<RootStackParamList, 'PaymentsDashboard'>;

interface PaymentsDashboardScreenProps {
  route: PaymentsDashboardRouteProp;
  navigation: PaymentsDashboardNavigationProp;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function PaymentsDashboardScreen({ route, navigation }: PaymentsDashboardScreenProps) {
  const { branchId } = route.params || {};
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [activeSegment, setActiveSegment] = useState('pending');
  const [isProcessing, setIsProcessing] = useState(false);

  // Month/year being viewed — defaults to the current month. Collections can't exist
  // for a month that hasn't happened yet, so navigation is capped at the current month.
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth); // 0-11
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [pickerYear, setPickerYear] = useState(currentYear);

  // Edit amount modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingPayment, setEditingPayment] = useState<any>(null);
  const [editAmount, setEditAmount] = useState('');
  const [isSavingAmount, setIsSavingAmount] = useState(false);

  const isCurrentMonth = selectedYear === currentYear && selectedMonth === currentMonth;
  const isFutureMonth = (monthIndex: number, year: number) =>
    year > currentYear || (year === currentYear && monthIndex > currentMonth);

  const openMonthPicker = () => {
    setPickerYear(selectedYear);
    setMonthPickerVisible(true);
  };

  const handleSelectMonth = (monthIndex: number) => {
    if (isFutureMonth(monthIndex, pickerYear)) return;
    setSelectedMonth(monthIndex);
    setSelectedYear(pickerYear);
    setMonthPickerVisible(false);
  };

  const goToPrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (isCurrentMonth) return;
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  // Fetch payments list for the selected month
  const { data: payments, isLoading, refetch, isRefetching } = useQuery<any[]>({
    queryKey: ['paymentsList', branchId, activeSegment, selectedMonth, selectedYear],
    queryFn: async () => {
      // Set status filter based on segment selection
      const statusMap: Record<string, string> = {
        paid: 'PAID',
        pending: 'PENDING',
        overdue: 'OVERDUE',
      };
      const response = await apiClient.get('/payments', {
        params: {
          branchId,
          status: statusMap[activeSegment],
          month: selectedMonth + 1,
          year: selectedYear,
        },
      });
      return response.data;
    },
  });

  // Calculate high level summaries from list, scoped to the selected month
  const { data: allPayments } = useQuery<any[]>({
    queryKey: ['allPaymentsSummary', branchId, selectedMonth, selectedYear],
    queryFn: async () => {
      const response = await apiClient.get('/payments', {
        params: { branchId, month: selectedMonth + 1, year: selectedYear },
      });
      return response.data;
    },
  });

  let collectedThisMonth = 0;
  let pendingCollection = 0;
  let overdueCollection = 0;

  if (allPayments) {
    allPayments.forEach((p: any) => {
      if (p.status === 'PAID') collectedThisMonth += p.amount;
      else if (p.status === 'PENDING') pendingCollection += p.amount;
      else if (p.status === 'OVERDUE') overdueCollection += p.amount;
    });
  }

  const handleGenerateDues = async () => {
    setIsProcessing(true);
    try {
      const response = await apiClient.post('/payments/generate-dues');
      showAlert(response.data.message || 'Rent dues generation complete.');
      refetch();
    } catch (err: any) {
      console.error(err);
      showAlert(err.response?.data?.error || 'Failed to generate dues');
    } finally {
      setIsProcessing(false);
    }
  };

  // Notify the tenant on WhatsApp that their payment has been received & approved
  const sendPaymentReceivedWhatsApp = async (pay: any, paymentMethod: string) => {
    const phone = pay.tenant?.whatsappNumber || pay.tenant?.phone || '';
    if (!phone) return;

    const tenantName = pay.tenant?.name || 'Tenant';
    const branchName = pay.branch?.name || '';
    const roomInfo = pay.tenant?.room ? `Room ${pay.tenant.room.roomNumber}` : '';
    const methodLabel = paymentMethod === 'CASH' ? 'Cash' : 'UPI / Bank Transfer';

    const message = [
      `Hello ${tenantName},`,
      ``,
      `✅ We have received your payment for *${branchName}*${roomInfo ? ` (${roomInfo})` : ''}.`,
      ``,
      `💰 *Amount Paid: ₹${pay.amount}*`,
      `🧾 Payment Method: ${methodLabel}`,
      `📅 Date: ${new Date().toLocaleDateString('en-IN')}`,
      ``,
      `Thank you for your payment!`,
      `— HostelHub`,
    ].join('\n');

    const whatsappUrl = `https://wa.me/91${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    const canOpen = await Linking.canOpenURL(whatsappUrl);
    if (canOpen) {
      Linking.openURL(whatsappUrl);
    }
  };

  const recordPayment = async (pay: any, paymentMethod: string) => {
    setIsProcessing(true);
    try {
      await apiClient.post(`/payments/${pay.id}/record-pay`, { paymentMethod });
      showAlert('Payment recorded successfully.');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['allPaymentsSummary'] });
      await sendPaymentReceivedWhatsApp(pay, paymentMethod);
    } catch (err: any) {
      console.error(err);
      showAlert(err.response?.data?.error || 'Failed to record payment');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRecordManualPayment = (pay: any) => {
    Alert.alert(
      'Record Payment',
      `Mark payment of ₹${pay.amount} as PAID. Select the payment method received:`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Cash', onPress: () => recordPayment(pay, 'CASH') },
        { text: 'UPI / Bank', onPress: () => recordPayment(pay, 'UPI') },
      ]
    );
  };

  // ── Edit Amount ───────────────────────────────────────────────────────
  const openEditAmountModal = (payment: any) => {
    setEditingPayment(payment);
    setEditAmount(String(payment.amount));
    setEditModalVisible(true);
  };

  const handleSaveAmount = async () => {
    if (!editingPayment) return;
    const newAmount = parseFloat(editAmount);
    if (isNaN(newAmount) || newAmount <= 0) {
      showAlert('Please enter a valid amount greater than 0');
      return;
    }

    setIsSavingAmount(true);
    try {
      await apiClient.put(`/payments/${editingPayment.id}/edit-amount`, {
        amount: newAmount,
      });
      showAlert('Amount updated successfully!');
      setEditModalVisible(false);
      setEditingPayment(null);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['allPaymentsSummary'] });
    } catch (err: any) {
      console.error(err);
      showAlert(err.response?.data?.error || 'Failed to update amount');
    } finally {
      setIsSavingAmount(false);
    }
  };

  // ── Share via WhatsApp with Payment Link ──────────────────────────────
  const handleSharePaymentLink = async (payment: any) => {
    setIsProcessing(true);
    try {
      // 1. Generate payment link (creates Razorpay link or sandbox mock link)
      const linkResponse = await apiClient.post(`/payments/${payment.id}/link`);
      const paymentLinkUrl = linkResponse.data.paymentLinkUrl;

      // Build the payment URL — prefer the Razorpay link, fall back to sandbox
      const payUrl = paymentLinkUrl || `${getBackendBaseUrl()}/pay/${payment.id}`;

      const tenantName = payment.tenant?.name || 'Tenant';
      const phone = payment.tenant?.whatsappNumber || payment.tenant?.phone || '';
      const branchName = payment.branch?.name || '';
      const roomInfo = payment.tenant?.room
        ? `Room ${payment.tenant.room.roomNumber}`
        : '';

      // 2. Compose a friendly WhatsApp message with the payment link on its own line
      const message = [
        `Hello ${tenantName},`,
        ``,
        `Your rent for *${branchName}*${roomInfo ? ` (${roomInfo})` : ''} is ready.`,
        ``,
        `💰 *Amount: ₹${payment.amount}*`,
        `📅 Due Date: ${new Date(payment.dueDate).toLocaleDateString('en-IN')}`,
        ``,
        `Pay securely here:`,
        payUrl,
        ``,
        `— HostelHub`,
      ].join('\n');

      // 3. Open WhatsApp with pre-filled message
      const whatsappUrl = phone
        ? `https://wa.me/91${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`
        : `https://wa.me/?text=${encodeURIComponent(message)}`;

      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
      } else {
        showAlert('WhatsApp is not installed on this device. The payment link has been generated — you can copy and share it manually.');
      }
    } catch (err: any) {
      console.error(err);
      showAlert(err.response?.data?.error || 'Failed to generate payment link');
    } finally {
      setIsProcessing(false);
    }
  };

  // Legacy reminder (console-only, no payment link)
  const handleSendReminder = async (paymentId: string) => {
    setIsProcessing(true);
    try {
      const response = await apiClient.post(`/payments/${paymentId}/reminder`);
      const { text, phone } = response.data;

      // Construct WhatsApp link
      const whatsappUrl = `https://wa.me/91${phone}?text=${encodeURIComponent(text)}`;
      Linking.openURL(whatsappUrl).catch(() => {
        showAlert('Could not open WhatsApp. Reminder printed to backend console.');
      });
    } catch (err: any) {
      console.error(err);
      showAlert('Failed to send reminder');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* 0. Month/Year Navigator */}
      <View style={styles.monthNav}>
        <IconButton icon="chevron-left" size={22} onPress={goToPrevMonth} style={{ margin: 0 }} />
        <TouchableOpacity onPress={openMonthPicker} style={styles.monthNavLabel}>
          <Icon name="calendar-month-outline" size={18} color={theme.colors.primary} />
          <Text variant="titleMedium" style={styles.monthNavText}>
            {MONTH_NAMES[selectedMonth]} {selectedYear}
          </Text>
        </TouchableOpacity>
        <IconButton
          icon="chevron-right"
          size={22}
          onPress={goToNextMonth}
          disabled={isCurrentMonth}
          style={{ margin: 0 }}
        />
      </View>

      <View style={styles.headerGrid}>
        <Surface style={styles.headerCell} elevation={1}>
          <Text style={[styles.headerCellLabel, { color: (theme.colors as any).success }]}>Collected</Text>
          <Text variant="titleMedium" style={styles.headerCellVal}>₹{collectedThisMonth}</Text>
        </Surface>
        <Surface style={styles.headerCell} elevation={1}>
          <Text style={[styles.headerCellLabel, { color: (theme.colors as any).warning }]}>Pending</Text>
          <Text variant="titleMedium" style={styles.headerCellVal}>₹{pendingCollection}</Text>
        </Surface>
        <Surface style={styles.headerCell} elevation={1}>
          <Text style={[styles.headerCellLabel, { color: (theme.colors as any).error }]}>Overdue</Text>
          <Text variant="titleMedium" style={styles.headerCellVal}>₹{overdueCollection}</Text>
        </Surface>
      </View>

      {/* 2. Operations trigger bar */}
      <View style={styles.operationsBar}>
        <Button
          mode="contained"
          icon="calendar-sync"
          onPress={handleGenerateDues}
          disabled={isProcessing}
          loading={isProcessing}
          style={{ flex: 1 }}
        >
          Generate Rent Invoices
        </Button>
      </View>

      {/* 3. Navigation segments */}
      <View style={styles.segmentWrapper}>
        <SegmentedButtons
          value={activeSegment}
          onValueChange={setActiveSegment}
          buttons={[
            { value: 'pending', label: 'Pending', icon: 'clock-outline' },
            { value: 'overdue', label: 'Overdue', icon: 'alert-circle-outline' },
            { value: 'paid', label: 'Paid Logs', icon: 'check-all' },
          ]}
        />
      </View>

      {/* 4. Payments list view */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[theme.colors.primary]} />
          }
        >
          {payments && payments.length > 0 ? (
            payments.map((pay: any) => {
              const name = pay.tenant?.name || pay.admissionApplication?.name || 'Applicant';
              const phone = pay.tenant?.phone || pay.admissionApplication?.phone || 'N/A';
              const roomDetails = pay.tenant?.room
                ? `Room ${pay.tenant.room.roomNumber} (${pay.tenant.room.roomType})`
                : `${pay.paymentType} Pre-Allocation`;

              return (
                <Card key={pay.id} style={styles.payCard}>
                  <Card.Content>
                    <View style={styles.payHeader}>
                      <View style={{ flex: 1 }}>
                        <Text variant="titleMedium" style={{ fontWeight: '800' }}>{name}</Text>
                        <Text variant="bodySmall" style={styles.paySubText}>📞 {phone} • {pay.branch.name}</Text>
                        <Text variant="bodySmall" style={styles.paySubText}>{roomDetails}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text variant="titleMedium" style={{ fontWeight: '800', color: theme.colors.primary }}>
                          ₹{pay.amount}
                        </Text>
                        <Text variant="bodySmall" style={{ color: '#64748B', marginTop: 4 }}>
                          {pay.paymentType}
                        </Text>
                        {pay.discountAmount > 0 && (
                          <Text variant="bodySmall" style={{ color: (theme.colors as any).success, fontSize: 11 }}>
                            Discount: ₹{pay.discountAmount}
                          </Text>
                        )}
                      </View>
                    </View>

                    <Divider style={{ marginVertical: 10 }} />

                    <View style={styles.payBody}>
                      <View>
                        <Text variant="bodySmall" style={{ color: '#64748B' }}>
                          Due Date: {new Date(pay.dueDate).toLocaleDateString()}
                        </Text>
                        {pay.paidDate && (
                          <Text variant="bodySmall" style={{ color: (theme.colors as any).success, fontWeight: '600', marginTop: 2 }}>
                            Paid on: {new Date(pay.paidDate).toLocaleDateString()} via {pay.paymentMethod}
                          </Text>
                        )}
                      </View>

                      {pay.status !== 'PAID' && (
                        <View style={styles.rowActions}>
                          <IconButton
                            icon="pencil"
                            iconColor={theme.colors.primary}
                            size={18}
                            style={styles.actionIconButton}
                            onPress={() => openEditAmountModal(pay)}
                          />
                          <IconButton
                            icon="whatsapp"
                            iconColor="#25D366"
                            size={20}
                            style={styles.actionIconButton}
                            onPress={() => handleSharePaymentLink(pay)}
                          />
                          <IconButton
                            icon="check-circle-outline"
                            iconColor={(theme.colors as any).success}
                            size={20}
                            style={styles.actionIconButton}
                            onPress={() => handleRecordManualPayment(pay)}
                          />
                        </View>
                      )}
                    </View>
                  </Card.Content>
                </Card>
              );
            })
          ) : (
            <View style={styles.emptyContainer}>
              <Icon name="cash-multiple" size={48} color="#94A3B8" />
              <Text style={{ marginTop: 8, color: '#64748B', fontWeight: '500' }}>
                No payment transactions found in this state.
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Edit Amount Modal ──────────────────────────────────────────── */}
      <Portal>
        <Modal
          visible={editModalVisible}
          onDismiss={() => setEditModalVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <View style={styles.modalHeader}>
            <Icon name="currency-inr" size={28} color={theme.colors.primary} />
            <Text variant="titleLarge" style={styles.modalTitle}>Edit Rent Amount</Text>
          </View>

          {editingPayment && (
            <View style={styles.modalBody}>
              <Text style={styles.modalTenantName}>
                {editingPayment.tenant?.name || 'Tenant'}
              </Text>
              <Text style={styles.modalRoomInfo}>
                {editingPayment.tenant?.room
                  ? `Room ${editingPayment.tenant.room.roomNumber} • ${editingPayment.branch?.name}`
                  : editingPayment.branch?.name}
              </Text>

              <View style={styles.modalAmountRow}>
                <Text style={styles.modalAmountLabel}>Original Amount</Text>
                <Text style={styles.modalAmountOriginal}>
                  ₹{editingPayment.tenant?.room?.monthlyRent || editingPayment.amount}
                </Text>
              </View>

              <View style={styles.amountInputWrapper}>
                <Text style={styles.currencySymbol}>₹</Text>
                <TextInput
                  style={styles.amountInput}
                  value={editAmount}
                  onChangeText={setEditAmount}
                  keyboardType="numeric"
                  placeholder="Enter new amount"
                  placeholderTextColor="#94A3B8"
                  selectTextOnFocus
                />
              </View>

              <View style={styles.modalActions}>
                <Button
                  mode="outlined"
                  onPress={() => setEditModalVisible(false)}
                  style={styles.modalActionBtn}
                  disabled={isSavingAmount}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={handleSaveAmount}
                  style={[styles.modalActionBtn, { backgroundColor: theme.colors.primary }]}
                  loading={isSavingAmount}
                  disabled={isSavingAmount}
                >
                  Save Amount
                </Button>
              </View>
            </View>
          )}
        </Modal>
      </Portal>

      {/* ── Month/Year Picker Modal ───────────────────────────────────── */}
      <Portal>
        <Modal
          visible={monthPickerVisible}
          onDismiss={() => setMonthPickerVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <View style={styles.modalHeader}>
            <Icon name="calendar-month-outline" size={26} color={theme.colors.primary} />
            <Text variant="titleLarge" style={styles.modalTitle}>Select Month & Year</Text>
          </View>

          <View style={styles.modalBody}>
            <View style={styles.yearStepper}>
              <IconButton icon="chevron-left" size={22} onPress={() => setPickerYear((y) => y - 1)} style={{ margin: 0 }} />
              <Text variant="titleLarge" style={{ fontWeight: '800', color: '#0F172A' }}>{pickerYear}</Text>
              <IconButton
                icon="chevron-right"
                size={22}
                onPress={() => setPickerYear((y) => y + 1)}
                disabled={pickerYear >= currentYear}
                style={{ margin: 0 }}
              />
            </View>

            <View style={styles.monthGrid}>
              {MONTH_NAMES.map((name, idx) => {
                const isSelected = idx === selectedMonth && pickerYear === selectedYear;
                const isDisabled = isFutureMonth(idx, pickerYear);
                return (
                  <TouchableOpacity
                    key={name}
                    style={[
                      styles.monthGridCell,
                      isSelected && { backgroundColor: theme.colors.primary },
                    ]}
                    onPress={() => handleSelectMonth(idx)}
                    disabled={isDisabled}
                  >
                    <Text
                      style={[
                        styles.monthGridCellText,
                        isSelected && { color: '#FFFFFF' },
                        isDisabled && styles.monthGridCellTextDisabled,
                      ]}
                    >
                      {name.slice(0, 3)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
  },
  monthNavLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  monthNavText: {
    fontWeight: '800',
    color: '#0F172A',
  },
  yearStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 16,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  monthGridCell: {
    width: '30%',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  monthGridCellText: {
    fontWeight: '700',
    color: '#334155',
    fontSize: 13,
  },
  monthGridCellTextDisabled: {
    color: '#94A3B8',
    opacity: 0.5,
  },
  headerGrid: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  headerCell: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  headerCellLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerCellVal: {
    fontWeight: '800',
    color: '#0F172A',
  },
  operationsBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  segmentWrapper: {
    padding: 16,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  payCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
  },
  payHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  paySubText: {
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  payBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowActions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionIconButton: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    margin: 0,
  },
  linkInfo: {
    backgroundColor: '#EEF2FF',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },

  /* ── Edit Amount Modal ──────────────────────────────────── */
  modalContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 24,
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  modalTitle: {
    fontWeight: '800',
    color: '#0F172A',
  },
  modalBody: {
    padding: 20,
  },
  modalTenantName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  modalRoomInfo: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
    marginBottom: 16,
  },
  modalAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  modalAmountLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  modalAmountOriginal: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '700',
    textDecorationLine: 'line-through',
  },
  amountInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4F46E5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    backgroundColor: '#F8FAFC',
    marginBottom: 20,
  },
  currencySymbol: {
    fontSize: 22,
    fontWeight: '800',
    color: '#4F46E5',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    paddingVertical: 10,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalActionBtn: {
    flex: 1,
    borderRadius: 10,
  },
});
