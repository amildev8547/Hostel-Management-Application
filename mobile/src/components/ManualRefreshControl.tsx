import React, { useCallback, useState } from 'react';
import { RefreshControl, RefreshControlProps } from 'react-native';

type Props = {
  color: string;
  onRefresh: () => Promise<unknown> | void;
} & Pick<RefreshControlProps, 'children' | 'style'>;

export default function ManualRefreshControl({ color, onRefresh, children, style }: Props) {
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

  // Android and React Native Web clone the supplied refresh control and place
  // the actual ScrollView/FlatList inside it. Preserve those injected props or
  // the navigation shell renders while the complete screen body disappears.
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={handleRefresh}
      colors={[color]}
      tintColor={color}
      style={style}
    >
      {children}
    </RefreshControl>
  );
}
