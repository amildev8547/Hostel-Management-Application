import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Image, Modal, TouchableOpacity, Linking } from 'react-native';
import { Text, Surface, Card, Button, useTheme, Divider, List, Portal, Dialog, TextInput, Chip, IconButton } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../services/api';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { showAlert, showConfirm } from '../../utils/alerts';
import { getBackendBaseUrl } from '../../utils/backendUrl';

type TenantProfileRouteProp = RouteProp<RootStackParamList, 'TenantProfile'>;
type TenantProfileNavigationProp = StackNavigationProp<RootStackParamList, 'TenantProfile'>;

interface TenantProfileScreenProps {
  route: TenantProfileRouteProp;
  navigation: TenantProfileNavigationProp;
}

export default function TenantProfileScreen({ route, navigation }: TenantProfileScreenProps) {
  const { tenantId } = route.params;
  const theme = useTheme();
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeImageModal, setActiveImageModal] = useState<string | null>(null);

  // Custom rent invoice dialog (create or edit a prorated/discounted RENT invoice)
  const [rentDialogVisible, setRentDialogVisible] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [daysInput, setDaysInput] = useState('30');
  const [discountInput, setDiscountInput] = useState('0');
  const [isSavingInvoice, setIsSavingInvoice] = useState(false);

  const { data: tenant, isLoading, refetch, isRefetching } = useQuery<any>({
    queryKey: ['tenantProfile', tenantId],
    queryFn: async () => {
      const response = await apiClient.get(`/tenants/${tenantId}`);
      return response.data;
    },
  });

  const handleVacate = () => {
    showConfirm(
      'Are you sure you want to mark this tenant as Vacated? This will release their bed and make it immediately available.',
      async () => {
        setIsProcessing(true);
        try {
          await apiClient.post(`/tenants/${tenantId}/vacate`);
          showAlert('Tenant marked as Vacated');
          refetch();
        } catch (err: any) {
          console.error(err);
          showAlert(err.response?.data?.error || 'Failed to vacate tenant');
        } finally {
          setIsProcessing(false);
        }
      },
      { title: 'Confirm Vacate', confirmText: 'Vacate', destructive: true }
    );
  };

  const handleDelete = () => {
    showConfirm(
      'Are you sure you want to delete this tenant record permanently? All payments history will be deleted.',
      async () => {
        setIsProcessing(true);
        try {
          await apiClient.delete(`/tenants/${tenantId}`);
          showAlert('Tenant record deleted successfully');
          navigation.navigate('Main');
        } catch (err: any) {
          console.error(err);
          showAlert(err.response?.data?.error || 'Failed to delete tenant');
        } finally {
          setIsProcessing(false);
        }
      },
      { title: 'Delete Tenant', confirmText: 'Delete', destructive: true }
    );
  };

  const openAddRentDialog = () => {
    setEditingPaymentId(null);
    setDaysInput('30');
    setDiscountInput('0');
    setRentDialogVisible(true);
  };

  const openEditRentDialog = (pay: any) => {
    setEditingPaymentId(pay.id);
    setDaysInput(String(pay.daysBilled ?? 30));
    setDiscountInput(String(pay.discountAmount ?? 0));
    setRentDialogVisible(true);
  };

  const monthlyRent = tenant?.room?.monthlyRent ?? 0;
  const perDayRate = monthlyRent / 30;
  const parsedDays = Math.max(0, Number(daysInput) || 0);
  const parsedDiscount = Math.max(0, Number(discountInput) || 0);
  const previewOriginal = Math.round(perDayRate * parsedDays);
  const previewFinal = Math.max(0, previewOriginal - parsedDiscount);

  const handleSaveRentInvoice = async () => {
    if (!parsedDays || parsedDays < 1 || parsedDays > 31) {
      showAlert('Enter a valid number of days (1-31).');
      return;
    }

    setIsSavingInvoice(true);
    try {
      if (editingPaymentId) {
        await apiClient.put(`/payments/${editingPaymentId}/customize`, {
          days: parsedDays,
          discountAmount: parsedDiscount,
        });
      } else {
        await apiClient.post(`/tenants/${tenantId}/rent`, {
          days: parsedDays,
          discountAmount: parsedDiscount,
        });
      }
      setRentDialogVisible(false);
      refetch();
    } catch (err: any) {
      console.error(err);
      showAlert(err.response?.data?.error || 'Failed to save rent invoice');
    } finally {
      setIsSavingInvoice(false);
    }
  };

  // Dial a phone number directly (tenant contact or guardian)
  const handleCallNumber = (phone?: string) => {
    if (!phone) return;
    Linking.openURL(`tel:+91${phone}`).catch(() => showAlert('Unable to open the dialer on this device.'));
  };

  // Open a quick WhatsApp chat with the tenant (no pre-filled message)
  const handleOpenWhatsAppChat = async (whatsappNumber?: string) => {
    if (!whatsappNumber) return;
    const url = `https://wa.me/91${whatsappNumber.replace(/\D/g, '')}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      Linking.openURL(url);
    } else {
      showAlert('WhatsApp is not installed on this device.');
    }
  };

  // Share a payment's amount + payment link to the tenant's WhatsApp number
  const handleSharePaymentLink = async (pay: any) => {
    setIsProcessing(true);
    try {
      const linkResponse = await apiClient.post(`/payments/${pay.id}/link`);
      const paymentLinkUrl = linkResponse.data.paymentLinkUrl;
      const payUrl = paymentLinkUrl || `${getBackendBaseUrl()}/pay/${pay.id}`;

      const phone = tenant.whatsappNumber || tenant.phone || '';
      const branchName = tenant.room?.branch?.name || '';
      const roomInfo = tenant.room ? `Room ${tenant.room.roomNumber}` : '';

      const message = [
        `Hello ${tenant.name},`,
        ``,
        `Your rent for *${branchName}*${roomInfo ? ` (${roomInfo})` : ''} is ready.`,
        ``,
        `💰 *Amount: ₹${pay.amount}*`,
        `📅 Due Date: ${new Date(pay.dueDate).toLocaleDateString('en-IN')}`,
        ``,
        `Pay securely here:`,
        payUrl,
        ``,
        `— HostelHub`,
      ].join('\n');

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

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Text>Loading profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[theme.colors.primary]} />
      }
    >
      {/* Image Modal for Aadhaar zooming */}
      <Modal visible={!!activeImageModal} transparent={true} onRequestClose={() => setActiveImageModal(null)}>
        <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setActiveImageModal(null)}>
          {activeImageModal && (
            <Image source={{ uri: activeImageModal }} style={styles.zoomedImage} resizeMode="contain" />
          )}
        </TouchableOpacity>
      </Modal>

      {/* Custom Rent Invoice Dialog: prorate by days + optional discount */}
      <Portal>
        <Dialog visible={rentDialogVisible} onDismiss={() => setRentDialogVisible(false)}>
          <Dialog.Title>{editingPaymentId ? 'Edit Rent Invoice' : 'Add Rent Invoice'}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodySmall" style={{ color: '#64748B', marginBottom: 8 }}>
              Stay Duration (Days)
            </Text>
            <View style={styles.dayChipsRow}>
              {[10, 15, 20, 30].map((d) => (
                <Chip
                  key={d}
                  selected={daysInput === String(d)}
                  onPress={() => setDaysInput(String(d))}
                  style={{ marginRight: 8, marginBottom: 8 }}
                >
                  {d} days
                </Chip>
              ))}
            </View>
            <TextInput
              label="Custom Days"
              value={daysInput}
              onChangeText={setDaysInput}
              keyboardType="numeric"
              mode="outlined"
              style={{ marginBottom: 12 }}
            />
            <TextInput
              label="Discount Amount (₹)"
              value={discountInput}
              onChangeText={setDiscountInput}
              keyboardType="numeric"
              mode="outlined"
              style={{ marginBottom: 12 }}
            />

            <Surface style={styles.invoicePreview} elevation={0}>
              <View style={styles.invoicePreviewRow}>
                <Text variant="bodySmall" style={{ color: '#64748B' }}>
                  {parsedDays} days × ₹{perDayRate.toFixed(2)}/day
                </Text>
                <Text variant="bodySmall" style={{ color: '#64748B' }}>₹{previewOriginal}</Text>
              </View>
              {parsedDiscount > 0 && (
                <View style={styles.invoicePreviewRow}>
                  <Text variant="bodySmall" style={{ color: theme.colors.error }}>Discount</Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.error }}>-₹{parsedDiscount}</Text>
                </View>
              )}
              <Divider style={{ marginVertical: 6 }} />
              <View style={styles.invoicePreviewRow}>
                <Text style={{ fontWeight: '800', color: '#0F172A' }}>Total Due</Text>
                <Text style={{ fontWeight: '800', color: theme.colors.primary }}>₹{previewFinal}</Text>
              </View>
            </Surface>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRentDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleSaveRentInvoice} loading={isSavingInvoice} disabled={isSavingInvoice}>
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* 1. Profile Header Card */}
      <Surface style={styles.headerCard} elevation={1}>
        <View style={styles.headerRow}>
          <Image
            source={{ uri: tenant.profilePhotoUrl || 'https://via.placeholder.com/150' }}
            style={styles.avatar}
          />
          <View style={styles.headerInfo}>
            <Text variant="headlineSmall" style={styles.tenantName}>{tenant.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: tenant.status === 'ACTIVE' ? '#D1FAE5' : '#FEE2E2',
                  },
                ]}
              >
                <Text style={{ fontSize: 10, fontWeight: '800', color: tenant.status === 'ACTIVE' ? '#065F46' : '#B91C1C' }}>
                  {tenant.status}
                </Text>
              </View>
            </View>
            <Text variant="bodySmall" style={{ color: '#64748B', marginTop: 6, fontWeight: '500' }}>
              Joined: {new Date(tenant.joiningDate).toLocaleDateString()}
            </Text>
          </View>
        </View>

        <Divider style={{ marginVertical: 16 }} />

        {/* Room Alloc Details */}
        <View style={styles.roomSpecs}>
          <View style={styles.specCell}>
            <Text variant="bodySmall" style={styles.specLabel}>Branch</Text>
            <Text variant="titleMedium" style={styles.specVal}>{tenant.room.branch.name}</Text>
          </View>
          <View style={[styles.specCell, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#E2E8F0' }]}>
            <Text variant="bodySmall" style={styles.specLabel}>Room Number</Text>
            <Text variant="titleMedium" style={styles.specVal}>Room {tenant.room.roomNumber}</Text>
          </View>
          <View style={styles.specCell}>
            <Text variant="bodySmall" style={styles.specLabel}>Monthly Rent</Text>
            <Text variant="titleMedium" style={[styles.specVal, { color: theme.colors.primary }]}>₹{tenant.room.monthlyRent}</Text>
          </View>
        </View>
      </Surface>

      {/* 2. Personal & Guardian Details */}
      <Text variant="titleMedium" style={styles.sectionTitle}>Personal & Guardian Details</Text>
      <Card style={styles.infoCard}>
        <Card.Content>
          <View style={styles.detailsGrid}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Contact Phone</Text>
              <TouchableOpacity style={styles.detailValueRow} onPress={() => handleCallNumber(tenant.phone)}>
                <Text style={[styles.detailVal, { color: '#0EA5E9' }]}>+91 {tenant.phone}</Text>
                <Icon name="phone" size={15} color="#0EA5E9" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>WhatsApp Number</Text>
              <TouchableOpacity style={styles.detailValueRow} onPress={() => handleOpenWhatsAppChat(tenant.whatsappNumber)}>
                <Text style={[styles.detailVal, { color: '#25D366' }]}>+91 {tenant.whatsappNumber}</Text>
                <Icon name="whatsapp" size={15} color="#25D366" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Occupation</Text>
              <Text style={styles.detailVal}>{tenant.occupation}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Work/Study Location</Text>
              <Text style={styles.detailVal}>{tenant.workLocation}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Guardian Name</Text>
              <Text style={styles.detailVal}>{tenant.guardianName}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Guardian Phone</Text>
              <TouchableOpacity style={styles.detailValueRow} onPress={() => handleCallNumber(tenant.guardianPhone)}>
                <Text style={[styles.detailVal, { color: '#0EA5E9' }]}>{tenant.guardianPhone}</Text>
                <Icon name="phone" size={15} color="#0EA5E9" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Nearest Police Station</Text>
              <Text style={styles.detailVal}>{tenant.nearestPoliceStation}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Permanent Address</Text>
              <Text style={styles.detailVal}>{tenant.address}</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* 3. Uploaded S3 Documents */}
      <Text variant="titleMedium" style={styles.sectionTitle}>Uploaded Documents</Text>
      <Card style={styles.infoCard}>
        <Card.Content>
          <Text variant="bodySmall" style={{ color: '#64748B', marginBottom: 10 }}>Tap image to expand document preview</Text>
          <View style={styles.docsRow}>
            {tenant.aadhaarFrontUrl ? (
              <TouchableOpacity onPress={() => setActiveImageModal(tenant.aadhaarFrontUrl)}>
                <Image source={{ uri: tenant.aadhaarFrontUrl }} style={styles.docThumb} />
                <Text variant="labelSmall" style={styles.docThumbLabel}>Aadhaar Front</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.noDoc}><Text>No Aadhaar Front</Text></View>
            )}

            {tenant.aadhaarBackUrl ? (
              <TouchableOpacity onPress={() => setActiveImageModal(tenant.aadhaarBackUrl)}>
                <Image source={{ uri: tenant.aadhaarBackUrl }} style={styles.docThumb} />
                <Text variant="labelSmall" style={styles.docThumbLabel}>Aadhaar Back</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.noDoc}><Text>No Aadhaar Back</Text></View>
            )}
          </View>
        </Card.Content>
      </Card>

      {/* 4. Payment History */}
      <View style={styles.paymentsSectionHeader}>
        <Text variant="titleMedium" style={[styles.sectionTitle, { marginHorizontal: 0 }]}>Payments History</Text>
        {tenant.status === 'ACTIVE' && (
          <Button mode="text" icon="plus" compact onPress={openAddRentDialog}>
            Add Rent Invoice
          </Button>
        )}
      </View>
      <Card style={styles.infoCard}>
        <Card.Content style={{ padding: 8 }}>
          {tenant.payments && tenant.payments.length > 0 ? (
            tenant.payments.map((pay: any, idx: number) => (
              <View key={pay.id}>
                {idx > 0 && <Divider />}
                <View style={styles.paymentRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ fontWeight: '700', color: '#334155' }}>
                      ₹{pay.amount} ({pay.paymentType})
                    </Text>
                    <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                      Due: {new Date(pay.dueDate).toLocaleDateString()}
                    </Text>
                    {!!pay.daysBilled && (
                      <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                        {pay.daysBilled} days billed
                        {pay.discountAmount > 0 ? ` • Discount -₹${pay.discountAmount}` : ''}
                      </Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text
                      style={[
                        styles.paymentStatusText,
                        {
                          color:
                            pay.status === 'PAID'
                              ? (theme.colors as any).success
                              : pay.status === 'OVERDUE'
                              ? theme.colors.error
                              : (theme.colors as any).warning,
                        },
                      ]}
                    >
                      {pay.status}
                    </Text>
                    {pay.paidDate && (
                      <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
                        {new Date(pay.paidDate).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row' }}>
                    {pay.status === 'PENDING' && pay.paymentType === 'RENT' && (
                      <IconButton
                        icon="pencil-outline"
                        size={18}
                        onPress={() => openEditRentDialog(pay)}
                        style={{ margin: 0 }}
                        disabled={isProcessing}
                      />
                    )}
                    {pay.status !== 'PAID' && (
                      <IconButton
                        icon="whatsapp"
                        iconColor="#25D366"
                        size={18}
                        onPress={() => handleSharePaymentLink(pay)}
                        style={{ margin: 0 }}
                        disabled={isProcessing}
                      />
                    )}
                  </View>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyPayments}>
              <Text style={{ color: '#64748B' }}>No payment logs recorded yet.</Text>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* 5. Quick Admin Commands */}
      {tenant.status === 'ACTIVE' && (
        <View style={styles.actionButtons}>
          <Button
            mode="contained"
            icon="door-open"
            style={styles.actionBtn}
            onPress={() => navigation.navigate('MoveTenant', { tenantId: tenant.id, branchId: tenant.room.branchId })}
          >
            Move Room
          </Button>
          <Button
            mode="outlined"
            icon="logout"
            textColor={(theme.colors as any).warning}
            style={[styles.actionBtn, { borderColor: (theme.colors as any).warning }]}
            onPress={handleVacate}
            disabled={isProcessing}
          >
            Vacate
          </Button>
        </View>
      )}

      <Button
        mode="text"
        icon="delete"
        textColor={theme.colors.error}
        style={{ marginHorizontal: 16, marginTop: 10, marginBottom: 40 }}
        onPress={handleDelete}
        disabled={isProcessing}
      >
        Delete Tenant Profile
      </Button>
    </ScrollView>
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
  headerCard: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  headerInfo: {
    marginLeft: 20,
    flex: 1,
  },
  tenantName: {
    fontWeight: '800',
    color: '#0F172A',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  roomSpecs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  specCell: {
    alignItems: 'center',
    flex: 1,
  },
  specLabel: {
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 4,
    fontSize: 12,
  },
  specVal: {
    fontWeight: '800',
    color: '#1E293B',
    fontSize: 14,
  },
  sectionTitle: {
    fontWeight: '800',
    color: '#0F172A',
    marginHorizontal: 16,
    marginBottom: 10,
    marginTop: 8,
  },
  paymentsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    marginTop: 8,
  },
  dayChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  invoicePreview: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
  },
  invoicePreviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  infoCard: {
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
  },
  detailsGrid: {
    gap: 12,
  },
  detailRow: {
    borderBottomWidth: 1,
    borderColor: '#F8FAFC',
    paddingBottom: 8,
  },
  detailLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 2,
  },
  detailVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  detailValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  docsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  docThumb: {
    width: 120,
    height: 80,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  docThumbLabel: {
    textAlign: 'center',
    fontWeight: '700',
    color: '#475569',
    marginTop: 4,
  },
  noDoc: {
    width: 120,
    height: 80,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  paymentStatusText: {
    fontWeight: '800',
    fontSize: 12,
  },
  emptyPayments: {
    padding: 20,
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    marginHorizontal: 16,
    gap: 12,
    marginTop: 8,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 8,
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomedImage: {
    width: '95%',
    height: '80%',
  },
});
