/**
 * GPS & Navigation Service Abstraction
 * 
 * IMPORTANT:
 * External mapping providers (Google Maps, Mapbox) and API keys
 * are not yet finalized. This abstraction provides step-by-step route
 * guidance simulation with distance, direction, and vocal instruction
 * ready to plug into native geolocation and mapping SDKs.
 */

import {
  LocationCoordinates,
  NavigationInstruction,
  NavigationStatus,
} from '../../types';

export type NavigationListener = (
  status: NavigationStatus,
  currentStep?: NavigationInstruction | null,
  location?: LocationCoordinates | null
) => void;

export interface INavigationService {
  getCurrentLocation(): Promise<LocationCoordinates | null>;
  getDirections(destination: string): Promise<NavigationInstruction[]>;
  startNavigation(destination: string): Promise<boolean>;
  stopNavigation(): void;
  nextStep(): NavigationInstruction | null;
  getStatus(): NavigationStatus;
  getCurrentInstruction(): NavigationInstruction | null;
  onNavigationUpdate(listener: NavigationListener): () => void;
}

export class NavigationService implements INavigationService {
  private status: NavigationStatus = 'idle';
  private instructions: NavigationInstruction[] = [];
  private currentStepIndex: number = 0;
  private listeners: Set<NavigationListener> = new Set();

  private currentLocation: LocationCoordinates = {
    latitude: 37.7749,
    longitude: -122.4194,
    altitude: 12,
    accuracy: 3.5, // High GPS accuracy in meters
    speed: 1.1,    // Walking speed ~1.1 m/s
  };

  private defaultRouteInstructions: NavigationInstruction[] = [
    {
      id: 'step-1',
      instruction: 'Walk straight ahead for 35 meters along the walkway.',
      distanceMeters: 35,
      direction: 'straight',
    },
    {
      id: 'step-2',
      instruction: 'Turn slight right towards the building entrance ramp.',
      distanceMeters: 15,
      direction: 'slight-right',
    },
    {
      id: 'step-3',
      instruction: 'Approaching entrance. Turn sharp left towards the automatic door.',
      distanceMeters: 10,
      direction: 'sharp-left',
    },
    {
      id: 'step-4',
      instruction: 'You have arrived at your destination: Main Lobby.',
      distanceMeters: 0,
      direction: 'arrive',
    },
  ];

  private notifyListeners() {
    const currentStep = this.instructions[this.currentStepIndex];
    this.listeners.forEach((listener) => {
      try {
        listener(this.status, currentStep, this.currentLocation);
      } catch {
        // Suppress listener error
      }
    });
  }

  onNavigationUpdate(listener: NavigationListener): () => void {
    this.listeners.add(listener);
    listener(this.status, this.getCurrentInstruction(), this.currentLocation);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async getCurrentLocation(): Promise<LocationCoordinates | null> {
    // In production: will query Android LocationManager / FusedLocationProviderClient
    return { ...this.currentLocation };
  }

  async getDirections(_destination: string): Promise<NavigationInstruction[]> {
    // In production: will call Google Maps Directions API or Mapbox Directions API
    this.instructions = [...this.defaultRouteInstructions];
    return this.instructions;
  }

  async startNavigation(destination: string): Promise<boolean> {
    await this.getDirections(destination);
    this.currentStepIndex = 0;
    this.status = 'navigating';
    this.notifyListeners();
    return true;
  }

  stopNavigation(): void {
    this.status = 'idle';
    this.instructions = [];
    this.currentStepIndex = 0;
    this.notifyListeners();
  }

  nextStep(): NavigationInstruction | null {
    if (this.status !== 'navigating') return null;

    if (this.currentStepIndex < this.instructions.length - 1) {
      this.currentStepIndex += 1;
      if (this.currentStepIndex === this.instructions.length - 1) {
        this.status = 'arrived';
      }
      this.notifyListeners();
      return this.instructions[this.currentStepIndex];
    }
    return null;
  }

  getStatus(): NavigationStatus {
    return this.status;
  }

  getCurrentInstruction(): NavigationInstruction | null {
    if (this.instructions.length === 0) return null;
    return this.instructions[this.currentStepIndex] || null;
  }
}

export const navigationService = new NavigationService();
export default navigationService;
