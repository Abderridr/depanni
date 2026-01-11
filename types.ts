
export enum UserRole {
  DRIVER = 'DRIVER',
  MECHANIC = 'MECHANIC',
}

export enum RequestStatus {
  PENDING = 'PENDING', // Waiting for offers
  OFFERING = 'OFFERING', // Mechanics are sending offers
  ACCEPTED = 'ACCEPTED', // Driver accepted an offer
  EN_ROUTE = 'EN_ROUTE', // Mechanic is moving
  ARRIVED = 'ARRIVED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  password?: string;
  avatar?: string;
  rating?: number;
  location?: Coordinates;
}

export interface MechanicProfile extends User {
  isOnline: boolean;
  specialties: string[];
  vehicleType: 'moto' | 'car' | 'truck';
  basePrice?: number;
  bio?: string;
}

export interface DriverProfile extends User {
  vehicleModel?: string;
}

export interface Offer {
  id: string;
  requestId: string;
  mechanicId: string;
  mechanicName: string;
  mechanicRating: number;
  price: number;
  originalPrice?: number; // Added for negotiation tracking
  isCounterOffer?: boolean; // Added
  eta: number;
  createdAt: number;
  status: 'PENDING' | 'NEGOTIATING' | 'ACCEPTED' | 'REJECTED'; // Added
}

export interface ServiceRequest {
  id: string;
  driverId: string;
  mechanicId?: string; 
  status: RequestStatus;
  problemDescription: string;
  location: Coordinates;
  createdAt: number;
  acceptedOfferId?: string;
  offers: Offer[];
}
