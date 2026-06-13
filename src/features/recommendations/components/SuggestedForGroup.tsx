import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Sparkles, Star, Plus } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useGroupRecommendations } from '../hooks/useGroupRecommendations';
import type { RecommendationKind, GroupRecommendation } from '../types';

export type SuggestedForGroupProps = {
  kind: RecommendationKind;
  participantIds?: string[];
  hangoutId?: string;
  /** Keys already on the poll (placeId for places, `tmdb:<type>:<id>` for media). */
  excludeKeys?: string[];
  onAdd: (rec: GroupRecommendation) => void;
  /** Max chips to show. Default 6. */
  max?: number;
};

/**
 * A horizontal strip of "Suggested for your group" chips, ranked from the
 * group's combined ratings. Supplementary to the picker's own search UI: it
 * renders nothing while loading or when the group has no shared history, so the
 * picker's five-state search machine stays in charge of the primary states.
 */
export function SuggestedForGroup({
  kind,
  participantIds,
  hangoutId,
  excludeKeys,
  onAdd,
  max = 6,
}: SuggestedForGroupProps): React.ReactElement | null {
  const theme = useTheme();
  const { data, isLoading } = useGroupRecommendations({ kind, participantIds, hangoutId });

  const exclude = useMemo(() => new Set(excludeKeys ?? []), [excludeKeys]);
  const recs = useMemo(
    () => (data ?? []).filter((r) => !exclude.has(r.key)).slice(0, max),
    [data, exclude, max],
  );

  if (isLoading || recs.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Sparkles size={13} color={theme.colors.accent} />
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.text.tertiary, marginLeft: 5, fontWeight: '600', letterSpacing: 0.3 },
          ]}
        >
          SUGGESTED FOR YOUR GROUP
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 16 }}
      >
        {recs.map((rec) => (
          <Pressable
            key={rec.key}
            onPress={() => onAdd(rec)}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default },
              pressed && { opacity: 0.7 },
            ]}
          >
            <View style={{ flexShrink: 1 }}>
              <Text
                numberOfLines={1}
                style={[theme.typography.bodySmall, { color: theme.colors.text.primary, fontWeight: '600' }]}
              >
                {rec.name}
              </Text>
              <View style={styles.metaRow}>
                <Star size={10} color={theme.colors.accent} fill={theme.colors.accent} />
                <Text
                  style={[theme.typography.caption, { color: theme.colors.text.secondary, marginLeft: 3 }]}
                >
                  {rec.avgRating.toFixed(1)} · {rec.raterCount} {rec.raterCount === 1 ? 'rating' : 'ratings'}
                </Text>
              </View>
            </View>
            <View style={[styles.addBtn, { backgroundColor: theme.colors.accent + '18' }]}>
              <Plus size={15} color={theme.colors.accent} />
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 230,
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  addBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
