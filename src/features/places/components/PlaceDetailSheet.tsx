import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  FlatList,
  StyleSheet,
  Linking,
  Alert,
  Dimensions,
} from 'react-native';
import {
  X,
  Star,
  MapPin,
  Phone,
  Globe,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui';
import { PlacePhoto } from './PlacePhoto';
import { usePlaceDetails } from '../hooks/usePlaces';
import type { PlaceDetails } from '../types';
import type { PollPhase } from '@/features/polls/types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PHOTO_HEIGHT = 220;

export type PlaceDetailSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** null = custom place (no Google data) */
  placeId: string | null;
  /** Always shown in the header, even before details load */
  placeName?: string;
  pollPhase?: PollPhase;
  isMyVote?: boolean;
  /** 0 = "Doesn't vote" weight — show warning before voting */
  myVoteWeight?: number;
  onVote?: () => void;
  onUnvote?: () => void;
};

export function PlaceDetailSheet({
  visible,
  onClose,
  placeId,
  placeName,
  pollPhase,
  isMyVote,
  myVoteWeight,
  onVote,
  onUnvote,
}: PlaceDetailSheetProps): React.ReactElement {
  const theme = useTheme();
  const details = usePlaceDetails(placeId ?? undefined);
  const [showAllHours, setShowAllHours] = useState(false);

  const showVoteButton =
    pollPhase === 'voting' && Boolean(onVote || onUnvote);

  const handleVote = (): void => {
    if (isMyVote) {
      onUnvote?.();
      onClose();
      return;
    }
    if (myVoteWeight === 0) {
      Alert.alert(
        'Vote weight is 0×',
        "You can still vote, but it won't affect the result.",
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Vote anyway',
            onPress: () => {
              onVote?.();
              onClose();
            },
          },
        ],
      );
      return;
    }
    onVote?.();
    onClose();
  };

  const handleOpenMaps = (mapsUrl: string | null, address: string): void => {
    const url =
      mapsUrl ?? `https://maps.apple.com/?q=${encodeURIComponent(address)}`;
    Linking.openURL(url).catch(() => {});
  };

  const bottomButton = (() => {
    if (showVoteButton) {
      return (
        <Button
          label={isMyVote ? 'Remove vote' : 'Vote for this'}
          variant={isMyVote ? 'ghost' : 'primary'}
          onPress={handleVote}
          fullWidth
        />
      );
    }
    if (placeId && details.data) {
      return (
        <Button
          label="Open in Maps"
          variant="ghost"
          onPress={() =>
            handleOpenMaps(details.data!.mapsUrl, details.data!.address)
          }
          fullWidth
        />
      );
    }
    return null;
  })();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.bg.canvas }]}>
        {/* Header */}
        <View
          style={[
            styles.header,
            { borderBottomColor: theme.colors.border.default },
          ]}
        >
          <Text
            style={[
              theme.typography.h3,
              { color: theme.colors.text.primary, flex: 1 },
            ]}
            numberOfLines={1}
          >
            {placeName ?? 'Place details'}
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={22} color={theme.colors.text.secondary} />
          </Pressable>
        </View>

        {/* Body */}
        <View style={{ flex: 1 }}>
          {!placeId ? (
            <CustomPlaceBody placeName={placeName} />
          ) : details.isLoading ? (
            <SkeletonBody />
          ) : details.isError || !details.data ? (
            <ErrorBody />
          ) : (
            <PlaceBody
              place={details.data}
              showAllHours={showAllHours}
              onToggleHours={() => setShowAllHours((v) => !v)}
              onOpenMaps={() =>
                handleOpenMaps(details.data!.mapsUrl, details.data!.address)
              }
            />
          )}
        </View>

        {/* Sticky bottom button */}
        {bottomButton ? (
          <View
            style={[
              styles.bottomBar,
              { borderTopColor: theme.colors.border.default },
            ]}
          >
            {bottomButton}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

// ─── Sub-views ───────────────────────────────────────────────────────────────

function PlaceBody({
  place,
  showAllHours,
  onToggleHours,
  onOpenMaps,
}: {
  place: PlaceDetails;
  showAllHours: boolean;
  onToggleHours: () => void;
  onOpenMaps: () => void;
}): React.ReactElement {
  const theme = useTheme();

  const photos = place.photos ?? [];

  // Google weekdayDescriptions: index 0=Monday … 6=Sunday
  // JS Date.getDay(): 0=Sunday … 6=Saturday
  const todayIndex = (new Date().getDay() + 6) % 7;
  const todayHours = place.openingHours?.[todayIndex] ?? null;
  const allHours = place.openingHours ?? [];

  const priceDots = place.priceLevel ? '$'.repeat(place.priceLevel) : null;

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Photo carousel */}
      {photos.length > 0 ? (
        <FlatList
          data={photos}
          keyExtractor={(item) => item}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <PlacePhoto
              photoName={item}
              width={SCREEN_WIDTH}
              height={PHOTO_HEIGHT}
            />
          )}
          style={{ height: PHOTO_HEIGHT }}
        />
      ) : (
        <PlacePhoto
          photoName={null}
          width={SCREEN_WIDTH}
          height={PHOTO_HEIGHT}
        />
      )}

      <View style={styles.detailsContainer}>
        {/* Type + rating + price */}
        <View style={styles.metaRow}>
          {place.primaryType ? (
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.text.secondary },
              ]}
            >
              {place.primaryType}
            </Text>
          ) : null}
          {place.rating !== null ? (
            <View style={styles.ratingChip}>
              <Star
                size={12}
                color={theme.colors.warning}
                fill={theme.colors.warning}
              />
              <Text
                style={[
                  theme.typography.caption,
                  {
                    color: theme.colors.text.secondary,
                    marginLeft: 4,
                    fontWeight: '600',
                  },
                ]}
              >
                {place.rating.toFixed(1)}
                {place.ratingCount
                  ? ` (${place.ratingCount.toLocaleString()})`
                  : ''}
              </Text>
            </View>
          ) : null}
          {priceDots ? (
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.text.secondary, fontWeight: '600' },
              ]}
            >
              {priceDots}
            </Text>
          ) : null}
        </View>

        {/* Open / closed status */}
        {place.isOpenNow !== null ? (
          <Text
            style={[
              theme.typography.bodySmall,
              {
                color: place.isOpenNow
                  ? theme.colors.success
                  : theme.colors.danger,
                fontWeight: '600',
                marginBottom: 4,
              },
            ]}
          >
            {place.isOpenNow ? 'Open now' : 'Closed now'}
          </Text>
        ) : null}

        <View style={styles.divider} />

        {/* Address */}
        <DetailRow icon={<MapPin size={16} color={theme.colors.text.tertiary} />}>
          <Pressable onPress={onOpenMaps}>
            <Text
              style={[
                theme.typography.body,
                { color: theme.colors.accent },
              ]}
            >
              {place.address}
            </Text>
          </Pressable>
        </DetailRow>

        {/* Phone */}
        {place.phone ? (
          <DetailRow
            icon={<Phone size={16} color={theme.colors.text.tertiary} />}
          >
            <Pressable
              onPress={() =>
                Linking.openURL(`tel:${place.phone}`).catch(() => {})
              }
            >
              <Text
                style={[theme.typography.body, { color: theme.colors.accent }]}
              >
                {place.phone}
              </Text>
            </Pressable>
          </DetailRow>
        ) : null}

        {/* Website */}
        {place.website ? (
          <DetailRow
            icon={<Globe size={16} color={theme.colors.text.tertiary} />}
          >
            <Pressable
              onPress={() =>
                Linking.openURL(place.website!).catch(() => {})
              }
            >
              <Text
                style={[
                  theme.typography.body,
                  { color: theme.colors.accent },
                ]}
                numberOfLines={1}
              >
                {place.website.replace(/^https?:\/\/(www\.)?/, '')}
              </Text>
            </Pressable>
          </DetailRow>
        ) : null}

        {/* Hours */}
        <DetailRow icon={<Clock size={16} color={theme.colors.text.tertiary} />}>
          {allHours.length === 0 ? (
            <Text
              style={[
                theme.typography.body,
                { color: theme.colors.text.tertiary },
              ]}
            >
              Hours not available
            </Text>
          ) : (
            <View style={{ flex: 1 }}>
              {todayHours ? (
                <Text
                  style={[
                    theme.typography.body,
                    { color: theme.colors.text.primary, fontWeight: '600' },
                  ]}
                >
                  {todayHours}
                </Text>
              ) : null}
              {showAllHours
                ? allHours
                    .filter((h) => h !== todayHours)
                    .map((h) => (
                      <Text
                        key={h}
                        style={[
                          theme.typography.bodySmall,
                          {
                            color: theme.colors.text.secondary,
                            marginTop: 2,
                          },
                        ]}
                      >
                        {h}
                      </Text>
                    ))
                : null}
              {allHours.length > 1 ? (
                <Pressable
                  onPress={onToggleHours}
                  style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}
                >
                  <Text
                    style={[
                      theme.typography.caption,
                      { color: theme.colors.accent, marginRight: 4 },
                    ]}
                  >
                    {showAllHours ? 'Hide hours' : 'See all hours'}
                  </Text>
                  {showAllHours ? (
                    <ChevronUp size={12} color={theme.colors.accent} />
                  ) : (
                    <ChevronDown size={12} color={theme.colors.accent} />
                  )}
                </Pressable>
              ) : null}
            </View>
          )}
        </DetailRow>
      </View>
    </ScrollView>
  );
}

