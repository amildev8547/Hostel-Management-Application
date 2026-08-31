import { QueryClient } from '@tanstack/react-query';

type HostelInvalidationScope = {
  branchId?: string;
  roomId?: string;
  tenantId?: string;
  applicationId?: string;
};

export function invalidateHostelData(
  queryClient: QueryClient,
  scope: HostelInvalidationScope = {}
) {
  const invalidate = (queryKey: unknown[]) => {
    void queryClient.invalidateQueries({ queryKey });
  };

  invalidate(['dashboardMetrics']);
  invalidate(['branchesList']);
  invalidate(['admissionsList']);
  invalidate(['tenantsList']);
  invalidate(['paymentsList']);
  invalidate(['allPaymentsSummary']);
  invalidate(['notifications']);

  if (scope.branchId) {
    invalidate(['branchDashboard', scope.branchId]);
    invalidate(['branchRooms', scope.branchId]);
    invalidate(['allocationRooms', scope.branchId]);
    invalidate(['moveRoomsList', scope.branchId]);
  }

  if (scope.roomId) {
    invalidate(['roomDetails', scope.roomId]);
  }

  if (scope.tenantId) {
    invalidate(['tenantProfile', scope.tenantId]);
    invalidate(['tenantMoveProfile', scope.tenantId]);
  }

  if (scope.applicationId) {
    invalidate(['admissionDetails', scope.applicationId]);
  }
}
