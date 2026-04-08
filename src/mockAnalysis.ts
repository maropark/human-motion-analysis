export const CAPTURE_CHECKLIST = [
  {
    title: 'Brace the phone at chest height',
    body: 'Use a tripod or bench so the player stays stable in frame from setup through landing.',
  },
  {
    title: 'Keep the whole shooter visible',
    body: 'The MVP needs shoes, hips, shooting arm, and release point visible to score the rep safely.',
  },
  {
    title: 'Record one rep per clip',
    body: 'Short clips reduce latency and make the analysis window easier to segment reliably.',
  },
];

export const ANALYSIS_STAGES = ['Validate framing', 'Extract pose', 'Trace release path', 'Score cue'];

export const PRIMARY_TRACE = '24,88 31,74 38,61 46,51 55,43 62,30 70,18';
export const COMPARISON_TRACE = '26,88 34,76 41,63 49,53 58,44 65,28 71,16';

export const PRIMARY_CUE = {
  title: 'Keep your set point tighter',
  body:
    'Your shooting elbow drifts outward before release. On the next rep, bring the ball to the same eyebrow-height set point and keep the forearm more vertical through the gather.',
  confidence: 'Confidence 82%',
  whyItMatters: 'Release path consistency',
};

export const MOCK_METRICS = [
  {
    body: 'Slightly flatter than the comparison rep. Good enough to coach, not enough to reject.',
    label: 'Release angle proxy',
    status: 'Monitor',
    value: '47°',
  },
  {
    body: 'Your elbow path fans outward during the gather. This is the clearest source of variance.',
    label: 'Elbow path consistency',
    status: 'Needs work',
    value: '61%',
  },
  {
    body: 'Set point stayed in the target band. Preserve this while tightening the elbow path.',
    label: 'Set-point height',
    status: 'Good',
    value: '+2 cm',
  },
  {
    body: 'Landing drift was controlled. The base stays usable, so the next cue should target the upper body.',
    label: 'Landing drift',
    status: 'Stable',
    value: '6 cm',
  },
];
