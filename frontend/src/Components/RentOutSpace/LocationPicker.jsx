import React, { useState, useCallback } from 'react';
import Map, { Marker, GeolocateControl, NavigationControl } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapPin } from 'lucide-react';

const LocationSection = ({ spaceDetails, setSpaceDetails, isSubmitting, errors }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const searchAddress = async (query) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${process.env.REACT_APP_MAPBOX_TOKEN}&country=GB&proximity=${spaceDetails.coordinates.longitude},${spaceDetails.coordinates.latitude}`
      );
      const data = await response.json();
      setSuggestions(data.features || []);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSpaceDetails((prev) => ({
      ...prev,
      location: value,
    }));
    searchAddress(value);
  };

  const handleSuggestionClick = (suggestion) => {
    const [lng, lat] = suggestion.center;
    setSpaceDetails((prev) => ({
      ...prev,
      location: suggestion.place_name,
      coordinates: {
        latitude: lat,
        longitude: lng,
      },
    }));
    setShowSuggestions(false);
  };

  const handleMapClick = useCallback(async (event) => {
    if (isSubmitting) return;

    const { lat, lng } = event.lngLat;

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${process.env.REACT_APP_MAPBOX_TOKEN}`
      );
      const data = await response.json();

      if (data.features && data.features.length > 0) {
        const address = data.features[0].place_name;
        setSpaceDetails((prev) => ({
          ...prev,
          location: address,
          coordinates: {
            latitude: lat,
            longitude: lng,
          },
        }));

        // Debugging: Log updated state
        console.log('Updated coordinates:', { latitude: lat, longitude: lng });
        console.log('Updated location:', address);
      }
    } catch (error) {
      console.error('Error getting address from map click:', error);
    }
  }, [isSubmitting, setSpaceDetails]);

  // Debugging: Log state updates
  console.log('Current spaceDetails:', spaceDetails);

  return (
    <div className="form-section">
      <h2>Location</h2>
      <div className="form-group">
        <label>Address:</label>
        <div className="relative">
          <input
            type="text"
            name="location"
            placeholder="Start typing to search for an address"
            value={spaceDetails.location}
            onChange={handleInputChange}
            className={`${errors.location ? 'border-red-500' : ''} ${
              isSubmitting ? 'opacity-50' : ''
            } w-full p-2 border rounded-md min-h-[48px]`}
            style={{ minWidth: '500px' }}
            disabled={isSubmitting}
            required
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
              {suggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="p-2 hover:bg-gray-100 cursor-pointer text-sm"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion.place_name}
                </div>
              ))}
            </div>
          )}
        </div>
        {errors.location && (
          <span className="text-red-500 text-sm mt-1">{errors.location}</span>
        )}
      </div>

      <div className="mt-4 relative">
        <Map
          mapboxAccessToken={process.env.REACT_APP_MAPBOX_TOKEN}
          initialViewState={{
            latitude: spaceDetails.coordinates.latitude,
            longitude: spaceDetails.coordinates.longitude,
            zoom: 13,
          }}
          style={{ width: '100%', height: '400px' }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          onClick={handleMapClick}
          interactive={!isSubmitting}
        >
          <Marker
            latitude={spaceDetails.coordinates.latitude}
            longitude={spaceDetails.coordinates.longitude}
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

export default LocationSection;
