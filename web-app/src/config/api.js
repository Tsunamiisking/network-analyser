export const API_BASE_URL = 'http://localhost:3000/api';

export const PROVIDERS = ['MTN', 'Airtel', 'Glo', '9mobile'];

export const ISSUE_TYPES = ['No Signal', 'Slow Internet', 'Call Drop', 'No Data'];

export const SIGNAL_QUALITY = [
  { label: 'Excellent', min: -85,   max: Infinity, color: '#22C55E' },
  { label: 'Good',      min: -95,   max: -85,      color: '#86EFAC' },
  { label: 'Fair',      min: -105,  max: -95,      color: '#EAB308' },
  { label: 'Poor',      min: -115,  max: -105,     color: '#F97316' },
  { label: 'Very Poor', min: -Infinity, max: -115, color: '#EF4444' },
];

export function getSignalTier(dbm) {
  if (dbm > -85)  return SIGNAL_QUALITY[0];
  if (dbm > -95)  return SIGNAL_QUALITY[1];
  if (dbm > -105) return SIGNAL_QUALITY[2];
  if (dbm > -115) return SIGNAL_QUALITY[3];
  return SIGNAL_QUALITY[4];
}
