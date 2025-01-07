import React, { useState, useCallback } from 'react';
import Map, { Marker, GeolocateControl, NavigationControl } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapPin } from 'lucide-react';

const LocationEditSection = ({ editFormData, setEditFormData, isSubmitting }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const searchAddress = async (query) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${process.env.REACT_APP_MAPBOX_TOKEN}&country=GB&proximity=${editFormData.longitude},${editFormData.latitude}`
      );
      const data = await response.json();
      setSuggestions(data.features || []);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  const handleInputChange = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const value = e.target.value;
    const scrollPos = document.querySelector('.edit-modal-overlay')?.scrollTop;
    
    setEditFormData((prev) => ({
      ...prev,
      location: value,
    }));
    searchAddress(value);

    // Maintain scroll position
    setTimeout(() => {
      const overlay = document.querySelector('.edit-modal-overlay');
      if (overlay && scrollPos) overlay.scrollTop = scrollPos;
    }, 0);
  };

  const handleSuggestionClick = (suggestion, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const [lng, lat] = suggestion.center;
    const scrollPos = document.querySelector('.edit-modal-overlay')?.scrollTop;
    
    setEditFormData((prev) => ({
      ...prev,
      location: suggestion.place_name,
      latitude: lat.toString(),
      longitude: lng.toString(),
    }));
    setShowSuggestions(false);

    // Maintain scroll position
    setTimeout(() => {
      const overlay = document.querySelector('.edit-modal-overlay');
      if (overlay && scrollPos) overlay.scrollTop = scrollPos;
    }, 0);
  };

  const handleMapClick = useCallback(async (event) => {
    if (isSubmitting) return;

    const { lat, lng } = event.lngLat;
    const scrollPos = document.querySelector('.edit-modal-overlay')?.scrollTop;

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${process.env.REACT_APP_MAPBOX_TOKEN}`
      );
      const data = await response.json();

      if (data.features && data.features.length > 0) {
        const address = data.features[0].place_name;
        setEditFormData((prev) => ({
          ...prev,
          location: address,
          latitude: lat.toString(),
          longitude: lng.toString(),
        }));

        // Maintain scroll position
        setTimeout(() => {
          const overlay = document.querySelector('.edit-modal-overlay');
          if (overlay && scrollPos) overlay.scrollTop = scrollPos;
        }, 0);
      }
    } catch (error) {
      console.error('Error getting address from map click:', error);
    }
  }, [isSubmitting, setEditFormData]);

  return (
    <div className="form-section" onClick={(e) => e.stopPropagation()}>
      <h3>Location</h3>
      <div className="form-group">
        <label>Address</label>
        <div className="relative">
          <input
            type="text"
            name="location"
            placeholder="Start typing to search for an address"
            value={editFormData.location}
            onChange={handleInputChange}
            onFocus={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="form-input w-full"
            disabled={isSubmitting}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div 
              className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {suggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="p-2 hover:bg-gray-100 cursor-pointer text-sm"
                  onClick={(e) => handleSuggestionClick(suggestion, e)}
                >
                  {suggestion.place_name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 relative" onClick={(e) => e.stopPropagation()}>
        <Map
          mapboxAccessToken={process.env.REACT_APP_MAPBOX_TOKEN}
          initialViewState={{
            latitude: parseFloat(editFormData.latitude),
            longitude: parseFloat(editFormData.longitude),
            zoom: 13,
          }}
          style={{ width: '100%', height: '400px' }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          onClick={handleMapClick}
          interactive={!isSubmitting}
        >
          <Marker
            latitude={parseFloat(editFormData.latitude)}
            longitude={parseFloat(editFormData.longitude)}
            anchor="bottom"
          >
            <MapPin className="text-blue-500 w-8 h-8" />
          </Marker>
          <GeolocateControl
            position="top-right"
            trackUserLocation={true}
            showAccuracyCircle={true}
          />
          <NavigationControl position="bottom-right" />
        </Map>
      </div>
    </div>
  );
};

export default LocationEditSection;