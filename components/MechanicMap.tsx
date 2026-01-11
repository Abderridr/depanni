import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MechanicProfile, Coordinates } from '../types';

interface MechanicMapProps {
  userLocation: Coordinates;
  mechanics: MechanicProfile[];
  targetMechanicLocation?: Coordinates;
  mode: 'VIEW' | 'TRACKING';
  eta?: number;
  isMoving?: boolean;
  darkMode?: boolean;
}

export const MechanicMap: React.FC<MechanicMapProps> = ({ userLocation, mechanics, targetMechanicLocation, mode, darkMode = false }) => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<{ [id: string]: L.Marker }>({});
  const userMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const getLat = (val: any) => Number(val) || 33.5731;
  const getLng = (val: any) => Number(val) || -7.5898;

  // Initialize Map
  useEffect(() => {
    if (containerRef.current && !mapRef.current) {
      mapRef.current = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([getLat(userLocation.lat), getLng(userLocation.lng)], 15);
      
      setTimeout(() => mapRef.current?.invalidateSize(), 100);
    }
    return () => { if(mapRef.current) { mapRef.current.remove(); mapRef.current = null; } }
  }, []); 

  // Handle Dark Mode / Tile Layer
  useEffect(() => {
      if (!mapRef.current) return;

      const lightTiles = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
      const darkTiles = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      const url = darkMode ? darkTiles : lightTiles;

      if (tileLayerRef.current) {
          tileLayerRef.current.setUrl(url);
      } else {
          tileLayerRef.current = L.tileLayer(url, {
              attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
              subdomains: 'abcd',
              maxZoom: 20
          }).addTo(mapRef.current);
      }
  }, [darkMode]);

  // Update User Location Marker
  useEffect(() => {
    if (!mapRef.current) return;
    const lat = getLat(userLocation.lat);
    const lng = getLng(userLocation.lng);
    const userIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="relative w-6 h-6"><div class="absolute inset-0 bg-blue-500 rounded-full opacity-30 animate-ping"></div><div class="absolute inset-1 bg-blue-600 rounded-full border-2 border-white shadow-lg"></div></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
    
    if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([lat, lng]);
    } else {
        userMarkerRef.current = L.marker([lat, lng], { icon: userIcon, zIndexOffset: 1000 }).addTo(mapRef.current);
    }

    // Auto-centering removed to allow panning
  }, [userLocation, mode]);

  // Update Mechanics Markers
  useEffect(() => {
    if (!mapRef.current) return;
    const currentMechIds = new Set<string>();
    if (mode === 'VIEW') {
        mechanics.forEach(mech => {
            if (!mech.location) return;
            currentMechIds.add(mech.id);
            const mLat = getLat(mech.location.lat);
            const mLng = getLng(mech.location.lng);
            const icon = L.divIcon({
                className: 'custom-div-icon',
                html: `<div style="background-color: ${darkMode ? '#1F2937' : 'white'}; padding: 4px; border-radius: 50%; box-shadow: 0 4px 6px rgba(0,0,0,0.3); border: 2px solid ${darkMode ? '#374151' : 'transparent'}"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg></div>`,
                iconSize: [34, 34],
                iconAnchor: [17, 17]
            });
            if (markersRef.current[mech.id]) {
                markersRef.current[mech.id].setLatLng([mLat, mLng]);
                markersRef.current[mech.id].setIcon(icon);
            } else {
                markersRef.current[mech.id] = L.marker([mLat, mLng], { icon }).addTo(mapRef.current);
            }
        });
    }
    Object.keys(markersRef.current).forEach(id => {
        if (!currentMechIds.has(id) && id !== 'target') {
            markersRef.current[id].remove();
            delete markersRef.current[id];
        }
    });
  }, [mechanics, mode, darkMode]);

  // Tracking Mode Logic
  useEffect(() => {
    if (!mapRef.current) return;
    if (mode === 'TRACKING' && targetMechanicLocation) {
        const tLat = getLat(targetMechanicLocation.lat);
        const tLng = getLng(targetMechanicLocation.lng);
        const uLat = getLat(userLocation.lat);
        const uLng = getLng(userLocation.lng);
        const carIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color: #10B981; padding: 8px; border-radius: 50%; border: 2px solid white; box-shadow: 0 10px 15px rgba(0,0,0,0.2);"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg></div>`,
            iconSize: [44, 44],
            iconAnchor: [22, 22]
        });
        if (markersRef.current['target']) {
            markersRef.current['target'].setLatLng([tLat, tLng]);
        } else {
            markersRef.current['target'] = L.marker([tLat, tLng], { icon: carIcon, zIndexOffset: 2000 }).addTo(mapRef.current);
        }
        if (routeLineRef.current) {
            routeLineRef.current.setLatLngs([[uLat, uLng], [tLat, tLng]]);
        } else {
            routeLineRef.current = L.polyline([[uLat, uLng], [tLat, tLng]], { color: '#2563EB', weight: 4, dashArray: '10, 10', opacity: 0.7 }).addTo(mapRef.current);
        }
        const bounds = L.latLngBounds([[uLat, uLng], [tLat, tLng]]);
        mapRef.current.fitBounds(bounds, { padding: [100, 100], animate: true });
    } else {
        if (markersRef.current['target']) { markersRef.current['target'].remove(); delete markersRef.current['target']; }
        if (routeLineRef.current) { routeLineRef.current.remove(); routeLineRef.current = null; }
    }
  }, [mode, targetMechanicLocation, userLocation]);

  return (
      <div className="relative w-full h-full">
          <div ref={containerRef} className="w-full h-full bg-main dark:bg-gray-900 transition-colors duration-300" />
          <button onClick={() => mapRef.current?.flyTo([getLat(userLocation.lat), getLng(userLocation.lng)], 15)} className="absolute bottom-24 right-4 z-[400] bg-white dark:bg-gray-800 p-3 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 text-blue-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
          </button>
      </div>
  );
};