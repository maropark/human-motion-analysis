import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';

type Props = {
  onClose: () => void;
};

export function CameraScreen({ onClose }: Props) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const [frameCount, setFrameCount] = useState(0);
  const [frameSize, setFrameSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission().then((granted) => {
        if (!granted) {
          Alert.alert(
            'Camera access needed',
            'Shotpath needs the camera to record a session for on-device motion analysis.'
          );
        }
      });
    }
  }, [hasPermission, requestPermission]);

  const onFrame = Worklets.createRunOnJS((w: number, h: number) => {
    setFrameCount((n) => n + 1);
    setFrameSize({ w, h });
  });

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      // Throttle: only notify JS every ~30th frame to avoid flooding the bridge.
      if (frame.timestamp % 30 === 0) {
        onFrame(frame.width, frame.height);
      }
    },
    [onFrame]
  );

  if (!hasPermission) {
    return (
      <View style={styles.fullscreen}>
        <Text style={styles.statusText}>Requesting camera permission…</Text>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.fullscreen}>
        <Text style={styles.statusText}>No back camera available on this device.</Text>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.fullscreen}>
      <Camera
        device={device}
        frameProcessor={frameProcessor}
        isActive
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.hudTop}>
        <View style={styles.hudPill}>
          <Text style={styles.hudPillText}>
            FP frames: {frameCount}
            {frameSize ? `  ·  ${frameSize.w}×${frameSize.h}` : ''}
          </Text>
        </View>
      </View>
      <View style={styles.hudBottom}>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>Close</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullscreen: {
    backgroundColor: '#000',
    flex: 1,
  },
  statusText: {
    color: '#FDF7EF',
    fontSize: 16,
    fontWeight: '600',
    padding: 24,
    textAlign: 'center',
  },
  hudTop: {
    alignItems: 'center',
    left: 0,
    paddingTop: 56,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  hudBottom: {
    alignItems: 'center',
    bottom: 40,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  hudPill: {
    backgroundColor: 'rgba(14, 42, 71, 0.85)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  hudPillText: {
    color: '#FDF7EF',
    fontSize: 13,
    fontWeight: '700',
  },
  closeButton: {
    backgroundColor: '#F56A4D',
    borderRadius: 999,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  closeButtonText: {
    color: '#FFF7F1',
    fontSize: 15,
    fontWeight: '800',
  },
});
