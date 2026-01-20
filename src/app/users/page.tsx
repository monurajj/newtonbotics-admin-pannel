'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { 
  MagnifyingGlassIcon,
  FunnelIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  UserPlusIcon,
  ChartBarIcon,
  UsersIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import UserDetailModal from '../../components/UserDetailModal';
import EditUserModal from '../../components/EditUserModal';
import AdminLayout from '../../components/AdminLayout';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  studentId?: string;
  department?: string;
  yearOfStudy?: number;
  phone?: string;
  isActive: boolean;
  emailVerified: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
  profileImageUrl?: string;
  bio?: string;
  skills?: string[];
  permissions?: string[];
  preferences?: {
    notifications: boolean;
    newsletter: boolean;
  };
}

interface Pagination {
  total: number;
  limit: number;
  skip: number;
  hasMore: boolean;
}

interface UserStatistics {
  totalUsers: number;
  activeUsers: number;
  verifiedUsers: number;
  roleDistribution: Array<{
    role: string;
    count: number;
  }>;
}

const USERS_PER_PAGE = 20;

export default function Users() {
  const [allUsers, setAllUsers] = useState<User[]>([]); // Store all users
  const [users, setUsers] = useState<User[]>([]); // Displayed users (paginated)
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    limit: USERS_PER_PAGE,
    skip: 0,
    hasMore: false
  });
  const [statistics, setStatistics] = useState<UserStatistics | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'deactivated'>('active');
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Modal
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    // Reset to page 1 when filters change
    setCurrentPage(1);
  }, [searchQuery, selectedRole, selectedDepartment, activeTab]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Fetch all users at once
  const fetchUsers = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        window.location.href = '/';
        return;
      }

      setErrorMessage(null);
      setIsLoading(true);

      const basePath = activeTab === 'active' ? '/api/users' : '/api/users/deactivated';
      
      // Fetch all users with pagination
      let allFetchedUsers: User[] = [];
      const limit = 100; // Fetch in batches of 100
      let skip = 0;
      let hasMore = true;

      while (hasMore) {
        const params = new URLSearchParams({
          limit: limit.toString(),
          skip: skip.toString()
        });

        const response = await fetch(`${basePath}?${params}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => null);
          const retryAfter = response.headers.get('Retry-After');
          if (response.status === 429) {
            const retryText = retryAfter ? `${retryAfter} seconds` : 'a moment';
            setErrorMessage(`Too many requests. Please wait ${retryText} and try again.`);
          } else {
            const message = errorBody?.message || errorBody?.error || 'Failed to fetch users';
            setErrorMessage(message);
          }
          console.error('Failed to fetch users', { status: response.status, body: errorBody });
          break;
        }

        const data = await response.json();
        const rawUsers = data.data?.users || data.data?.items || data.users || [];
        
        // Normalize user IDs to handle both id and _id fields
        const normalizedUsers = rawUsers.map((user: Record<string, unknown>) => {
          const resolvedId = typeof user.id === 'string' && user.id
            ? user.id
            : typeof (user as { _id?: string })._id === 'string' && (user as { _id?: string })._id
              ? (user as { _id?: string })._id
              : '';
          return {
            ...user,
            id: resolvedId || undefined,
            _id: (user as { _id?: string })._id || resolvedId || undefined,
          } as User;
        }).filter((user: User) => user.id); // Filter out users without valid IDs
        
        if (normalizedUsers.length === 0) {
          hasMore = false;
        } else {
          allFetchedUsers = [...allFetchedUsers, ...normalizedUsers];
          const pagination = data.data?.pagination;
          hasMore = pagination?.hasMore || normalizedUsers.length === limit;
          skip += limit;
        }
      }

      setAllUsers(allFetchedUsers);
      setErrorMessage(null);
    } catch (error) {
      console.error('Error fetching users:', error);
      setErrorMessage('Unable to load users. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  // Filter and paginate users on the frontend
  useEffect(() => {
    let filtered = [...allUsers];

    // Apply search filter
    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(user =>
        `${user.firstName} ${user.lastName}`.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.studentId?.toLowerCase().includes(query)
      );
    }

    // Apply role filter
    if (selectedRole) {
      filtered = filtered.filter(user => user.role === selectedRole);
    }

    // Apply department filter
    if (selectedDepartment) {
      filtered = filtered.filter(user => user.department === selectedDepartment);
    }

    // Calculate pagination
    const total = filtered.length;
    const totalPages = Math.ceil(total / USERS_PER_PAGE);
    const startIndex = (currentPage - 1) * USERS_PER_PAGE;
    const endIndex = startIndex + USERS_PER_PAGE;
    const paginatedUsers = filtered.slice(startIndex, endIndex);

    setUsers(paginatedUsers);
    setPagination({
      total,
      limit: USERS_PER_PAGE,
      skip: startIndex,
      hasMore: endIndex < total
    });
  }, [allUsers, debouncedSearchQuery, selectedRole, selectedDepartment, currentPage]);

  const fetchStatistics = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch(`/api/users/statistics`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStatistics(data.data.statistics);
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  // Extract departments and roles from allUsers
  useEffect(() => {
    if (allUsers.length > 0) {
      const uniqueDepartments = [...new Set(allUsers.map(u => u.department).filter(Boolean))].sort() as string[];
      const uniqueRoles = [...new Set(allUsers.map(u => u.role).filter(Boolean))].sort() as string[];
      setDepartments(uniqueDepartments);
      setRoles(uniqueRoles);
    }
  }, [allUsers]);

  useEffect(() => {
    fetchUsers();
    fetchStatistics();
  }, [fetchUsers, fetchStatistics]);

  const handleDeactivateUser = async (userId: string) => {
    if (!confirm('Are you sure you want to deactivate this user?')) return;

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Refresh users list
        fetchUsers();
        fetchStatistics();
      } else {
        alert('Failed to deactivate user');
      }
    } catch (error) {
      console.error('Error deactivating user:', error);
      alert('Error deactivating user');
    }
  };

  const handleReactivateUser = async (userId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch(`/api/users/${userId}/reactivate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Refresh users list
        fetchUsers();
        fetchStatistics();
      } else {
        alert('Failed to reactivate user');
      }
    } catch (error) {
      console.error('Error reactivating user:', error);
      alert('Error reactivating user');
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedRole('');
    setSelectedDepartment('');
    setCurrentPage(1);
  };

  const handleViewUser = async (user: User) => {
    // Navigate to the user detail page
    window.location.href = `/users/${user.id}`;
  };

  const handleEditUser = (user: User) => {
    console.log('Edit user clicked:', user);
    setSelectedUser(user);
    setIsEditModalOpen(true);
    console.log('Modal state set:', { selectedUser: user, isEditModalOpen: true });
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedUser(null);
  };

  const handleSaveUser = (updatedUser: User) => {
    // Update the user in the list
    setUsers(prevUsers => 
      prevUsers.map(user => 
        user.id === updatedUser.id ? updatedUser : user
      )
    );
    // Refresh statistics
    fetchStatistics();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout pageTitle="User Management">
      <div className="max-w-7xl mx-auto">
        {/* Add User Button */}
        <div className="mb-6 flex justify-end">
          <button className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors">
            <UserPlusIcon className="w-4 h-4" />
            <span>Add User</span>
          </button>
        </div>

        {/* Statistics Cards */}
        {!isLoadingStats && statistics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <UsersIcon className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Users</p>
                  <p className="text-2xl font-bold text-gray-900">{statistics.totalUsers}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircleIcon className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Active Users</p>
                  <p className="text-2xl font-bold text-gray-900">{statistics.activeUsers}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <CheckCircleIcon className="w-6 h-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Verified Users</p>
                  <p className="text-2xl font-bold text-gray-900">{statistics.verifiedUsers}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <ChartBarIcon className="w-6 h-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Roles</p>
                  <p className="text-2xl font-bold text-gray-900">{statistics.roleDistribution.length}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs + Search and Filters */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-6">
            {/* Tabs */}
            <div className="mb-4 border-b border-gray-200">
              <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab('active')}
                  className={`whitespace-nowrap py-4 px-1 border-b-2 text-sm font-medium ${
                    activeTab === 'active'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Active Users
                </button>
                <button
                  onClick={() => setActiveTab('deactivated')}
                  className={`whitespace-nowrap py-4 px-1 border-b-2 text-sm font-medium ${
                    activeTab === 'deactivated'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Deactivated Users
                </button>
              </nav>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search users by name, email, or student ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors ${
                  showFilters
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                <FunnelIcon className="w-4 h-4" />
                <span>Filters</span>
              </button>

              {/* Clear Filters */}
              {(searchQuery || selectedRole || selectedDepartment) && (
                <button
                  onClick={clearFilters}
                  className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  <ArrowPathIcon className="w-4 h-4" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">All Roles</option>
                      {roles.map((role) => (
                        <option key={role} value={role}>
                          {role.charAt(0).toUpperCase() + role.slice(1).replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                    <select
                      value={selectedDepartment}
                      onChange={(e) => setSelectedDepartment(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">All Departments</option>
                      {departments.map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          {user.profileImageUrl ? (
                            <Image
                              className="h-10 w-10 rounded-full object-cover"
                              src={user.profileImageUrl}
                              alt={`${user.firstName} ${user.lastName}`}
                              width={40}
                              height={40}
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center">
                              <span className="text-white text-sm font-medium">
                                {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                          {user.studentId && (
                            <div className="text-xs text-gray-400">ID: {user.studentId}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.email === 'monu2feb2004@gmail.com' ? (
                        <span className="inline-flex px-3 py-1 text-xs font-bold rounded-full bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg animate-pulse">
                          Super Admin
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          {user.role.replace('_', ' ')}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.department || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                        {user.emailVerified && (
                          <CheckCircleIcon className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={() => handleViewUser(user)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        {user.email !== 'monu2feb2004@gmail.com' && (
                          <button 
                            onClick={() => handleEditUser(user)}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                        )}
                        {user.email !== 'monu2feb2004@gmail.com' && (
                          user.isActive ? (
                            <button
                              onClick={() => handleDeactivateUser(user.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleReactivateUser(user.id)}
                              className="text-green-600 hover:text-green-900"
                            >
                              <ArrowPathIcon className="w-4 h-4" />
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.total > 0 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage((prev) => prev + 1)}
                  disabled={!pagination.hasMore}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{pagination.skip + 1}</span> to{' '}
                    <span className="font-medium">
                      {Math.min(pagination.skip + pagination.limit, pagination.total)}
                    </span>{' '}
                    of <span className="font-medium">{pagination.total}</span> results
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronLeftIcon className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setCurrentPage((prev) => prev + 1)}
                      disabled={!pagination.hasMore}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronRightIcon className="w-5 h-5" />
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User Detail Modal */}
      <UserDetailModal
        user={selectedUser}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />

      {/* Edit User Modal */}
      <EditUserModal
        user={selectedUser}
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        onSave={handleSaveUser}
        departments={departments}
        roles={roles}
      />
    </AdminLayout>
  );
}
