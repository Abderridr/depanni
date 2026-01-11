import { User, UserRole, RequestStatus, ServiceRequest, MechanicProfile, DriverProfile, Offer } from '../types';

// Initial Mock Data
const MOCK_MECHANICS: MechanicProfile[] = [
  { id: 'm1', name: 'Ahmed Benali', email: 'ahmed@depanni.ma', phone: '0661234567', password: '123', role: UserRole.MECHANIC, rating: 4.8, isOnline: true, specialties: ['Batterie', 'Pneu'], vehicleType: 'car', location: { lat: 33.5731, lng: -7.5898 }, basePrice: 150, bio: 'Expert en pannes rapides, 10 ans d\'expérience.' },
  { id: 'm2', name: 'Garage AutoPlus', email: 'contact@autoplus.ma', phone: '0669876543', password: '123', role: UserRole.MECHANIC, rating: 4.5, isOnline: true, specialties: ['Moteur', 'Remorquage'], vehicleType: 'truck', location: { lat: 33.5780, lng: -7.5920 }, basePrice: 300, bio: 'Service de remorquage 24/7.' },
  { id: 'm3', name: 'Karim Moto', email: 'karim@moto.ma', phone: '0661122334', password: '123', role: UserRole.MECHANIC, rating: 4.9, isOnline: true, specialties: ['Moto'], vehicleType: 'moto', location: { lat: 33.5600, lng: -7.6000 }, basePrice: 100, bio: 'Réparation moto express.' },
];

const MOCK_DRIVERS: DriverProfile[] = [
    { id: 'u1', name: 'Yassine Driver', email: 'yassine@gmail.com', phone: '0600000000', password: '123', role: UserRole.DRIVER, location: { lat: 33.5731, lng: -7.5898 }, vehicleModel: 'Dacia Logan' }
];

class MockBackendService {
  private users: User[] = [...MOCK_MECHANICS, ...MOCK_DRIVERS];
  private requests: ServiceRequest[] = [];
  private currentUser: User | null = null;
  private subscribers: Function[] = [];

  // --- Auth ---

  login(email: string, pass: string): User {
    const user = this.users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === pass);
    if (!user) throw new Error("Email ou mot de passe incorrect");
    this.currentUser = user;
    return user;
  }

  register(userData: Partial<User & MechanicProfile & DriverProfile> & { password: string, role: UserRole }): User {
    const exists = this.users.find(u => u.email === userData.email);
    if (exists) throw new Error("Cet email est déjà utilisé");

    const newUser: User = {
      id: `user_${Date.now()}`,
      name: userData.name || 'Utilisateur',
      email: userData.email || '',
      phone: userData.phone || '',
      password: userData.password,
      role: userData.role,
      location: { lat: 33.5731, lng: -7.5898 }, // Default Casablance
      ...userData
    };

    this.users.push(newUser);
    this.currentUser = newUser;
    return newUser;
  }

  logout() {
    this.currentUser = null;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  // --- Data ---

  getNearbyMechanics() {
    return this.users.filter(u => u.role === UserRole.MECHANIC && (u as MechanicProfile).isOnline) as MechanicProfile[];
  }

  createRequest(description: string, location: { lat: number, lng: number }): ServiceRequest {
    const newRequest: ServiceRequest = {
      id: `req_${Date.now()}`,
      driverId: this.currentUser?.id || 'u1',
      status: RequestStatus.PENDING,
      problemDescription: description,
      location,
      createdAt: Date.now(),
      offers: []
    };
    this.requests.push(newRequest);
    this.notifySubscribers();

    // Simulation: Other AI mechanics send offers automatically after a few seconds
    setTimeout(() => {
        this.simulateAutomatedOffers(newRequest.id);
    }, 2000);

    return newRequest;
  }

  simulateAutomatedOffers(requestId: string) {
      const req = this.requests.find(r => r.id === requestId);
      if(!req || req.status !== RequestStatus.PENDING) return;

      req.status = RequestStatus.OFFERING;
      
      const bots = MOCK_MECHANICS.filter(m => m.id !== this.currentUser?.id); // Don't let current user bot against themselves if they are testing mech side
      
      bots.forEach((mech, index) => {
          setTimeout(() => {
              if(req.status === RequestStatus.OFFERING || req.status === RequestStatus.PENDING) {
                const offer: Offer = {
                    id: `off_${Date.now()}_${mech.id}`,
                    requestId,
                    mechanicId: mech.id,
                    mechanicName: mech.name,
                    mechanicRating: mech.rating || 5.0,
                    price: (mech.basePrice || 100) + Math.floor(Math.random() * 50),
                    eta: 10 + Math.floor(Math.random() * 20),
                    createdAt: Date.now(),
                    status: 'PENDING'
                };
                req.offers.push(offer);
                this.notifySubscribers();
              }
          }, index * 2000 + 1000);
      });
  }

  sendOffer(requestId: string, mechanicId: string, price: number) {
      const req = this.requests.find(r => r.id === requestId);
      const mech = this.users.find(u => u.id === mechanicId) as MechanicProfile;
      
      if (req && mech) {
          req.status = RequestStatus.OFFERING;
          const offer: Offer = {
              id: `off_${Date.now()}`,
              requestId,
              mechanicId,
              mechanicName: mech.name,
              mechanicRating: mech.rating || 5.0,
              price,
              eta: 15, // Mock ETA
              createdAt: Date.now(),
              status: 'PENDING'
          };
          req.offers.push(offer);
          this.notifySubscribers();
      }
  }

  acceptOffer(requestId: string, offerId: string) {
    const req = this.requests.find(r => r.id === requestId);
    if (req) {
      const offer = req.offers.find(o => o.id === offerId);
      if(offer) {
          req.status = RequestStatus.ACCEPTED;
          req.mechanicId = offer.mechanicId;
          req.acceptedOfferId = offerId;
          this.notifySubscribers();
      }
    }
  }

  updateStatus(requestId: string, status: RequestStatus) {
    const req = this.requests.find(r => r.id === requestId);
    if (req) {
      req.status = status;
      this.notifySubscribers();
    }
  }

  getPendingRequestsForMechanic() {
    // Mechanics see requests that are PENDING or OFFERING (where they haven't won yet)
    return this.requests.filter(r => r.status === RequestStatus.PENDING || r.status === RequestStatus.OFFERING);
  }

  getActiveRequestForDriver(driverId: string) {
    return this.requests.find(r => r.driverId === driverId && r.status !== RequestStatus.COMPLETED && r.status !== RequestStatus.CANCELLED);
  }

  getActiveJobForMechanic(mechanicId: string) {
    return this.requests.find(r => r.mechanicId === mechanicId && r.status !== RequestStatus.COMPLETED && r.status !== RequestStatus.CANCELLED);
  }

  subscribe(callback: Function) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  private notifySubscribers() {
    this.subscribers.forEach(cb => cb());
  }
}

export const mockBackend = new MockBackendService();