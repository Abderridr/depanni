
import { supabase } from './supabaseClient';
import { User, UserRole, RequestStatus, ServiceRequest, MechanicProfile, DriverProfile, Offer, Coordinates } from '../types';

class BackendService {
  private subscribers: Function[] = [];
  private currentUser: User | null = null;
  private channel: any = null;
  private lastLocationUpdate: number = 0;

  constructor() {
    this.initRealtime();
    this.restoreSession();
  }

  initRealtime() {
    if (this.channel) return;
    
    this.channel = supabase.channel('depanni-realtime-v5')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => this.notifySubscribers())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offers' }, () => this.notifySubscribers())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => this.notifySubscribers())
      .subscribe((status) => {
        console.log('Realtime status:', status);
      });
  }

  async restoreSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      this.currentUser = await this.fetchProfile(session.user.id);
      this.notifySubscribers();
    }
  }

  async fetchProfile(id: string): Promise<User | null> {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single();
    if (error || !data) return null;
    return this.mapProfileToUser(data);
  }

  getAuthUser() {
      // Returns the raw auth user even if profile doesn't exist yet (for onboarding flow)
      return supabase.auth.getUser().then(({ data }) => data.user);
  }

  async login(email: string, password: string): Promise<User> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    
    if (data.user) {
        const user = await this.fetchProfile(data.user.id);
        if(!user) throw new Error("Profil introuvable");
        this.currentUser = user;
        return user;
    }
    throw new Error("Erreur de connexion");
  }

  async signInWithProvider(provider: 'google' | 'facebook') {
      const { data, error } = await supabase.auth.signInWithOAuth({
          provider: provider,
          options: {
              redirectTo: window.location.origin,
              queryParams: {
                  access_type: 'offline',
                  prompt: 'consent',
              },
          },
      });
      if (error) throw error;
      return data;
  }

  async completeProfile(userId: string, userData: any): Promise<User> {
      const profileData = {
          id: userId,
          email: userData.email,
          name: userData.name,
          phone: userData.phone,
          role: userData.role,
          vehicle_model: userData.vehicleModel || null,
          specialties: userData.specialties || null,
          base_price: userData.basePrice || null,
          is_online: true,
          location: userData.location || { lat: 33.5731, lng: -7.5898 }
      };

      const { error } = await supabase.from('profiles').insert(profileData);
      if (error) throw error;

      const user = await this.fetchProfile(userId);
      if (!user) throw new Error("Erreur lors de la création du profil");
      
      this.currentUser = user;
      this.notifySubscribers();
      return user;
  }

  async register(userData: any): Promise<{ user: User | null, message?: string }> {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
    });
    
    if (authError) throw authError;
    if (!authData.user) throw new Error("Erreur lors de la création du compte");

    // Reuse completeProfile logic
    await this.completeProfile(authData.user.id, { ...userData, email: authData.user.email });

    if (authData.session) {
        return { user: this.currentUser };
    }
    return { user: null, message: "Veuillez confirmer votre email." };
  }

  async logout() {
    await supabase.auth.signOut();
    this.currentUser = null;
    this.notifySubscribers();
  }

  getCurrentUser() { return this.currentUser; }

  async updateUserLocation(lat: number, lng: number): Promise<void> {
      if (!this.currentUser) return;
      
      const now = Date.now();
      if (now - this.lastLocationUpdate < 2000) return; 
      this.lastLocationUpdate = now;

      const { error } = await supabase.from('profiles')
        .update({ location: { lat: parseFloat(lat.toString()), lng: parseFloat(lng.toString()) } })
        .eq('id', this.currentUser.id);
      
      if (!error) {
          this.currentUser.location = { lat, lng };
      }
  }

  async getNearbyMechanics(): Promise<MechanicProfile[]> {
    const { data } = await supabase.from('profiles')
        .select('*')
        .eq('role', UserRole.MECHANIC)
        .eq('is_online', true);
    
    return (data || []).map(d => this.mapProfileToUser(d)) as MechanicProfile[];
  }

  async createRequest(description: string, location: Coordinates): Promise<void> {
    if(!this.currentUser) return;
    const { error } = await supabase.from('requests').insert({
        driver_id: this.currentUser.id,
        status: RequestStatus.PENDING,
        problem_description: description,
        location: { lat: parseFloat(location.lat.toString()), lng: parseFloat(location.lng.toString()) }
    });
    if (error) console.error("Error creating request:", error.message);
  }

  async sendOffer(requestId: string, mechanicId: string, price: number): Promise<void> {
    if (!requestId || !mechanicId) return;
    
    const user = this.currentUser as MechanicProfile;
    const offerData: any = {
        request_id: requestId,
        mechanic_id: mechanicId,
        mechanic_name: user.name || "Mécanicien",
        mechanic_rating: user.rating || 5.0,
        price: Number(price),
        original_price: Number(price),
        eta: 15,
        status: 'PENDING',
        is_counter_offer: false
    };

    let { error } = await supabase.from('offers').insert(offerData);

    if (error) {
        console.warn("Retrying offer without extended columns due to schema mismatch:", error.message);
        // Fallback: Remove columns that might be missing in a non-updated schema
        const minimalOffer = {
            request_id: requestId,
            mechanic_id: mechanicId,
            price: Number(price)
        };
        const retry = await supabase.from('offers').insert(minimalOffer);
        if (retry.error) {
            console.error("FATAL OFFER ERROR:", retry.error.message);
            throw new Error(`Erreur lors de l'envoi: ${retry.error.message}`);
        }
    }

    // Mark request as having offers
    await supabase.from('requests')
        .update({ status: RequestStatus.OFFERING })
        .eq('id', requestId)
        .eq('status', RequestStatus.PENDING);
  }

  async submitCounterOffer(offerId: string, newPrice: number): Promise<void> {
      const { error } = await supabase.from('offers').update({
          price: Number(newPrice),
          is_counter_offer: true,
          status: 'NEGOTIATING'
      }).eq('id', offerId);
      
      if (error) {
          console.warn("Counter offer failed, trying minimal update:", error.message);
          await supabase.from('offers').update({
              price: Number(newPrice)
          }).eq('id', offerId);
      }
  }

  async cancelCounterOffer(offerId: string, originalPrice: number): Promise<void> {
      // Driver regrets offering a price, reset to original
      await supabase.from('offers').update({
          price: Number(originalPrice),
          is_counter_offer: false,
          status: 'PENDING'
      }).eq('id', offerId);
  }

  async rejectCounterOffer(offerId: string, originalPrice: number): Promise<void> {
      // Mechanic says NO to the counter offer
      await supabase.from('offers').update({
          price: Number(originalPrice),
          is_counter_offer: false,
          status: 'PENDING' // Go back to normal state
      }).eq('id', offerId);
  }

  async acceptOffer(requestId: string, offerId: string): Promise<void> {
    const { data: offer } = await supabase.from('offers').select('*').eq('id', offerId).single();
    if(!offer) return;

    await supabase.from('offers').update({ status: 'ACCEPTED' }).eq('id', offerId);
    await supabase.from('requests').update({
        status: RequestStatus.ACCEPTED,
        mechanic_id: offer.mechanic_id,
        accepted_offer_id: offerId
    }).eq('id', requestId);
  }

  async updateStatus(requestId: string, status: RequestStatus): Promise<void> {
    await supabase.from('requests').update({ status }).eq('id', requestId);
  }

  async getActiveRequestForDriver(driverId: string): Promise<ServiceRequest | null> {
    const { data: request, error: reqError } = await supabase.from('requests')
        .select('*')
        .eq('driver_id', driverId)
        .neq('status', RequestStatus.COMPLETED)
        .neq('status', RequestStatus.CANCELLED)
        .maybeSingle(); 
    
    if (!request || reqError) return null;

    const { data: offers } = await supabase.from('offers')
        .select('*')
        .eq('request_id', request.id)
        .order('created_at', { ascending: false });

    request.offers = offers || [];
    return this.mapToServiceRequest(request);
  }

  async getActiveJobForMechanic(mechanicId: string): Promise<ServiceRequest | null> {
     const { data: request } = await supabase.from('requests')
        .select('*')
        .eq('mechanic_id', mechanicId)
        .neq('status', RequestStatus.COMPLETED)
        .neq('status', RequestStatus.CANCELLED)
        .maybeSingle();

    if (!request) return null;

    const { data: offers } = await supabase.from('offers').select('*').eq('request_id', request.id);
    request.offers = offers || [];
    return this.mapToServiceRequest(request);
  }

  async getPendingRequestsForMechanic(): Promise<ServiceRequest[]> {
     const { data: requests } = await supabase.from('requests')
        .select('*')
        .in('status', [RequestStatus.PENDING, RequestStatus.OFFERING])
        .order('created_at', { ascending: false });
    
     if (!requests || requests.length === 0) return [];
     const requestIds = requests.map(r => r.id);
     const { data: allOffers } = await supabase.from('offers').select('*').in('request_id', requestIds);

     return requests.map(req => {
         req.offers = allOffers?.filter(o => o.request_id === req.id) || [];
         return this.mapToServiceRequest(req);
     });
  }

  subscribe(callback: Function) {
    this.subscribers.push(callback);
    return () => { this.subscribers = this.subscribers.filter(cb => cb !== callback); };
  }

  private notifySubscribers() { this.subscribers.forEach(cb => cb()); }

  private mapProfileToUser(data: any): User {
      let loc = { lat: 33.5731, lng: -7.5898 };
      if (data.location && typeof data.location === 'object') {
          loc = { lat: parseFloat(data.location.lat) || 33.5731, lng: parseFloat(data.location.lng) || -7.5898 };
      }
      return { ...data, location: loc };
  }

  private mapToServiceRequest(data: any): ServiceRequest {
      return {
          id: data.id,
          driverId: data.driver_id,
          mechanicId: data.mechanic_id,
          status: data.status,
          problemDescription: data.problem_description,
          location: data.location || { lat: 33.5731, lng: -7.5898 },
          createdAt: new Date(data.created_at).getTime(),
          acceptedOfferId: data.accepted_offer_id,
          offers: (data.offers || []).map((o: any) => ({
              id: o.id,
              requestId: o.request_id,
              mechanicId: o.mechanic_id,
              mechanicName: o.mechanic_name || "Mécanicien",
              mechanicRating: o.mechanic_rating || 5.0,
              price: Number(o.price),
              originalPrice: Number(o.original_price || o.price),
              isCounterOffer: !!o.is_counter_offer,
              status: o.status || 'PENDING',
              eta: o.eta || 15,
              createdAt: new Date(o.created_at).getTime()
          }))
      };
  }
}

export const api = new BackendService();