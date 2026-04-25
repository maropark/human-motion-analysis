export type ShotClip = {
  id: string;
  label: 'make' | 'miss';
  clipNumber: number;
  thumbnailColor: string;
  timestampLabel: string;
};

export const CAPTURE_CHECKLIST = [
  {
    title: 'Brace the phone at chest height',
    body: 'Tripod or bench. Lock it before your first shot and leave it there for the whole session.',
  },
  {
    title: 'Keep the whole shooter visible',
    body: 'Shoes, hips, shooting arm, and release point must stay in frame through every make and miss.',
  },
  {
    title: 'Record a full 5-min session of makes and misses',
    body: 'One long clip captures your natural rhythm. A mix of makes and misses gives the analysis enough to compare.',
  },
];

export const ANALYSIS_STAGES = [
  'Finding shot attempts',
  'Classifying makes & misses',
  'Analyzing your makes',
  'Comparing misses to makes',
];

export const PRIMARY_TRACE = '24,88 31,74 38,61 46,51 55,43 62,30 70,18';
export const COMPARISON_TRACE = '26,88 34,76 41,63 49,53 58,44 65,28 71,16';

export const MOCK_SHOT_CLIPS: ShotClip[] = [
  { id: 'c1',  label: 'make', clipNumber: 1,  thumbnailColor: '#1A4D2E', timestampLabel: '0:14' },
  { id: 'c2',  label: 'miss', clipNumber: 2,  thumbnailColor: '#4D1A1A', timestampLabel: '0:42' },
  { id: 'c3',  label: 'make', clipNumber: 3,  thumbnailColor: '#1A4D2E', timestampLabel: '1:08' },
  { id: 'c4',  label: 'miss', clipNumber: 4,  thumbnailColor: '#4D1A1A', timestampLabel: '1:31' },
  { id: 'c5',  label: 'make', clipNumber: 5,  thumbnailColor: '#1A4D2E', timestampLabel: '1:55' },
  { id: 'c6',  label: 'miss', clipNumber: 6,  thumbnailColor: '#4D1A1A', timestampLabel: '2:18' },
  { id: 'c7',  label: 'make', clipNumber: 7,  thumbnailColor: '#1A4D2E', timestampLabel: '2:44' },
  { id: 'c8',  label: 'miss', clipNumber: 8,  thumbnailColor: '#4D1A1A', timestampLabel: '3:02' },
  { id: 'c9',  label: 'make', clipNumber: 9,  thumbnailColor: '#1A4D2E', timestampLabel: '3:29' },
  { id: 'c10', label: 'miss', clipNumber: 10, thumbnailColor: '#4D1A1A', timestampLabel: '3:51' },
];

export const MAKES_CUE = {
  title: 'Set point creeps forward on late makes',
  body: 'Even on shots that go in, your ball position at gather drifts 4–6 cm forward of your eye line in the last third of a session. Tightening the set point earlier in the motion will make your release more repeatable when fatigued.',
  confidence: 'Confidence 79%',
  metrics: [
    {
      label: 'Set-point consistency',
      value: '73%',
      status: 'Monitor',
      body: 'Varies more in the second half of the session than the first.',
    },
    {
      label: 'Release angle proxy',
      value: '48°',
      status: 'Good',
      body: 'Within the target band across all makes. Preserve this.',
    },
    {
      label: 'Elbow flare',
      value: '12°',
      status: 'Monitor',
      body: 'Slight outward drift before release, present even on makes.',
    },
    {
      label: 'Follow-through height',
      value: '+3 cm',
      status: 'Stable',
      body: 'Consistent. Not a source of variance in this session.',
    },
  ],
};

export const MISSES_CUE = {
  title: 'Misses start lower and arrive shorter',
  body: 'On missed shots, your gather point is on average 7 cm lower and the ball exits 3° flatter than on makes. The trajectory difference is visible by the set point, not at release — which means the fix happens earlier in the motion than it feels.',
  comparisonNote: 'Avg miss path vs. avg make path',
};
