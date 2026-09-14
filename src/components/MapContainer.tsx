import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useGps } from '../lib/GpsContext';
import { useTheme } from '../lib/ThemeContext';
import { Crosshair } from 'lucide-react';
import type { PowerUpOverlay } from '../types/tacticalPowerUps';

export type { PowerUpOverlay };


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
      <div class="w-4 h-4 rounded-full bg-cyber-red border-2 border-zinc-950 shadow-red-glow z-10 flex items-center justify-center text-[10px] font-black text-white">★</div>
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

// Frozen Player Marker Icon (Freeze Tag)
const frozenIcon = L.divIcon({
  className: 'frozen-gps-icon',
  html: `
    <div class="relative w-7 h-7 flex items-center justify-center">
      <div class="absolute w-7 h-7 rounded-full bg-sky-400 opacity-50 animate-ping"></div>
      <div class="w-5 h-5 rounded-full bg-sky-500/90 border-2 border-white shadow-[0_0_12px_#38bdf8] z-10 flex items-center justify-center text-[10px]">
        ❄️
      </div>
    </div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

// Zombie / Infected Marker Icon (Infection Mode)
const zombieIcon = L.divIcon({
  className: 'zombie-gps-icon',
  html: `
    <div class="relative w-6 h-6 flex items-center justify-center">
      <div class="absolute w-6 h-6 rounded-full bg-emerald-400 opacity-50 animate-ping"></div>
      <div class="w-3.5 h-3.5 rounded-full bg-emerald-500 border border-zinc-950 shadow-[0_0_10px_#10b981] z-10 flex items-center justify-center text-[8px] text-zinc-950 font-black">
        ☣
      </div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

// Energy Cube Collectible Icon (Geo-Bounty Skattejakt)
const energyCubeIcon = L.divIcon({
  className: 'energy-cube-gps-icon',
  html: `
    <div class="relative w-8 h-8 flex items-center justify-center">
      <div class="absolute w-7 h-7 rounded bg-cyan-400 opacity-40 animate-ping"></div>
      <div class="w-5 h-5 rounded bg-zinc-950 border-2 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.9)] flex items-center justify-center z-10 rotate-45 transform transition-transform">
        <span class="text-[10px] font-black text-cyan-300 -rotate-45">⚡</span>
      </div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

// Bounty Crystal Collectible Icon (Geo-Bounty Skattejakt)
const bountyCrystalIcon = L.divIcon({
  className: 'bounty-crystal-gps-icon',
  html: `
    <div class="relative w-9 h-9 flex items-center justify-center">
      <div class="absolute w-8 h-8 rounded-full bg-fuchsia-500 opacity-50 animate-ping"></div>
      <div class="w-6 h-6 bg-gradient-to-tr from-fuchsia-600 via-pink-500 to-amber-300 border-2 border-amber-300 shadow-[0_0_16px_rgba(217,70,239,0.9)] flex items-center justify-center z-10 rotate-45 transform transition-transform">
        <span class="text-[11px] font-black text-amber-200 -rotate-45">💎</span>
      </div>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18]
});

// Decoy Drone Phantom Marker Icon (pulsing cyan ping)
const decoyIcon = L.divIcon({
  className: 'decoy-gps-icon',
  html: `
    <div class="relative w-8 h-8 flex items-center justify-center pointer-events-none">
      <div class="absolute w-8 h-8 rounded-full bg-cyber-cyan opacity-60 animate-ping"></div>
      <div class="absolute w-6 h-6 rounded-full border border-cyber-cyan/50 animate-pulse"></div>
      <div class="w-4 h-4 rounded-full bg-cyber-cyan border-2 border-zinc-950 shadow-[0_0_12px_#00f0ff] z-10 flex items-center justify-center text-[10px] text-zinc-950 font-black">
        📡
      </div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

// Freeze Trap Hazard Icon (snowflake / frost snare)
const freezeTrapIcon = L.divIcon({
  className: 'freeze-trap-gps-icon',
  html: `
    <div class="relative w-8 h-8 flex items-center justify-center pointer-events-none">
      <div class="absolute w-7 h-7 rounded-full bg-sky-400 opacity-40 animate-ping"></div>
      <div class="w-6 h-6 rounded-full bg-zinc-950 border-2 border-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.8)] z-10 flex items-center justify-center text-xs">
        ❄️
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
    isFrozen?: boolean;
    gameMode?: string;
  }>;
  bombs?: Array<{
    id: number;
    lat: number;
    lng: number;
    radius: number;
    isActive: boolean;
  }>;
  collectibles?: Array<{
    id: string;
    type: 'energy_cube' | 'bounty_crystal';
    lat: number;
    lng: number;
    points: number;
    isCollected: boolean;
  }>;
  powerUps?: PowerUpOverlay[];
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
  collectibles = [],
  powerUps = [],
  boundary = null,
  recenterTrigger: externalRecenterTrigger,
  showRecenterButton = true
}) => {
  const { lat, lng, isSimulated, setCoordinates } = useGps();
  const { theme, isBright } = useTheme();
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
        attributionControl={false}
      >
        {/* Recenter triggers */}
        <MapRecenter center={[lat, lng]} trigger={activeTrigger} />
        
        {/* Map warping click triggers */}
        <MapEventsHandler isSimulated={isSimulated} onMapClick={handleMapClick} />

        {/* Dynamic Tile Layer: CARTO Positron Light in Bright Mode, CARTO Dark Matter in Dark Mode */}
        <TileLayer
          key={theme}
          url={
            isBright
              ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
              : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
          }
          subdomains="abcd"
          maxZoom={20}
        />

        {/* Play boundary overlay */}
        {boundary && boundary.lat && boundary.lng && (
          <Circle
            center={[boundary.lat, boundary.lng]}
            radius={boundary.radius}
            pathOptions={{
              color: isBright ? '#0284c7' : '#00f0ff',
              dashArray: '8, 8',
              weight: isBright ? 2.5 : 2,
              fillColor: isBright ? '#0284c7' : '#00f0ff',
              fillOpacity: isBright ? 0.08 : 0.03
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
                color: b.isActive ? (isBright ? '#dc2626' : '#ff0055') : (isBright ? '#d97706' : '#ff5e00'),
                dashArray: b.isActive ? undefined : '5, 5',
                weight: isBright ? 2.5 : 1.5,
                fillColor: b.isActive ? (isBright ? '#dc2626' : '#ff0055') : (isBright ? '#d97706' : '#ff5e00'),
                fillOpacity: isBright ? (b.isActive ? 0.22 : 0.12) : (b.isActive ? 0.15 : 0.05)
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

        {/* Collectible markers (Geo-Bounty Skattejakt) */}
        {collectibles.filter(c => !c.isCollected).map(c => {
          if (c.lat == null || c.lng == null) return null;
          const isCrystal = c.type === 'bounty_crystal';
          return (
            <Marker
              key={c.id}
              position={[c.lat, c.lng]}
              icon={isCrystal ? bountyCrystalIcon : energyCubeIcon}
            >
              <Popup>
                <div className="text-zinc-900 font-bold font-rajdhani text-center leading-tight">
                  <span className={`block uppercase text-xs font-black ${isCrystal ? 'text-fuchsia-600' : 'text-cyan-600'}`}>
                    {isCrystal ? '💎 Bounty Crystal' : '⚡ Energy Cube'}
                  </span>
                  <span className="text-[11px] text-zinc-600 font-mono">+{c.points} XP</span>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Decoy Drone Phantom Markers */}
        {powerUps.filter(p => p.type === 'decoy' && (p.isActive ?? true)).map(decoy => {
          if (decoy.lat == null || decoy.lng == null) return null;
          return (
            <Marker key={decoy.id} position={[decoy.lat, decoy.lng]} icon={decoyIcon}>
              <Popup>
                <div className="text-zinc-900 font-bold font-rajdhani text-center">
                  <span className="text-cyber-cyan block uppercase text-xs font-black">📡 PHANTOM DECOY</span>
                  <span className="text-[10px] text-zinc-500 font-mono">Simulated Radar Signal</span>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Freeze Trap Hazard Markers & 10m Snare Radii */}
        {powerUps.filter(p => p.type === 'freeze_trap' && (p.isActive ?? true)).map(trap => {
          if (trap.lat == null || trap.lng == null) return null;
          return (
            <React.Fragment key={trap.id}>
              <Circle
                center={[trap.lat, trap.lng]}
                radius={trap.radius || 10}
                pathOptions={{
                  color: isBright ? '#0284c7' : '#38bdf8',
                  dashArray: '4, 4',
                  weight: isBright ? 2 : 1.5,
                  fillColor: isBright ? '#38bdf8' : '#0284c7',
                  fillOpacity: isBright ? 0.20 : 0.15
                }}
              />
              <Marker position={[trap.lat, trap.lng]} icon={freezeTrapIcon}>
                <Popup>
                  <div className="text-zinc-900 font-bold font-rajdhani text-center">
                    <span className="text-sky-500 block uppercase text-xs font-black">❄️ FREEZE TRAP</span>
                    <span className="text-[10px] text-zinc-500 font-mono">10m Snare Zone</span>
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}

        {/* Nearby / Opponent markers */}
        {markers.map(m => {
          if (m.lat == null || m.lng == null) return null;
          let markerIcon = hunterIcon;
          
          if (m.isFrozen) {
            markerIcon = frozenIcon;
          } else if (m.role === 'seeker' && m.gameMode === 'infection') {
            markerIcon = zombieIcon;
          } else if (m.isSpecial) {
            markerIcon = specialIcon;
          } else if (m.role === 'hider') {
            markerIcon = hiderIcon;
          }

          return (
            <Marker key={m.id} position={[m.lat, m.lng]} icon={markerIcon}>
              <Popup>
                <div className="text-zinc-900 font-bold font-rajdhani text-center">
                  <span className="uppercase text-xs">{m.name}</span>
                  {m.isFrozen ? (
                    <span className="block text-[10px] text-sky-500 font-black animate-pulse">
                      ❄️ FROZEN
                    </span>
                  ) : m.role && (
                    <span className={`block text-[10px] uppercase font-black ${
                      m.role === 'hider' ? 'text-amber-500' : m.gameMode === 'infection' ? 'text-emerald-500' : 'text-cyan-500'
                    }`}>
                      Role: {m.role === 'seeker' && m.gameMode === 'infection' ? 'Zombie' : m.role}
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
