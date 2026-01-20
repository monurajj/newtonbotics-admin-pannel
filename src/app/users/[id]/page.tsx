'use client';

import { useCallback, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeftIcon,
  EnvelopeIcon,
  PhoneIcon,
  BuildingOfficeIcon,
  AcademicCapIcon,
  CheckCircleIcon,
  XCircleIcon,
  PencilIcon,
  TrashIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  BellIcon,
  HeartIcon,
  StarIcon
} from '@heroicons/react/24/outline';
import AdminLayout from '../../../components/AdminLayout';
import EditUserModal from '../../../components/EditUserModal';
import { ErrorBoundary } from '../../../components/ErrorBoundary';

interface User {
  id?: string;
  _id?: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  studentId?: string;
  department?: string;
  yearOfStudy?: number;
  phone?: string;
  profileImageUrl?: string;
  bio?: string;
  skills?: string[];
  isActive: boolean;
  emailVerified: boolean;
  permissions?: string[];
  preferences?: {
    notifications: boolean;
    newsletter: boolean;
  };
  subroles?: string[];
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

// Removed unused UserStatistics type

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Debug modal state changes
  useEffect(() => {
    console.log('Modal state changed:', isEditModalOpen);
  }, [isEditModalOpen]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);

  const fetchUserDetails = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/');
        return;
      }

      const response = await fetch(`/api/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.data.user);
      } else {
        setError('Failed to fetch user details');
      }
    } catch (error) {
      console.error('Error fetching user details:', error);
      setError('Network error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [router, userId]);

  useEffect(() => {
    if (userId) {
      fetchUserDetails();
      fetchDepartments();
      fetchRoles();
    }
  }, [userId, fetchUserDetails]);

  const fetchDepartments = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch(`/api/users/departments`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDepartments(data.data.departments);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchRoles = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch(`/api/users/roles`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRoles(data.data.roles);
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const handleDeactivateUser = async () => {
    if (!user || !confirm('Are you sure you want to deactivate this user?')) return;

    setIsDeactivating(true);
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const userId = user.id || user._id;
      if (!userId) {
        alert('User ID not found');
        return;
      }

      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Refresh user details
        fetchUserDetails();
      } else {
        alert('Failed to deactivate user');
      }
    } catch (error) {
      console.error('Error deactivating user:', error);
      alert('Error deactivating user');
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleReactivateUser = async () => {
    if (!user) return;

    setIsReactivating(true);
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const userId = user.id || user._id;
      if (!userId) {
        alert('User ID not found');
        return;
      }

      const response = await fetch(`/api/users/${userId}/reactivate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Refresh user details
        fetchUserDetails();
      } else {
        alert('Failed to reactivate user');
      }
    } catch (error) {
      console.error('Error reactivating user:', error);
      alert('Error reactivating user');
    } finally {
      setIsReactivating(false);
    }
  };

  const handleSaveUser = (updatedUser: User) => {
    console.log('Saving user:', updatedUser);
    setUser(updatedUser);
    setIsEditModalOpen(false);
    // Optionally show a success message
    // You can add a toast notification here if needed
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatRole = (role: string) => {
    return role.charAt(0).toUpperCase() + role.slice(1).replace('_', ' ');
  };

  if (isLoading) {
    return (
      <AdminLayout pageTitle="User Details">
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading user details...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error || !user) {
    return (
      <AdminLayout pageTitle="User Details">
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <XCircleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading User</h2>
            <p className="text-gray-600 mb-4">{error || 'User not found'}</p>
            <button
              onClick={() => router.push('/users')}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Back to Users
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <>
    <AdminLayout pageTitle={`${user.firstName} ${user.lastName} - User Details`}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/users')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            <span>Back to Users</span>
          </button>
          
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {user.firstName} {user.lastName}
              </h1>
              <p className="text-lg text-gray-600 mt-1">
                {user.email === 'monu2feb2004@gmail.com' ? 'Super Admin' : formatRole(user.role)} • {user.department || 'No Department'}
              </p>
            </div>
            
            {user.email !== 'monu2feb2004@gmail.com' && (
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    console.log('Edit button clicked, opening modal for user:', user);
                    setIsEditModalOpen(true);
                  }}
                  className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  <PencilIcon className="w-4 h-4" />
                  <span>Edit</span>
                </button>
                
                {user.isActive ? (
                  <button
                    onClick={handleDeactivateUser}
                    disabled={isDeactivating}
                    className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                  >
                    <TrashIcon className="w-4 h-4" />
                    <span>{isDeactivating ? 'Deactivating...' : 'Deactivate'}</span>
                  </button>
                ) : (
                  <button
                    onClick={handleReactivateUser}
                    disabled={isReactivating}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                  >
                    <ArrowPathIcon className="w-4 h-4" />
                    <span>{isReactivating ? 'Reactivating...' : 'Reactivate'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center space-x-6 mb-6">
                <div className="w-24 h-24">
                  {user.profileImageUrl ? (
                    <img
                      className="w-24 h-24 rounded-full"
                      src={user.profileImageUrl}
                      alt={`${user.firstName} ${user.lastName}`}
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-indigo-600 flex items-center justify-center">
                      <span className="text-white text-2xl font-bold">
                        {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {user.firstName} {user.lastName}
                  </h2>
                  <p className="text-lg text-gray-600">{user.email}</p>
                  {user.studentId && (
                    <p className="text-sm text-gray-500">Student ID: {user.studentId}</p>
                  )}
                </div>
              </div>

              {/* Status Badges */}
              <div className="flex flex-wrap gap-2 mb-6">
                <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                  user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {user.isActive ? 'Active' : 'Inactive'}
                </span>
                <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                  user.emailVerified ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {user.emailVerified ? 'Email Verified' : 'Email Not Verified'}
                </span>
                {user.email === 'monu2feb2004@gmail.com' ? (
                  <span className="inline-flex px-3 py-1 text-sm font-bold rounded-full bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg animate-pulse">
                    Super Admin
                  </span>
                ) : (
                  <span className="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-purple-100 text-purple-800">
                    {formatRole(user.role)}
                  </span>
                )}
              </div>

              {/* Bio */}
              {user.bio && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Bio</h3>
                  <p className="text-gray-600">{user.bio}</p>
                </div>
              )}

              {/* Skills */}
              {user.skills && user.skills.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {user.skills.map((skill, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800"
                      >
                        <StarIcon className="w-3 h-3 mr-1" />
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Contact Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <EnvelopeIcon className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Email</p>
                    <p className="text-gray-600">{user.email}</p>
                  </div>
                </div>
                {user.phone && (
                  <div className="flex items-center space-x-3">
                    <PhoneIcon className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Phone</p>
                      <p className="text-gray-600">{user.phone}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Academic Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Academic Information</h3>
              <div className="space-y-4">
                {user.department && (
                  <div className="flex items-center space-x-3">
                    <BuildingOfficeIcon className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Department</p>
                      <p className="text-gray-600">{user.department}</p>
                    </div>
                  </div>
                )}
                {user.yearOfStudy && (
                  <div className="flex items-center space-x-3">
                    <AcademicCapIcon className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Year of Study</p>
                      <p className="text-gray-600">Year {user.yearOfStudy}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Permissions */}
            {user.permissions && user.permissions.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Permissions</h3>
                <div className="flex flex-wrap gap-2">
                  {user.permissions.map((permission, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800"
                    >
                      <ShieldCheckIcon className="w-3 h-3 mr-1" />
                      {permission}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Account Status */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Status</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Status</span>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Email Verified</span>
                  <div className="flex items-center space-x-1">
                    {user.emailVerified ? (
                      <CheckCircleIcon className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircleIcon className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Activity Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Last Login</span>
                  <span className="text-sm text-gray-900">
                    {user.lastLogin ? formatDate(user.lastLogin) : 'Never'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Member Since</span>
                  <span className="text-sm text-gray-900">
                    {formatDate(user.createdAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Last Updated</span>
                  <span className="text-sm text-gray-900">
                    {formatDate(user.updatedAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* Preferences */}
            {user.preferences && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Preferences</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Notifications</span>
                    <div className="flex items-center space-x-1">
                      {user.preferences.notifications ? (
                        <BellIcon className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircleIcon className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Newsletter</span>
                    <div className="flex items-center space-x-1">
                      {user.preferences.newsletter ? (
                        <HeartIcon className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircleIcon className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </AdminLayout>

    {/* Edit User Modal - Rendered outside AdminLayout */}
    {isEditModalOpen && user && (
      <ErrorBoundary
        fallback={
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-500 bg-opacity-75">
            <div className="bg-white p-6 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Modal Error</h3>
              <p className="text-gray-600 mb-4">There was an error loading the edit modal.</p>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Close
              </button>
            </div>
          </div>
        }
      >
        <EditUserModal
          user={user}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSave={handleSaveUser}
          departments={departments}
          roles={roles}
        />
      </ErrorBoundary>
    )}
    </>
  );
}
