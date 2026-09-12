import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useGps } from '../lib/GpsContext';
import { Crosshair } from 'lucide-react';

// Custom Map Click Listener to warp player in simulated mode
const MapEventsHandler: React.FC<{ isSimulated: boolean; onMapClick: (lat: number, lng: number) => void }> = ({
  isSimulated,
  onMapClick
}) => {
  useMapEvents({
    click(e) {
      if (isSimulated) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    }
  });
  return null;
};

// Map panning manager
const MapRecenter: React.FC<{ center: [number, number]; trigger: number | boolean }> = ({ center, trigger }) => {
  const map = useMap();
  const prevTriggerRef = useRef(trigger);
  useEffect(() => {
    if (trigger && trigger !== prevTriggerRef.current) {
      map.setView(center, map.getZoom());
    }
    prevTriggerRef.current = trigger;
  }, [center, trigger, map]);
  return null;
};

// Custom Cyberpunk Leaflet markers using DivIcon
const ownIcon = L.divIcon({
  className: 'own-gps-icon',
  html: `
    <div class="relative w-6 h-6 flex items-center justify-center">
      <div class="absolute w-6 h-6 rounded-full bg-cyber-cyan opacity-40 animate-ping"></div>
      <div class="w-3.5 h-3.5 rounded-full bg-cyber-cyan border-2 border-zinc-950 shadow-cyan-glow z-10"></div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const hiderIcon = L.divIcon({
  className: 'hider-gps-icon',
  html: `
    <div class="relative w-6 h-6 flex items-center justify-center">
      <div class="absolute w-6 h-6 rounded-full bg-cyber-yellow opacity-40 animate-ping"></div>
      <div class="w-3.5 h-3.5 rounded-full bg-cyber-yellow border-2 border-zinc-950 shadow-yellow-glow z-10"></div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const specialIcon = L.divIcon({
  className: 'special-gps-icon',
  html: `
    <div class="relative w-8 h-8 flex items-center justify-center">
      <div class="absolute w-8 h-8 rounded-full bg-cyber-red opacity-50 animate-ping"></div>
      <div class="w-4 h-4 rounded-full bg-cyber-red border-2 border-zinc-950 shadow-red-glow z-10 flex items-center justify-center text-[8px] font-black text-white">★</div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const hunterIcon = L.divIcon({
  className: 'hunter-gps-icon',
  html: `
    <div class="relative w-6 h-6 flex items-center justify-center">
      <div class="absolute w-5 h-5 rounded-full bg-cyber-orange opacity-40 animate-ping"></div>
      <div class="w-3 h-3 rounded-full bg-cyber-orange border border-zinc-950 shadow-orange-glow z-10"></div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

// Bomb marker icons
const bombIcon = L.divIcon({
  className: 'bomb-gps-icon',
  html: `
    <div class="relative w-8 h-8 flex items-center justify-center">
      <div class="w-6 h-6 rounded-full bg-zinc-950 border border-cyber-red/80 shadow-red-glow flex items-center justify-center text-xs animate-bounce z-10">
        💥
      </div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const armingBombIcon = L.divIcon({
  className: 'bomb-gps-icon-arming',
  html: `
    <div class="relative w-8 h-8 flex items-center justify-center">
      <div class="w-6 h-6 rounded-full bg-zinc-900 border border-cyber-orange/40 text-cyber-orange flex items-center justify-center text-xs pulse-slow z-10">
        💣
      </div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

interface MapProps {
  markers?: Array<{
    id: string;
    name: string;
    lat: number;
    lng: number;
    isSpecial?: boolean;
    role?: 'hider' | 'seeker';
  }>;
  bombs?: Array<{
    id: number;
    lat: number;
    lng: number;
    radius: number;
    isActive: boolean;
  }>;
  boundary?: {
    lat: number;
    lng: number;
    radius: number;
  } | null;
  recenterTrigger?: number | boolean;
  showRecenterButton?: boolean;
}

const CustomMapContainer: React.FC<MapProps> = ({
  markers = [],
  bombs = [],
  boundary = null,
  recenterTrigger: externalRecenterTrigger,
  showRecenterButton = true
}) => {
  const { lat, lng, isSimulated, setCoordinates } = useGps();
  const [internalRecenterTrigger, setInternalRecenterTrigger] = useState(0);
  const activeTrigger = externalRecenterTrigger !== undefined ? externalRecenterTrigger : internalRecenterTrigger;

  // Recenter map on current player location
  const handleRecenter = () => {
    setInternalRecenterTrigger(prev => prev + 1);
  };

  const handleMapClick = (clickLat: number, clickLng: number) => {
    setCoordinates(clickLat, clickLng, true);
  };

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={[lat, lng]}
        zoom={16}
        className="w-full h-full"
        zoomControl={false}
      >
        {/* Recenter triggers */}
        <MapRecenter center={[lat, lng]} trigger={activeTrigger} />
        
        {/* Map warping click triggers */}
        <MapEventsHandler isSimulated={isSimulated} onMapClick={handleMapClick} />

        {/* Bright theme maps layer */}
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          maxZoom={20}
        />

        {/* Play boundary overlay */}
        {boundary && boundary.lat && boundary.lng && (
          <Circle
            center={[boundary.lat, boundary.lng]}
            radius={boundary.radius}
            pathOptions={{
              color: '#00f0ff',
              dashArray: '8, 8',
              weight: 2,
              fillColor: '#00f0ff',
              fillOpacity: 0.03
            }}
          />
        )}

        {/* Active bomb circles */}
        {bombs.map(b => (
          <React.Fragment key={b.id}>
            <Circle
              center={[b.lat, b.lng]}
              radius={b.radius}
              pathOptions={{
                color: b.isActive ? '#ff0055' : '#ff5e00',
                dashArray: b.isActive ? undefined : '5, 5',
                weight: 1.5,
                fillColor: b.isActive ? '#ff0055' : '#ff5e00',
                fillOpacity: b.isActive ? 0.15 : 0.05
              }}
            />
            <Marker
              position={[b.lat, b.lng]}
              icon={b.isActive ? bombIcon : armingBombIcon}
            />
          </React.Fragment>
        ))}

        {/* Own Player marker */}
        <Marker position={[lat, lng]} icon={ownIcon}>
          <Popup>
            <div className="text-zinc-900 font-bold font-rajdhani text-center leading-none">
              <span className="text-cyber-cyan text-xs">YOUR POSITION</span>
              <br />
              <span className="text-[10px] text-zinc-500 font-mono">
                {lat.toFixed(5)}, {lng.toFixed(5)}
              </span>
            </div>
          </Popup>
        </Marker>

        {/* Nearby / Opponent markers */}
        {markers.map(m => {
          if (m.lat == null || m.lng == null) return null;
          let markerIcon = hunterIcon;
          
          if (m.isSpecial) {
            markerIcon = specialIcon;
          } else if (m.role === 'hider') {
            markerIcon = hiderIcon;
          }

          return (
            <Marker key={m.id} position={[m.lat, m.lng]} icon={markerIcon}>
              <Popup>
                <div className="text-zinc-900 font-bold font-rajdhani text-center">
                  <span className="uppercase text-xs">{m.name}</span>
                  {m.role && (
                    <span className={`block text-[10px] uppercase font-black ${m.role === 'hider' ? 'text-amber-500' : 'text-cyan-500'}`}>
                      Role: {m.role}
                    </span>
                  )}
                  {m.isSpecial && (
                    <span className="block text-[10px] text-red-500 font-black animate-pulse">
                      🚨 SPECIAL BOUNTY (500 XP)
                    </span>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Floating map HUD center button (rendered when not delegated to parent) */}
      {showRecenterButton && (
        <button
          onClick={handleRecenter}
          className="absolute top-20 right-2 z-[1000] w-11 h-11 rounded-full bg-zinc-950/90 border border-cyber-cyan text-cyber-cyan shadow-cyan-glow hover:bg-cyber-cyan hover:text-zinc-950 transition-all active:scale-95 flex items-center justify-center pointer-events-auto"
          title="Center Map on Me"
          aria-label="Center Map on My Location"
        >
          <Crosshair className="w-5 h-5" />
        </button>
      )}

      {isSimulated && (
        <div className="absolute top-4 right-4 z-[1000] pointer-events-none px-3 py-1 bg-cyber-red/20 border border-cyber-red text-cyber-red rounded text-[10px] font-bold tracking-wider uppercase font-orbitron animate-pulse">
          GPS Sim Mode Active: Click Map to Warp
        </div>
      )}
    </div>
  );
};

export default CustomMapContainer;
