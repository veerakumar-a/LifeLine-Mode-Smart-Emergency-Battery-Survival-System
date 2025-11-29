import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Map, CheckCircle, Clock, XCircle, Settings, Menu, Zap, Users, Shield, Smartphone, Loader, AlertTriangle, UserCheck } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, setDoc, setLogLevel, collection, getDocs } from 'firebase/firestore';

// --- THEME & UTILITY CONSTANTS ---

const Theme = {
  LIGHT_BG: 'bg-white',
  DARK_BG: 'bg-gray-900',
  LIGHT_GLASS: 'bg-white/30 backdrop-blur-md border border-white/40 shadow-lg',
  DARK_GLASS: 'bg-gray-800/40 backdrop-blur-md border border-blue-900/40 shadow-2xl',
  ACTIVE_GLOW: 'shadow-[0_0_15px_rgba(59,130,246,0.8)]', // Electric Blue Glow
  COMPLETED_COLOR: 'text-white bg-blue-500', 
  ACTIVE_COLOR: 'text-blue-400 border-blue-400', 
  SCHEDULED_COLOR: 'text-blue-600 border-blue-600', 
  FLAGGED_COLOR: 'text-blue-900 border-blue-900', 
  CRITICAL_COLOR: 'text-red-400 border-red-400', // New Critical Color
};

// --- INITIAL DATA FOR DATABASE SEEDING ---
const initialMockInspections = [
  { id: '1', title: 'Server Rack 4A Check', category: 'IT Asset', location: 'Floor 3, Data Ctr', status: 'Active', timestamp: '10m ago', critical: false },
  { id: '2', title: 'HVAC Unit 12 Maintenance', category: 'Facility', location: 'Roof Access', status: 'Completed', timestamp: '2h ago', critical: false },
  { id: '3', title: 'Fire Extinguisher P-05', category: 'Safety', location: 'Warehouse SW', status: 'Scheduled', timestamp: 'Tomorrow 9am', critical: false },
  { id: '4', title: 'Backup Generator D-2', category: 'Power', location: 'Basement', status: 'Flagged', timestamp: '1d ago', critical: true }, // Marked Critical
  { id: '5', title: 'Network Switch Uplink', category: 'IT Asset', location: 'Floor 1, Comm', status: 'Active', timestamp: '20m ago', critical: false },
];

// --- REUSABLE COMPONENTS ---

