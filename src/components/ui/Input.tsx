import React, { forwardRef } from 'react';
import {
  TextInput,
  View,
  Text,
  StyleSheet,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';

export type InputProps = Omit<TextInputProps, 'style'> & {
  label?: string;
  error?: string;
  hint?: string;
  /** Right-side icon or button (e.g. password toggle). */
  trailing?: React.ReactNode;
  containerStyle?: ViewStyle;
};

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, hint, trailing, containerStyle, ...inputProps },
  ref,
) {
  const theme = useTheme();
  const hasError = Boolean(error);

  return (
    <View style={[{ width: '100%' }, containerStyle]}>
      {label ? (
        <Text
          style={[
            theme.typography.bodySmallMedium,
            { color: theme.colors.text.primary, marginBottom: theme.spacing[2] },
          ]}
        >
          {label}
        </Text>
      ) : null}

      <View
        style={[
          styles.fieldWrap,
          {
            backgroundColor: theme.colors.bg.subtle,
            borderColor: hasError ? theme.colors.danger : theme.colors.border.default,
          },
        ]}
      >
        <TextInput
          ref={ref}
          style={[
            styles.input,
            theme.typography.body,
            { color: theme.colors.text.primary },
          ]}
          placeholderTextColor={theme.colors.text.tertiary}
          accessibilityLabel={label}
          accessibilityState={hasError ? ({ invalid: true } as object) : undefined}
          {...inputProps}
        />
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>

      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[
            theme.typography.caption,
            { color: theme.colors.danger, marginTop: theme.spacing[1] },
          ]}
        >
          {error}
        </Text>
      ) : hint ? (
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.text.tertiary, marginTop: theme.spacing[1] },
          ]}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  fieldWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
  },
  trailing: {
    marginLeft: 8,
  },
});
