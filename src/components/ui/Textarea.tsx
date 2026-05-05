import React, { forwardRef, useState } from 'react';
import { TextInput, View, Text, StyleSheet, type TextInputProps } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

export type TextareaProps = Omit<TextInputProps, 'multiline' | 'style'> & {
  label?: string;
  error?: string;
  hint?: string;
  /** Min visible lines. */
  minLines?: number;
  /** Max visible lines before scrolling internally. */
  maxLines?: number;
  /** Show "x / max" character counter. */
  maxLength?: number;
};

export const Textarea = forwardRef<TextInput, TextareaProps>(function Textarea(
  { label, error, hint, minLines = 3, maxLines = 8, maxLength, value, onChangeText, ...rest },
  ref,
) {
  const theme = useTheme();
  const hasError = Boolean(error);
  const [internalValue, setInternalValue] = useState<string>(typeof value === 'string' ? value : '');

  const currentValue = value ?? internalValue;

  return (
    <View style={{ width: '100%' }}>
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
          styles.wrap,
          {
            backgroundColor: theme.colors.bg.subtle,
            borderColor: hasError ? theme.colors.danger : theme.colors.border.default,
            minHeight: 22 * minLines + 24,
            maxHeight: 22 * maxLines + 24,
          },
        ]}
      >
        <TextInput
          ref={ref}
          multiline
          value={currentValue}
          onChangeText={(text) => {
            setInternalValue(text);
            onChangeText?.(text);
          }}
          maxLength={maxLength}
          placeholderTextColor={theme.colors.text.tertiary}
          textAlignVertical="top"
          style={[
            styles.input,
            theme.typography.body,
            { color: theme.colors.text.primary },
          ]}
          accessibilityLabel={label}
          {...rest}
        />
      </View>

      <View style={styles.footerRow}>
        <View style={{ flex: 1 }}>
          {error ? (
            <Text style={[theme.typography.caption, { color: theme.colors.danger }]}>
              {error}
            </Text>
          ) : hint ? (
            <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary }]}>
              {hint}
            </Text>
          ) : null}
        </View>
        {maxLength ? (
          <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary }]}>
            {currentValue.length} / {maxLength}
          </Text>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  input: {
    padding: 0, // RN adds padding by default
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
});
