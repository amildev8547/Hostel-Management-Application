import React, { useCallback, useState } from 'react';
import { RefreshControl } from 'react-native';

type Props = {
  color: string;
  onRefresh: () => Promise<unknown> | void;
};

export default function ManualRefreshControl({ color, onRefresh }: Props) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh, refreshing]);

  return <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[color]} tintColor={color} />;
}
