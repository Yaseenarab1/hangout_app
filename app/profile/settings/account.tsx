import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { Card, ListItem, SectionHeader, Button, Input } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useSession, useSignOut } from '@/features/auth';
import { supabase } from '@/services/supabase/client';
import { friendlyErrorMessage, logError } from '@/services/errors';
import { toast } from '@/stores/ui.store';

export default function AccountSettingsScreen(): React.ReactElement {
  const theme = useTheme();
  const { user } = useSession();
  const signOut = useSignOut();
  const [confirmText, setConfirmText] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handlePasswordReset = async (): Promise<void> => {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email);
    if (error) {
      logError(error, { where: 'accountResetPassword' });
      toast.error(friendlyErrorMessage(error));
    } else {
      toast.success('Check your email for a reset link.');
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (confirmText !== 'DELETE') return;
    setDeleting(true);
    try {
      // Calls our delete-account Edge Function which sets profile.deleted_at
      // and starts the 7-day grace period (see docs/05-security-and-privacy §10).
      const { error } = await supabase.functions.invoke('delete-account', {});
      if (error) throw error;
      toast.info('Account deletion scheduled. You have 7 days to undo by signing back in.');
      signOut.mutate();
    } catch (error) {
      logError(error, { where: 'deleteAccount' });
      toast.error(friendlyErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Screen header={{ title: 'Account', showBack: true }} scroll>
      <SectionHeader title="Sign-in" />
      <Card padding="none">
        <ListItem title="Email" subtitle={user?.email ?? ''} hideChevron />
        <Divider />
        <ListItem title="Reset password" onPress={handlePasswordReset} />
      </Card>

      <SectionHeader title="Danger zone" />
      {!showDelete ? (
        <Card padding="md" variant="danger">
          <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>
            Delete account
          </Text>
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.text.secondary, marginTop: 4 },
            ]}
          >
            All your data will be removed after a 7-day grace period. You can cancel by signing back in.
          </Text>
          <Button
            label="Delete account…"
            variant="danger"
            size="sm"
            onPress={() => setShowDelete(true)}
            style={{ marginTop: 12, alignSelf: 'flex-start' }}
          />
        </Card>
      ) : (
        <Card padding="md" variant="danger">
          <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>
            Type DELETE to confirm
          </Text>
          <Input
            value={confirmText}
            onChangeText={setConfirmText}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="DELETE"
            containerStyle={{ marginTop: 12 }}
          />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Button
              label="Cancel"
              variant="secondary"
              onPress={() => {
                setShowDelete(false);
                setConfirmText('');
              }}
              style={{ flex: 1 }}
            />
            <Button
              label="Confirm delete"
              variant="danger"
              onPress={() =>
                Alert.alert(
                  'Delete account?',
                  "We'll keep your data for 7 days in case you change your mind.",
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => void handleDelete() },
                  ],
                )
              }
              loading={deleting}
              disabled={confirmText !== 'DELETE'}
              style={{ flex: 1 }}
            />
          </View>
        </Card>
      )}
    </Screen>
  );
}

function Divider(): React.ReactElement {
  const theme = useTheme();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.border.default,
        marginLeft: 16,
      }}
    />
  );
}