function DetailRow({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>{icon}</View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

function CustomPlaceBody({
  placeName,
}: {
  placeName?: string;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={styles.centeredBody}>
      <Text
        style={[
          theme.typography.bodyMedium,
          { color: theme.colors.text.primary, marginBottom: 8 },
        ]}
      >
        {placeName ?? 'Custom place'}
      </Text>
      <Text
        style={[
          theme.typography.bodySmall,
          { color: theme.colors.text.tertiary, textAlign: 'center' },
        ]}
      >
        No Google details available for this place.
      </Text>
    </View>
  );
}

function SkeletonBody(): React.ReactElement {
  const theme = useTheme();
  const bg = theme.colors.bg.subtle;
  return (
    <View>
      <View style={{ height: PHOTO_HEIGHT, backgroundColor: bg }} />
      <View style={styles.detailsContainer}>
        {[180, 120, 200, 160].map((w, i) => (
          <View
            key={i}
            style={{
              height: 14,
              width: w,
              backgroundColor: bg,
              borderRadius: 6,
              marginBottom: 14,
            }}
          />
        ))}
      </View>
    </View>
  );
}

function ErrorBody(): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={styles.centeredBody}>
      <Text
        style={[
          theme.typography.bodySmall,
          { color: theme.colors.text.tertiary, textAlign: 'center' },
        ]}
      >
        Couldn't load details.{'\n'}Check your connection and try again.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  detailsContainer: { padding: 16, gap: 4 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  ratingChip: { flexDirection: 'row', alignItems: 'center' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 12 },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    gap: 12,
  },
  detailIcon: { width: 20, alignItems: 'center', paddingTop: 2 },
  centeredBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
});
