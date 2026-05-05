import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useTheme } from '@/hooks/useTheme';
import type { Profile, FriendRequest } from '@/services/supabase/types.gen';

export type FriendRequestCardProps = {
  request: FriendRequest;
  /** The OTHER side of the request (sender for incoming, recipient for outgoing). */
  otherUser: Profile;
  /** When 'incoming', shows Accept + Decline. When 'outgoing', shows Cancel. */
  direction: 'incoming' | 'outgoing';
  onAccept?: () => void;
  onDecline?: () => void;
  onCancel?: () => void;
  busy?: boolean;
};

export function FriendRequestCard({
  request,
  otherUser,
  direction,
  onAccept,
  onDecline,
  onCancel,
  busy,
}: FriendRequestCardProps): React.ReactElement {
  const theme = useTheme();

  return (
    <Card padding="md" style={styles.card}>
      <View style={styles.row}>
        <Avatar
          id={otherUser.id}
          displayName={otherUser.display_name}
          uri={otherUser.avatar_url}
          size="md"
        />
        <View style={styles.body}>
          <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>
            {otherUser.display_name}
          </Text>
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.text.secondary, marginTop: 2 },
            ]}
          >
            @{otherUser.username}
          </Text>
          {request.message ? (
            <Text
              style={[
                theme.typography.bodySmall,
                {
                  color: theme.colors.text.secondary,
                  marginTop: theme.spacing[2],
                  fontStyle: 'italic',
                },
              ]}
              numberOfLines={3}
            >
              "{request.message}"
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.actions}>
        {direction === 'incoming' ? (
          <>
            <Button
              label="Decline"
              variant="secondary"
              size="sm"
              onPress={onDecline}
              disabled={busy}
              style={{ flex: 1 }}
            />
            <Button
              label="Accept"
              variant="primary"
              size="sm"
              onPress={onAccept}
              loading={busy}
              style={{ flex: 1 }}
            />
          </>
        ) : (
          <Button
            label="Cancel request"
            variant="ghost"
            size="sm"
            onPress={onCancel}
            disabled={busy}
            fullWidth
          />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  body: {
    flex: 1,
    marginLeft: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
});
