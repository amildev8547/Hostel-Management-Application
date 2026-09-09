import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Image, Modal, TouchableOpacity } from 'react-native';
import { Text, Surface, Card, Button, useTheme, Divider, SegmentedButtons } from 'react-native-paper';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../services/api';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp as StackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { showAlert, showConfirm } from '../../utils/alerts';
import { invalidateHostelData } from '../../utils/queryInvalidation';

type AdmissionReviewRouteProp = RouteProp<RootStackParamList, 'AdmissionReview'>;
type AdmissionReviewNavigationProp = StackNavigationProp<RootStackParamList, 'AdmissionReview'>;

interface AdmissionReviewScreenProps {
  route: AdmissionReviewRouteProp;
  navigation: AdmissionReviewNavigationProp;
}

export default function AdmissionReviewScreen({ route, navigation }: AdmissionReviewScreenProps) {
  const { applicationId } = route.params;
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [activeImageModal, setActiveImageModal] = useState<string | null>(null);

  // Fetch application details
  const { data: application, isLoading: appLoading, refetch, isRefetching } = useQuery<any>({
    queryKey: ['admissionDetails', applicationId],
    queryFn: async () => {
      const response = await apiClient.get(`/admissions/${applicationId}`);
      return response.data;
    },
  });

  useEffect(() => {
    if (application?.booking?.roomId) setSelectedRoomId(application.booking.roomId);
  }, [application?.booking?.roomId]);

  // Fetch vacant/partial rooms in the branch for allocation
  const { data: rooms, isLoading: roomsLoading } = useQuery<any[]>({
    queryKey: ['allocationRooms', application?.branchId],
    queryFn: async () => {
      const response = await apiClient.get('/rooms', { params: { branchId: application.branchId } });
      // Only show rooms with vacancy
      return response.data.filter((r: any) => r.vacant > 0);
    },
    enabled: !!application && application.status === 'PENDING',
  });

  const admissionPayment = application?.payments?.find((payment: any) => payment.paymentType === 'ADMISSION');
  const joiningFeePaid = application?.paymentStatus === 'PAID' && admissionPayment?.status === 'PAID';

  const changeJoiningFeeStatus = (paymentStatus: 'PAID' | 'PENDING', paymentMethod: 'CASH' | 'UPI' = 'CASH') => {
    const markingPaid = paymentStatus === 'PAID';
    showConfirm(
      markingPaid
        ? `Confirm that ${admissionPayment?.amount != null ? `₹${admissionPayment.amount}` : 'the joining fee'} was received by ${paymentMethod === 'CASH' ? 'cash' : 'UPI or bank transfer'}?`
        : 'Change the joining fee back to “Not paid”? The application cannot be approved until the fee is marked paid again.',
      async () => {
        setIsProcessing(true);
        try {
          await apiClient.patch(`/admissions/${applicationId}/fee-status`, { paymentStatus, paymentMethod });
          await invalidateHostelData(queryClient, { branchId: application.branchId, applicationId });
          await refetch();
          showAlert(
            markingPaid
              ? 'Joining fee marked as paid. You can now approve the admission.'
              : 'Joining fee marked as not paid.',
          );
        } catch (err: any) {
          showAlert(err.response?.data?.error || 'Could not change the joining fee status.');
        } finally {
          setIsProcessing(false);
        }
      },
      {
        title: markingPaid ? 'Mark joining fee paid' : 'Mark joining fee not paid',
        confirmText: markingPaid ? 'Confirm received' : 'Change status',
        destructive: !markingPaid,
      },
    );
  };

  const handleDeleteApplication = () => {
    showConfirm(
      `Delete ${application.name}’s application? Its joining-fee record and uploaded document records will also be removed. If this came from an advance booking, the reservation and secure link will stay active for a corrected submission.`,
      async () => {
        setIsProcessing(true);
        try {
          const response = await apiClient.delete(`/admissions/${applicationId}`);
          await invalidateHostelData(queryClient, { branchId: application.branchId, applicationId });
          await queryClient.invalidateQueries({ queryKey: ['bookings'] });
          queryClient.removeQueries({ queryKey: ['admissionDetails', applicationId] });
          showAlert(response.data?.message || 'Application deleted.', 'Application deleted', () => navigation.goBack());
        } catch (err: any) {
          showAlert(err.response?.data?.error || 'Could not delete this application.');
        } finally {
          setIsProcessing(false);
        }
      },
      { title: 'Delete application?', confirmText: 'Delete application', destructive: true },
    );
  };

  const handleProcess = (status: 'APPROVED' | 'REJECTED') => {
    if (status === 'APPROVED' && !joiningFeePaid) {
      showAlert('The joining fee must be marked as paid before this admission can be approved.');
      return;
    }

    if (status === 'APPROVED' && !selectedRoomId) {
      showAlert('Please select an available room to allocate the applicant.');
      return;
    }

    const proceed = async () => {
      setIsProcessing(true);
      try {
        const response = await apiClient.post(`/admissions/${applicationId}/review`, {
          status,
          roomId: status === 'APPROVED' ? selectedRoomId : undefined,
        });
        await invalidateHostelData(queryClient, {
          branchId: application.branchId,
          applicationId,
          roomId: selectedRoomId,
        });
        await queryClient.invalidateQueries({ queryKey: ['bookings'] });
        showAlert(
          response.data?.message || (status === 'APPROVED' ? 'Application accepted and room assigned.' : 'Application declined.'),
          'Success',
          () => navigation.goBack()
        );
      } catch (err: any) {
        console.error(err);
        showAlert(err.response?.data?.error || 'Failed to complete review');
      } finally {
        setIsProcessing(false);
      }
    };

    proceed();
  };

  if (appLoading) {
    return (
      <View style={styles.center}>
        <Text>Loading Application...</Text>
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
      {/* Zoom Image Modal */}
      <Modal visible={!!activeImageModal} transparent={true} onRequestClose={() => setActiveImageModal(null)}>
        <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setActiveImageModal(null)}>
          {activeImageModal && (
            <Image source={{ uri: activeImageModal }} style={styles.zoomedImage} resizeMode="contain" />
          )}
        </TouchableOpacity>
      </Modal>

      {/* 1. Header Card */}
      <Surface style={styles.headerCard} elevation={1}>
        <View style={styles.headerRow}>
          <Image
            source={{ uri: application.profilePhotoUrl || 'https://via.placeholder.com/150' }}
            style={styles.avatar}
          />
          <View style={styles.headerInfo}>
            <Text variant="headlineSmall" style={styles.applicantName}>{application.name}</Text>
            <Text variant="bodyMedium" style={{ color: '#64748B', marginTop: 4 }}>
              Wants to stay at: {application.branch?.name || 'Branch not available'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      application.status === 'PENDING'
                        ? '#FEF3C7'
                        : application.status === 'APPROVED'
                        ? '#D1FAE5'
                        : '#FEE2E2',
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '800',
                    color:
                      application.status === 'PENDING'
                        ? '#D97706'
                        : application.status === 'APPROVED'
                        ? '#065F46'
                        : '#B91C1C',
                  }}
                >
                  {application.status === 'PENDING' ? 'Waiting for your decision' : application.status === 'APPROVED' ? 'Accepted' : 'Not accepted'}
                </Text>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: joiningFeePaid ? '#D1FAE5' : '#FEF3C7',
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '800',
                    color: joiningFeePaid ? '#065F46' : '#D97706',
                  }}
                >
                  Joining fee: {joiningFeePaid ? 'Paid' : 'Not paid'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Surface>

      {(
        <Surface
          style={[styles.feeCard, joiningFeePaid && styles.feeCardPaid]}
          elevation={1}
        >
          <View style={styles.feeHeading}>
            <Icon name={joiningFeePaid ? 'cash-check' : 'cash-clock'} size={25} color={joiningFeePaid ? '#059669' : '#D97706'} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.feeTitle, joiningFeePaid && styles.feeTitlePaid]}>
                Joining fee: {joiningFeePaid ? 'Paid' : 'Not paid'}
              </Text>
              <Text style={styles.feeAmount}>₹{admissionPayment?.amount ?? 0}</Text>
            </View>
          </View>
          <Text style={styles.feeHelp}>
            {joiningFeePaid
              ? 'If this was marked by mistake, the admin can change it back to not paid.'
              : application.status === 'PENDING'
                ? 'After checking that the money was actually received, choose how it was paid. Admission approval stays locked until then.'
                : 'The admin can correct this fee status without changing the resident or application status.'}
          </Text>
          {joiningFeePaid ? (
            <Button
              mode="outlined"
              icon="undo"
              textColor={theme.colors.error}
              disabled={isProcessing}
              onPress={() => changeJoiningFeeStatus('PENDING')}
              style={styles.feeButton}
            >
              Change to not paid
            </Button>
          ) : (
            <>
              <Button mode="contained" icon="cash" disabled={isProcessing} onPress={() => changeJoiningFeeStatus('PAID', 'CASH')} style={styles.feeButton}>Received by cash</Button>
              <Button mode="outlined" icon="bank-transfer" disabled={isProcessing} onPress={() => changeJoiningFeeStatus('PAID', 'UPI')} style={styles.feeButton}>Received by UPI / bank</Button>
            </>
          )}
        </Surface>
      )}

      {/* 2. Applicant details */}
      <Text variant="titleMedium" style={styles.sectionTitle}>Personal and contact information</Text>
      <Card style={styles.infoCard}>
        <Card.Content>
          <View style={styles.detailsGrid}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Contact Phone</Text>
              <Text style={styles.detailVal}>+91 {application.phone}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>WhatsApp Number</Text>
              <Text style={styles.detailVal}>+91 {application.whatsappNumber}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Work or studies</Text>
              <Text style={styles.detailVal}>{application.occupation}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Work or college location</Text>
              <Text style={styles.detailVal}>{application.workLocation}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Guardian Name</Text>
              <Text style={styles.detailVal}>{application.guardianName}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Guardian Phone</Text>
              <Text style={styles.detailVal}>{application.guardianPhone}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Preferred room type</Text>
              <Text style={styles.detailVal}>{String(application.preferredRoomType).replace('Share', 'people')}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Plans to move in on</Text>
              <Text style={styles.detailVal}>{new Date(application.joiningDate).toLocaleDateString()}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Nearest Police Station</Text>
              <Text style={styles.detailVal}>{application.nearestPoliceStation}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Permanent Address</Text>
              <Text style={styles.detailVal}>{application.address}</Text>
            </View>
            {application.notes && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Message from applicant</Text>
                <Text style={styles.detailVal}>{application.notes}</Text>
              </View>
            )}
          </View>
        </Card.Content>
      </Card>

      {/* 3. Uploaded documents */}
      <Text variant="titleMedium" style={styles.sectionTitle}>Identity documents</Text>
      <Card style={styles.infoCard}>
        <Card.Content>
          <View style={styles.docsRow}>
            {application.aadhaarFrontUrl ? (
              <TouchableOpacity onPress={() => setActiveImageModal(application.aadhaarFrontUrl)}>
                <Image source={{ uri: application.aadhaarFrontUrl }} style={styles.docThumb} />
                <Text variant="labelSmall" style={styles.docThumbLabel}>Aadhaar Front</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.noDoc}><Text>No Aadhaar Front</Text></View>
            )}

            {application.aadhaarBackUrl ? (
              <TouchableOpacity onPress={() => setActiveImageModal(application.aadhaarBackUrl)}>
                <Image source={{ uri: application.aadhaarBackUrl }} style={styles.docThumb} />
                <Text variant="labelSmall" style={styles.docThumbLabel}>Aadhaar Back</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.noDoc}><Text>No Aadhaar Back</Text></View>
            )}
          </View>
        </Card.Content>
      </Card>

      {/* 4. Room Allocation - Show only when PENDING */}
      {application.status === 'PENDING' && (
        <>
          <Text variant="titleMedium" style={styles.sectionTitle}>Choose a room</Text>
          <Card style={styles.infoCard}>
            <Card.Content>
              <Text variant="bodySmall" style={{ color: '#64748B', marginBottom: 12 }}>
                Choose where {application.name} will stay. Only rooms with a free bed are shown.
              </Text>
              {application.booking ? (
                <Surface style={{ padding: 14, borderRadius: 12, backgroundColor: '#FEF3C7' }} elevation={0}>
                  <Text style={{ color: '#78350F', fontWeight: '800' }}>Reserved room and bed</Text>
                  <Text style={{ color: '#57534E', marginTop: 5 }}>Room {application.booking.room.roomNumber} · Bed {application.booking.bedNumber}</Text>
                  <Text style={{ color: '#57534E', marginTop: 3 }}>This reserved place will be used when you accept the application.</Text>
                </Surface>
              ) : roomsLoading ? (
                <Text>Loading available rooms...</Text>
              ) : rooms && rooms.length > 0 ? (
                <ScrollView style={{ maxHeight: 200 }}>
                  <RadioButtonGroup
                    options={rooms.map((r: any) => ({
                      label: `Room ${r.roomNumber} · ${r.occupied} of ${r.capacity} beds in use`,
                      value: r.id,
                    }))}
                    selectedValue={selectedRoomId}
                    onValueChange={setSelectedRoomId}
                  />
                </ScrollView>
              ) : (
                <Text style={{ color: theme.colors.error, fontWeight: '700' }}>
                  ⚠️ No available rooms with free beds in this branch. Please create a room first.
                </Text>
              )}
            </Card.Content>
          </Card>

          {/* Review actions */}
          <View style={styles.actionRow}>
            <Button
              mode="contained"
              icon="check"
              onPress={() => handleProcess('APPROVED')}
              style={[styles.actionBtn, { backgroundColor: (theme.colors as any).success }]}
              disabled={isProcessing || !selectedRoomId || !joiningFeePaid}
              loading={isProcessing}
            >
              Accept and assign room
            </Button>
            <Button
              mode="outlined"
              icon="close"
              textColor={theme.colors.error}
              style={[styles.actionBtn, { borderColor: theme.colors.error }]}
              onPress={() => handleProcess('REJECTED')}
              disabled={isProcessing}
            >
              Decline request
            </Button>
          </View>
        </>
      )}

      {application.status !== 'PENDING' && (
        <Surface style={[styles.processedBanner, { backgroundColor: application.status === 'APPROVED' ? '#EBFDF4' : '#FEF2F2' }]} elevation={1}>
          <Icon
            name={application.status === 'APPROVED' ? 'check-circle-outline' : 'close-circle-outline'}
            size={24}
            color={application.status === 'APPROVED' ? '#10B981' : '#EF4444'}
          />
          <Text
            style={{
              marginLeft: 8,
              fontWeight: '700',
              color: application.status === 'APPROVED' ? '#065F46' : '#991B1B',
            }}
          >
            This application was {application.status === 'APPROVED' ? 'accepted' : 'not accepted'}.
          </Text>
        </Surface>
      )}

      {application.status !== 'APPROVED' && (
        <Button
          mode="outlined"
          icon="delete-outline"
          textColor={theme.colors.error}
          style={styles.deleteApplicationButton}
          contentStyle={styles.deleteApplicationButtonContent}
          disabled={isProcessing}
          onPress={handleDeleteApplication}
        >
          Delete this application
        </Button>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// Simple internal Radio Group implementation to avoid dependency issues
function RadioButtonGroup({
  options,
  selectedValue,
  onValueChange,
}: {
  options: { label: string; value: string }[];
  selectedValue: string;
  onValueChange: (val: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: 8 }}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[
            styles.radioRow,
            {
              borderColor: selectedValue === opt.value ? theme.colors.primary : '#E2E8F0',
              backgroundColor: selectedValue === opt.value ? '#EEF2FF' : '#FFFFFF',
            },
          ]}
          onPress={() => onValueChange(opt.value)}
        >
          <View
            style={[
              styles.radioDot,
              { borderColor: selectedValue === opt.value ? theme.colors.primary : '#94A3B8' },
            ]}
          >
            {selectedValue === opt.value && (
              <View style={[styles.radioDotInner, { backgroundColor: theme.colors.primary }]} />
            )}
          </View>
          <Text style={{ marginLeft: 10, fontWeight: '600', fontSize: 13, color: '#334155' }}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
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
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  headerInfo: {
    marginLeft: 16,
    flex: 1,
  },
  applicantName: {
    fontWeight: '800',
    color: '#0F172A',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  feeCard: { marginHorizontal: 16, marginBottom: 16, padding: 16, borderRadius: 14, backgroundColor: '#FFFBEB' },
  feeCardPaid: { backgroundColor: '#ECFDF5' },
  feeHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  feeTitle: { color: '#78350F', fontSize: 15, fontWeight: '800' },
  feeTitlePaid: { color: '#065F46' },
  feeAmount: { color: '#0F172A', fontSize: 20, fontWeight: '900', marginTop: 2 },
  feeHelp: { color: '#57534E', fontSize: 13, lineHeight: 19, marginTop: 10, marginBottom: 8 },
  feeButton: { borderRadius: 10, marginTop: 8 },
  sectionTitle: {
    fontWeight: '800',
    color: '#0F172A',
    marginHorizontal: 16,
    marginBottom: 10,
    marginTop: 8,
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
  actionRow: {
    marginHorizontal: 16,
    gap: 12,
    marginTop: 8,
  },
  actionBtn: {
    borderRadius: 12,
    minHeight: 50,
    justifyContent: 'center',
  },
  processedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  deleteApplicationButton: {
    marginHorizontal: 16,
    marginTop: 16,
    borderColor: '#EF4444',
    borderRadius: 12,
  },
  deleteApplicationButtonContent: {
    minHeight: 50,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  radioDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
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