// Glass Panel Component: Handles the visual glassmorphism style based on theme
const GlassPanel = ({ children, className = '', isDark, glowing = false, onClick }) => {
  const glassClass = isDark ? Theme.DARK_GLASS : Theme.LIGHT_GLASS;
  const glowClass = glowing ? Theme.ACTIVE_GLOW : 'shadow-md';
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl p-4 transition-all duration-300 ${glassClass} ${glowClass} ${className}`}
    >
      {children}
    </div>
  );
};

// Icon Component with dynamic glow
const NavIcon = ({ Icon, isActive, isDark, onClick }) => {
    const baseClasses = 'p-3 rounded-full transition-all duration-300';
    const activeClasses = isActive 
      ? `bg-blue-600/20 ${Theme.ACTIVE_GLOW} text-blue-400` 
      : isDark 
        ? 'text-gray-400 hover:text-blue-300' 
        : 'text-gray-500 hover:text-blue-600'; 
    
    return (
        <button className={baseClasses + ' ' + activeClasses} onClick={onClick}>
            <Icon size={24} />
        </button>
    );
};

// --- CORE UI ELEMENTS ---

const InspectionCard = ({ inspection, isDark, onLongPress }) => {
  const { title, category, location, status, timestamp, critical } = inspection;

  const statusMap = useMemo(() => {
    if (critical) return { icon: AlertTriangle, classes: `${Theme.CRITICAL_COLOR} border-red-400 ${Theme.ACTIVE_GLOW}` };
    switch (status) {
      case 'Completed': return { icon: CheckCircle, classes: `${Theme.COMPLETED_COLOR} border-blue-300` };
      case 'Active': return { icon: Zap, classes: `${Theme.ACTIVE_COLOR} border-blue-400 ${Theme.ACTIVE_GLOW}` };
      case 'Scheduled': return { icon: Clock, classes: `${Theme.SCHEDULED_COLOR} border-blue-600` };
      case 'Flagged': return { icon: XCircle, classes: `${Theme.FLAGGED_COLOR} border-blue-900` };
      default: return { icon: Menu, classes: 'text-gray-500 border-gray-500' };
    }
  }, [status, critical]);
  
  const StatusIcon = statusMap.icon;
  const statusClasses = statusMap.classes;
  
  const handleMouseDown = (e) => {
    e.preventDefault();
    const timer = setTimeout(() => {
        onLongPress(inspection);
    }, 500); 
    
    const clearTimer = () => {
        clearTimeout(timer);
        e.currentTarget.removeEventListener('mouseup', clearTimer);
        e.currentTarget.removeEventListener('mouseleave', clearTimer);
    };
    e.currentTarget.addEventListener('mouseup', clearTimer);
    e.currentTarget.addEventListener('mouseleave', clearTimer);
  };

  const isCompleted = status === 'Completed';
  
  return (
    <GlassPanel 
      isDark={isDark} 
      glowing={status === 'Active' || critical}
      onMouseDown={handleMouseDown} 
      className={`p-4 mb-4 cursor-pointer relative overflow-hidden transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] ${isDark ? 'text-gray-100' : 'text-gray-800'} ${critical ? 'border-2 border-red-500/50' : ''}`}
    >
      {/* Background Status Glow */}
      <div className={`absolute inset-0 opacity-10 ${statusClasses}`}></div>
      {critical && <div className="absolute top-0 right-0 p-1 bg-red-800/80 text-xs font-bold text-white rounded-bl-lg">CRITICAL</div>}

      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <h4 className={`text-lg font-bold truncate ${critical ? 'text-red-300' : (isDark ? 'text-blue-300' : 'text-blue-700')}`}>{title}</h4>
          <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'} font-mono`}>
            <Map size={12} className="inline mr-1" />
            {location}
          </p>
        </div>
        
        <div className={`flex flex-col items-center ml-4 p-2 rounded-full border-2 ${statusClasses} ${isCompleted ? 'bg-white text-blue-500 border-blue-500' : (isDark ? 'bg-gray-700/50' : 'bg-white/50')}`}>
            <StatusIcon size={18} />
        </div>
      </div>

      <div className="flex justify-between items-center mt-3 pt-3 border-t border-dashed border-current border-opacity-20">
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${isDark ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
          {category}
        </span>
        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{timestamp}</span>
      </div>
    </GlassPanel>
  );
};


// --- Alert Banner Component ---
const AlertBanner = ({ isDark, criticalCount }) => {
    if (criticalCount === 0) return null;

    const criticalText = criticalCount === 1 ? '1 CRITICAL ISSUE' : `${criticalCount} CRITICAL ISSUES`;

    return (
        <div className="sticky top-0 z-20">
            <div className={`p-3 flex items-center justify-center font-bold text-sm transition-all duration-300 ${isDark ? 'bg-red-900/90 text-red-300 shadow-xl shadow-red-900/50' : 'bg-red-200/90 text-red-700 shadow-md'} backdrop-blur-sm`}>
                <AlertTriangle size={20} className="mr-3 animate-pulse" />
                <span>{criticalText} REQUIRES ATTENTION</span>
            </div>
        </div>
    );
};

// --- MAIN APP COMPONENT ---

