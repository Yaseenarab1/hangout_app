import React from 'react';
import { Switch as RNSwitch, View, Text, StyleSheet, Platform } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

export type SwitchProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label?: string;
  hint?: string;
  disabled?: boolean;
};

export function Switch({
  value,
  onValueChange,
  label,
  hint,
  disabled,
}: SwitchProps): React.ReactElement {
  const theme = useTheme();

  const trackOff = theme.mode === 'dark' ? theme.colors.bg.muted : '#D4D4D8';

  const switchEl = (
    <RNSwitch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: trackOff, true: theme.colors.accent }}
      thumbColor={Platform.OS === 'ios' ? '#FFFFFF' : value ? theme.colors.accentHover : '#F4F4F5'}
      ios_backgroundColor={trackOff}
      accessibilityRole="switch"
      accessibilityLabel={label}
    />
  );

  if (!label && !hint) return switchEl;

  return (
    <View style={styles.row}>
      <View style={{ flex: 1, paddingRight: 16 }}>
        {label ? (
          <Text style={[theme.typography.body, { color: theme.colors.text.primary }]}>
            {label}
          </Text>
        ) : null}
        {hint ? (
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.text.secondary, marginTop: 2 },
            ]}
          >
            {hint}
          </Text>
        ) : null}
      </View>
      {switchEl}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
});
