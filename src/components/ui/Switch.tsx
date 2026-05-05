import React from 'react';
import { Switch as RNSwitch, SwitchProps as RNSwitchProps } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

export type SwitchProps = Omit<RNSwitchProps, 'trackColor' | 'thumbColor'> & {
  /** Override the on-state track color. Defaults to the theme accent. */
  activeColor?: string;
};

/**
 * Themed wrapper around React Native's built-in Switch.
 * Uses the brand accent color when on, neutral track when off.
 */
export function Switch({ activeColor, value, ...rest }: SwitchProps): React.ReactElement {
  const theme = useTheme();
  const onColor = activeColor ?? theme.colors.accent;
  return (
    <RNSwitch
      value={value}
      trackColor={{ false: theme.colors.border.default, true: onColor }}
      thumbColor="#FFFFFF"
      ios_backgroundColor={theme.colors.border.default}
      {...rest}
    />
  );
}
