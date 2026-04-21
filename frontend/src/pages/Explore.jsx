import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  FaHome, 
  FaIndustry, 
  FaMapMarkerAlt, 
  FaFilter,
  FaSearch,
  FaTimes,
  FaLocationArrow,
  FaSort
} from 'react-icons/fa';
import Logo from '../components/Logo';
import DarkModeToggle from '../components/DarkModeToggle';
import { getUserLocation, addDistanceToIndustries, sortIndustriesByDistance, formatDistance } from '../utils/distance';
import { API_BASE_URL } from '../utils/api';
import './Explore.css';

// Fix for default marker icons in React Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Custom green marker icon
const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Component to handle map resize and lifecycle
function MapResizeHandler() {
  const map = useMap();
  
  useEffect(() => {
    // Invalidate size on mount
    const timer = setTimeout(() => {
      map.invalidateSize();
      console.log('[Map] Size invalidated on mount');
    }, 100);

    // Handle window resize
    const handleResize = () => {
      map.invalidateSize();
      console.log('[Map] Size invalidated on resize');
    };

    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [map]);

  return null;
}

// Component to update map view when filters change
function MapViewController({ center, industries }) {
  const map = useMap();

  useEffect(() => {
    if (industries.length > 0) {
      // Fit bounds to show all markers
      const bounds = industries.map(ind => [ind.latitude, ind.longitude]);
      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
      }
    } else {
      // Reset to center if no industries
      map.setView(center, 7);
    }
  }, [industries, center, map]);

  return null;
}

