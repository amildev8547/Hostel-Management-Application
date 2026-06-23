import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Image, Modal, TouchableOpacity } from 'react-native';
import { Text, Surface, Card, Button, useTheme, Divider, SegmentedButtons } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../services/api';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { showAlert, showConfirm } from '../../utils/alerts';

type AdmissionReviewRouteProp = RouteProp<RootStackParamList, 'AdmissionReview'>;
type AdmissionReviewNavigationProp = StackNavigationProp<RootStackParamList, 'AdmissionReview'>;

interface AdmissionReviewScreenProps {
  route: AdmissionReviewRouteProp;
  navigation: AdmissionReviewNavigationProp;
}

export default function AdmissionReviewScreen({ route, navigation }: AdmissionReviewScreenProps) {
  const { applicationId } = route.params;
  const theme = useTheme();
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

  // Fetch vacant/partial rooms in the branch for allocation
  const { data: rooms, isLoading: roomsLoading } = useQuery<any[]>({
    queryKey: ['allocationRooms', application?.branchId],
    queryFn: async () => {
      const response = await apiClient.get('/rooms', { params: { branchId: application.branchId } });
      // Only show rooms with vacancy
      return response.data.filter((r: any) => r.status !== 'FULL' && r.status !== 'MAINTENANCE');
    },
    enabled: !!application && application.status === 'PENDING',
  });

  const handleProcess = (status: 'APPROVED' | 'REJECTED') => {
    if (status === 'APPROVED' && !selectedRoomId) {
      showAlert('Please select an available room to allocate the applicant.');
      return;
    }

    const proceed = async () => {
      setIsProcessing(true);
      try {
        await apiClient.post(`/admissions/${applicationId}/review`, {
          status,
          roomId: status === 'APPROVED' ? selectedRoomId : undefined,
        });
        showAlert(`Application successfully ${status.toLowerCase()}`, 'Success', () => navigation.goBack());
      } catch (err: any) {
        console.error(err);
        showAlert(err.response?.data?.error || 'Failed to complete review');
      } finally {
        setIsProcessing(false);
      }
    };

    if (status === 'APPROVED' && application.paymentStatus !== 'PAID') {
      showConfirm(
        'Warning: The applicant has not paid the admission fee. Proceed with approval anyway?',
        proceed,
        { title: 'Unpaid Admission Fee', confirmText: 'Proceed' }
      );
      return;
    }

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
              Apply Branch: {application.branch.name}
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
                  Status: {application.status}
                </Text>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: application.paymentStatus === 'PAID' ? '#D1FAE5' : '#FEF3C7',
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '800',
                    color: application.paymentStatus === 'PAID' ? '#065F46' : '#D97706',
                  }}
                >
                  Fee: {application.paymentStatus}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Surface>

      {/* 2. Applicant details */}
      <Text variant="titleMedium" style={styles.sectionTitle}>Application Details</Text>
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
              <Text style={styles.detailLabel}>Occupation</Text>
              <Text style={styles.detailVal}>{application.occupation}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Work/Study Location</Text>
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
              <Text style={styles.detailLabel}>Preferred Sharing</Text>
              <Text style={styles.detailVal}>{application.preferredRoomType} sharing</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Expected Joining Date</Text>
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
                <Text style={styles.detailLabel}>Applicant Notes</Text>
                <Text style={styles.detailVal}>{application.notes}</Text>
              </View>
            )}
          </View>
        </Card.Content>
      </Card>

      {/* 3. Uploaded documents */}
      <Text variant="titleMedium" style={styles.sectionTitle}>Identity Verification Documents</Text>
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
          <Text variant="titleMedium" style={styles.sectionTitle}>Room Allocation</Text>
          <Card style={styles.infoCard}>
            <Card.Content>
              <Text variant="bodySmall" style={{ color: '#64748B', marginBottom: 12 }}>
                Select a room in {application.branch.name} to allocate this resident:
              </Text>
              {roomsLoading ? (
                <Text>Loading available rooms...</Text>
              ) : rooms && rooms.length > 0 ? (
                <ScrollView style={{ maxHeight: 200 }}>
                  <RadioButtonGroup
                    options={rooms.map((r: any) => ({
                      label: `Room ${r.roomNumber} (${r.roomType}) - ${r.occupied}/${r.capacity} occupied`,
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
              disabled={isProcessing || !selectedRoomId}
              loading={isProcessing}
            >
              Approve & Assign
            </Button>
            <Button
              mode="outlined"
              icon="close"
              textColor={theme.colors.error}
              style={[styles.actionBtn, { borderColor: theme.colors.error }]}
              onPress={() => handleProcess('REJECTED')}
              disabled={isProcessing}
            >
              Reject
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
            This application has been processed as {application.status.toUpperCase()}.
          </Text>
        </Surface>
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
    flexDirection: 'row',
    marginHorizontal: 16,
    gap: 12,
    marginTop: 8,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 8,
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
