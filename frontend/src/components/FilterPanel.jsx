import React, { useState, useEffect } from 'react';
import './FilterPanel.css';

/**
 * Reusable FilterPanel Component
 *
 * Features:
 * - Debounced search input
 * - Multiple filter types (dropdown, range, checkbox, text)
 * - Active filter tags with remove capability
 * - Apply/Reset functionality
 * - Responsive design
 */
const FilterPanel = ({
  filters = [],
  initialValues = {},
  onApply,
  onReset,
  onFilterChange,
  showApplyButton = true,
  showResetButton = true,
  layout = "sidebar", // 'sidebar' or 'horizontal'
  totalResults = 0,
  loading = false
}) => {
  // State for all filter values
  const [filterValues, setFilterValues] = useState({});
  const [activeFilters, setActiveFilters] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Update filter values when debounced search changes
  useEffect(() => {
    if (debouncedSearch !== undefined) {
      setFilterValues(prev => ({
        ...prev,
        search: debouncedSearch
      }));
    }
  }, [debouncedSearch]);

  // Initialize filter values from props
  useEffect(() => {
    setFilterValues(initialValues);
    if (initialValues.search) {
      setSearchInput(initialValues.search);
    }
  }, [initialValues]);

  // Update active filters list whenever filterValues change
  useEffect(() => {
    const active = [];

    if (filterValues.search) {
      active.push({
        key: 'search',
        label: `Search: "${filterValues.search}"`,
        value: filterValues.search
      });
    }

    if (filterValues.category) {
      active.push({
        key: 'category',
        label: `Category: ${filterValues.category}`,
        value: filterValues.category
      });
    }

    if (filterValues.sector) {
      active.push({
        key: 'sector',
        label: `Sector: ${filterValues.sector}`,
        value: filterValues.sector
      });
    }

    if (filterValues.location) {
      active.push({
        key: 'location',
        label: `Location: ${filterValues.location}`,
        value: filterValues.location
      });
    }

    if (filterValues.industry_id) {
      active.push({
        key: 'industry_id',
        label: `Industry: ${filterValues.industry_id}`,
        value: filterValues.industry_id
      });
    }

    if (filterValues.minPrice || filterValues.maxPrice) {
      const label = `Price: ${filterValues.minPrice || '0'} - ${filterValues.maxPrice || '∞'} ETB`;
      active.push({
        key: 'priceRange',
        label,
        value: { min: filterValues.minPrice, max: filterValues.maxPrice }
      });
    }

    if (filterValues.is_available !== undefined) {
      active.push({
        key: 'is_available',
        label: filterValues.is_available ? 'In Stock' : 'Out of Stock',
        value: filterValues.is_available
      });
    }

    if (filterValues.role) {
      active.push({
        key: 'role',
        label: `Role: ${filterValues.role}`,
        value: filterValues.role
      });
    }

    if (filterValues.status) {
      active.push({
        key: 'status',
        label: `Status: ${filterValues.status}`,
        value: filterValues.status
      });
    }

    setActiveFilters(active);
  }, [filterValues]);

  // Handle input change
  const handleChange = (key, value) => {
    setFilterValues(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Remove a specific active filter
  const removeFilter = (filterKey) => {
    if (filterKey === 'search') {
      setSearchInput('');
      setFilterValues(prev => {
        const updated = { ...prev };
        delete updated.search;
        return updated;
      });
    } else if (filterKey === 'priceRange') {
      setFilterValues(prev => {
        const updated = { ...prev };
        delete updated.minPrice;
        delete updated.maxPrice;
        return updated;
      });
    } else {
      setFilterValues(prev => {
        const updated = { ...prev };
        delete updated[filterKey];
        return updated;
      });
    }
  };

  // Clear all filters
  const handleReset = () => {
    setFilterValues({});
    setSearchInput('');
    if (onReset) onReset();
  };

  // Apply filters
  const handleApply = () => {
    if (onApply) {
      onApply(filterValues);
    }
    if (onFilterChange) {
      onFilterChange(filterValues);
    }
  };

  // Get unique categories from filters config
  const categories = filters.category?.options || [];
  const sectors = filters.sector?.options || [];

  return (
    <div className={`filter-panel ${layout}`}>
      {/* Active Filters Tags */}
      {activeFilters.length > 0 && (
        <div className="active-filters">
          <div className="active-filters-label">
            Active Filters ({activeFilters.length}):
          </div>
          <div className="active-filter-tags">
            {activeFilters.map(filter => (
              <span key={filter.key} className="filter-tag">
                {filter.label}
                <button
                  className="tag-remove"
                  onClick={() => removeFilter(filter.key)}
                  aria-label={`Remove ${filter.key} filter`}
                >
                  ×
                </button>
              </span>
            ))}
            <button
              className="clear-all-btn"
              onClick={handleReset}
            >
              Clear All
            </button>
          </div>
        </div>
      )}

      {/* Filter Controls */}
      <div className="filter-controls">
        {/* Search Input */}
        {filters.search !== false && (
          <div className="filter-group">
            <label htmlFor="filter-search">Keyword Search</label>
            <input
              id="filter-search"
              type="text"
              placeholder="Search products, industries..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="filter-input"
            />
          </div>
        )}

        {/* Category Dropdown */}
        {filters.category && (
          <div className="filter-group">
            <label htmlFor="filter-category">Category</label>
            <select
              id="filter-category"
              value={filterValues.category || ''}
              onChange={(e) => handleChange('category', e.target.value || undefined)}
              className="filter-select"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        )}

        {/* Sector Dropdown */}
        {filters.sector && (
          <div className="filter-group">
            <label htmlFor="filter-sector">Sector</label>
            <select
              id="filter-sector"
              value={filterValues.sector || ''}
              onChange={(e) => handleChange('sector', e.target.value || undefined)}
              className="filter-select"
            >
              <option value="">All Sectors</option>
              {sectors.map(sector => (
                <option key={sector} value={sector}>{sector}</option>
              ))}
            </select>
          </div>
        )}

        {/* Location Input */}
        {filters.location && (
          <div className="filter-group">
            <label htmlFor="filter-location">Location</label>
            <input
              id="filter-location"
              type="text"
              placeholder="City or region..."
              value={filterValues.location || ''}
              onChange={(e) => handleChange('location', e.target.value || undefined)}
              className="filter-input"
            />
          </div>
        )}

        {/* Industry Dropdown (for products) */}
        {filters.industry && (
          <div className="filter-group">
            <label htmlFor="filter-industry">Industry</label>
            <select
              id="filter-industry"
              value={filterValues.industry_id || ''}
              onChange={(e) => handleChange('industry_id', e.target.value ? parseInt(e.target.value) : undefined)}
              className="filter-select"
            >
              <option value="">All Industries</option>
              {filters.industry.options?.map(ind => (
                <option key={ind.id} value={ind.id}>{ind.company_name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Price Range */}
        {filters.priceRange && (
          <div className="filter-group price-range">
            <label>Price Range (ETB)</label>
            <div className="price-inputs">
              <input
                type="number"
                placeholder="Min"
                value={filterValues.minPrice || ''}
                onChange={(e) => handleChange('minPrice', e.target.value || undefined)}
                className="filter-input price-input"
                min="0"
              />
              <span className="price-separator">to</span>
              <input
                type="number"
                placeholder="Max"
                value={filterValues.maxPrice || ''}
                onChange={(e) => handleChange('maxPrice', e.target.value || undefined)}
                className="filter-input price-input"
                min="0"
              />
            </div>
          </div>
        )}

        {/* Availability Checkbox */}
        {filters.availability && (
          <div className="filter-group checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={filterValues.is_available || false}
                onChange={(e) => handleChange('is_available', e.target.checked || undefined)}
              />
              In Stock Only
            </label>
          </div>
        )}

        {/* Role Filter (Admin) */}
        {filters.role && (
          <div className="filter-group">
            <label htmlFor="filter-role">User Role</label>
            <select
              id="filter-role"
              value={filterValues.role || ''}
              onChange={(e) => handleChange('role', e.target.value || undefined)}
              className="filter-select"
            >
              <option value="">All Roles</option>
              <option value="stakeholder">Stakeholder</option>
              <option value="industry">Industry</option>
            </select>
          </div>
        )}

        {/* Status Filter (Admin) */}
        {filters.status && (
          <div className="filter-group">
            <label htmlFor="filter-status">Status</label>
            <select
              id="filter-status"
              value={filterValues.status || ''}
              onChange={(e) => handleChange('status', e.target.value || undefined)}
              className="filter-select"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="suspended">Suspended</option>
              <option value="banned">Banned</option>
            </select>
          </div>
        )}

        {/* Sorting Options */}
        {filters.sorting && (
          <div className="filter-group sort-group">
            <label htmlFor="filter-sort">Sort By</label>
            <select
              id="filter-sort"
              value={`${filterValues.sortBy || 'created_at'}-${filterValues.sortOrder || 'DESC'}`}
              onChange={(e) => {
                const [sortBy, sortOrder] = e.target.value.split('-');
                setFilterValues(prev => ({
                  ...prev,
                  sortBy,
                  sortOrder
                }));
              }}
              className="filter-select"
            >
              <option value="created_at-DESC">Newest First</option>
              <option value="created_at-ASC">Oldest First</option>
              <option value="price-ASC">Price: Low to High</option>
              <option value="price-DESC">Price: High to Low</option>
              <option value="name-ASC">Name: A-Z</option>
              <option value="name-DESC">Name: Z-A</option>
              {filters.sortBy?.includes('popularity') && (
                <option value="popularity_score-DESC">Most Popular</option>
              )}
            </select>
          </div>
        )}
      </div>

      {/* Results Count */}
      {totalResults > 0 && (
        <div className="results-count">
          {loading ? 'Loading...' : `${totalResults.toLocaleString()} results found`}
        </div>
      )}

      {/* Action Buttons */}
      {(showApplyButton || showResetButton) && (
        <div className="filter-actions">
          {showResetButton && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleReset}
            >
              Reset Filters
            </button>
          )}
          {showApplyButton && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleApply}
            >
              Apply Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default FilterPanel;
