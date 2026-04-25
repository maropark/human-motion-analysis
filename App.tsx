import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import { startTransition, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

import {
  ANALYSIS_STAGES,
  CAPTURE_CHECKLIST,
  COMPARISON_TRACE,
  MAKES_CUE,
  MISSES_CUE,
  MOCK_SHOT_CLIPS,
  PRIMARY_TRACE,
  type ShotClip,
} from './src/mockAnalysis';
import { CameraScreen } from './src/CameraScreen';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);

type AnalysisState = 'idle' | 'analyzing' | 'ready';
type OverlayMode = 'trace' | 'compare' | 'raw';

type PickedVideo = {
  durationMs: number | null;
  fileName: string | null;
  height: number | null;
  uri: string;
  width: number | null;
};

function statusColor(status: string): string {
  if (status === 'Good') return '#1A6630';
  if (status === 'Needs work') return '#8B1A1A';
  return '#6A4E2E';
}

export default function App() {
  const [analysisState, setAnalysisState] = useState<AnalysisState>('idle');
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('trace');
  const [selectedVideo, setSelectedVideo] = useState<PickedVideo | null>(null);
  const [stageIndex, setStageIndex] = useState(0);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

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
        'The app needs photo library access so you can import a recorded shooting session.'
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
    setSelectedClipId(null);
  }

  function runAnalysis() {
    if (!selectedVideo) {
      Alert.alert('Import a session first', 'Choose a 5-minute shooting session from Photos to start analysis.');
      return;
    }

    setAnalysisState('analyzing');
  }

  const stageLabel = ANALYSIS_STAGES[Math.min(stageIndex, ANALYSIS_STAGES.length - 1)];
  const isReady = analysisState === 'ready';

  if (cameraOpen) {
    return <CameraScreen onClose={() => setCameraOpen(false)} />;
  }

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
            Import a 5-minute session of free throw attempts. Shotpath finds the shots, classifies makes and misses,
            and tells you what's mechanically different between the two.
          </Text>
          <View style={styles.heroActions}>
            <PrimaryButton label="Import From Photos" onPress={pickVideo} />
            <SecondaryButton label="Record Session" onPress={() => setCameraOpen(true)} />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Capture Checklist</Text>
            <Text style={styles.sectionMeta}>Portrait or landscape</Text>
          </View>
          <FreethrowFigurine />
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
            <Text style={styles.sectionMeta}>{selectedVideo ? 'Ready to review' : 'No session selected'}</Text>
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
                selectedVideo?.durationMs
                  ? `${Math.max(1, Math.round(selectedVideo.durationMs / 1000))}s clip`
                  : '~5 min ideal'
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
            <PrimaryButton
              label={analysisState === 'analyzing' ? 'Analyzing…' : 'Analyze Session'}
              onPress={runAnalysis}
            />
            <SecondaryButton label="Replace Clip" onPress={pickVideo} />
          </View>

          <View style={styles.analysisStatusCard}>
            <Text style={styles.analysisStatusLabel}>Analysis status</Text>
            <Text style={styles.analysisStatusValue}>
              {analysisState === 'idle' ? 'Waiting for session' : stageLabel}
            </Text>
            <View style={styles.stageRail}>
              {ANALYSIS_STAGES.map((stage, index) => {
                const active =
                  analysisState === 'ready'
                    ? true
                    : analysisState === 'analyzing'
                    ? index <= stageIndex
                    : index === 0;
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

        {isReady && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Detected Shots</Text>
              <Text style={styles.sectionMeta}>Auto-segmented</Text>
            </View>
            <ShotClipsRow
              clips={MOCK_SHOT_CLIPS}
              selectedId={selectedClipId}
              onSelect={setSelectedClipId}
            />
          </View>
        )}

        {isReady && <MakesAnalysisCard isReady={isReady} />}
        {isReady && <MissesAnalysisCard isReady={isReady} />}

        <View style={styles.footerCard}>
          <Text style={styles.footerTitle}>What ships next</Text>
          <Text style={styles.footerBody}>
            Real pose extraction, session segmentation, and per-rep metric scoring. This build establishes the
            session-first workflow and the trust surface for making sense of a mix of makes and misses.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Cavalier oblique projection: x=court-width(±), y=height, z=depth-toward-basket
// proj(x,y,z) → svg: x maps right, z maps upper-right at 30°, y maps up
// sx=6, sy=5, sz_x=5.5, sz_y=3.5 | origin (88, 130)
function FreethrowFigurine() {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 2400,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );
    animation.start();
    return () => animation.stop();
  }, []);

  // Ball: shooter's hands → arc peak → rim. Both endpoints opacity=0 → seamless loop reset.
  const MOVE = [0, 0.2, 0.45, 0.65, 0.75, 1];
  const ballCx      = anim.interpolate({ inputRange: MOVE, outputRange: [95, 108, 122, 136, 148, 148] });
  const ballCy      = anim.interpolate({ inputRange: MOVE, outputRange: [85, 65, 51, 46, 46, 46] });
  const ballR       = anim.interpolate({ inputRange: [0, 0.5, 0.75, 1], outputRange: [4.5, 4.5, 3.5, 3.5] });
  const ballOpacity = anim.interpolate({ inputRange: [0, 0.04, 0.68, 0.82, 1], outputRange: [0, 1, 1, 0, 0] });

  return (
    <View style={styles.figurineWrap}>
      <Svg width="100%" height="100%" viewBox="0 0 240 148">

        {/* ── COURT FLOOR (oblique quad: FT line → baseline receding upper-right) ── */}
        {/* Lane/paint area */}
        <Path d="M 52 130 L 112 130 L 194 78 L 134 78 Z" fill="rgba(14,42,71,0.06)" stroke="#C4B9AC" strokeWidth="1" />
        {/* Floor extends beyond lane */}
        <Line x1="0" y1="130" x2="52" y2="130" stroke="#C4B9AC" strokeWidth="1" />
        <Line x1="112" y1="130" x2="240" y2="130" stroke="#C4B9AC" strokeWidth="1" />
        {/* Free throw line — near edge of lane */}
        <Line x1="52" y1="130" x2="112" y2="130" stroke="#0E2A47" strokeWidth="2.5" strokeLinecap="round" />

        {/* ── HOOP (far end of lane, upper-right) ── */}
        {/* Support pole from floor */}
        <Line x1="164" y1="78" x2="164" y2="40" stroke="#566170" strokeWidth="2.5" strokeLinecap="round" />
        {/* Backboard */}
        <Rect x="154" y="27" width="22" height="15" rx="1" fill="#EAF1F8" stroke="#0E2A47" strokeWidth="1.5" />
        {/* Rim — near side extends toward viewer (lower-left in oblique) */}
        <Line x1="146" y1="50" x2="156" y2="45" stroke="#F56A4D" strokeWidth="2.5" strokeLinecap="round" />
        <Line x1="156" y1="45" x2="164" y2="45" stroke="#F56A4D" strokeWidth="1.5" strokeLinecap="round" />
        {/* Net */}
        <Line x1="147" y1="50" x2="149" y2="59" stroke="#8A9BAA" strokeWidth="1" />
        <Line x1="150" y1="49" x2="152" y2="59" stroke="#8A9BAA" strokeWidth="1" />
        <Line x1="153" y1="48" x2="154" y2="59" stroke="#8A9BAA" strokeWidth="1" />
        <Line x1="156" y1="46" x2="157" y2="59" stroke="#8A9BAA" strokeWidth="1" />
        <Line x1="159" y1="46" x2="159" y2="59" stroke="#8A9BAA" strokeWidth="1" />
        <Path d="M 149 59 Q 154 63 159 59" stroke="#8A9BAA" strokeWidth="1" fill="none" />

        {/* ── CAMERA FOV CONE (from left, sweeps over shooter) ── */}
        <Path d="M 30 104 L 66 78 L 72 134 Z" fill="rgba(14,42,71,0.04)" />
        {/* Dashed camera-aim line showing perpendicular side angle */}
        <Line x1="30" y1="104" x2="70" y2="104" stroke="#566170" strokeWidth="0.8" strokeDasharray="3 2" />

        {/* ── CAMERA + TRIPOD (left side of court) ── */}
        <Line x1="20" y1="109" x2="13" y2="130" stroke="#566170" strokeWidth="1.5" strokeLinecap="round" />
        <Line x1="20" y1="109" x2="20" y2="130" stroke="#566170" strokeWidth="1.5" strokeLinecap="round" />
        <Line x1="20" y1="109" x2="27" y2="130" stroke="#566170" strokeWidth="1.5" strokeLinecap="round" />
        <Rect x="10" y="99" width="18" height="11" rx="2" fill="#E7EDF4" stroke="#0E2A47" strokeWidth="1.5" />
        <Circle cx="17" cy="104" r="3.5" fill="#0E2A47" />
        <Circle cx="16" cy="103" r="1.2" fill="#4A8AB4" opacity="0.7" />

        {/* ── SHOOTER (at FT line center, facing basket = toward upper-right) ── */}
        {/* Head */}
        <Circle cx="82" cy="96" r="5.5" fill="#0E2A47" />
        {/* Torso */}
        <Line x1="82" y1="101" x2="82" y2="117" stroke="#0E2A47" strokeWidth="3.5" strokeLinecap="round" />
        {/* Shooting arm — extends toward basket direction (upper-right) */}
        <Line x1="82" y1="105" x2="90" y2="99" stroke="#0E2A47" strokeWidth="2.5" strokeLinecap="round" />
        <Line x1="90" y1="99" x2="94" y2="91" stroke="#0E2A47" strokeWidth="2.5" strokeLinecap="round" />
        {/* Guide arm — to the side */}
        <Line x1="82" y1="105" x2="75" y2="102" stroke="#0E2A47" strokeWidth="2.5" strokeLinecap="round" />
        {/* Legs */}
        <Line x1="82" y1="117" x2="86" y2="124" stroke="#0E2A47" strokeWidth="2.5" strokeLinecap="round" />
        <Line x1="86" y1="124" x2="88" y2="130" stroke="#0E2A47" strokeWidth="2.5" strokeLinecap="round" />
        <Line x1="82" y1="117" x2="78" y2="124" stroke="#0E2A47" strokeWidth="2.5" strokeLinecap="round" />
        <Line x1="78" y1="124" x2="76" y2="130" stroke="#0E2A47" strokeWidth="2.5" strokeLinecap="round" />

        {/* 90° angle marker at shooter — shows camera line ⊥ shooting direction */}
        <Path d="M 76 104 L 76 108 L 80 108" stroke="#F56A4D" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* ── BALL TRAJECTORY (dashed arc from hands to rim) ── */}
        <Path d="M 94 91 Q 124 46 148 47" stroke="#F8B44C" strokeWidth="1.2" strokeDasharray="3 3" fill="none" opacity="0.5" />

        {/* ── ANIMATED BALL ── */}
        <AnimatedCircle cx={ballCx} cy={ballCy} r={ballR} fill="#F8B44C" stroke="#6A3E00" strokeWidth="1.5" opacity={ballOpacity} />

      </Svg>
    </View>
  );
}

