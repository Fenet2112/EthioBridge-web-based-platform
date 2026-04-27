import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import GlobalNav from '../components/GlobalNav';
import FilterPanel from '../components/FilterPanel';
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
    const timer = setTimeout(() => {
      map.invalidateSize();
      console.log('[Map] Size invalidated on mount');
    }, 100);

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
      const bounds = industries.map(ind => [ind.latitude, ind.longitude]);
      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
      }
    } else {
      map.setView(center, 7);
    }
  }, [industries, center, map]);

  return null;
}

function Explore() {
  const navigate = useNavigate();
  const [industries, setIndustries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const mapContainerRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);

  // Location and distance states
  const [userLocation, setUserLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [sortByDistance, setSortByDistance] = useState(false);

  // Filter state
  const [currentFilters, setCurrentFilters] = useState({});
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
      setIsMobile(mobile);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Ethiopia center coordinates
  const ethiopiaCenter = [9.145, 40.489673];

  // Fetch industries with server-side filtering
  const fetchIndustries = useCallback(async (filters = {}, page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', '20');

      if (filters.sector) params.append('sector', filters.sector);
      if (filters.location) params.append('location', filters.location);
      if (filters.minProducts) params.append('minProducts', filters.minProducts);
      if (filters.maxProducts) params.append('maxProducts', filters.maxProducts);
      if (filters.search) params.append('search', filters.search);
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${API_BASE_URL}/api/industries/explore?${params.toString()}`, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to fetch industries (${response.status})`);
      }

      const data = await response.json();
      console.log('[Explore] Received', data.industries?.length || 0, 'industries');

      const industriesData = data.industries || [];

      // Use real coordinates if available, otherwise generate mock coordinates
      const industriesWithCoords = industriesData.map((industry, index) => ({
        ...industry,
        latitude: industry.latitude || (9.0 + (Math.random() * 2)),
        longitude: industry.longitude || (38.7 + (Math.random() * 2))
      }));

      // Add distance information if user location is available
      const industriesWithDistance = userLocation
        ? addDistanceToIndustries(industriesWithCoords, userLocation)
        : industriesWithCoords;

      setIndustries(industriesWithDistance);
      setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
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
      setIndustries([]);
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, userLocation]);

  // Request user's current location
  const requestUserLocation = async () => {
    setLocationLoading(true);
    setLocationError(null);
    try {
      console.log('[Explore] Requesting user location...');
      const location = await getUserLocation();
      console.log('[Explore] User location obtained:', location);
      setUserLocation(location);
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
    }
  }, [userLocation]);

  // Initial fetch
  useEffect(() => {
    fetchIndustries(currentFilters, 1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply filters (server-side)
  const handleApplyFilters = (filters) => {
    setCurrentFilters(filters);
    fetchIndustries(filters, 1);
  };

  // Reset filters
  const handleResetFilters = () => {
    setCurrentFilters({});
    fetchIndustries({}, 1);
  };

  // Handle pagination
  const handlePageChange = (newPage) => {
    fetchIndustries(currentFilters, newPage);
  };

  // Get unique sectors from current industries (for filter dropdown)
  const sectors = ['all', ...new Set(industries.map(ind => ind.sector).filter(Boolean))];

  // Filter and sort industries for display
  const displayIndustries = React.useMemo(() => {
    let result = [...industries];

    // Sort by distance if enabled and user location is available
    if (sortByDistance && userLocation) {
      result = sortIndustriesByDistance(result, userLocation);
    }

    return result;
  }, [industries, sortByDistance, userLocation]);

  return (
    <div className="explore-page">
      <GlobalNav />

      {/* Header */}
      <div className="explore-header">
        <div className="explore-header-content">
          <h1><FaMapMarkerAlt /> Explore Industries</h1>
          <p>Discover construction industries across Ethiopia</p>
        </div>
      </div>

      {/* Filters Section */}
      <div className="explore-filters-section">
        <div className="explore-filters-header">
          <button
            className="toggle-filters-btn"
            onClick={() => setShowFilters(!showFilters)}
          >
            <FaFilter /> {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
          <div className="filter-stats">
            {loading ? 'Loading...' : `${pagination.total || industries.length} industries found`}
          </div>
        </div>

        {showFilters && (
          <div className="explore-filter-panel">
            <FilterPanel
              filters={{
                search: true,
                sector: { options: sectors.filter(s => s !== 'all') },
                location: true,
                priceRange: false, // Not applicable for industries
                sorting: {
                  options: [
                    { value: 'created_at-DESC', label: 'Newest First' },
                    { value: 'created_at-ASC', label: 'Oldest First' },
                    { value: 'popularity_score-DESC', label: 'Most Popular' },
                    { value: 'product_count-DESC', label: 'Most Products' },
                    { value: 'company_name-ASC', label: 'Name A-Z' },
                  ]
                }
              }}
              initialValues={{
                ...currentFilters,
                sortBy: currentFilters.sortBy || 'created_at',
                sortOrder: currentFilters.sortOrder || 'DESC'
              }}
              onApply={handleApplyFilters}
              onReset={handleResetFilters}
              layout="horizontal"
              totalResults={pagination.total || 0}
              loading={loading}
            />
          </div>
        )}
      </div>

      {/* Map Container */}
      <div className="explore-map-container" ref={mapContainerRef}>
        {loading && industries.length === 0 ? (
          <div className="map-loading">
            <div className="loading-spinner"></div>
            <p>Loading map...</p>
          </div>
        ) : error ? (
          <div className="map-error">
            <div className="error-icon">⚠️</div>
            <h3>Unable to Load Map</h3>
            <p>{error}</p>
            <button className="retry-btn" onClick={() => fetchIndustries(currentFilters, 1)}>
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

            <MapContainer
              key={mapKey}
              center={ethiopiaCenter}
              zoom={isMobile ? 6 : 7}
              scrollWheelZoom={!isMobile}
              touchZoom={true}
              dragging={true}
              tap={true}
              style={{ height: '100%', width: '100%' }}
            >
              <MapResizeHandler />
              <MapViewController center={ethiopiaCenter} industries={displayIndustries} />

              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {displayIndustries.map((industry) => (
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
            {displayIndustries.length === 0 && !loading && (
              <div className="map-empty-overlay">
                <div className="empty-icon">🔍</div>
                <h3>No Industries Found</h3>
                <p>Try adjusting your search or filters</p>
                <button className="clear-filters-btn" onClick={handleResetFilters}>
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
            <span className="info-number">{displayIndustries.length}</span>
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
      {displayIndustries.length > 0 && (
        <div className="explore-industry-list">
          <div className="industry-list-header">
            <h2>
              <FaIndustry /> Industries
              {userLocation && sortByDistance && ' (Nearest First)'}
            </h2>
            <p>{displayIndustries.length} industries found</p>
          </div>
          <div className="industry-grid">
            {displayIndustries.map((industry) => (
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

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="pagination">
              <button
                className="pagination-btn"
                disabled={!pagination.hasPrev}
                onClick={() => handlePageChange(pagination.page - 1)}
              >
                ← Previous
              </button>
              <span className="pagination-info">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                className="pagination-btn"
                disabled={!pagination.hasNext}
                onClick={() => handlePageChange(pagination.page + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Explore;
