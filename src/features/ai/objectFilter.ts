/**
 * Vision-Link Relevant Obstacle Filter
 *
 * Configured Category Breakdown for SSD MobileNet v1 (COCO 91 classes):
 *
 * 1. People:
 *    - Person: SUPPORTED (COCO class 0: 'person')
 *
 * 2. Vehicles — Street Safety:
 *    - Car: SUPPORTED (COCO class 2: 'car')
 *    - Truck: SUPPORTED (COCO class 7: 'truck')
 *    - Bus: SUPPORTED (COCO class 5: 'bus')
 *    - Motorcycle: SUPPORTED (COCO class 3: 'motorcycle')
 *    - Bicycle: SUPPORTED (COCO class 1: 'bicycle')
 *
 * 3. Indoor Obstacles:
 *    - Chair: SUPPORTED (COCO class 61: 'chair')
 *    - Table: SUPPORTED (COCO class 66: 'dining table', mapped to display 'Table')
 *    - Desk: UNSUPPORTED (COCO 80/91 has no 'desk' class)
 *    - Bed: SUPPORTED (COCO class 64: 'bed')
 *    - Sofa: SUPPORTED (COCO class 62: 'couch', mapped to display 'Sofa')
 *
 * 4. Navigation:
 *    - Door: UNSUPPORTED (COCO 80/91 has no 'door' class)
 *    - Wall: UNSUPPORTED (COCO 80/91 has no 'wall' class)
 *    - Stairs: UNSUPPORTED (COCO 80/91 has no 'stairs' class)
 */

export const SUPPORTED_RELEVANT_OBJECT_ALLOWLIST: readonly string[] = [
  'person',
  'car',
  'truck',
  'bus',
  'motorcycle',
  'bicycle',
  'chair',
  'dining table',
  'table',
  'bed',
  'couch',
  'sofa',
] as const;

export const ESSENTIAL_OBJECT_ALLOWLIST = SUPPORTED_RELEVANT_OBJECT_ALLOWLIST;

/**
 * Requested categories not available in the COCO SSD MobileNet v1 dataset.
 * Documented explicitly per specification without inventing or mismapping classes.
 */
export const UNSUPPORTED_REQUESTED_OBJECTS: readonly string[] = [
  'desk',
  'door',
  'wall',
  'stairs',
] as const;

/**
 * Checks whether a given COCO label is in the relevant object allowlist.
 */
export function isAllowedObstacle(label: string | null | undefined): boolean {
  if (!label) return false;
  const normalized = label.trim().toLowerCase();
  return SUPPORTED_RELEVANT_OBJECT_ALLOWLIST.includes(normalized);
}

/**
 * Standardizes the display/warning label (e.g., "dining table" -> "Table", "couch" -> "Sofa").
 */
export function formatObstacleLabel(rawLabel: string): string {
  const trimmed = rawLabel.trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'dining table' || lower === 'table') {
    return 'Table';
  }
  if (lower === 'couch' || lower === 'sofa') {
    return 'Sofa';
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
