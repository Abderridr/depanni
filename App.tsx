import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  MapPin, 
  Wrench, 
  ShieldAlert, 
  ChevronRight, 
  LogOut, 
  User as UserIcon, 
  Star,
  CheckCircle, 
  Mic,
  Navigation, 
  MessageSquare, 
  Car,
  X,
  CreditCard, 
  Mail, 
  Lock, 
  Clock, 
  Phone, 
  BarChart3, 
  RefreshCw, 
  Zap, 
  Menu, 
  Sun, 
  Moon,
  Facebook,
  Eye,
  EyeOff
} from './components/Icons';
import { api } from './services/api';
import { diagnoseProblem } from './services/geminiService';
import { User, UserRole, RequestStatus, ServiceRequest, Offer } from './types';
import { MechanicMap } from './components/MechanicMap';

// --- Assets & Helper Components ---

const LOGO_URL = "https://i.ibb.co/BVtQK5xd/unnabbmed.jpg";

const BrandLogo = ({ size = 60, className = "" }: { size?: number, className?: string }) => (
    <div className={`relative flex items-center justify-center overflow-hidden rounded-2xl shadow-lg ${className}`} style={{ width: size, height: size }}>
         <img 
            src={LOGO_URL} 
            alt="Dépanni Logo" 
            className="w-full h-full object-cover transform hover:scale-110 transition-transform duration-500"
         />
    </div>
);

// --- Helper Functions ---

const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
        const data = await res.json();
        if (data && data.address) {
            const street = data.address.road || data.address.suburb || data.address.neighbourhood || '';
            const city = data.address.city || data.address.town || data.address.state || 'Maroc';
            return `${street ? street + ', ' : ''}${city}`;
        }
        return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch (e) {
        return "Position inconnue";
    }
};

// --- Components ---

const NegotiationModal = ({ offer, onClose, onSubmit }: { offer: Offer, onClose: () => void, onSubmit: (price: number) => void }) => {
    const [price, setPrice] = useState(offer.price.toString());

    return (
        <div className="fixed inset-0 bg-secondary/50 backdrop-blur-sm z-[60] flex items-center justify-center p-6 animate-fadeIn">
            <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-secondary dark:text-white">Négocier le prix</h3>
                    <button onClick={onClose}><X className="text-gray-400 hover:text-secondary dark:hover:text-white" /></button>
                </div>
                
                <div className="bg-main dark:bg-gray-700 p-4 rounded-xl mb-6 border border-gray-200 dark:border-gray-600">
                    <p className="text-gray-500 dark:text-gray-300 text-sm">Prix proposé par {offer.mechanicName}</p>
                    <p className="text-2xl font-bold text-blue-500 line-through opacity-70">{offer.originalPrice || offer.price} Dh</p>
                </div>

                <div className="mb-6">
                    <label className="text-xs text-secondary dark:text-gray-300 font-bold uppercase mb-2 block">Votre Contre-Offre (Dh)</label>
                    <input 
                        type="number" 
                        value={price}
                        onChange={e => setPrice(e.target.value)}
                        className="w-full bg-main dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl p-4 text-2xl font-bold text-secondary dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>

                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 rounded-xl font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">Annuler</button>
                    <button onClick={() => onSubmit(Number(price))} className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/25 transition-colors">Envoyer</button>
                </div>
            </div>
        </div>
    );
};

// --- UI HELPER COMPONENTS (Defined outside to prevent re-renders) ---

// Ghost Social Button
const GhostButton = ({ onClick, children, className = "" }: any) => (
    <button 
      onClick={onClick} 
      className={`flex items-center justify-center gap-3 w-full bg-transparent border border-white/20 py-3.5 rounded-xl hover:bg-white/5 hover:border-white/40 transition-all duration-300 shadow-sm group ${className}`}
    >
      {children}
    </button>
);

// Minimal Input Field
const AuthInput = ({ icon: Icon, className = "", ...props }: any) => (
  <div className="relative group">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-400 transition-colors duration-300">
          <Icon size={20} strokeWidth={2} />
      </div>
      <input 
          {...props}
          className={`w-full pl-12 pr-5 py-4 bg-black/20 border border-white/5 rounded-2xl focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 outline-none text-white font-medium placeholder:text-gray-500 transition-all duration-300 ${className}`}
      />
  </div>
);

// Glowing Primary Button
const PrimaryButton = ({ children, onClick, loading, type = "button" }: any) => (
    <button 
      disabled={loading} 
      type={type} 
      onClick={onClick}
      className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white py-4 rounded-2xl font-bold text-lg shadow-[0_10px_20px_rgba(59,130,246,0.4)] hover:shadow-[0_15px_25px_rgba(59,130,246,0.5)] active:scale-[0.98] transition-all duration-300 flex justify-center items-center border border-white/10"
    >
      {loading ? <div className="animate-spin h-6 w-6 border-2 border-white rounded-full border-t-transparent"></div> : children}
    </button>
);

// --- Auth Component ---

