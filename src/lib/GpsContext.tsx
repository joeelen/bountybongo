import React, { createContext, useContext, useState, useEffect } from 'react';

interface GpsContextType {
  lat: number;
  lng: number;
  accuracy: number | null;
  isSimulated: boolean;
  setCoordinates: (lat: number, lng: number, simulated?: boolean) => void;
  toggleSimulation: (active: boolean) => void;
}

const GpsContext = createContext<GpsContextType | undefined>(undefined);

export const GpsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Default coordinates: Central Oslo area with a minor random offset to avoid exact overlays
  const [lat, setLat] = useState(() => {
    const saved = sessionStorage.getItem('gps_lat');
    return saved ? parseFloat(saved) : 59.9139 + (Math.random() - 0.5) * 0.002;
  });
  const [lng, setLng] = useState(() => {
    const saved = sessionStorage.getItem('gps_lng');
    return saved ? parseFloat(saved) : 10.7522 + (Math.random() - 0.5) * 0.002;
  });
  const [isSimulated, setIsSimulated] = useState(() => {
    return sessionStorage.getItem('gps_simulated') === 'true';
  });
  const [accuracy, setAccuracy] = useState<number | null>(() => {
    const isSim = sessionStorage.getItem('gps_simulated') === 'true';
    return isSim ? null : 5;
  });

  // Function to manually set coordinates (used by simulator or maps clicks)
  const setCoordinates = (newLat: number, newLng: number, simulated = true) => {
    setLat(newLat);
    setLng(newLng);
    setIsSimulated(simulated);
    sessionStorage.setItem('gps_lat', newLat.toString());
    sessionStorage.setItem('gps_lng', newLng.toString());
    sessionStorage.setItem('gps_simulated', simulated.toString());
    if (simulated) setAccuracy(null);

    // Push new coordinates to the server silently
    fetch('/api/profile/gps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: newLat, lng: newLng })
    }).catch(err => console.error('Failed to sync GPS to server:', err));
  };

  const toggleSimulation = (active: boolean) => {
    setIsSimulated(active);
    sessionStorage.setItem('gps_simulated', active.toString());
    if (active) setAccuracy(null);
  };

  // Real Geolocation Hook (runs only if simulation mode is false)
  useEffect(() => {
    if (isSimulated) return;

    if (!navigator.geolocation) {
      console.warn('Geolocation not supported by browser. Falling back to simulation.');
      setIsSimulated(true);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy: reportedAccuracy } = position.coords;
        setLat(latitude);
        setLng(longitude);
        setAccuracy(reportedAccuracy ?? 5);
        sessionStorage.setItem('gps_lat', latitude.toString());
        sessionStorage.setItem('gps_lng', longitude.toString());

        // Sync coordinates to server
        fetch('/api/profile/gps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: latitude, lng: longitude })
        }).catch(err => console.error('Failed to sync GPS to server:', err));
      },
      (error) => {
        console.warn('Geolocation access failed. Defaulting to simulation.', error.message);
        setIsSimulated(true);
        setAccuracy(null);
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isSimulated]);

  // Periodic GPS push to server in case coordinates are static but server needs heartbeat
  useEffect(() => {
    const interval = setInterval(() => {
      fetch('/api/profile/gps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng })
      }).catch(() => {});
    }, 10000);

    return () => clearInterval(interval);
  }, [lat, lng]);

  return (
    <GpsContext.Provider value={{ lat, lng, accuracy, isSimulated, setCoordinates, toggleSimulation }}>
      {children}
    </GpsContext.Provider>
  );
};

export const useGps = () => {
  const context = useContext(GpsContext);
  if (!context) throw new Error('useGps must be used within GpsProvider');
  return context;
};