const App = () => {
  // --- Firebase/Auth States ---
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userRole, setUserRole] = useState(null); // New state for RBAC

  // --- App States, now driven by Firestore ---
  const [isDark, setIsDark] = useState(null); 
  const [inspections, setInspections] = useState([]); 
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedInspection, setSelectedInspection] = useState(null);

  // Get App ID
  const appId = useMemo(() => typeof __app_id !== 'undefined' ? __app_id : 'default-app-id', []);


  // --- Firebase Initialization and Authentication ---
  useEffect(() => {
    const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
    const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
    
    if (console && console.debug) setLogLevel('Debug');

    if (!firebaseConfig) {
      console.error("Firebase configuration is missing.");
      setIsAuthReady(true);
      return;
    }

    try {
      const app = initializeApp(firebaseConfig);
      const firestoreDb = getFirestore(app);
      const firebaseAuth = getAuth(app);
      setDb(firestoreDb);
      setAuth(firebaseAuth);

      const authenticate = async () => {
        try {
          if (initialAuthToken) {
            await signInWithCustomToken(firebaseAuth, initialAuthToken);
          } else {
            await signInAnonymously(firebaseAuth);
          }
        } catch (error) {
          console.error("Firebase authentication failed:", error);
          setUserId(crypto.randomUUID());
          setIsAuthReady(true); 
        }
      };

      const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
        if (user) {
          setUserId(user.uid);
          console.log(`User signed in: ${user.uid}`);
        }
        setIsAuthReady(true); 
      });
      
      authenticate();
      return () => unsubscribe();

    } catch (error) {
      console.error("Firebase initialization failed:", error);
      setIsAuthReady(true);
    }
  }, []); 


  // --- User Settings and Role Persistence (Read and Write) ---
  useEffect(() => {
    if (!db || !userId) return; 

    // Path: /artifacts/{appId}/users/{userId}/settings/theme
    const settingsDocRef = doc(db, `artifacts/${appId}/users/${userId}/settings`, 'theme');

    const unsubscribeTheme = onSnapshot(settingsDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // 1. Load Theme
        if (data.isDark !== undefined) setIsDark(data.isDark);
        else if (isDark === null) setIsDark(true); // Default
        
        // 2. Load Role (New RBAC feature)
        if (data.role) setUserRole(data.role);
        else if (userRole === null) {
            // Default role and initialization if not found
            const defaultRole = 'Technician'; 
            setUserRole(defaultRole);
            setDoc(settingsDocRef, { role: defaultRole, isDark: true, lastUpdated: new Date().toISOString() }, { merge: true })
                .catch(e => console.error("Error setting initial role:", e));
        }

      } else if (isDark === null) {
        // Initialize theme and role if document doesn't exist
        const defaultRole = 'Technician'; 
        const defaultIsDark = true;
        setIsDark(defaultIsDark); 
        setUserRole(defaultRole);
        setDoc(settingsDocRef, { role: defaultRole, isDark: defaultIsDark, lastUpdated: new Date().toISOString() }, { merge: true })
            .catch(e => console.error("Error setting initial settings:", e));
      }
    }, (error) => {
      console.error("Error reading theme setting/role:", error);
      if (isDark === null) setIsDark(true); 
      if (userRole === null) setUserRole('Technician');
    });

    return () => unsubscribeTheme();
  }, [db, userId, appId]); 
  
  // Custom setter for isDark that writes to Firestore
  const toggleDark = useCallback((newDarkState) => {
    setIsDark(newDarkState); 
    if (!db || !userId) return; 
    
    const settingsDocRef = doc(db, `artifacts/${appId}/users/${userId}/settings`, 'theme');
    setDoc(settingsDocRef, { isDark: newDarkState, lastUpdated: new Date().toISOString() }, { merge: true })
      .catch(e => console.error("Error saving theme setting:", e));
  }, [db, userId, appId]);

  // Custom setter for Role
  const toggleRole = useCallback((newRole) => {
    setUserRole(newRole);
    if (!db || !userId) return; 
    
    const settingsDocRef = doc(db, `artifacts/${appId}/users/${userId}/settings`, 'theme');
    setDoc(settingsDocRef, { role: newRole, lastUpdated: new Date().toISOString() }, { merge: true })
      .catch(e => console.error("Error saving role setting:", e));
  }, [db, userId, appId]);


  // --- Inspection Data Persistence (Read Only) ---
  useEffect(() => {
    if (!db || !userId) return; 

    const inspectionsCollectionRef = collection(db, `artifacts/${appId}/public/data/inspections`);

    // 1. Populate initial mock data if the collection is empty (simulated)
    getDocs(inspectionsCollectionRef)
      .then(snapshot => {
        if (snapshot.empty) {
            console.log("Initializing mock inspection data...");
            initialMockInspections.forEach(item => {
                setDoc(doc(inspectionsCollectionRef, item.id), item)
                    .catch(e => console.error("Error setting mock inspection:", e));
            });
        }
      })
      .then(() => {
        // 2. Listen for real-time updates
        const unsubscribeInspections = onSnapshot(inspectionsCollectionRef, (snapshot) => {
          const liveInspections = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setInspections(liveInspections);
        }, (error) => {
          console.error("Error reading inspection data:", error);
        });

        return unsubscribeInspections;
      })
      .catch(e => console.error("Error during inspection data operation:", e));

    return () => {}; 
  }, [db, userId, appId]);


  // --- Derived State and Logic ---
  const criticalCount = useMemo(() => {
    return inspections.filter(i => i.critical).length;
  }, [inspections]);

  const isManager = userRole === 'Manager';


  // Filter inspections based on search term
  const filteredInspections = useMemo(() => {
    if (!searchTerm) return inspections;
    const lowerCaseSearch = searchTerm.toLowerCase();
    return inspections.filter(item => 
      item.title.toLowerCase().includes(lowerCaseSearch) ||
      item.location.toLowerCase().includes(lowerCaseSearch) ||
      item.category.toLowerCase().includes(lowerCaseSearch)
    );
  }, [searchTerm, inspections]);

  // AI-Assisted Search Simulation (suggestions)
  useEffect(() => {
    if (searchTerm.length > 2) {
      const allWords = Array.from(new Set(inspections.flatMap(i => 
        [...i.title.split(' '), ...i.category.split(' ')]
      ))).filter(w => w.toLowerCase().startsWith(searchTerm.toLowerCase()));
      setSuggestions(allWords.slice(0, 3));
    } else {
      setSuggestions([]);
    }
  }, [searchTerm, inspections]);
  
  // Handlers for interactions
  const handleCardLongPress = useCallback((inspection) => {
    setSelectedInspection(inspection);
    console.log(`Long press detected on: ${inspection.title}. Opening detail modal.`);
  }, []);

  const handleSuggestionClick = (suggestion) => {
    setSearchTerm(suggestion);
    setSuggestions([]);
  };

  // --- Theme Classes ---
  const appBackground = isDark ? Theme.DARK_BG : Theme.LIGHT_BG;
  const textColor = isDark ? 'text-gray-100' : 'text-gray-800';
  const headerGradient = isDark 
    ? 'bg-gradient-to-r from-blue-900 to-gray-900' 
    : 'bg-gradient-to-r from-white via-blue-50 to-white';

  // --- Loading State UI ---
  if (isDark === null || !isAuthReady || !userId || userRole === null) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-blue-400">
        <div className="animate-pulse">
          <Loader size={48} className="animate-spin" />
        </div>
        <p className="mt-4 text-lg font-bold">Initializing System</p>
        <p className="text-sm text-gray-500 font-mono">Loading user profile and security permissions...</p>
      </div>
    );
  }

  // --- Main App UI ---
  return (
    <div className={`min-h-screen ${appBackground} ${textColor} transition-colors duration-500 font-sans p-0 m-0`}>
      <div className="max-w-md mx-auto relative pb-20"> 

        {/* --- CRITICAL ALERT BANNER --- */}
        <AlertBanner isDark={isDark} criticalCount={criticalCount} />

        {/* Header and Search Panel */}
        <div className={`p-6 pt-10 sticky top-0 z-10 ${headerGradient} backdrop-blur-sm shadow-md`}>
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-extrabold tracking-tight">System Dashboard</h1>
            <div className="flex items-center space-x-3">
              <span className={`text-sm font-mono px-3 py-1 rounded-full ${isManager ? 'bg-green-600/70 text-white' : (isDark ? 'bg-blue-800/50 text-blue-300' : 'bg-blue-100 text-blue-600')}`}>
                <UserCheck size={14} className='inline mr-1'/>{userRole}
              </span>
              <NavIcon 
                Icon={isDark ? Zap : Smartphone} 
                isDark={isDark} 
                isActive={false} 
                onClick={() => toggleDark(!isDark)} 
              />
            </div>
          </div>

          {/* Search Input */}
          <GlassPanel isDark={isDark} className="relative p-0 glowing-input">
            <Search size={20} className={`absolute left-4 top-1/2 transform -translate-y-1/2 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
            <input
              type="text"
              placeholder="Search assets, locations, or status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full py-3 pl-12 pr-4 rounded-xl border-none focus:ring-0 ${isDark ? 'bg-transparent text-white placeholder-gray-400' : 'bg-transparent text-gray-800 placeholder-gray-500'}`}
            />
          </GlassPanel>

          {/* AI Suggestions Panel */}
          {suggestions.length > 0 && (
            <div className="mt-2 flex space-x-2 overflow-x-auto">
              {suggestions.map((s, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(s)}
                  className={`text-xs font-medium px-3 py-1 rounded-full transition-colors duration-200 whitespace-nowrap ${isDark ? 'bg-blue-800/50 text-blue-300 hover:bg-blue-700/50' : 'bg-blue-100/50 text-blue-700 hover:bg-blue-200/50'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content Area (Dashboard/Map) */}
        <main className="p-4">
          {activeTab === 'dashboard' && (
            <div className="mt-4">
              <h2 className={`text-2xl font-bold mb-4 ${isDark ? 'text-blue-200' : 'text-gray-800'}`}>Active Inspections ({filteredInspections.length})</h2>
              {filteredInspections.length > 0 ? (
                filteredInspections.map(inspection => (
                  <InspectionCard 
                    key={inspection.id} 
                    inspection={inspection} 
                    isDark={isDark}
                    onLongPress={handleCardLongPress}
                  />
                ))
              ) : (
                <p className={`text-center py-10 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>No inspections match your criteria.</p>
              )}
            </div>
          )}
          
          {activeTab === 'map' && (
            <div className="mt-4 h-96">
                <GlassPanel isDark={isDark} className="h-full flex items-center justify-center">
                    <Map size={36} className={`mr-2 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}/>
                    <p className="text-xl font-medium">Map View: Glowing Blue Pins</p>
                </GlassPanel>
            </div>
          )}
          
          {activeTab === 'settings' && (
            <div className="mt-4">
                <h2 className={`text-2xl font-bold mb-4 ${isDark ? 'text-blue-200' : 'text-gray-800'}`}>System Settings</h2>
                <GlassPanel isDark={isDark} className="p-5 space-y-4">
                    <div className="border-b border-current border-opacity-10 pb-4">
                        <p className="font-semibold mb-2">User Identity</p>
                        <p className="text-xs font-mono break-all opacity-75">
                            ID: {userId}
                        </p>
                    </div>
                    
                    {/* RBAC Role Toggle */}
                    <div className="border-b border-current border-opacity-10 pb-4">
                        <p className="font-semibold mb-2">User Role (RBAC)</p>
                        <div className="flex space-x-4">
                            <button
                                onClick={() => toggleRole('Technician')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${userRole === 'Technician' ? 'bg-blue-600 text-white shadow-lg' : (isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300')}`}
                            >
                                Technician
                            </button>
                            <button
                                onClick={() => toggleRole('Manager')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${userRole === 'Manager' ? 'bg-green-600 text-white shadow-lg' : (isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300')}`}
                            >
                                Manager
                            </button>
                        </div>
                        <p className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Current Role: **{userRole}**
                        </p>
                    </div>

                    <p className="font-semibold mb-2">Interface</p>
                    <div className="flex justify-between items-center py-2 border-t border-current border-opacity-10">
                        <span>Aura Blue Dark Mode</span>
                        <input type="checkbox" checked={isDark} onChange={() => toggleDark(!isDark)} className="h-6 w-12 rounded-full appearance-none bg-gray-300 dark:bg-blue-900 checked:bg-blue-500 transition duration-300 cursor-pointer relative after:content-[''] after:absolute after:top-1/2 after:-translate-y-1/2 after:w-4 after:h-4 after:rounded-full after:bg-white after:shadow after:transition after:duration-300 checked:after:translate-x-full" />
                    </div>
                </GlassPanel>
            </div>
          )}
          
          {/* RBAC Block for non-Managers trying to access Settings */}
          {activeTab === 'settings' && !isManager && (
            <div className="mt-4">
                <GlassPanel isDark={isDark} className="h-48 flex flex-col items-center justify-center p-6 text-center">
                    <Shield size={36} className="text-red-500 mb-3" />
                    <p className={`text-lg font-bold ${isDark ? 'text-red-300' : 'text-red-700'}`}>Access Denied</p>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        You must be a **Manager** to access system configuration settings.
                    </p>
                </GlassPanel>
            </div>
          )}
        </main>

        {/* Floating Bottom Navigation Bar (Bottom Nav) */}
        <GlassPanel isDark={isDark} className="fixed bottom-0 left-0 right-0 z-20 max-w-md mx-auto rounded-none rounded-t-3xl p-3 flex justify-around shadow-2xl shadow-blue-800/50 border-t border-blue-600/50">
          <NavIcon Icon={Shield} isActive={activeTab === 'dashboard'} isDark={isDark} onClick={() => setActiveTab('dashboard')} />
          <NavIcon Icon={Map} isActive={activeTab === 'map'} isDark={isDark} onClick={() => setActiveTab('map')} />
          <NavIcon Icon={Users} isActive={activeTab === 'teams'} isDark={isDark} onClick={() => setActiveTab('teams')} />
          
          {/* Settings icon only appears if user has the Manager role */}
          {isManager && (
              <NavIcon Icon={Settings} isActive={activeTab === 'settings'} isDark={isDark} onClick={() => setActiveTab('settings')} />
          )}
          {/* If not a manager, the settings tab will be inaccessible, but the icon is hidden */}
        </GlassPanel>
        
        {/* Detail Modal Layer */}
        <DetailModal inspection={selectedInspection} isDark={isDark} onClose={() => setSelectedInspection(null)} />
        
      </div>
    </div>
  );
};

export default App;
```eof
