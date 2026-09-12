/**
 * Emergency SOS Service Abstraction
 * 
 * IMPORTANT:
 * Does not send real SMS or place emergency phone calls without approved
 * telephony/telecom infrastructure. Provides a complete state machine
 * and contact dispatch simulation for assistive safety testing.
 */

import { EmergencyContact, LocationCoordinates, SOSStatus } from '../../types';

export type SOSStatusListener = (
  status: SOSStatus,
  location?: LocationCoordinates,
  contacts?: EmergencyContact[]
) => void;

export interface ISOSService {
  triggerSOS(location?: LocationCoordinates): Promise<boolean>;
  cancelSOS(): Promise<boolean>;
  getEmergencyContacts(): Promise<EmergencyContact[]>;
  getStatus(): SOSStatus;
  onStatusChange(listener: SOSStatusListener): () => void;
}

export class SOSService implements ISOSService {
  private status: SOSStatus = 'idle';
  private listeners: Set<SOSStatusListener> = new Set();

  private emergencyContacts: EmergencyContact[] = [
    {
      id: 'contact-1',
      name: 'Primary Caregiver (Sarah)',
      phoneNumber: '+1 (555) 234-5678',
      relation: 'Family',
    },
    {
      id: 'contact-2',
      name: 'Emergency Guardian (David)',
      phoneNumber: '+1 (555) 876-5432',
      relation: 'Guardian',
    },
  ];

  private lastDispatchedLocation?: LocationCoordinates;

  private notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.status, this.lastDispatchedLocation, this.emergencyContacts);
      } catch {
        // Suppress callback error
      }
    });
  }

  onStatusChange(listener: SOSStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.status, this.lastDispatchedLocation, this.emergencyContacts);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async triggerSOS(location?: LocationCoordinates): Promise<boolean> {
    this.status = 'sending';
    this.lastDispatchedLocation = location || {
      latitude: 37.7749,
      longitude: -122.4194,
      accuracy: 4.2,
    };
    this.notifyListeners();

    // Simulating emergency dispatch network latency
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 800));

    this.status = 'sent';
    this.notifyListeners();
    return true;
  }

  async cancelSOS(): Promise<boolean> {
    this.status = 'cancelled';
    this.notifyListeners();

    await new Promise<void>((resolve) => setTimeout(() => resolve(), 400));
    this.status = 'idle';
    this.notifyListeners();
    return true;
  }

  async getEmergencyContacts(): Promise<EmergencyContact[]> {
    return [...this.emergencyContacts];
  }

  getStatus(): SOSStatus {
    return this.status;
  }
}

export const sosService = new SOSService();
export default sosService;
