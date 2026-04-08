import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import { startTransition, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import {
  ANALYSIS_STAGES,
  CAPTURE_CHECKLIST,
  COMPARISON_TRACE,
  MOCK_METRICS,
  PRIMARY_CUE,
  PRIMARY_TRACE,
} from './src/mockAnalysis';

type AnalysisState = 'idle' | 'analyzing' | 'ready';
type OverlayMode = 'trace' | 'compare' | 'raw';

type PickedVideo = {
  durationMs: number | null;
  fileName: string | null;
  height: number | null;
  uri: string;
  width: number | null;
};

export default function App() {
  const [analysisState, setAnalysisState] = useState<AnalysisState>('idle');
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('trace');
  const [selectedVideo, setSelectedVideo] = useState<PickedVideo | null>(null);
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    if (analysisState !== 'analyzing') {
      return;
    }

    setStageIndex(0);
    const timers = ANALYSIS_STAGES.map((_, index) =>
      setTimeout(() => {
        if (index === ANALYSIS_STAGES.length - 1) {
          startTransition(() => {
            setStageIndex(index);
            setAnalysisState('ready');
          });
          return;
        }

        startTransition(() => {
          setStageIndex(index + 1);
        });
      }, index * 900)
    );

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [analysisState]);

  async function pickVideo() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Allow photo access',
        'The app needs photo library access so you can import a recorded shooting clip.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 1,
      selectionLimit: 1,
    });

    if (result.canceled || !result.assets.length) {
      return;
    }

    const asset = result.assets[0];

    setSelectedVideo({
      durationMs: asset.duration ?? null,
      fileName: asset.fileName ?? null,
      height: asset.height ?? null,
      uri: asset.uri,
      width: asset.width ?? null,
    });
    setAnalysisState('idle');
    setOverlayMode('trace');
    setStageIndex(0);
  }

  function runAnalysis() {
    if (!selectedVideo) {
      Alert.alert('Import a clip first', 'Choose a landscape shooting clip from Photos to start analysis.');
      return;
    }

    setAnalysisState('analyzing');
  }

  function openVaultPlan() {
    Linking.openURL('file:///home/maro/Documents/maro-og/Development/Ideas/human-motion-analysis/README.md').catch(
      () => {
        Alert.alert('Open the vault note manually', 'The plan lives in the linked noggin idea for this project.');
      }
    );
  }

  const stageLabel = ANALYSIS_STAGES[Math.min(stageIndex, ANALYSIS_STAGES.length - 1)];
  const isReady = analysisState === 'ready';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroTopline}>
            <Text style={styles.eyebrow}>Approach A</Text>
            <View style={styles.platformPill}>
              <Text style={styles.platformPillText}>iPhone-first</Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>Shotpath</Text>
          <Text style={styles.heroBody}>
            Fixed-angle free-throw feedback from a single clip. Import from Photos, trace the motion path, then get
            one coaching cue you can use on the next rep.
          </Text>
          <View style={styles.heroActions}>
            <PrimaryButton label="Import From Photos" onPress={pickVideo} />
            <SecondaryButton label="Open Plan" onPress={openVaultPlan} />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Capture Checklist</Text>
            <Text style={styles.sectionMeta}>Landscape clip required</Text>
          </View>
          {CAPTURE_CHECKLIST.map((item) => (
            <View key={item.title} style={styles.checkRow}>
              <View style={styles.checkDot} />
              <View style={styles.checkCopy}>
                <Text style={styles.checkTitle}>{item.title}</Text>
                <Text style={styles.checkBody}>{item.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Session Clip</Text>
            <Text style={styles.sectionMeta}>{selectedVideo ? 'Ready to review' : 'No clip selected'}</Text>
          </View>

          {selectedVideo ? (
            <SelectedVideoCard overlayMode={overlayMode} selectedVideo={selectedVideo} />
          ) : (
            <EmptyClipCard onPress={pickVideo} />
          )}

          <View style={styles.metaRow}>
            <MetaPill label={selectedVideo?.fileName ?? 'Waiting for import'} />
            <MetaPill
              label={
                selectedVideo?.durationMs ? `${Math.max(1, Math.round(selectedVideo.durationMs / 1000))}s clip` : '6-12s ideal'
              }
            />
            <MetaPill
              label={
                selectedVideo?.width && selectedVideo?.height
                  ? `${selectedVideo.width}x${selectedVideo.height}`
                  : 'Framed from waist to release'
              }
            />
          </View>

          <View style={styles.actionRow}>
            <PrimaryButton label={analysisState === 'analyzing' ? 'Analyzing…' : 'Analyze Shot'} onPress={runAnalysis} />
            <SecondaryButton label="Replace Clip" onPress={pickVideo} />
          </View>

          <View style={styles.analysisStatusCard}>
            <Text style={styles.analysisStatusLabel}>Analysis status</Text>
            <Text style={styles.analysisStatusValue}>{analysisState === 'idle' ? 'Waiting for clip' : stageLabel}</Text>
            <View style={styles.stageRail}>
              {ANALYSIS_STAGES.map((stage, index) => {
                const active =
                  analysisState === 'ready' ? true : analysisState === 'analyzing' ? index <= stageIndex : index === 0;
                return (
                  <View key={stage} style={[styles.stagePill, active ? styles.stagePillActive : null]}>
                    <Text style={[styles.stageText, active ? styles.stageTextActive : null]}>{stage}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Replay Mode</Text>
            <Text style={styles.sectionMeta}>Thumb-ready segmented controls</Text>
          </View>
          <View style={styles.segmentedControl}>
            {(['trace', 'compare', 'raw'] as OverlayMode[]).map((mode) => (
              <Pressable
                key={mode}
                onPress={() => setOverlayMode(mode)}
                style={[styles.segment, overlayMode === mode ? styles.segmentActive : null]}
              >
                <Text style={[styles.segmentText, overlayMode === mode ? styles.segmentTextActive : null]}>
                  {mode === 'trace' ? 'Trace' : mode === 'compare' ? 'Compare' : 'Raw'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Primary Cue</Text>
            <Text style={styles.sectionMeta}>One instruction at a time</Text>
          </View>

          <View style={styles.cueBanner}>
            <Text style={styles.cueTitle}>{PRIMARY_CUE.title}</Text>
            <Text style={styles.cueBody}>
              {isReady
                ? PRIMARY_CUE.body
                : 'Run analysis to surface the first coaching note. The MVP intentionally prefers one strong cue over a weak dashboard.'}
            </Text>
            <View style={styles.cueFooter}>
              <MetaPill label={isReady ? PRIMARY_CUE.confidence : 'Confidence pending'} />
              <MetaPill label={PRIMARY_CUE.whyItMatters} />
            </View>
          </View>

          <View style={styles.metricsGrid}>
            {MOCK_METRICS.map((metric) => (
              <View key={metric.label} style={styles.metricCard}>
                <Text style={styles.metricLabel}>{metric.label}</Text>
                <Text style={styles.metricValue}>{isReady ? metric.value : '--'}</Text>
                <Text style={styles.metricStatus}>{metric.status}</Text>
                <Text style={styles.metricBody}>{metric.body}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.footerCard}>
          <Text style={styles.footerTitle}>What ships next</Text>
          <Text style={styles.footerBody}>
            Real pose extraction, a held-out evaluation set, and deterministic metric scoring. This build establishes
            the iPhone-first workflow and the trustworthy results surface.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SelectedVideoCard({
  overlayMode,
  selectedVideo,
}: {
  overlayMode: OverlayMode;
  selectedVideo: PickedVideo;
}) {
  const player = useVideoPlayer({ uri: selectedVideo.uri }, (videoPlayer) => {
    videoPlayer.loop = true;
  });

  return (
    <View style={styles.videoFrame}>
      <VideoView
        allowsFullscreen
        allowsPictureInPicture={Platform.OS === 'ios'}
        allowsVideoFrameAnalysis={Platform.OS === 'ios'}
        contentFit="cover"
        nativeControls
        player={player}
        style={StyleSheet.absoluteFill}
      />
      {overlayMode !== 'raw' ? <MotionOverlay mode={overlayMode} /> : null}
      <View style={styles.videoBadge}>
        <Text style={styles.videoBadgeText}>Landscape form review</Text>
      </View>
    </View>
  );
}

function MotionOverlay({ mode }: { mode: OverlayMode }) {
  return (
    <View pointerEvents="none" style={styles.overlayWrap}>
      <Svg height="100%" viewBox="0 0 100 100" width="100%">
        {mode === 'compare' ? (
          <Polyline
            fill="none"
            points={COMPARISON_TRACE}
            stroke="#F8B44C"
            strokeDasharray="4 4"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        ) : null}
        <Polyline
          fill="none"
          points={PRIMARY_TRACE}
          stroke="#F56A4D"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
        />
        <Circle cx="62" cy="22" fill="#FDF7EF" r="4.5" stroke="#0E2A47" strokeWidth="1.5" />
        <Circle cx="55" cy="52" fill="#FDF7EF" r="3.6" stroke="#0E2A47" strokeWidth="1.5" />
        <Circle cx="42" cy="80" fill="#FDF7EF" r="3.3" stroke="#0E2A47" strokeWidth="1.5" />
      </Svg>
    </View>
  );
}

function EmptyClipCard({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.emptyVideoCard}>
      <Text style={styles.emptyVideoTitle}>Bring in a practice clip</Text>
      <Text style={styles.emptyVideoBody}>
        Start with an iPhone video from the side or slight front-side angle. The MVP assumes one player, one hoop, and
        a clean background.
      </Text>
      <View style={styles.emptyVideoAction}>
        <Text style={styles.emptyVideoActionText}>Choose a clip from Photos</Text>
      </View>
    </Pressable>
  );
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.primaryButton}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.secondaryButton}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function MetaPill({ label }: { label: string }) {
  return (
    <View style={styles.metaPill}>
      <Text numberOfLines={1} style={styles.metaPillText}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#F3EEE5',
    flex: 1,
  },
  scrollContent: {
    gap: 18,
    paddingBottom: 36,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  heroCard: {
    backgroundColor: '#0E2A47',
    borderRadius: 28,
    gap: 14,
    padding: 22,
  },
  heroTopline: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: '#BFD1E4',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  platformPill: {
    backgroundColor: '#163A5F',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  platformPillText: {
    color: '#FDF7EF',
    fontSize: 12,
    fontWeight: '700',
  },
  heroTitle: {
    color: '#FDF7EF',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.9,
  },
  heroBody: {
    color: '#D7E2EE',
    fontSize: 15,
    lineHeight: 22,
  },
  heroActions: {
    flexDirection: 'row',
    gap: 10,
  },
  card: {
    backgroundColor: '#FCF7F0',
    borderColor: '#E6D9C8',
    borderRadius: 24,
    borderWidth: 1,
    gap: 16,
    padding: 18,
  },
  sectionHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#0E2A47',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  sectionMeta: {
    color: '#6A7683',
    fontSize: 12,
    fontWeight: '600',
  },
  checkRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  checkDot: {
    backgroundColor: '#F56A4D',
    borderRadius: 999,
    height: 10,
    marginTop: 7,
    width: 10,
  },
  checkCopy: {
    flex: 1,
    gap: 4,
  },
  checkTitle: {
    color: '#0E2A47',
    fontSize: 15,
    fontWeight: '700',
  },
  checkBody: {
    color: '#566170',
    fontSize: 14,
    lineHeight: 20,
  },
  videoFrame: {
    backgroundColor: '#12283D',
    borderRadius: 22,
    height: 260,
    overflow: 'hidden',
    position: 'relative',
  },
  overlayWrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(12, 24, 38, 0.2)',
  },
  videoBadge: {
    backgroundColor: 'rgba(14, 42, 71, 0.88)',
    borderRadius: 999,
    bottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    position: 'absolute',
    right: 14,
  },
  videoBadgeText: {
    color: '#FDF7EF',
    fontSize: 12,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaPill: {
    backgroundColor: '#F1E5D4',
    borderRadius: 999,
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  metaPillText: {
    color: '#6A4E2E',
    fontSize: 12,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#F56A4D',
    borderRadius: 16,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 14,
  },
  primaryButtonText: {
    color: '#FFF7F1',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#E7EDF4',
    borderRadius: 16,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    color: '#173654',
    fontSize: 15,
    fontWeight: '700',
  },
  analysisStatusCard: {
    backgroundColor: '#F5EADC',
    borderRadius: 20,
    gap: 10,
    padding: 14,
  },
  analysisStatusLabel: {
    color: '#7B5A39',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  analysisStatusValue: {
    color: '#0E2A47',
    fontSize: 18,
    fontWeight: '800',
  },
  stageRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stagePill: {
    backgroundColor: '#E5D7C4',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  stagePillActive: {
    backgroundColor: '#0E2A47',
  },
  stageText: {
    color: '#7B5A39',
    fontSize: 12,
    fontWeight: '700',
  },
  stageTextActive: {
    color: '#FDF7EF',
  },
  segmentedControl: {
    backgroundColor: '#E6EBF1',
    borderRadius: 20,
    flexDirection: 'row',
    padding: 5,
  },
  segment: {
    alignItems: 'center',
    borderRadius: 16,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
  },
  segmentActive: {
    backgroundColor: '#FCF7F0',
  },
  segmentText: {
    color: '#5B6978',
    fontSize: 15,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: '#0E2A47',
  },
  cueBanner: {
    backgroundColor: '#0E2A47',
    borderRadius: 22,
    gap: 12,
    padding: 16,
  },
  cueTitle: {
    color: '#FDF7EF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  cueBody: {
    color: '#D7E2EE',
    fontSize: 15,
    lineHeight: 21,
  },
  cueFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricsGrid: {
    gap: 12,
  },
  metricCard: {
    backgroundColor: '#FFFDF9',
    borderColor: '#E6D9C8',
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    padding: 14,
  },
  metricLabel: {
    color: '#0E2A47',
    fontSize: 15,
    fontWeight: '700',
  },
  metricValue: {
    color: '#F56A4D',
    fontSize: 24,
    fontWeight: '800',
  },
  metricStatus: {
    color: '#6A4E2E',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricBody: {
    color: '#5B6978',
    fontSize: 14,
    lineHeight: 20,
  },
  emptyVideoCard: {
    alignItems: 'flex-start',
    backgroundColor: '#EAF1F8',
    borderRadius: 22,
    gap: 12,
    minHeight: 220,
    justifyContent: 'center',
    padding: 22,
  },
  emptyVideoTitle: {
    color: '#0E2A47',
    fontSize: 22,
    fontWeight: '800',
  },
  emptyVideoBody: {
    color: '#526173',
    fontSize: 15,
    lineHeight: 22,
  },
  emptyVideoAction: {
    backgroundColor: '#0E2A47',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  emptyVideoActionText: {
    color: '#FDF7EF',
    fontSize: 13,
    fontWeight: '800',
  },
  footerCard: {
    backgroundColor: '#F8E7C8',
    borderRadius: 24,
    gap: 8,
    padding: 18,
  },
  footerTitle: {
    color: '#6A3E00',
    fontSize: 18,
    fontWeight: '800',
  },
  footerBody: {
    color: '#6A4E2E',
    fontSize: 14,
    lineHeight: 20,
  },
});