const AuthScreen = ({ onLogin }: { onLogin: (user: any) => void }) => {
  const [view, setView] = useState<'LOGIN' | 'REGISTER_DRIVER' | 'REGISTER_MECH' | 'COMPLETE_PROFILE'>('LOGIN');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Login/Register Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [basePrice, setBasePrice] = useState('');
  
  // For OAuth profile completion
  const [oauthUser, setOauthUser] = useState<any>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.DRIVER);

  const [currentLoc, setCurrentLoc] = useState({ lat: 33.5731, lng: -7.5898 });

  useEffect(() => {
      navigator.geolocation.getCurrentPosition(
          (pos) => setCurrentLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          (err) => console.warn(err)
      );

      const checkIncompleteProfile = async () => {
          const user = await api.getAuthUser();
          const profile = api.getCurrentUser();
          
          if (user && !profile) {
              setOauthUser(user);
              setName(user.user_metadata?.full_name || user.email?.split('@')[0] || '');
              setEmail(user.email || '');
              setView('COMPLETE_PROFILE');
          }
      };
      checkIncompleteProfile();

  }, []);

  const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setSuccessMsg('');
      setLoading(true);
      try {
          const user = await api.login(email, password);
          onLogin(user);
      } catch (err: any) {
          setError(err.message || "Erreur de connexion");
      } finally {
          setLoading(false);
      }
  };

  const handleSocialLogin = async (provider: 'google' | 'facebook') => {
      setLoading(true);
      try {
          await api.signInWithProvider(provider);
      } catch (err: any) {
          setError(err.message || `Erreur avec ${provider}`);
          setLoading(false);
      }
  };

  const handleCompleteProfile = async () => {
      if (!oauthUser) return;
      if (!phone) {
          setError("Le téléphone est requis.");
          return;
      }
      setLoading(true);
      try {
          const user = await api.completeProfile(oauthUser.id, {
            name,
            email: oauthUser.email,
            phone,
            role: selectedRole,
            vehicleModel: selectedRole === UserRole.DRIVER ? vehicle : undefined,
            specialties: selectedRole === UserRole.MECHANIC ? [specialty] : undefined,
            basePrice: selectedRole === UserRole.MECHANIC ? Number(basePrice) : undefined,
            location: currentLoc
          });
          onLogin(user);
      } catch (err: any) {
          setError(err.message || "Erreur lors de la finalisation.");
      } finally {
          setLoading(false);
      }
  };

  const handleRegister = async (role: UserRole) => {
      setError('');
      setSuccessMsg('');
      if(!name || !email || !password || !phone) {
          setError("Tous les champs sont requis.");
          return;
      }
      setLoading(true);
      
      try {
          const result = await api.register({
              name, email, phone, password,
              role,
              vehicleModel: role === UserRole.DRIVER ? vehicle : undefined,
              specialties: role === UserRole.MECHANIC ? [specialty] : undefined,
              basePrice: role === UserRole.MECHANIC ? Number(basePrice) : undefined,
              location: currentLoc
          });

          if (result.user) {
              onLogin(result.user);
          } else if (result.message) {
              setSuccessMsg(result.message);
              setView('LOGIN');
          }
      } catch (err: any) {
          setError(err.message || "Erreur d'inscription");
      } finally {
          setLoading(false);
      }
  };

  // --- VIEWS ---

  // Post-OAuth Profile Completion
  if (view === 'COMPLETE_PROFILE') {
      return (
          <div className="flex flex-col items-center justify-center min-h-screen bg-[#0F141A] p-4 relative overflow-hidden">
             {/* Mesh Gradient Background */}
             <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-900/20 rounded-full blur-[120px] pointer-events-none animate-pulse-fast"></div>
             <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#F59E0B]/10 rounded-full blur-[100px] pointer-events-none"></div>

              <div className="w-full max-w-md bg-[#1E1E1E]/60 backdrop-blur-[16px] p-8 rounded-3xl border border-white/10 shadow-2xl relative z-10">
                  <div className="text-center mb-8">
                      <div className="flex justify-center mb-4"><BrandLogo size={60} /></div>
                      <h2 className="text-2xl font-extrabold text-white">Finaliser l'inscription</h2>
                      <p className="text-gray-400 text-sm mt-1">Bienvenue {name} ! Complétez votre profil.</p>
                  </div>

                  {error && <div className="bg-red-500/10 text-red-400 p-4 rounded-xl text-sm mb-6 border border-red-500/20">{error}</div>}

                  <div className="space-y-4">
                      <div>
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1 mb-2 block">Je suis un</label>
                          <div className="grid grid-cols-2 gap-3">
                              <button onClick={() => setSelectedRole(UserRole.DRIVER)} className={`py-3 rounded-xl font-bold text-sm border transition-all ${selectedRole === UserRole.DRIVER ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20' : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'}`}>Automobiliste</button>
                              <button onClick={() => setSelectedRole(UserRole.MECHANIC)} className={`py-3 rounded-xl font-bold text-sm border transition-all ${selectedRole === UserRole.MECHANIC ? 'bg-[#F59E0B] text-black border-[#F59E0B] shadow-lg shadow-amber-500/20' : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'}`}>Mécanicien</button>
                          </div>
                      </div>

                      <div className="space-y-3">
                          <AuthInput icon={UserIcon} type="text" placeholder="Nom complet" value={name} onChange={(e: any) => setName(e.target.value)} />
                          <AuthInput icon={Phone} type="tel" placeholder="Téléphone (ex: 06...)" value={phone} onChange={(e: any) => setPhone(e.target.value)} />
                          
                          {selectedRole === UserRole.DRIVER ? (
                              <AuthInput icon={Car} type="text" placeholder="Modèle de voiture" value={vehicle} onChange={(e: any) => setVehicle(e.target.value)} />
                          ) : (
                              <div className="grid grid-cols-2 gap-3">
                                  <div className="col-span-2"><AuthInput icon={Wrench} type="text" placeholder="Spécialité" value={specialty} onChange={(e: any) => setSpecialty(e.target.value)} /></div>
                                  <AuthInput icon={CreditCard} type="number" placeholder="Tarif (Dh)" value={basePrice} onChange={(e: any) => setBasePrice(e.target.value)} />
                              </div>
                          )}
                      </div>

                      <div className="mt-6">
                        <PrimaryButton onClick={handleCompleteProfile} loading={loading}>Terminer</PrimaryButton>
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  // Login View
  if (view === 'LOGIN') {
      return (
          <div className="flex flex-col items-center justify-center min-h-screen bg-[#0F141A] p-4 relative overflow-hidden">
              {/* Mesh Gradient Background */}
              <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[120px] pointer-events-none"></div>
              <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] bg-[#F59E0B]/10 rounded-full blur-[100px] pointer-events-none"></div>

              <div className="w-full max-w-md bg-[#1E1E1E]/60 backdrop-blur-[16px] p-8 rounded-3xl border border-white/10 shadow-2xl relative z-10 animate-fade-in">
                  <div className="mb-8 text-center">
                      <div className="flex justify-center mb-6">
                          <BrandLogo size={80} className="shadow-2xl" />
                      </div>
                      <h1 className="text-4xl font-extrabold text-white mb-2 tracking-tight">Dépanni</h1>
                      <p className="text-[#F59E0B] font-medium text-xs uppercase tracking-[0.15em]">L'assistance routière 2.0</p>
                  </div>
                  
                  {successMsg && <div className="bg-emerald-500/10 text-emerald-400 p-4 rounded-xl text-sm mb-6 border border-emerald-500/20 flex items-center"><CheckCircle size={16} className="mr-2"/>{successMsg}</div>}
                  {error && <div className="bg-red-500/10 text-red-400 p-4 rounded-xl text-sm mb-6 border border-red-500/20 flex items-center"><ShieldAlert size={16} className="mr-2"/>{error}</div>}

                  <form onSubmit={handleLogin} className="space-y-5">
                      <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Email</label>
                          <AuthInput icon={Mail} type="email" value={email} onChange={(e: any) => setEmail(e.target.value)} placeholder="votre@email.com" />
                      </div>
                      <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Mot de passe</label>
                          <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-400 transition-colors">
                                <Lock size={20} strokeWidth={2} />
                            </div>
                            <input 
                                type={showPassword ? "text" : "password"} 
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full pl-12 pr-12 py-4 bg-black/20 border border-white/5 rounded-2xl focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 outline-none text-white font-medium placeholder:text-gray-500 transition-all duration-300"
                                placeholder="••••••••"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                          </div>
                          <div className="flex justify-end">
                            <a href="#" onClick={(e) => e.preventDefault()} className="text-xs font-bold text-[#F59E0B] hover:text-amber-400 mt-1 transition-colors">
                                Mot de passe oublié ?
                            </a>
                          </div>
                      </div>
                      
                      <div className="pt-2">
                        <PrimaryButton type="submit" loading={loading}>Connexion</PrimaryButton>
                      </div>
                  </form>

                  <div className="my-8 flex items-center gap-4">
                      <div className="h-px bg-white/10 flex-1"></div>
                      <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Ou</span>
                      <div className="h-px bg-white/10 flex-1"></div>
                  </div>

                  <div className="flex flex-col gap-3">
                      <GhostButton onClick={() => handleSocialLogin('google')}>
                         <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                             <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                             <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                             <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                             <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                         </svg>
                         <span className="font-bold text-white text-sm">Continuer avec Google</span>
                      </GhostButton>
                      <GhostButton onClick={() => handleSocialLogin('facebook')}>
                          <Facebook size={20} fill="currentColor" className="text-white group-hover:scale-110 transition-transform" />
                          <span className="font-bold text-white text-sm">Continuer avec Facebook</span>
                      </GhostButton>
                  </div>
                  
                  <div className="mt-8 text-center pt-6 border-t border-white/10">
                    <p className="text-gray-400 text-sm mb-4">Pas encore de compte ?</p>
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => setView('REGISTER_DRIVER')} className="py-3 px-4 bg-white/5 border border-white/10 rounded-xl text-white font-bold text-sm hover:bg-white/10 hover:border-white/20 transition-all">
                            Automobiliste
                        </button>
                        <button onClick={() => setView('REGISTER_MECH')} className="py-3 px-4 bg-white/5 border border-white/10 rounded-xl text-white font-bold text-sm hover:bg-white/10 hover:border-white/20 transition-all">
                            Mécanicien
                        </button>
                    </div>
                 </div>
              </div>
          </div>
      );
  }

  // Register View (Shared for Driver/Mechanic)
  const isDriver = view === 'REGISTER_DRIVER';
  return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0F141A] p-4 relative overflow-auto">
          {/* Mesh Gradient Background */}
          <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[120px] pointer-events-none"></div>
          <div className="absolute bottom-[-20%] left-[-10%] w-[40%] h-[40%] bg-[#F59E0B]/10 rounded-full blur-[100px] pointer-events-none"></div>

          <div className="w-full max-w-lg bg-[#1E1E1E]/60 backdrop-blur-[16px] p-8 rounded-3xl border border-white/10 shadow-2xl relative z-10 my-10 animate-fade-in">
            <div className="flex items-center mb-8">
                <button onClick={() => setView('LOGIN')} className="p-2 -ml-2 text-gray-400 hover:text-white rounded-full mr-2 transition-colors">
                    <ChevronRight className="rotate-180" size={24} />
                </button>
                <h2 className="text-2xl font-extrabold text-white">Créer un compte</h2>
            </div>
            
            <div className="bg-black/20 p-5 rounded-2xl mb-6 flex items-start border border-white/5">
                <div className={`p-3 rounded-xl mr-4 ${isDriver ? 'bg-blue-500/20 text-blue-400 shadow-lg shadow-blue-500/10' : 'bg-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-500/10'}`}>
                    {isDriver ? <Car size={24}/> : <Wrench size={24}/>}
                </div>
                <div>
                    <p className="font-bold text-white text-lg">{isDriver ? 'Profil Conducteur' : 'Profil Mécanicien'}</p>
                    <p className="text-sm text-gray-400 mt-1">
                        {isDriver ? 'Dépannez votre véhicule.' : 'Trouvez des clients.'}
                    </p>
                </div>
            </div>

            <div className="flex flex-col gap-3">
                 <GhostButton onClick={() => handleSocialLogin('google')}>
                     <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                     <span className="font-bold text-white text-sm">Google</span>
                 </GhostButton>
                 <GhostButton onClick={() => handleSocialLogin('facebook')}>
                     <Facebook size={20} fill="currentColor" className="text-white"/>
                     <span className="font-bold text-white text-sm">Facebook</span>
                 </GhostButton>
            </div>
            
            <div className="my-6 flex items-center gap-4">
                <div className="h-px bg-white/10 flex-1"></div>
                <span className="text-xs text-gray-500 font-bold uppercase">Ou avec email</span>
                <div className="h-px bg-white/10 flex-1"></div>
            </div>

            {error && <div className="bg-red-500/10 text-red-400 p-4 rounded-xl text-sm mb-6 border border-red-500/20">{error}</div>}

            <div className="space-y-4 mb-8">
                <AuthInput icon={UserIcon} type="text" placeholder="Nom complet" value={name} onChange={(e: any) => setName(e.target.value)} />
                <AuthInput icon={Mail} type="email" placeholder="Email" value={email} onChange={(e: any) => setEmail(e.target.value)} />
                <AuthInput icon={Phone} type="tel" placeholder="Téléphone (ex: 06...)" value={phone} onChange={(e: any) => setPhone(e.target.value)} />
                
                <div className="relative group">
                     <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-400 transition-colors">
                        <Lock size={20} strokeWidth={2} />
                     </div>
                     <input type={showPassword ? "text" : "password"} placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-12 pr-12 py-4 bg-black/20 border border-white/5 rounded-2xl focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 outline-none text-white font-medium placeholder:text-gray-500 transition-all duration-300" />
                     <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors">
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                     </button>
                </div>

                {isDriver ? (
                    <AuthInput icon={Car} type="text" placeholder="Modèle de voiture (ex: Dacia Logan)" value={vehicle} onChange={(e: any) => setVehicle(e.target.value)} />
                ) : (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                             <AuthInput icon={Wrench} type="text" placeholder="Spécialité" value={specialty} onChange={(e: any) => setSpecialty(e.target.value)} />
                        </div>
                        <AuthInput icon={CreditCard} type="number" placeholder="Tarif (Dh)" value={basePrice} onChange={(e: any) => setBasePrice(e.target.value)} />
                    </div>
                )}
            </div>

            <PrimaryButton onClick={() => handleRegister(isDriver ? UserRole.DRIVER : UserRole.MECHANIC)} loading={loading}>
                S'inscrire et Localiser
            </PrimaryButton>
          </div>
      </div>
  );
};


