export type NotificationType =
  | 'message'
  | 'photo_added'
  | 'bill_added'
  | 'bill_paid'
  | 'friend_post'
  | 'hangout_invite'
  | 'poll_closed'
  | 'rsvp_change';

export type NotificationData = {
  type: NotificationType;
  refId: string;
  [key: string]: unknown;
};
