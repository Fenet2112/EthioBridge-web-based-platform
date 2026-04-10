import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  FaHome, 
  FaIndustry, 
  FaMapMarkerAlt, 
  FaFilter,
  FaSearch,
  FaTimes
} from 'react-icons/fa';
import Logo from '../components/Logo';
import DarkModeToggle from '../components/DarkModeToggle';
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

function Explore() {
  const navigate = useNavigate();
  const [industries, setIndustries] = useState([]);
  const [filteredIndustries, setFilteredIndustries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSector, setSelectedSector] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

  // Ethiopia center coordinates
  const ethiopiaCenter = [9.145, 40.489673];

  // Fetch industries with location data
  useEffect(() => {
    fetchIndustries();
  }, []);

  const fetchIndustries = async () => {
    try {
      setError(null);
      const response = await fetch(`${API_BASE_URL}/api/industries/explore`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch industries');
      }
      
      const data = await response.json();
      
      // Use real coordinates if available, otherwise generate mock coordinates
      const industriesWithCoords = data.map((industry, index) => ({
        ...industry,
        // Use real coordinates if available, otherwise mock around Ethiopia
        latitude: industry.latitude || (9.0 + (Math.random() * 2)),
        longitude: industry.longitude || (38.7 + (Math.random() * 2))
      }));
      
      setIndustries(industriesWithCoords);
      setFilteredIndustries(industriesWithCoords);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching industries:', error);
      setError('Failed to load industries. Please try again later.');
      // Set empty array on error to prevent crashes
      setIndustries([]);
      setFilteredIndustries([]);
      setLoading(false);
    }
  };

  // Filter industries
  useEffect(() => {
    let filtered = industries;

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

    setFilteredIndustries(filtered);
  }, [selectedSector, searchQuery, industries]);

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
          
          <button 
            className="filters-toggle-btn"
            onClick={() => setShowFilters(!showFilters)}
          >
            <FaFilter /> Filters
          </button>
        </div>

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
            </div>
          </div>
        )}
      </div>

      {/* Map Container */}
      <div className="explore-map-container">
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
        ) : filteredIndustries.length === 0 ? (
          <div className="map-empty">
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
        ) : (
          <MapContainer
            center={ethiopiaCenter}
            zoom={7}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%', minHeight: '600px' }}
            whenCreated={(map) => {
              console.log('Map created:', map);
              setTimeout(() => {
                map.invalidateSize();
              }, 100);
            }}
          >
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
        </div>
      </div>
    </div>
  );
}

export default Explore;
