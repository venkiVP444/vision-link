/**
 * Vision-Link Essential Obstacle Filter
 * EXACT 20 allowed COCO classes supported by SSD MobileNet v1.
 * Ignore everything else (e.g. cat, horse, traffic light, bottle, cup, laptop, etc.).
 */

export const ESSENTIAL_OBJECT_ALLOWLIST: readonly string[] = [
  'person',
  'car',
  'motorcycle',
  'bicycle',
  'bus',
  'truck',
  'stop sign',
  'fire hydrant',
  'bench',
  'dog',
  'chair',
  'couch',
  'dining table',
  'table',
  'bed',
  'toilet',
  'potted plant',
  'backpack',
  'umbrella',
  'suitcase',
  'tv',
] as const;

/**
 * Checks whether a given COCO label is in the essential 20-object allowlist.
 */
export function isAllowedObstacle(label: string | null | undefined): boolean {
  if (!label) return false;
  const normalized = label.trim().toLowerCase();
  return ESSENTIAL_OBJECT_ALLOWLIST.includes(normalized);
}

/**
 * Standardizes the display/warning label (e.g., "dining table" -> "Table", "tv" -> "TV").
 */
export function formatObstacleLabel(rawLabel: string): string {
  const trimmed = rawLabel.trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'dining table' || lower === 'table') {
    return 'Table';
  }
  if (lower === 'tv') {
    return 'TV';
  }
  if (lower === 'stop sign') {
    return 'Stop sign';
  }
  if (lower === 'fire hydrant') {
    return 'Fire hydrant';
  }
  if (lower === 'potted plant') {
    return 'Potted plant';
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

/**
 * Formulates the standard dynamic obstacle warning sentence:
 * "<Object> ahead, be careful"
 */
export function generateObstacleWarning(label: string, position: string = 'ahead'): string {
  const formatted = formatObstacleLabel(label);
  if (position === 'left') {
    return `${formatted} on your left, be careful`;
  }
  if (position === 'right') {
    return `${formatted} on your right, be careful`;
  }
  return `${formatted} ahead, be careful`;
}