function ShotClipsRow({
  clips,
  selectedId,
  onSelect,
}: {
  clips: ShotClip[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const makes = clips.filter((c) => c.label === 'make').length;
  const misses = clips.filter((c) => c.label === 'miss').length;

  return (
    <>
      <Text style={styles.shotSummaryLine}>{makes} makes · {misses} misses</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.shotClipsScroll}
      >
        {clips.map((clip) => {
          const selected = clip.id === selectedId;
          return (
            <Pressable
              key={clip.id}
              onPress={() => onSelect(clip.id)}
              style={[styles.clipTile, selected && styles.clipTileSelected]}
            >
              <View style={[styles.clipThumbnail, { backgroundColor: clip.thumbnailColor }]}>
                <Text style={styles.clipTimestamp}>{clip.timestampLabel}</Text>
              </View>
              <View
                style={[
                  styles.clipLabelRow,
                  clip.label === 'make' ? styles.clipLabelMake : styles.clipLabelMiss,
                ]}
              >
                <Text style={[styles.clipLabelText, { color: clip.label === 'make' ? '#1A6630' : '#8B1A1A' }]}>
                  {clip.label === 'make' ? 'Make' : 'Miss'}
                </Text>
                <Text style={[styles.clipLabelText, { color: clip.label === 'make' ? '#1A6630' : '#8B1A1A' }]}>
                  #{clip.clipNumber}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </>
  );
}

function MakesAnalysisCard({ isReady }: { isReady: boolean }) {
  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Your Makes</Text>
        <Text style={styles.sectionMeta}>Form present even on makes</Text>
      </View>
      <View style={styles.cueBanner}>
        <Text style={styles.cueTitle}>{MAKES_CUE.title}</Text>
        <Text style={styles.cueBody}>
          {isReady ? MAKES_CUE.body : 'Run analysis to see form tendencies from your makes.'}
        </Text>
        <View style={styles.cueFooter}>
          <MetaPill label={isReady ? MAKES_CUE.confidence : 'Confidence pending'} />
        </View>
      </View>
      <View style={styles.metricsGrid}>
        {MAKES_CUE.metrics.map((metric) => (
          <View key={metric.label} style={styles.metricCard}>
            <Text style={styles.metricLabel}>{metric.label}</Text>
            <Text style={styles.metricValue}>{isReady ? metric.value : '--'}</Text>
            <Text style={[styles.metricStatus, { color: statusColor(metric.status) }]}>{metric.status}</Text>
            <Text style={styles.metricBody}>{metric.body}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function MissesAnalysisCard({ isReady }: { isReady: boolean }) {
  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Misses vs Makes</Text>
        <Text style={styles.sectionMeta}>What changes mechanically</Text>
      </View>
      <View style={[styles.cueBanner, styles.missesBanner]}>
        <Text style={[styles.cueTitle, styles.missesCueTitle]}>{MISSES_CUE.title}</Text>
        <Text style={styles.cueBody}>
          {isReady ? MISSES_CUE.body : 'Run analysis to see how your misses differ from your makes.'}
        </Text>
      </View>
      {isReady && (
        <View style={styles.missesVisualization}>
          <Text style={styles.visualizationNote}>{MISSES_CUE.comparisonNote}</Text>
          <Svg height={90} viewBox="0 0 100 100" width="100%">
            <Polyline
              fill="none"
              points={PRIMARY_TRACE}
              stroke="#4CAF82"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
            />
            <Polyline
              fill="none"
              points={COMPARISON_TRACE}
              stroke="#F56A4D"
              strokeDasharray="5 3"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
            />
          </Svg>
          <View style={styles.visualizationLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#4CAF82' }]} />
              <Text style={styles.legendLabel}>Avg make</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#F56A4D' }]} />
              <Text style={styles.legendLabel}>Avg miss</Text>
            </View>
          </View>
        </View>
      )}
    </View>
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
        <Text style={styles.videoBadgeText}>Session in review</Text>
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
      <Text style={styles.emptyVideoTitle}>Bring in your session</Text>
      <Text style={styles.emptyVideoBody}>
        Upload a 5-minute clip of your free throw session. Include makes and misses — the mix is what the analysis
        needs.
      </Text>
      <View style={styles.emptyVideoAction}>
        <Text style={styles.emptyVideoActionText}>Choose your session from Photos</Text>
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
  figurineWrap: {
    aspectRatio: 240 / 148,
    marginVertical: 4,
    width: '100%',
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
  shotSummaryLine: {
    color: '#0E2A47',
    fontSize: 14,
    fontWeight: '700',
  },
  shotClipsScroll: {
    gap: 10,
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  clipTile: {
    borderRadius: 14,
    height: 120,
    overflow: 'hidden',
    width: 88,
  },
  clipTileSelected: {
    borderColor: '#F56A4D',
    borderWidth: 2,
  },
  clipThumbnail: {
    alignItems: 'flex-end',
    flex: 1,
    justifyContent: 'flex-end',
    padding: 6,
  },
  clipTimestamp: {
    color: '#FDF7EF',
    fontSize: 11,
    fontWeight: '700',
  },
  clipLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 28,
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  clipLabelMake: {
    backgroundColor: '#E8F5EC',
  },
  clipLabelMiss: {
    backgroundColor: '#FDE8E8',
  },
  clipLabelText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cueBanner: {
    backgroundColor: '#0E2A47',
    borderRadius: 22,
    gap: 12,
    padding: 16,
  },
  missesBanner: {
    backgroundColor: '#1A0E2A',
  },
  cueTitle: {
    color: '#FDF7EF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  missesCueTitle: {
    color: '#F8B44C',
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
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricBody: {
    color: '#5B6978',
    fontSize: 14,
    lineHeight: 20,
  },
  missesVisualization: {
    backgroundColor: '#EAF1F8',
    borderRadius: 18,
    gap: 8,
    padding: 12,
  },
  visualizationNote: {
    color: '#6A7683',
    fontSize: 11,
    fontWeight: '600',
  },
  visualizationLegend: {
    flexDirection: 'row',
    gap: 14,
  },
  legendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  legendDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  legendLabel: {
    color: '#566170',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyVideoCard: {
    alignItems: 'flex-start',
    backgroundColor: '#EAF1F8',
    borderRadius: 22,
    gap: 12,
    justifyContent: 'center',
    minHeight: 220,
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
