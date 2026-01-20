'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { 
  MagnifyingGlassIcon, 
  FunnelIcon,
  EyeIcon,
  TrashIcon,
  CalendarIcon,
  ClipboardDocumentListIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CurrencyDollarIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  UsersIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { getProjectRequestPermissions, canChangeStatus } from '@/lib/projectRequestPermissions';

interface TeamMember {
  userId: string;
  proposedRole: string;
  skills: string[];
  availabilityHoursPerWeek: number;
}

interface Resource {
  resourceType: 'equipment' | 'software' | 'funding' | 'space' | 'other';
  description: string;
  estimatedCost: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface ProjectRequest {
  _id: string;
  title: string;
  description: string;
  objectives: string[];
  expectedOutcomes: string[];
  teamSize: number;
  estimatedDurationMonths: number;
  budgetEstimate: number;
  requiredResources: string[];
  mentorId?: string;
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'on_hold';
  submittedBy: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNotes?: string;
  approvalDate?: string;
  startDate?: string;
  endDate?: string;
  teamMembers: TeamMember[];
  resources: Resource[];
  createdAt: string;
  updatedAt: string;
  // Deleted project fields
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
}

interface ProjectRequestFilters {
  search: string;
  status: string;
  mentorId: string;
  submittedBy: string;
  showDeleted: boolean;
  deletedBy: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

interface ProjectRequestStats {
  total: number;
  pending: number;
  underReview: number;
  approved: number;
  rejected: number;
  onHold: number;
  deleted: number;
}

export default function ProjectRequestsPage() {
  const [projectRequests, setProjectRequests] = useState<ProjectRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id?: string; _id?: string; role?: string } | null>(null);
  const [filters, setFilters] = useState<ProjectRequestFilters>({
    search: '',
    status: '',
    mentorId: '',
    submittedBy: '',
    showDeleted: false,
    deletedBy: '',
    sortBy: 'deletedAt',
    sortOrder: 'desc'
  });
  const [showFilters, setShowFilters] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<ProjectRequestStats>({
    total: 0,
    pending: 0,
    underReview: 0,
    approved: 0,
    rejected: 0,
    onHold: 0,
    deleted: 0
  });
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]);

  // Get current user
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        setCurrentUser(user);
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
  }, []);

  const fetchDeletedCount = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return 0;

      // Get backend URL from environment
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://newton-botics-server-phi.vercel.app';
      console.log('Fetching deleted count from backend URL:', backendUrl);

      const response = await fetch(`${backendUrl}/api/project-requests/deleted?limit=1`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success) {
        return data.data.pagination?.total || 0;
      }
      return 0;
    } catch (err) {
      console.error('Error fetching deleted count:', err);
      return 0;
    }
  };

  const fetchProjectRequests = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setError('No authentication token found');
        return;
      }

      // Determine which endpoint to use
      const shouldUseDeletedEndpoint = filters.showDeleted || filters.status === 'deleted';
      
      const queryParams = new URLSearchParams();
      if (filters.search) queryParams.append('search', filters.search);
      
      // Only add status filter if we're not using the deleted endpoint or if status is not "deleted"
      if (filters.status && !(shouldUseDeletedEndpoint && filters.status === 'deleted')) {
        queryParams.append('status', filters.status);
      }
      
      if (filters.mentorId) queryParams.append('mentorId', filters.mentorId);
      if (filters.submittedBy) queryParams.append('submittedBy', filters.submittedBy);
      if (shouldUseDeletedEndpoint && filters.deletedBy) queryParams.append('deletedBy', filters.deletedBy);
      if (shouldUseDeletedEndpoint) {
        queryParams.append('sortBy', filters.sortBy);
        queryParams.append('sortOrder', filters.sortOrder);
      }
      queryParams.append('limit', '20');
      queryParams.append('skip', ((currentPage - 1) * 20).toString());

      // Get backend URL from environment
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://newton-botics-server-phi.vercel.app';
      console.log('Fetching project requests from backend URL:', backendUrl);

      // Use different endpoint based on whether we're showing deleted projects or filtering by deleted status
      const endpoint = shouldUseDeletedEndpoint ? '/api/project-requests/deleted' : '/api/project-requests';
      const response = await fetch(`${backendUrl}${endpoint}?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        const items = data.data.items || [];
        setProjectRequests(items);
        
        // Calculate pagination
        const pagination = data.data.pagination || {};
        setTotalCount(pagination.total || 0);
        setTotalPages(Math.ceil((pagination.total || 0) / 20));
        
        // Calculate stats
        const deletedCount = await fetchDeletedCount();
        const newStats = {
          total: pagination.total || 0,
          pending: items.filter((r: ProjectRequest) => r.status === 'pending' && !r.isDeleted).length,
          underReview: items.filter((r: ProjectRequest) => r.status === 'under_review' && !r.isDeleted).length,
          approved: items.filter((r: ProjectRequest) => r.status === 'approved' && !r.isDeleted).length,
          rejected: items.filter((r: ProjectRequest) => r.status === 'rejected' && !r.isDeleted).length,
          onHold: items.filter((r: ProjectRequest) => r.status === 'on_hold' && !r.isDeleted).length,
          deleted: deletedCount
        };
        setStats(newStats);
      } else {
        setError(data.message || 'Failed to fetch project requests');
      }
    } catch (err) {
      console.error('Error fetching project requests:', err);
      setError('Failed to fetch project requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectRequests();
  }, [currentPage, filters]);

  const handleFilterChange = (key: keyof ProjectRequestFilters, value: string | boolean) => {
    const newFilters = { ...filters, [key]: value };
    
    // Auto-enable showDeleted when status is set to "deleted"
    if (key === 'status' && value === 'deleted') {
      newFilters.showDeleted = true;
    }
    // Auto-disable showDeleted when status is changed from "deleted" to something else
    else if (key === 'status' && value !== 'deleted' && filters.status === 'deleted') {
      newFilters.showDeleted = false;
    }
    
    setFilters(newFilters);
    setCurrentPage(1);
  };

  const handleDeleteProjectRequest = async (requestId: string) => {
    if (!confirm('Are you sure you want to delete this project request?')) return;

    try {
      const token = localStorage.getItem('accessToken');
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://newton-botics-server-phi.vercel.app';
      const response = await fetch(`${backendUrl}/api/project-requests/${requestId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        setProjectRequests(prev => prev.filter(r => r._id !== requestId));
        setSelectedRequests(prev => prev.filter(id => id !== requestId));
        fetchProjectRequests(); // Refresh to update stats
      } else {
        alert(data.message || 'Failed to delete project request');
      }
    } catch (err) {
      console.error('Error deleting project request:', err);
      alert('Failed to delete project request');
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://newton-botics-server-phi.vercel.app';
      const response = await fetch(`${backendUrl}/api/project-requests/${requestId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        fetchProjectRequests(); // Refresh to update status
        alert('Project request approved successfully');
      } else {
        alert(data.message || 'Failed to approve project request');
      }
    } catch (err) {
      console.error('Error approving project request:', err);
      alert('Failed to approve project request');
    }
  };

  const handleRejectRequest = async (requestId: string, reason: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://newton-botics-server-phi.vercel.app';
      const response = await fetch(`${backendUrl}/api/project-requests/${requestId}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      });

      const data = await response.json();

      if (data.success) {
        fetchProjectRequests(); // Refresh to update status
        alert('Project request rejected');
      } else {
        alert(data.message || 'Failed to reject project request');
      }
    } catch (err) {
      console.error('Error rejecting project request:', err);
      alert('Failed to reject project request');
    }
  };

  const handleUpdateStatus = async (requestId: string, status: string, reviewNotes?: string) => {
    try {
      const request = projectRequests.find(r => r._id === requestId);
      if (request && !canChangeStatus(request, currentUser)) {
        alert('You do not have permission to change the status of this project request. Only administrators can modify approved projects.');
        return;
      }

      const token = localStorage.getItem('accessToken');
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://newton-botics-server-phi.vercel.app';
      console.log('Updating status to:', status, 'for request:', requestId);
      
      const response = await fetch(`${backendUrl}/api/project-requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          status,
          reviewNotes: reviewNotes || undefined
        })
      });

      console.log('Status update response:', response.status);
      const data = await response.json();
      console.log('Status update data:', data);

      if (data.success) {
        fetchProjectRequests(); // Refresh to update status
        alert(`Status updated to ${status} successfully`);
      } else {
        console.error('Status update failed:', data);
        // Check for access denied error
        if (response.status === 403) {
          const message = data.message || 'Access denied';
          if (message.includes('approved project requests') || message.includes('change status of approved')) {
            alert('Cannot change status of approved project requests. Only administrators can modify the status of approved projects.');
          } else {
            alert(message);
          }
        } else {
          alert(data.message || 'Failed to update status');
        }
      }
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update status');
    }
  };

  const handleSelectRequest = (requestId: string) => {
    setSelectedRequests(prev => 
      prev.includes(requestId) 
        ? prev.filter(id => id !== requestId)
        : [...prev, requestId]
    );
  };

  const handleSelectAll = () => {
    if (selectedRequests.length === projectRequests.length) {
      setSelectedRequests([]);
    } else {
      setSelectedRequests(projectRequests.map(r => r._id));
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedRequests.length === 0) {
      alert('Please select at least one project request');
      return;
    }

    const confirmMessage = `Are you sure you want to ${action} ${selectedRequests.length} project request(s)?`;
    if (!confirm(confirmMessage)) return;

    try {
      const token = localStorage.getItem('accessToken');
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://newton-botics-server-phi.vercel.app';
      
      for (const requestId of selectedRequests) {
        let url = `${backendUrl}/api/project-requests/${requestId}`;
        let method: 'PUT' | 'POST' | 'DELETE' = 'PUT';
        let body: Record<string, unknown> = {};

        switch (action) {
          case 'approve':
            url = `${backendUrl}/api/project-requests/${requestId}/approve`;
            method = 'POST';
            body = {};
            break;
          case 'reject':
            url = `${backendUrl}/api/project-requests/${requestId}/reject`;
            method = 'POST';
            body = { reason: 'Bulk rejection' };
            break;
          case 'under_review':
            body = { status: 'under_review' };
            break;
          case 'on_hold':
            body = { status: 'on_hold' };
            break;
          case 'pending':
            body = { status: 'pending' };
            break;
          case 'delete':
            method = 'DELETE';
            body = {};
            break;
        }

        const response = await fetch(url, {
          method,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error(`Failed to ${action} request ${requestId}:`, errorData.message);
        }
      }

      setSelectedRequests([]);
      fetchProjectRequests(); // Refresh to update status
      alert(`Bulk ${action} completed`);
    } catch (err) {
      console.error(`Error performing bulk ${action}:`, err);
      alert(`Failed to perform bulk ${action}`);
    }
  };

  const getStatusColor = (status: string | undefined) => {
    if (!status) return 'bg-gray-100 text-gray-800';
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'under_review': return 'bg-blue-100 text-blue-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'on_hold': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading && projectRequests.length === 0) {
    return (
      <AdminLayout pageTitle="Project Requests">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout pageTitle="Project Requests">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Project Requests</h1>
            <p className="text-gray-600">Review and manage project requests</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={fetchProjectRequests}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 flex items-center space-x-2"
            >
              <ArrowPathIcon className="w-5 h-5" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-7 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ClipboardDocumentListIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Requests</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <ClockIcon className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ExclamationTriangleIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Under Review</p>
                <p className="text-2xl font-bold text-gray-900">{stats.underReview}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircleIcon className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Approved</p>
                <p className="text-2xl font-bold text-gray-900">{stats.approved}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <XCircleIcon className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Rejected</p>
                <p className="text-2xl font-bold text-gray-900">{stats.rejected}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Cog6ToothIcon className="w-6 h-6 text-gray-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">On Hold</p>
                <p className="text-2xl font-bold text-gray-900">{stats.onHold}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <TrashIcon className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Deleted</p>
                <p className="text-2xl font-bold text-gray-900">{stats.deleted}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Filters</h3>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
            >
              <FunnelIcon className="w-5 h-5" />
              <span>Toggle Filters</span>
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                <div className="relative">
                  <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    placeholder="Search requests..."
                    className="pl-10 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="under_review">Under Review</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="on_hold">On Hold</option>
                  <option value="deleted">Deleted</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mentor</label>
                <input
                  type="text"
                  value={filters.mentorId}
                  onChange={(e) => handleFilterChange('mentorId', e.target.value)}
                  placeholder="Filter by mentor..."
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Submitted By</label>
                <input
                  type="text"
                  value={filters.submittedBy}
                  onChange={(e) => handleFilterChange('submittedBy', e.target.value)}
                  placeholder="Filter by submitter..."
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Show Deleted</label>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.showDeleted}
                    onChange={(e) => handleFilterChange('showDeleted', e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Include deleted projects</span>
                </div>
              </div>

              {filters.showDeleted && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Deleted By</label>
                    <input
                      type="text"
                      value={filters.deletedBy}
                      onChange={(e) => handleFilterChange('deletedBy', e.target.value)}
                      placeholder="Filter by who deleted..."
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                    <select
                      value={filters.sortBy}
                      onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="deletedAt">Deleted Date</option>
                      <option value="submittedAt">Submitted Date</option>
                      <option value="title">Title</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Sort Order</label>
                    <select
                      value={filters.sortOrder}
                      onChange={(e) => handleFilterChange('sortOrder', e.target.value as 'asc' | 'desc')}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="desc">Newest First</option>
                      <option value="asc">Oldest First</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Bulk Actions */}
        {selectedRequests.length > 0 && !filters.showDeleted && filters.status !== 'deleted' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-blue-900">
                  {selectedRequests.length} request(s) selected
                </span>
                <button
                  onClick={() => setSelectedRequests([])}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Clear selection
                </button>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleBulkAction('approve')}
                  className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 flex items-center space-x-1"
                >
                  <CheckCircleIcon className="w-4 h-4" />
                  <span>Approve</span>
                </button>
                <button
                  onClick={() => handleBulkAction('reject')}
                  className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 flex items-center space-x-1"
                >
                  <XCircleIcon className="w-4 h-4" />
                  <span>Reject</span>
                </button>
                <button
                  onClick={() => handleBulkAction('under_review')}
                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 flex items-center space-x-1"
                >
                  <ExclamationTriangleIcon className="w-4 h-4" />
                  <span>Under Review</span>
                </button>
                <button
                  onClick={() => handleBulkAction('on_hold')}
                  className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700 flex items-center space-x-1"
                >
                  <Cog6ToothIcon className="w-4 h-4" />
                  <span>On Hold</span>
                </button>
                <button
                  onClick={() => handleBulkAction('pending')}
                  className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700 flex items-center space-x-1"
                >
                  <ClockIcon className="w-4 h-4" />
                  <span>Reset to Pending</span>
                </button>
                <button
                  onClick={() => handleBulkAction('delete')}
                  className="bg-red-800 text-white px-3 py-1 rounded text-sm hover:bg-red-900 flex items-center space-x-1"
                >
                  <TrashIcon className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Project Requests Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {!(filters.showDeleted || filters.status === 'deleted') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <input
                        type="checkbox"
                        checked={selectedRequests.length === projectRequests.length && projectRequests.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Request
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Team Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Budget
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {projectRequests.map((request) => (
                  <tr key={request._id} className={`hover:bg-gray-50 ${request.isDeleted ? 'bg-red-50 opacity-75' : ''}`}>
                    {!(filters.showDeleted || filters.status === 'deleted') && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedRequests.includes(request._id)}
                          onChange={() => handleSelectRequest(request._id)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{request.title || 'Untitled'}</div>
                        <div className="text-sm text-gray-500 truncate max-w-xs">
                          {request.description || 'No description'}
                        </div>
                        {request.objectives && request.objectives.length > 0 && (
                          <div className="flex items-center mt-1">
                            <DocumentTextIcon className="w-4 h-4 text-gray-400 mr-1" />
                            <span className="text-xs text-gray-500">{request.objectives.length} objectives</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {request.isDeleted ? (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                          DELETED
                        </span>
                      ) : (
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(request.status)}`}>
                          {request.status ? request.status.replace('_', ' ').toUpperCase() : 'UNKNOWN'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <UsersIcon className="w-4 h-4 mr-1" />
                        {request.teamSize || 0} members
                      </div>
                      {request.teamMembers && request.teamMembers.length > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          {request.teamMembers.length} proposed
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <CalendarDaysIcon className="w-4 h-4 mr-1" />
                        {request.estimatedDurationMonths || 0} months
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <CurrencyDollarIcon className="w-4 h-4 mr-1" />
                        {request.budgetEstimate ? `$${request.budgetEstimate.toLocaleString()}` : 'Not specified'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <CalendarIcon className="w-4 h-4 mr-1" />
                        {formatDate(request.submittedAt || request.createdAt)}
                      </div>
                      {request.isDeleted && request.deletedAt && (
                        <div className="text-xs text-red-600 mt-1">
                          Deleted: {formatDate(request.deletedAt)}
                          {request.deletedBy && (
                            <span className="ml-1">by {request.deletedBy}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <a 
                          href={`/project-requests/${request._id}`}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="View Details"
                        >
                          <EyeIcon className="w-5 h-5" />
                        </a>
                        
                        {!request.isDeleted && (() => {
                          const permissions = getProjectRequestPermissions(request, currentUser);
                          
                          return (
                            <>
                              {/* Approve Button - Only show if user can change status and not already approved */}
                              {permissions.canChangeStatus && request.status !== 'approved' && (
                                <button 
                                  onClick={() => handleApproveRequest(request._id)}
                                  className="text-green-600 hover:text-green-900"
                                  title="Approve"
                                >
                                  <CheckCircleIcon className="w-5 h-5" />
                                </button>
                              )}
                              
                              {/* Reject Button - Only show if user can change status and not already rejected */}
                              {permissions.canChangeStatus && request.status !== 'rejected' && (
                                <button 
                                  onClick={() => {
                                    const reason = prompt('Reason for rejection:');
                                    if (reason) handleRejectRequest(request._id, reason);
                                  }}
                                  className="text-red-600 hover:text-red-900"
                                  title="Reject"
                                >
                                  <XCircleIcon className="w-5 h-5" />
                                </button>
                              )}
                              
                              {/* Status Change Buttons - Only show if user can change status */}
                              {permissions.canChangeStatus && request.status !== 'under_review' && (
                                <button 
                                  onClick={() => handleUpdateStatus(request._id, 'under_review')}
                                  className="text-blue-600 hover:text-blue-900"
                                  title="Put Under Review"
                                >
                                  <ExclamationTriangleIcon className="w-5 h-5" />
                                </button>
                              )}
                              
                              {permissions.canChangeStatus && request.status !== 'on_hold' && (
                                <button 
                                  onClick={() => handleUpdateStatus(request._id, 'on_hold')}
                                  className="text-gray-600 hover:text-gray-900"
                                  title="Put On Hold"
                                >
                                  <Cog6ToothIcon className="w-5 h-5" />
                                </button>
                              )}
                              
                              {permissions.canChangeStatus && request.status !== 'pending' && (
                                <button 
                                  onClick={() => handleUpdateStatus(request._id, 'pending')}
                                  className="text-yellow-600 hover:text-yellow-900"
                                  title="Reset to Pending"
                                >
                                  <ClockIcon className="w-5 h-5" />
                                </button>
                              )}
                              
                              {/* Admin can always change status, including on approved projects */}
                              {currentUser?.role === 'admin' && request.status === 'approved' && (
                                <button 
                                  onClick={() => {
                                    const newStatus = prompt('Enter new status (pending, under_review, rejected, on_hold):');
                                    if (newStatus && ['pending', 'under_review', 'rejected', 'on_hold'].includes(newStatus)) {
                                      handleUpdateStatus(request._id, newStatus);
                                    }
                                  }}
                                  className="text-indigo-600 hover:text-indigo-900"
                                  title="Change Status (Admin Only)"
                                >
                                  <Cog6ToothIcon className="w-5 h-5" />
                                </button>
                              )}
                              
                              {/* Delete Button - Only show if user has permission */}
                              {permissions.canDelete && (
                                <button 
                                  onClick={() => handleDeleteProjectRequest(request._id)}
                                  className="text-red-800 hover:text-red-900"
                                  title="Delete"
                                >
                                  <TrashIcon className="w-5 h-5" />
                                </button>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{(currentPage - 1) * 20 + 1}</span> to{' '}
                    <span className="font-medium">{Math.min(currentPage * 20, totalCount)}</span> of{' '}
                    <span className="font-medium">{totalCount}</span> results
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          page === currentPage
                            ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}