function Explore() {
  const navigate = useNavigate();
  const [industries, setIndustries] = useState([]);
  const [filteredIndustries, setFilteredIndustries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSector, setSelectedSector] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [mapKey, setMapKey] = useState(0); // Key to force map remount if needed
  const mapContainerRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);
  
  // Location and distance states
  const [userLocation, setUserLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [sortByDistance, setSortByDistance] = useState(false);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
      setIsMobile(mobile);
      console.log('[Explore] Device type:', mobile ? 'Mobile' : 'Desktop');
      console.log('[Explore] User Agent:', navigator.userAgent);
      console.log('[Explore] Window width:', window.innerWidth);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Ethiopia center coordinates
  const ethiopiaCenter = [9.145, 40.489673];

  // Fetch industries with location data
  useEffect(() => {
    console.log('[Explore] Component mounted, fetching industries...');
    fetchIndustries();
    // Try to get user location on mount
    requestUserLocation();
  }, []);

  const fetchIndustries = async () => {
    try {
      setError(null);
      console.log('[Explore] Fetching industries from API...');
      console.log('[Explore] API URL:', API_BASE_URL);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const response = await fetch(`${API_BASE_URL}/api/industries/explore`, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      clearTimeout(timeoutId);
      
      console.log('[Explore] Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch industries (${response.status})`);
      }
      
      const data = await response.json();
      console.log('[Explore] Received', data.length, 'industries');
      
      // Use real coordinates if available, otherwise generate mock coordinates
      const industriesWithCoords = data.map((industry, index) => ({
        ...industry,
        // Use real coordinates if available, otherwise mock around Ethiopia
        latitude: industry.latitude || (9.0 + (Math.random() * 2)),
        longitude: industry.longitude || (38.7 + (Math.random() * 2))
      }));
      
      // Add distance information if user location is available
      const industriesWithDistance = userLocation 
        ? addDistanceToIndustries(industriesWithCoords, userLocation)
        : industriesWithCoords;
      
      setIndustries(industriesWithDistance);
      setFilteredIndustries(industriesWithDistance);
      setLoading(false);
      console.log('[Explore] Industries loaded successfully');
    } catch (error) {
      console.error('[Explore] Error fetching industries:', error);
      
      let errorMessage = 'Failed to load industries. ';
      if (error.name === 'AbortError') {
        errorMessage += 'Request timed out. Please check your connection.';
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage += 'Network error. Please check your internet connection.';
      } else {
        errorMessage += error.message || 'Please try again later.';
      }
      
      setError(errorMessage);
      // Set empty array on error to prevent crashes
      setIndustries([]);
      setFilteredIndustries([]);
      setLoading(false);
    }
  };

  // Request user's current location
  const requestUserLocation = async () => {
    setLocationLoading(true);
    setLocationError(null);
    
    try {
      console.log('[Explore] Requesting user location...');
      const location = await getUserLocation();
      console.log('[Explore] User location obtained:', location);
      setUserLocation(location);
      
      // Update industries with distance information
      if (industries.length > 0) {
        const industriesWithDistance = addDistanceToIndustries(industries, location);
        setIndustries(industriesWithDistance);
        setFilteredIndustries(industriesWithDistance);
      }
    } catch (error) {
      console.error('[Explore] Error getting user location:', error);
      setLocationError(error.message);
    } finally {
      setLocationLoading(false);
    }
  };

  // Update industries with distance when user location changes
  useEffect(() => {
    if (userLocation && industries.length > 0) {
      console.log('[Explore] Updating industries with distance information');
      const industriesWithDistance = addDistanceToIndustries(industries, userLocation);
      setIndustries(industriesWithDistance);
      // Re-apply current filters
      applyFilters(industriesWithDistance);
    }
  }, [userLocation]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply filters and sorting
  const applyFilters = (industriesToFilter = industries) => {
    console.log('[Explore] Applying filters - Sector:', selectedSector, 'Query:', searchQuery, 'Sort by distance:', sortByDistance);
    let filtered = industriesToFilter;

    // Filter by sector
    if (selectedSector !== 'all') {
      filtered = filtered.filter(ind => ind.sector === selectedSector);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(ind =>
        ind.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ind.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ind.sector?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort by distance if enabled and user location is available
    if (sortByDistance && userLocation) {
      filtered = sortIndustriesByDistance(filtered, userLocation);
    }

    console.log('[Explore] Filtered to', filtered.length, 'industries');
    setFilteredIndustries(filtered);
  };

  // Filter industries when filters change
  useEffect(() => {
    applyFilters();
  }, [selectedSector, searchQuery, sortByDistance, industries]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get unique sectors
  const sectors = ['all', ...new Set(industries.map(ind => ind.sector).filter(Boolean))];

  return (
    <div className="explore-page">
      {/* Navigation */}
      <nav className="explore-nav">
        <div className="explore-nav-content">
          <Link to="/" className="explore-logo">
            <Logo size={32} color="#0a5c2f" />
            <span>EthioBridge</span>
          </Link>
          <div className="explore-nav-actions">
            <DarkModeToggle />
            <Link to="/" className="explore-home-btn">
              <FaHome /> Home
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <div className="explore-header">
        <div className="explore-header-content">
          <h1><FaMapMarkerAlt /> Explore Industries</h1>
          <p>Discover construction industries across Ethiopia</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="explore-filters-bar">
        <div className="explore-filters-content">
          <div className="explore-search">
            <FaSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search by name, location, or sector..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="clear-search" onClick={() => setSearchQuery('')}>
                <FaTimes />
              </button>
            )}
          </div>
          
          <div className="explore-actions">
            {/* Location Button */}
            <button 
              className={`location-btn ${userLocation ? 'active' : ''} ${locationLoading ? 'loading' : ''}`}
              onClick={requestUserLocation}
              disabled={locationLoading}
              title={userLocation ? 'Location enabled' : 'Get my location'}
            >
              <FaLocationArrow />
              {locationLoading ? 'Getting...' : userLocation ? 'Located' : 'My Location'}
            </button>

            {/* Distance Sort Button */}
            {userLocation && (
              <button 
                className={`sort-btn ${sortByDistance ? 'active' : ''}`}
                onClick={() => setSortByDistance(!sortByDistance)}
                title="Sort by nearest distance"
              >
                <FaSort />
                {sortByDistance ? 'By Distance' : 'Sort Distance'}
              </button>
            )}

            <button 
              className="filters-toggle-btn"
              onClick={() => setShowFilters(!showFilters)}
            >
              <FaFilter /> Filters
            </button>
          </div>
        </div>

        {/* Location Error */}
        {locationError && (
          <div className="location-error">
            <span>📍</span>
            <span>{locationError}</span>
            <button onClick={requestUserLocation}>Try Again</button>
          </div>
        )}

        {showFilters && (
          <div className="filters-dropdown">
            <div className="filter-group">
              <label>Sector</label>
              <select 
                value={selectedSector} 
                onChange={(e) => setSelectedSector(e.target.value)}
              >
                {sectors.map(sector => (
                  <option key={sector} value={sector}>
                    {sector === 'all' ? 'All Sectors' : sector}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-stats">
              Showing {filteredIndustries.length} of {industries.length} industries
              {userLocation && sortByDistance && ' (sorted by distance)'}
            </div>
          </div>
        )}
      </div>

      {/* Map Container */}
      <div className="explore-map-container" ref={mapContainerRef}>
        {loading ? (
          <div className="map-loading">
            <div className="loading-spinner"></div>
            <p>Loading map...</p>
          </div>
        ) : error ? (
          <div className="map-error">
            <div className="error-icon">⚠️</div>
            <h3>Unable to Load Map</h3>
            <p>{error}</p>
            <button className="retry-btn" onClick={fetchIndustries}>
              Try Again
            </button>
          </div>
        ) : (
          <>
            {/* Mobile debug indicator */}
            {isMobile && (
              <div style={{
                position: 'absolute',
                top: '10px',
                left: '10px',
                background: 'rgba(10, 92, 47, 0.9)',
                color: 'white',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: '600',
                zIndex: 1000,
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
              }}>
                📱 Mobile Mode
              </div>
            )}

            {/* Always render MapContainer, show overlay for empty state */}
            <MapContainer
              key={mapKey}
              center={ethiopiaCenter}
              zoom={isMobile ? 6 : 7}
              scrollWheelZoom={!isMobile}
              touchZoom={true}
              dragging={true}
              tap={true}
              style={{ height: '100%', width: '100%' }}
              whenReady={() => {
                console.log('[Map] Map is ready');
                console.log('[Map] Mobile mode:', isMobile);
              }}
            >
              <MapResizeHandler />
              <MapViewController center={ethiopiaCenter} industries={filteredIndustries} />
              
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              {filteredIndustries.map((industry) => (
                <Marker
                  key={industry.id}
                  position={[industry.latitude, industry.longitude]}
                  icon={greenIcon}
                >
                  <Popup>
                    <div className="map-popup">
                      <div className="popup-header">
                        <FaIndustry className="popup-icon" />
                        <h3>{industry.company_name}</h3>
                      </div>
                      <div className="popup-content">
                        <p className="popup-sector">{industry.sector}</p>
                        <p className="popup-location">
                          <FaMapMarkerAlt /> {industry.location}
                        </p>
                        {industry.distance !== null && (
                          <p className="popup-distance">
                            📍 {formatDistance(industry.distance)}
                          </p>
                        )}
                        {industry.description && (
                          <p className="popup-description">
                            {industry.description.substring(0, 100)}...
                          </p>
                        )}
                      </div>
                      <button
                        className="popup-btn"
                        onClick={() => navigate(`/industry/${industry.id}`)}
                      >
                        View Products →
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>

            {/* Empty state overlay */}
            {filteredIndustries.length === 0 && (
              <div className="map-empty-overlay">
                <div className="empty-icon">🔍</div>
                <h3>No Industries Found</h3>
                <p>Try adjusting your search or filters</p>
                <button className="clear-filters-btn" onClick={() => {
                  setSearchQuery('');
                  setSelectedSector('all');
                }}>
                  Clear Filters
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Info Panel */}
      <div className="explore-info-panel">
        <div className="info-panel-content">
          <div className="info-stat">
            <span className="info-number">{filteredIndustries.length}</span>
            <span className="info-label">Industries Found</span>
          </div>
          <div className="info-divider"></div>
          <div className="info-stat">
            <span className="info-number">{sectors.length - 1}</span>
            <span className="info-label">Sectors</span>
          </div>
          <div className="info-divider"></div>
          <div className="info-stat">
            <span className="info-number">11</span>
            <span className="info-label">Regions</span>
          </div>
          {userLocation && (
            <>
              <div className="info-divider"></div>
              <div className="info-stat">
                <span className="info-number">📍</span>
                <span className="info-label">Location Enabled</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Industry List View */}
      {filteredIndustries.length > 0 && (
        <div className="explore-industry-list">
          <div className="industry-list-header">
            <h2>
              <FaIndustry /> Industries 
              {userLocation && sortByDistance && ' (Nearest First)'}
            </h2>
            <p>{filteredIndustries.length} industries found</p>
          </div>
          <div className="industry-grid">
            {filteredIndustries.map((industry) => (
              <div key={industry.id} className="industry-card" onClick={() => navigate(`/industry/${industry.id}`)}>
                <div className="industry-card-header">
                  <div className="industry-icon">
                    <FaIndustry />
                  </div>
                  <div className="industry-info">
                    <h3>{industry.company_name}</h3>
                    <p className="industry-sector">{industry.sector}</p>
                  </div>
                  {industry.distance !== null && (
                    <div className="industry-distance">
                      {formatDistance(industry.distance)}
                    </div>
                  )}
                </div>
                <div className="industry-card-body">
                  <p className="industry-location">
                    <FaMapMarkerAlt /> {industry.location}
                  </p>
                  {industry.description && (
                    <p className="industry-description">
                      {industry.description.substring(0, 120)}...
                    </p>
                  )}
                </div>
                <div className="industry-card-footer">
                  <span className="view-products-link">View Products →</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Explore;
