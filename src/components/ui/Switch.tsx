import React from 'react';
import { Switch as RNSwitch, SwitchProps as RNSwitchProps, View, Text } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

export type SwitchProps = Omit<RNSwitchProps, 'trackColor' | 'thumbColor'> & {
  /** Override the on-state track color. Defaults to the theme accent. */
  activeColor?: string;
  /** If provided, renders a label + optional hint in a row with the switch. */
  label?: string;
  hint?: string;
};

/**
 * Themed wrapper around React Native's built-in Switch.
 * When `label` is provided, renders a labeled row: [label/hint] [switch].
 */
export function Switch({ activeColor, value, label, hint, ...rest }: SwitchProps): React.ReactElement {
  const theme = useTheme();
  const onColor = activeColor ?? theme.colors.accent;

  const toggle = (
    <RNSwitch
      value={value}
      trackColor={{ false: theme.colors.border.default, true: onColor }}
      thumbColor="#FFFFFF"
      ios_backgroundColor={theme.colors.border.default}
      {...rest}
    />
  );

  if (!label) return toggle;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={[theme.typography.body, { color: theme.colors.text.primary }]}>
          {label}
        </Text>
        {hint ? (
          <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary, marginTop: 2 }]}>
            {hint}
          </Text>
        ) : null}
      </View>
      {toggle}
    </View>
  );
}
