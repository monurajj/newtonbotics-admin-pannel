'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

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
  subroles?: string[];
}

interface EditUserModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedUser: User) => void;
  departments: string[];
  roles: string[];
}

export default function EditUserModal({ user, isOpen, onClose, onSave, departments, roles }: EditUserModalProps) {
  const [formData, setFormData] = useState<Partial<User>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [changedFields, setChangedFields] = useState<Set<string>>(new Set());
  const [availableSubroles, setAvailableSubroles] = useState<Array<{ name: string; displayName: string; description?: string }>>([]);
  const [selectedSubroles, setSelectedSubroles] = useState<string[]>([]);

  console.log('EditUserModal props:', { user, isOpen, departments, roles });

  useEffect(() => {
    console.log('EditUserModal useEffect triggered:', { user, isOpen });
    if (user) {
      // Normalize user ID and log it for debugging
      const userId = user.id || (user as { _id?: string })._id || '';
      console.log('EditUserModal - User ID:', userId, { id: user.id, _id: (user as { _id?: string })._id });
      
      if (!userId) {
        console.error('EditUserModal - User object missing ID:', user);
        setError('User object is missing an ID. Please refresh the page and try again.');
      }
      
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        role: user.role || '',
        department: user.department || '',
        yearOfStudy: user.yearOfStudy || undefined,
        phone: user.phone || '',
        isActive: user.isActive ?? true,
        emailVerified: user.emailVerified ?? false,
        bio: user.bio || '',
        skills: user.skills || [],
        studentId: user.studentId || '',
        permissions: user.permissions || [],
        preferences: user.preferences || { notifications: true, newsletter: true }
      });
      setSelectedSubroles(Array.isArray(user.subroles) ? user.subroles : []);
      setError(''); // Clear any previous errors
    }
  }, [user, isOpen]);

  useEffect(() => {
    const fetchSubroles = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        if (!token) return;
        const res = await fetch('/api/subroles/active', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        const data = await res.json();
        const list = data?.data?.subroles || data?.subroles || [];
        setAvailableSubroles(Array.isArray(list) ? list : []);
      } catch (e) {
        setAvailableSubroles([]);
      }
    };
    if (isOpen) {
      fetchSubroles();
    }
  }, [isOpen]);

  // Early return after all hooks are called
  if (!user) {
    console.warn('EditUserModal: No user provided');
    return null;
  }

  const handleInputChange = (field: string, value: string | boolean | number | undefined | User['preferences'] | string[]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Track changed fields
    const originalValue = user[field as keyof typeof user];
    const hasChanged = value !== originalValue;
    
    setChangedFields(prev => {
      const newSet = new Set(prev);
      if (hasChanged) {
        newSet.add(field);
      } else {
        newSet.delete(field);
      }
      return newSet;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setError('Authentication required');
        return;
      }

      // Only send fields that have been changed from their original values
      const changedFields: Record<string, unknown> = {};
      
      // Compare current form data with original user data
      Object.entries(formData).forEach(([key, value]) => {
        const originalValue = user[key as keyof typeof user];
        
        // Check if the value has actually changed
        if (value !== originalValue) {
          // Handle different data types
          if (Array.isArray(value) && Array.isArray(originalValue)) {
            // For arrays, check if they're different
            if (JSON.stringify(value) !== JSON.stringify(originalValue)) {
              changedFields[key] = value;
            }
          } else if (typeof value === 'object' && typeof originalValue === 'object') {
            // For objects, check if they're different
            if (JSON.stringify(value) !== JSON.stringify(originalValue)) {
              changedFields[key] = value;
            }
          } else {
            // For primitive values, handle empty strings specially
            if (value === '' && (originalValue === null || originalValue === undefined || originalValue === '')) {
              // Don't send empty string if original was also empty/null/undefined
              return;
            }
            
            // Special handling for phone number - send null instead of empty string
            if (key === 'phone' && value === '') {
              changedFields[key] = null;
            } else {
              changedFields[key] = value;
            }
          }
        }
      });

      console.log('Original user data:', user);
      console.log('Form data:', formData);
      console.log('Changed fields only:', changedFields);

      // Determine if subroles changed
      const originalSubroles = Array.isArray(user.subroles) ? [...user.subroles] : [];
      const currentSubroles = [...selectedSubroles];
      originalSubroles.sort();
      currentSubroles.sort();
      const subrolesChanged = JSON.stringify(originalSubroles) !== JSON.stringify(currentSubroles);

      // If nothing changed at all (neither core fields nor subroles), block submit
      if (Object.keys(changedFields).length === 0 && !subrolesChanged) {
        setError('No changes detected. Please modify at least one field before saving.');
        return;
      }

      // Optional: Validate phone number format if provided (but don't block submission)
      if (changedFields.phone && changedFields.phone !== null && changedFields.phone !== '') {
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        if (typeof changedFields.phone === 'string' && !phoneRegex.test(changedFields.phone.replace(/[\s\-\(\)]/g, ''))) {
          console.warn('Phone number format may be invalid, but allowing submission');
        }
      }

      let updatedUser = user;

      // Update core fields only if any core field changed
      if (Object.keys(changedFields).length > 0) {
        // Normalize user ID - handle both id and _id fields
        const userId = user.id || (user as { _id?: string })._id || '';
        
        // Validate user ID before making the request
        if (!userId || userId.trim().length === 0) {
          setError('Invalid user ID. Cannot update user. The user object is missing an ID field.');
          setIsLoading(false);
          return;
        }

        console.log('Updating user with ID:', userId);
        console.log('User object:', { id: user.id, _id: (user as { _id?: string })._id });
        console.log('Changed fields:', Object.keys(changedFields));

        const response = await fetch(`/api/users/${userId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(changedFields)
        });

        console.log('Core update status:', response.status);

        if (response.ok) {
          const data = await response.json().catch(() => ({}));
          updatedUser = data.data?.user || updatedUser;
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('Core update error response:', errorData);
          
          // Use the error message from the API, or provide a fallback
          let errorMessage = errorData.message || errorData.error?.message;
          
          // Provide more specific messages based on status
          if (response.status === 404) {
            errorMessage = errorMessage || `User not found. The user with ID "${userId}" may have been deleted or the ID is incorrect. Please refresh the users list and try again.`;
          } else if (response.status === 401) {
            errorMessage = errorMessage || 'Authentication failed. Please log in again.';
          } else if (response.status === 403) {
            errorMessage = errorMessage || 'You do not have permission to update this user.';
          } else if (!errorMessage) {
            errorMessage = `Failed to update user (${response.status}). Please try again.`;
          }
          
          setError(errorMessage);
          setIsLoading(false);
          return;
        }
      }

      // Update subroles if changed
      if (subrolesChanged) {
        try {
          // Use the same normalized user ID
          const userId = user.id || (user as { _id?: string })._id || '';
          if (!userId) {
            setError('Invalid user ID. Cannot update subroles.');
            setIsLoading(false);
            return;
          }
          
          const srRes = await fetch(`/api/users/${userId}/subroles`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ subroles: selectedSubroles })
          });
          if (!srRes.ok) {
            const err = await srRes.json().catch(() => ({}));
            console.warn('Subroles update failed:', err);
            setError(err?.message || err?.error?.message || 'Failed to update subroles');
            return;
          }
          updatedUser = { ...updatedUser, subroles: selectedSubroles } as typeof user;
        } catch (e) {
          console.warn('Subroles update error:', e);
          setError('Failed to update subroles');
          return;
        }
      }

      onSave(updatedUser);
      onClose();
    } catch (error) {
      console.error('Error updating user:', error);
      setError('Network error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !user) {
    console.log('EditUserModal not rendering:', { isOpen, user });
    return null;
  }

  console.log('EditUserModal rendering with:', { user, formData, isOpen });

  return (
    <div 
        className="fixed inset-0 z-50 overflow-y-auto"
        style={{ 
          backgroundColor: 'rgba(0, 0, 0, 0.5)', 
          zIndex: 9999,
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0
        }}
      >
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        {/* Modal panel */}
        <div 
          className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full max-h-[90vh] overflow-y-auto"
          style={{ 
            backgroundColor: 'white',
            zIndex: 10000,
            position: 'relative'
          }}
        >
          {/* Header */}
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Edit User</h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Changed Fields Summary */}
            {changedFields.size > 0 && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-600">
                  <strong>Changed fields:</strong> {Array.from(changedFields).join(', ')}
                </p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Simple Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input
                    type="text"
                    value={formData.firstName || ''}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={formData.lastName || ''}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Student ID (Optional)</label>
                  <input
                    type="text"
                    value={formData.studentId || ''}
                    onChange={(e) => handleInputChange('studentId', e.target.value)}
                    placeholder="Enter student ID (optional)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-black"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone (Optional)</label>
                  <input
                    type="tel"
                    value={formData.phone || ''}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="Enter phone number (optional)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-black"
                  />
                  <p className="mt-1 text-xs text-gray-700">Leave empty to remove phone number</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={formData.role || ''}
                    onChange={(e) => handleInputChange('role', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="" className="text-black">Select Role</option>
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
                    value={formData.department || ''}
                    onChange={(e) => handleInputChange('department', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="" className="text-black">Select Department</option>
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year of Study</label>
                <select
                  value={formData.yearOfStudy || ''}
                  onChange={(e) => handleInputChange('yearOfStudy', e.target.value ? parseInt(e.target.value) : undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="" className="text-black">Select Year</option>
                  {[1, 2, 3, 4, 5].map((year) => (
                    <option key={year} value={year}>Year {year}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                <textarea
                  value={formData.bio || ''}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-600"
                  placeholder="Enter user bio..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Skills (comma-separated)</label>
                <input
                  type="text"
                  value={Array.isArray(formData.skills) ? formData.skills.join(', ') : ''}
                  onChange={(e) => {
                    const skills = e.target.value.split(',').map(s => s.trim()).filter(s => s);
                    handleInputChange('skills', skills);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-600"
                  placeholder="e.g., Python, Arduino, ROS"
                />
              </div>

              {/* Subroles */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subroles</label>
                {availableSubroles.length === 0 ? (
                  <p className="text-sm text-gray-500">No active subroles found.</p>
                ) : (
                  <div className="grid gap-2">
                    {availableSubroles.map((sr) => {
                      const checked = selectedSubroles.includes(sr.name);
                      return (
                        <label key={sr.name} className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setSelectedSubroles(prev => checked ? prev.filter(s => s !== sr.name) : [...prev, sr.name]);
                            }}
                            className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                          <div>
                            <div className="font-medium text-gray-900">{sr.displayName || sr.name}</div>
                            {sr.description && (
                              <div className="text-xs text-gray-500">{sr.description}</div>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive || false}
                    onChange={(e) => handleInputChange('isActive', e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                    Active User
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="emailVerified"
                    checked={formData.emailVerified || false}
                    onChange={(e) => handleInputChange('emailVerified', e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="emailVerified" className="ml-2 block text-sm text-gray-900">
                    Email Verified
                  </label>
                </div>

                {formData.preferences && (
                  <>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="notifications"
                        checked={formData.preferences.notifications || false}
                        onChange={(e) => handleInputChange('preferences', {
                          notifications: e.target.checked,
                          newsletter: formData.preferences?.newsletter ?? true
                        })}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <label htmlFor="notifications" className="ml-2 block text-sm text-gray-900">
                        Enable Notifications
                      </label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="newsletter"
                        checked={formData.preferences.newsletter || false}
                        onChange={(e) => handleInputChange('preferences', {
                          notifications: formData.preferences?.notifications ?? true,
                          newsletter: e.target.checked
                        })}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <label htmlFor="newsletter" className="ml-2 block text-sm text-gray-900">
                        Newsletter Subscription
                      </label>
                    </div>
                  </>
                )}
              </div>

              {/* Form Buttons */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {isLoading ? 'Saving...' : `Save Changes${changedFields.size > 0 ? ` (${changedFields.size} field${changedFields.size > 1 ? 's' : ''})` : ''}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