// --- Driver Dashboard ---

const DriverDashboard = ({ user, onLogout, darkMode, toggleTheme }: { user: any, onLogout: () => void, darkMode: boolean, toggleTheme: () => void }) => {
  const [status, setStatus] = useState<RequestStatus>(RequestStatus.PENDING);
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [problem, setProblem] = useState('');
  const [aiDiagnostic, setAiDiagnostic] = useState('');
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [mechanics, setMechanics] = useState<any[]>([]);
  const [currentLocation, setCurrentLocation] = useState(user.location || { lat: 33.5731, lng: -7.5898 });
  const [addressName, setAddressName] = useState('Localisation...');
  const [negotiatingOffer, setNegotiatingOffer] = useState<Offer | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<'searching' | 'found' | 'error'>('searching');

  // Throttled address lookup to avoid rate limits
  useEffect(() => {
    const timer = setTimeout(() => {
        reverseGeocode(currentLocation.lat, currentLocation.lng).then(setAddressName);
    }, 1000);
    return () => clearTimeout(timer);
  }, [currentLocation]);

  useEffect(() => {
    let watchId: number;
    if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
            async (pos) => {
                const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setCurrentLocation(newLoc);
                setGpsStatus('found');
                await api.updateUserLocation(newLoc.lat, newLoc.lng);
            },
            (err) => {
                // Improved error handling
                console.warn("Location watch error:", err.message);
                if (err.code === 1) { // PERMISSION_DENIED
                     setGpsStatus('error');
                     alert("Veuillez autoriser la géolocalisation pour utiliser l'application.");
                } else if (err.code === 2) { // POSITION_UNAVAILABLE
                     setGpsStatus('error');
                }
                // Timeout (code 3) might just need more time, keep searching
            },
            { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 } // Relaxed constraints
        );
    }
    return () => { if (watchId) navigator.geolocation.clearWatch(watchId); };
  }, []);

  const refreshLocation = async () => {
      setGpsStatus('searching');
      navigator.geolocation.getCurrentPosition(
          async (pos) => {
             const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
             setCurrentLocation(loc);
             setGpsStatus('found');
             await api.updateUserLocation(loc.lat, loc.lng);
          },
          (err) => {
             console.warn("Manual refresh error:", err.message);
             setGpsStatus('error');
          },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
  };

  const fetchActiveRequest = useCallback(async () => {
      const activeReq = await api.getActiveRequestForDriver(user.id);
      if (activeReq) {
        setRequest(activeReq);
        setStatus(activeReq.status);
      } else {
        setRequest(null);
        setStatus(RequestStatus.PENDING);
      }
  }, [user.id]);

  useEffect(() => {
    const fetchMechanics = async () => {
        const mechs = await api.getNearbyMechanics();
        setMechanics(mechs);
    };
    fetchMechanics();
    fetchActiveRequest();

    const unsub = api.subscribe(() => {
      fetchActiveRequest();
      fetchMechanics();
    });
    
    const pollInterval = setInterval(() => fetchActiveRequest(), 3000);
    return () => { unsub(); clearInterval(pollInterval); };
  }, [user.id, fetchActiveRequest]);

  const handleManualRefresh = async () => {
      setIsRefreshing(true);
      await fetchActiveRequest();
      setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleDiagnose = async () => {
    if (!problem) return;
    setIsDiagnosing(true);
    const result = await diagnoseProblem(problem);
    setAiDiagnostic(result);
    setIsDiagnosing(false);
  };

  const handleSOS = async () => {
    const desc = aiDiagnostic ? `${problem} (Diagnostic AI: ${aiDiagnostic})` : (problem || "Urgence indéfinie");
    await api.createRequest(desc, currentLocation);
    await fetchActiveRequest(); 
    setShowRequestForm(false);
  };

  const handleAcceptOffer = async (offerId: string) => {
      if(request) await api.acceptOffer(request.id, offerId);
  };

  const handleNegotiate = (offer: Offer) => setNegotiatingOffer(offer);

  const submitNegotiation = async (price: number) => {
      if(negotiatingOffer) {
          await api.submitCounterOffer(negotiatingOffer.id, price);
          setNegotiatingOffer(null);
      }
  };
  
  const cancelNegotiation = async (offerId: string, originalPrice: number) => {
      await api.cancelCounterOffer(offerId, originalPrice);
  };

  const cancelRequest = async () => {
     if(request) await api.updateStatus(request.id, RequestStatus.CANCELLED);
  };

  const isInNegotiation = request && (status === RequestStatus.PENDING || status === RequestStatus.OFFERING);
  const isInTracking = request && (status === RequestStatus.ACCEPTED || status === RequestStatus.EN_ROUTE || status === RequestStatus.ARRIVED);
  
  let targetMechanicLocation = undefined;
  let mode: 'VIEW' | 'TRACKING' = 'VIEW';
  let eta = undefined;
  let isMoving = false;

  if (isInTracking) {
      const acceptedOffer = request.offers.find(o => o.id === request.acceptedOfferId);
      const assignedMechanic = mechanics.find(m => m.id === request.mechanicId);
      targetMechanicLocation = assignedMechanic?.location;
      mode = 'TRACKING';
      eta = acceptedOffer?.eta;
      isMoving = status === RequestStatus.EN_ROUTE;
  }

  return (
    <div className="h-screen w-full bg-main dark:bg-gray-900 relative flex flex-col overflow-hidden transition-colors duration-300">
        <header className="absolute top-0 left-0 right-0 h-16 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md z-30 flex items-center justify-between px-6 border-b border-gray-100 dark:border-gray-700 transition-colors duration-300">
            <div className="flex items-center space-x-4">
                 <BrandLogo size={32} />
                 <h1 className="text-xl font-bold text-secondary dark:text-white hidden md:block">Dépanni</h1>
                 <div className="hidden md:flex items-center space-x-2 bg-gray-50 dark:bg-gray-700 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-600 ml-6">
                    <button onClick={refreshLocation} className={`p-1 rounded-full ${gpsStatus === 'searching' ? 'animate-pulse text-blue-500' : gpsStatus === 'error' ? 'text-red-500' : 'text-blue-600 dark:text-blue-400'}`}>
                        <MapPin size={14} />
                    </button>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300 max-w-[200px] truncate">{addressName}</span>
                 </div>
            </div>
            <div className="flex items-center space-x-4">
                 <div className="flex items-center text-right mr-2">
                     <p className="text-sm font-bold text-secondary dark:text-white hidden sm:block">{user.name}</p>
                 </div>
                 <button onClick={toggleTheme} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-500 dark:text-gray-300 hover:text-blue-500 transition-colors">
                     {darkMode ? <Sun size={18}/> : <Moon size={18}/>}
                 </button>
                 <button onClick={onLogout} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-500 dark:text-gray-300 hover:text-red-500 transition-colors"><LogOut size={18}/></button>
            </div>
        </header>

        <div className="absolute inset-0 z-0 pt-16">
             <MechanicMap 
                userLocation={currentLocation} 
                mechanics={isInTracking ? [] : mechanics}
                targetMechanicLocation={targetMechanicLocation}
                mode={mode}
                eta={eta}
                isMoving={isMoving}
                darkMode={darkMode}
             />
        </div>

        {negotiatingOffer && <NegotiationModal offer={negotiatingOffer} onClose={() => setNegotiatingOffer(null)} onSubmit={submitNegotiation} />}

        {showRequestForm && (
            <div className="absolute z-20 top-20 left-4 right-4 md:left-6 md:right-auto md:w-96 bg-white dark:bg-gray-800 rounded-2xl shadow-card border border-gray-100 dark:border-gray-700 p-6 animate-slide-up flex flex-col max-h-[80vh] overflow-y-auto">
                 <div className="flex justify-between items-center mb-6">
                     <h3 className="text-xl font-bold text-secondary dark:text-white">Problème ?</h3>
                     <button onClick={() => setShowRequestForm(false)} className="bg-gray-100 dark:bg-gray-700 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"><X size={20} className="text-gray-500 dark:text-gray-300"/></button>
                 </div>
                 <div className="space-y-4">
                     <div className="relative group">
                        <textarea 
                            className="w-full bg-main dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl p-4 text-secondary dark:text-white focus:border-blue-500 outline-none resize-none h-32 text-sm placeholder:text-gray-400"
                            placeholder="Décrivez votre panne..."
                            value={problem}
                            onChange={(e) => setProblem(e.target.value)}
                        ></textarea>
                        <button onClick={handleDiagnose} disabled={!problem || isDiagnosing} className="absolute bottom-3 right-3 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 text-blue-500 dark:text-blue-300 px-3 py-1.5 rounded-xl flex items-center text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors">
                            {isDiagnosing ? '...' : <Mic size={14} />}
                        </button>
                     </div>
                     {aiDiagnostic && (
                         <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30 flex items-start space-x-3">
                             <div className="bg-white dark:bg-gray-700 p-2 rounded-lg mt-0.5"><Wrench size={14} className="text-blue-500 dark:text-blue-300"/></div>
                             <div><p className="text-xs font-bold text-blue-600 dark:text-blue-300 uppercase mb-1">Diagnostic AI</p><p className="text-xs text-blue-900 dark:text-blue-100 leading-snug">{aiDiagnostic}</p></div>
                         </div>
                     )}
                     <button onClick={handleSOS} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-bold flex justify-center items-center active:scale-[0.98] transition-all">
                        Chercher un dépanneur <ChevronRight className="ml-2" size={20}/>
                     </button>
                 </div>
            </div>
        )}

        {isInNegotiation && (
            <div className="absolute z-20 top-20 left-4 right-4 md:left-6 md:right-auto md:w-[450px] bottom-6 md:bottom-auto md:max-h-[80vh] bg-white dark:bg-gray-800 rounded-2xl shadow-card border border-gray-100 dark:border-gray-700 flex flex-col overflow-hidden animate-slide-up">
                 <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
                      <div><h2 className="font-bold text-secondary dark:text-white">Devis en cours...</h2><p className="text-xs text-blue-500 dark:text-blue-400">Mécano. contactés</p></div>
                      <div className="flex items-center gap-2">
                        <button onClick={handleManualRefresh} className={`p-2 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-300 ${isRefreshing ? 'animate-spin' : ''}`}><RefreshCw size={16}/></button>
                        <button onClick={cancelRequest} className="bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 px-3 py-1.5 rounded-lg text-xs font-bold border border-red-100 dark:border-red-900/30">Annuler</button>
                      </div>
                 </div>
                 <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {request && request.offers.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-10 text-center"><div className="relative w-20 h-20 flex items-center justify-center mb-4"><div className="absolute inset-0 bg-blue-100 dark:bg-blue-900/20 rounded-full animate-ping"></div><Car size={32} className="text-blue-500 dark:text-blue-400 relative z-10" /></div><p className="text-gray-400 text-sm">En attente de devis...</p></div>
                      ) : (
                          request && request.offers.map((offer) => (
                              <div key={offer.id} className="bg-main dark:bg-gray-700 p-4 rounded-xl border border-gray-200 dark:border-gray-600 flex flex-col hover:border-gray-300 dark:hover:border-gray-500 transition-colors">
                                  {offer.status === 'NEGOTIATING' && <div className="self-end bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full mb-2">En négociation</div>}
                                  <div className="flex justify-between items-start mb-3">
                                      <div className="flex items-center gap-3"><div className="w-10 h-10 bg-white dark:bg-gray-600 rounded-full flex items-center justify-center font-bold text-gray-500 dark:text-gray-300 border border-gray-200 dark:border-gray-500">{offer.mechanicName.charAt(0)}</div><div><p className="font-bold text-secondary dark:text-white text-sm">{offer.mechanicName}</p><div className="flex items-center text-xs text-yellow-500"><Star size={12} fill="currentColor" /><span className="ml-1 text-gray-500 dark:text-gray-400">{offer.mechanicRating}</span></div></div></div>
                                      <div className="text-right"><p className="text-xl font-black text-secondary dark:text-white">{offer.price} Dh</p><p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">~ {offer.eta} min</p></div>
                                  </div>
                                  <div className="flex gap-2">
                                      {offer.status === 'NEGOTIATING' ? (
                                         <button onClick={() => cancelNegotiation(offer.id, offer.originalPrice || offer.price)} className="flex-1 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-200 py-2 rounded-lg text-sm font-bold">Annuler négo.</button>
                                      ) : (
                                         <button onClick={() => handleNegotiate(offer)} className="flex-1 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 text-gray-600 dark:text-gray-200 py-2 rounded-lg text-sm font-bold">Négocier</button>
                                      )}
                                      <button disabled={offer.status === 'NEGOTIATING'} onClick={() => handleAcceptOffer(offer.id)} className="flex-[2] bg-blue-600 disabled:bg-blue-400 text-white py-2 rounded-lg text-sm font-bold hover:bg-blue-500">Accepter</button>
                                  </div>
                              </div>
                          ))
                      )}
                 </div>
            </div>
        )}

        {!showRequestForm && !isInNegotiation && !isInTracking && (
            <div className="absolute bottom-8 left-0 right-0 z-20 flex justify-center pointer-events-none px-4">
                <button onClick={() => setShowRequestForm(true)} className="pointer-events-auto bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-full shadow-soft flex items-center space-x-3 transition-transform hover:scale-105 active:scale-95 border-2 border-white/20">
                    <div className="bg-white/20 p-2 rounded-full"><Wrench size={20} /></div>
                    <span className="text-lg font-bold tracking-wide">ASSISTANCE PANNE</span>
                </button>
            </div>
        )}
    </div>
  );
};


// --- Mechanic Dashboard ---

const MechanicDashboard = ({ user, onLogout, darkMode, toggleTheme }: { user: any, onLogout: () => void, darkMode: boolean, toggleTheme: () => void }) => {
    const [pendingRequests, setPendingRequests] = useState<ServiceRequest[]>([]);
    const [activeJob, setActiveJob] = useState<ServiceRequest | null>(null);
    const [isOnline, setIsOnline] = useState(true);
    const [offerPrice, setOfferPrice] = useState<string>('');
    const [selectedReqId, setSelectedReqId] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    // Add current location state for mechanic
    const [currentLocation, setCurrentLocation] = useState(user.location || { lat: 33.5731, lng: -7.5898 });

    useEffect(() => {
         let watchId: number;
         if (navigator.geolocation) {
             watchId = navigator.geolocation.watchPosition(
                async (pos) => { 
                    const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    setCurrentLocation(newLoc); // Update local state
                    await api.updateUserLocation(newLoc.lat, newLoc.lng); 
                },
                (err) => console.warn("Location error:", err.message),
                { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
             );
         }
         return () => { if(watchId) navigator.geolocation.clearWatch(watchId); };
    }, []);

    const fetchDashboardData = useCallback(async () => {
        const job = await api.getActiveJobForMechanic(user.id);
        setActiveJob(job || null);
        if (!job) {
            const pending = await api.getPendingRequestsForMechanic();
            setPendingRequests(pending);
        }
    }, [user.id]);

    useEffect(() => {
        fetchDashboardData();
        const unsub = api.subscribe(() => fetchDashboardData());
        const pollInterval = setInterval(() => fetchDashboardData(), 3000);
        return () => { unsub(); clearInterval(pollInterval); };
    }, [user.id, fetchDashboardData]);

    const handleSendOffer = async (reqId: string) => {
        if(!offerPrice) return;
        try {
            await api.sendOffer(reqId, user.id, Number(offerPrice));
            setOfferPrice('');
            setSelectedReqId(null);
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleAcceptCounter = async (reqId: string, offerId: string, price: number) => {
        await api.sendOffer(reqId, user.id, price); 
        await api.acceptOffer(reqId, offerId);
    };

    const handleRejectCounter = async (offerId: string, originalPrice: number) => {
        await api.rejectCounterOffer(offerId, originalPrice);
    };

    const updateJobStatus = async (status: RequestStatus) => {
        if(activeJob) {
            await api.updateStatus(activeJob.id, status);
            setActiveJob({...activeJob, status});
        }
    };

    return (
        <div className="h-screen w-full bg-main dark:bg-gray-900 flex flex-col overflow-hidden relative transition-colors duration-300">
            <header className="h-16 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-700 z-40 transition-colors duration-300">
                <div className="flex items-center space-x-4">
                     <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden text-gray-500 dark:text-gray-400"><Menu size={24} /></button>
                     <BrandLogo size={32} />
                     <h1 className="text-xl font-bold text-secondary dark:text-white hidden md:block">Pro</h1>
                     <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full"><div className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div><span className="text-xs font-bold text-gray-600 dark:text-gray-300">{isOnline ? 'EN LIGNE' : 'HORS LIGNE'}</span></div>
                </div>
                <div className="flex items-center space-x-4">
                    <span className="text-secondary dark:text-white font-bold">{user.name}</span>
                    <button onClick={toggleTheme} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-500 dark:text-gray-300 hover:text-blue-500 transition-colors">
                        {darkMode ? <Sun size={18}/> : <Moon size={18}/>}
                    </button>
                    <button onClick={onLogout} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-500 dark:text-gray-300"><LogOut size={20}/></button>
                </div>
            </header>

            <div className="flex-1 flex relative overflow-hidden">
                <aside className={`absolute md:relative z-30 top-0 bottom-0 left-0 w-full md:w-96 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} flex flex-col shadow-soft`}>
                    <div className="flex-1 overflow-y-auto p-4">
                         {activeJob ? (
                             <div className="bg-blue-600 rounded-2xl p-5 shadow-soft text-white">
                                 <h3 className="text-lg font-bold mb-1">Mission en cours</h3>
                                 <div className="bg-white/20 p-3 rounded-xl mb-4 backdrop-blur-sm"><p className="font-medium">{activeJob.problemDescription}</p></div>
                                 <div className="flex flex-col gap-2">
                                     {activeJob.status === RequestStatus.ACCEPTED && <button onClick={() => updateJobStatus(RequestStatus.EN_ROUTE)} className="bg-white text-blue-600 font-bold py-3 rounded-xl">Démarrer trajet</button>}
                                     {activeJob.status === RequestStatus.EN_ROUTE && <button onClick={() => updateJobStatus(RequestStatus.ARRIVED)} className="bg-orange-500 text-white font-bold py-3 rounded-xl">Sur place</button>}
                                     {activeJob.status === RequestStatus.ARRIVED && <button onClick={() => updateJobStatus(RequestStatus.COMPLETED)} className="bg-emerald-500 text-white font-bold py-3 rounded-xl">Terminer</button>}
                                     <button onClick={() => window.open(`https://maps.google.com/?q=${activeJob.location.lat},${activeJob.location.lng}`)} className="bg-white/20 text-white font-bold py-3 rounded-xl">GPS</button>
                                 </div>
                             </div>
                         ) : pendingRequests.length === 0 ? (
                             <div className="flex flex-col items-center justify-center h-64 text-gray-400 dark:text-gray-500"><p className="text-sm font-medium">En attente de nouvelles demandes...</p></div>
                         ) : (
                             <div className="space-y-4">
                                 <h3 className="font-bold text-secondary dark:text-white px-2">Demandes ({pendingRequests.length})</h3>
                                 {pendingRequests.map(req => {
                                     const myOffer = req.offers.find(o => o.mechanicId === user.id);
                                     const negotiation = req.offers.find(o => o.mechanicId === user.id && o.status === 'NEGOTIATING');
                                     
                                     // Fancy Card Implementation
                                     return (
                                         <div key={req.id} className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-card border border-gray-100 dark:border-gray-700 transition-all hover:shadow-md">
                                              <div className="mb-4">
                                                  <h4 className="font-bold text-lg text-gray-800 dark:text-white line-clamp-2">{req.problemDescription}</h4>
                                                  <div className="flex items-center text-xs text-gray-400 mt-1">
                                                      <Clock size={12} className="mr-1"/>
                                                      <span>Il y a {Math.floor((Date.now() - req.createdAt)/60000)} min</span>
                                                  </div>
                                              </div>

                                              {negotiation ? (
                                                  <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900/30 p-3 rounded-xl">
                                                      <p className="text-xs text-orange-500 font-bold mb-1">CONTRE-OFFRE</p>
                                                      <p className="text-2xl font-black text-secondary dark:text-white mb-2">{negotiation.price} Dh</p>
                                                      <div className="flex gap-2">
                                                        <button onClick={() => handleRejectCounter(negotiation.id, negotiation.originalPrice || negotiation.price)} className="flex-1 bg-white border border-red-200 text-red-500 text-xs font-bold py-2 rounded-lg hover:bg-red-50">Refuser</button>
                                                        <button onClick={() => handleAcceptCounter(req.id, negotiation.id, negotiation.price)} className="flex-1 bg-orange-500 text-xs font-bold py-2 rounded-lg text-white">Accepter</button>
                                                      </div>
                                                  </div>
                                              ) : myOffer ? (
                                                  <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-xl text-center"><p className="text-xl font-bold text-blue-500 dark:text-blue-400">{myOffer.price} Dh envoyé</p></div>
                                              ) : (
                                                  <div className="flex items-center gap-3">
                                                      <div className="relative w-28">
                                                          <input 
                                                              type="number" 
                                                              placeholder="Prix" 
                                                              className="w-full bg-[#2F362F] text-white rounded-xl px-4 py-3 font-bold placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none text-center"
                                                              value={selectedReqId === req.id ? offerPrice : ''} 
                                                              onChange={e => {
                                                                  setSelectedReqId(req.id);
                                                                  setOfferPrice(e.target.value);
                                                              }}
                                                          />
                                                      </div>
                                                      <button 
                                                          onClick={() => handleSendOffer(req.id)} 
                                                          className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl py-3 transition-colors shadow-lg shadow-blue-500/30"
                                                      >
                                                          Envoyer
                                                      </button>
                                                  </div>
                                              )}
                                         </div>
                                     )
                                 })}
                             </div>
                         )}
                    </div>
                </aside>
                <main className="flex-1 relative bg-main dark:bg-gray-900">
                     <MechanicMap userLocation={currentLocation} mechanics={[]} targetMechanicLocation={activeJob?.location} mode={activeJob ? 'TRACKING' : 'VIEW'} darkMode={darkMode} />
                     {isSidebarOpen && <div className="md:hidden absolute inset-0 bg-black/50 z-20 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>}
                </main>
            </div>
        </div>
    );
};

const App = () => {
  const [user, setUser] = useState<User | null>(api.getCurrentUser());
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // Check system preference on load
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setDarkMode(true);
    }
  }, []);

  useEffect(() => {
      if (darkMode) {
          document.documentElement.classList.add('dark');
      } else {
          document.documentElement.classList.remove('dark');
      }
  }, [darkMode]);

  const toggleTheme = () => setDarkMode(!darkMode);

  useEffect(() => api.subscribe(() => setUser(api.getCurrentUser())), []);
  const handleLogin = (u: any) => setUser(u);
  const handleLogout = () => api.logout();

  if (!user) return <AuthScreen onLogin={handleLogin} />;
  
  return user.role === UserRole.DRIVER ? (
    <DriverDashboard user={user} onLogout={handleLogout} darkMode={darkMode} toggleTheme={toggleTheme} />
  ) : (
    <MechanicDashboard user={user} onLogout={handleLogout} darkMode={darkMode} toggleTheme={toggleTheme} />
  );
};

export default App;