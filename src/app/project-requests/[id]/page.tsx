'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import ProjectRequestAuditTrail from '@/components/ProjectRequestAuditTrail';
import { 
  ArrowLeftIcon,
  TrashIcon,
  UserGroupIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  TagIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentTextIcon,
  DocumentArrowDownIcon
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
  document?: {
    originalName?: string;
    documentName?: string;
    url?: string;
    publicId?: string;
    size?: number;
    bytes?: number;
  };
}

export default function ProjectRequestDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [projectRequest, setProjectRequest] = useState<ProjectRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'audit'>('details');
  const [currentUser, setCurrentUser] = useState<{ id?: string; _id?: string; role?: string } | null>(null);

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

  useEffect(() => {
    if (params.id) {
      fetchProjectRequest();
    }
  }, [params.id]);


  const fetchProjectRequest = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        setError('No authentication token found');
        return;
      }

      const response = await fetch(`/api/project-requests/${params.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        const projectData = data.data.item || data.data;
        
        // Ensure we have valid data
        if (projectData && typeof projectData === 'object') {
          setProjectRequest(projectData);
        } else {
          console.error('Invalid project data received:', projectData);
          setError('Invalid project request data received from server');
        }
      } else {
        console.error('API returned error:', data);
        setError(data.message || 'Failed to fetch project request details');
      }
    } catch (err) {
      console.error('Error fetching project request:', err);
      setError('Failed to fetch project request details');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProjectRequest = async () => {
    if (!confirm('Are you sure you want to delete this project request?')) return;

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/project-requests/${params.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        router.push('/project-requests');
      } else {
        alert(data.message || 'Failed to delete project request');
      }
    } catch (err) {
      console.error('Error deleting project request:', err);
      alert('Failed to delete project request');
    }
  };

  const handleApproveRequest = async () => {
    if (!confirm('Are you sure you want to approve this project request?')) return;

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/project-requests/${params.id}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        fetchProjectRequest(); // Refresh to update status
        alert('Project request approved successfully');
      } else {
        alert(data.message || 'Failed to approve project request');
      }
    } catch (err) {
      console.error('Error approving project request:', err);
      alert('Failed to approve project request');
    }
  };

  const handleRejectRequest = async () => {
    const reason = prompt('Reason for rejection:');
    if (!reason) return;

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/project-requests/${params.id}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      });

      const data = await response.json();

      if (data.success) {
        fetchProjectRequest(); // Refresh to update status
        alert('Project request rejected');
      } else {
        alert(data.message || 'Failed to reject project request');
      }
    } catch (err) {
      console.error('Error rejecting project request:', err);
      alert('Failed to reject project request');
    }
  };

  const handleUpdateStatus = async (status: string) => {
    try {
      if (!canChangeStatus(projectRequest, currentUser)) {
        alert('You do not have permission to change the status of this project request. Only administrators can modify approved projects.');
        return;
      }

      const token = localStorage.getItem('accessToken');
      console.log('Updating status to:', status);
      
      const response = await fetch(`/api/project-requests/${params.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });

      console.log('Status update response:', response.status);
      const data = await response.json();
      console.log('Status update data:', data);

      if (data.success) {
        fetchProjectRequest(); // Refresh to update status
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

  const handleViewDocument = async () => {
    if (!projectRequest?.document) {
      alert('No document available for this project request');
      return;
    }

    try {
      const permissions = getProjectRequestPermissions(projectRequest, currentUser);
      if (!permissions.canViewDocument) {
        alert('Access denied. You do not have permission to view this document.');
        return;
      }

      const token = localStorage.getItem('accessToken');
      
      // Use frontend API route which proxies to backend
      const response = await fetch(`/api/project-requests/${params.id}/document`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Access denied. You do not have permission to view this document.');
        }
        if (response.status === 404) {
          throw new Error('Document not found for this project request.');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to download document.');
      }

      // Check if it's a redirect response (Cloudinary URL)
      // The API route will handle redirects, but we can also check response type
      if (response.type === 'opaqueredirect' || response.url.includes('cloudinary.com') || response.url.includes('res.cloudinary.com')) {
        // For Cloudinary URLs, open in new tab
        const location = response.headers.get('location') || response.url;
        if (location) {
          window.open(location, '_blank');
          return;
        }
      }

      // Handle file download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Get filename from Content-Disposition header or use from project request
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'document.pdf';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      } else if (projectRequest.document?.originalName || projectRequest.document?.documentName) {
        filename = projectRequest.document.originalName || projectRequest.document.documentName || 'document.pdf';
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      alert('Document downloaded successfully');
    } catch (err: any) {
      console.error('Error viewing document:', err);
      alert(err.message || 'Failed to download document');
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

  const getStatusIcon = (status: string | undefined) => {
    if (!status) return <ClockIcon className="w-5 h-5" />;
    switch (status) {
      case 'pending': return <ClockIcon className="w-5 h-5" />;
      case 'under_review': return <ExclamationTriangleIcon className="w-5 h-5" />;
      case 'approved': return <CheckCircleIcon className="w-5 h-5" />;
      case 'rejected': return <XCircleIcon className="w-5 h-5" />;
      case 'on_hold': return <ClockIcon className="w-5 h-5" />;
      default: return <ClockIcon className="w-5 h-5" />;
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'No date';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid date';
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Date formatting error:', error, 'for date:', dateString);
      return 'Invalid date';
    }
  };

  if (loading) {
    return (
      <AdminLayout pageTitle="Project Request Details">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </AdminLayout>
    );
  }

  if (error || !projectRequest) {
    return (
      <AdminLayout pageTitle="Project Request Details">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error || 'Project request not found'}
        </div>
      </AdminLayout>
    );
  }

  const permissions = getProjectRequestPermissions(projectRequest, currentUser);

  return (
    <AdminLayout pageTitle="Project Request Details">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-md"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{projectRequest.title || 'Untitled Request'}</h1>
              <p className="text-gray-600">Project Request Details</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              {getStatusIcon(projectRequest.status)}
              <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(projectRequest.status)}`}>
                {projectRequest.status ? projectRequest.status.replace('_', ' ').toUpperCase() : 'LOADING'}
                {permissions.showAdminBadge && (
                  <span className="ml-2 text-xs">(Admin-Only Editing)</span>
                )}
              </span>
            </div>
            {permissions.canDelete && (
            <button
              onClick={handleDeleteProjectRequest}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 flex items-center space-x-2"
            >
              <TrashIcon className="w-5 h-5" />
              <span>Delete</span>
            </button>
            )}
          </div>
        </div>

        {/* Read-Only Warning */}
        {permissions.isReadOnly && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-yellow-800">Read-Only Mode</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  This project request is approved and can only be edited by administrators.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('details')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'details'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <DocumentTextIcon className="w-5 h-5 inline mr-2" />
                Request Details
              </button>
              <button
                onClick={() => setActiveTab('audit')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'audit'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <ClockIcon className="w-5 h-5 inline mr-2" />
                Audit Trail
              </button>
            </nav>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {activeTab === 'details' && (
              <>
                {/* Request Overview */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Request Overview</h3>
              </div>
              <div className="px-6 py-4 space-y-4">
                {/* Document Section */}
                {projectRequest.document && permissions.canViewDocument && (
                  <div className="mb-4 pb-4 border-b border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Document</h4>
                    <button
                      onClick={handleViewDocument}
                      className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                    >
                      <DocumentArrowDownIcon className="w-5 h-5" />
                      <span>View Document: {projectRequest.document.originalName || projectRequest.document.documentName || 'Document'}</span>
                      {(projectRequest.document.size || projectRequest.document.bytes) && (
                        <span className="text-sm opacity-90">
                          ({(projectRequest.document.size || projectRequest.document.bytes || 0) / 1024 / 1024} MB)
                        </span>
                      )}
                    </button>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Description</h4>
                  <p className="text-gray-900 whitespace-pre-wrap">{projectRequest.description || 'No description provided'}</p>
                </div>

                {projectRequest.objectives && projectRequest.objectives.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Objectives</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {projectRequest.objectives.map((objective, index) => (
                        <li key={index} className="text-gray-900">{objective}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {projectRequest.expectedOutcomes && projectRequest.expectedOutcomes.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Expected Outcomes</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {projectRequest.expectedOutcomes.map((outcome, index) => (
                        <li key={index} className="text-gray-900">{outcome}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Project Details</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-500">Team Size:</span>
                      <span className="ml-2 text-gray-900">{projectRequest.teamSize || 0} members</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Duration:</span>
                      <span className="ml-2 text-gray-900">{projectRequest.estimatedDurationMonths || 0} months</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Budget:</span>
                      <span className="ml-2 text-gray-900">
                        {projectRequest.budgetEstimate ? `$${projectRequest.budgetEstimate.toLocaleString()}` : 'Not specified'}
                      </span>
                    </div>
                  </div>
                </div>

                {projectRequest.requiredResources && projectRequest.requiredResources.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Required Resources</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {projectRequest.requiredResources.map((resource, index) => (
                        <li key={index} className="text-gray-900">{resource}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Team Members */}
            {projectRequest.teamMembers && projectRequest.teamMembers.length > 0 && (
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Proposed Team Members</h3>
                </div>
                <div className="px-6 py-4">
                  <div className="space-y-4">
                    {projectRequest.teamMembers.map((member, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-gray-900">{member.proposedRole}</h4>
                          <span className="text-xs text-gray-500">{member.availabilityHoursPerWeek}h/week</span>
                        </div>
                        {member.skills && member.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {member.skills.map((skill, skillIndex) => (
                              <span key={skillIndex} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {skill}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Resources */}
            {projectRequest.resources && projectRequest.resources.length > 0 && (
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Resource Requirements</h3>
                </div>
                <div className="px-6 py-4">
                  <div className="space-y-4">
                    {projectRequest.resources.map((resource, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-gray-900 capitalize">{resource.resourceType}</h4>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            resource.priority === 'critical' ? 'bg-red-100 text-red-800' :
                            resource.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                            resource.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {resource.priority} priority
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{resource.description}</p>
                        {resource.estimatedCost > 0 && (
                          <p className="text-sm text-gray-600">
                            Estimated cost: ${resource.estimatedCost.toLocaleString()}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

                {/* Status History */}
                <div className="bg-white shadow rounded-lg">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Status History</h3>
                  </div>
                  <div className="px-6 py-4">
                    <div className="flow-root">
                      <ul className="-mb-8">
                        <li>
                          <div className="relative pb-8">
                            <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true"></span>
                            <div className="relative flex space-x-3">
                              <div>
                                <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${getStatusColor(projectRequest.status)}`}>
                                  {getStatusIcon(projectRequest.status)}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                                <div>
                                  <p className="text-sm text-gray-500">
                                    Request <span className="font-medium text-gray-900">{projectRequest.status ? projectRequest.status.replace('_', ' ') : 'loading'}</span>
                                  </p>
                                </div>
                                <div className="text-right text-sm whitespace-nowrap text-gray-500">
                                  <time>{formatDate(projectRequest.updatedAt)}</time>
                                </div>
                              </div>
                            </div>
                          </div>
                        </li>
                        <li>
                          <div className="relative">
                            <div className="relative flex space-x-3">
                              <div>
                                <span className="h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white bg-blue-100 text-blue-800">
                                  <ClockIcon className="w-5 h-5" />
                                </span>
                              </div>
                              <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                                <div>
                                  <p className="text-sm text-gray-500">
                                    Request <span className="font-medium text-gray-900">submitted</span>
                                  </p>
                                </div>
                                <div className="text-right text-sm whitespace-nowrap text-gray-500">
                                  <time>{formatDate(projectRequest.createdAt)}</time>
                                </div>
                              </div>
                            </div>
                          </div>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'audit' && (
              <ProjectRequestAuditTrail 
                projectRequestId={projectRequest._id} 
                className="w-full"
              />
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Request Information */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Request Information</h3>
              </div>
              <div className="px-6 py-4 space-y-4">
                {/* Submitted By */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Submitted By</h4>
                  <div className="flex items-center text-sm text-gray-900">
                    <UserGroupIcon className="w-4 h-4 mr-2" />
                    User ID: {projectRequest.submittedBy}
                  </div>
                </div>

                {/* Mentor */}
                {projectRequest.mentorId && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Assigned Mentor</h4>
                    <div className="flex items-center text-sm text-gray-900">
                      <UserGroupIcon className="w-4 h-4 mr-2" />
                      Mentor ID: {projectRequest.mentorId}
                    </div>
                  </div>
                )}

                {/* Budget */}
                {projectRequest.budgetEstimate && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Budget Estimate</h4>
                    <div className="flex items-center text-sm text-gray-900">
                      <CurrencyDollarIcon className="w-4 h-4 mr-2" />
                      ${projectRequest.budgetEstimate.toLocaleString()}
                    </div>
                  </div>
                )}

                {/* Team Size */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Team Size</h4>
                  <div className="flex items-center text-sm text-gray-900">
                    <UserGroupIcon className="w-4 h-4 mr-2" />
                    {projectRequest.teamSize || 0} members
                  </div>
                </div>

                {/* Duration */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Duration</h4>
                  <div className="flex items-center text-sm text-gray-900">
                    <ClockIcon className="w-4 h-4 mr-2" />
                    {projectRequest.estimatedDurationMonths || 0} months
                  </div>
                </div>

                {/* Submitted Date */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Submitted</h4>
                  <div className="flex items-center text-sm text-gray-900">
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    {formatDate(projectRequest.submittedAt || projectRequest.createdAt)}
                  </div>
                </div>

                {/* Reviewed Date */}
                {projectRequest.reviewedAt && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Reviewed</h4>
                    <div className="flex items-center text-sm text-gray-900">
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {formatDate(projectRequest.reviewedAt)}
                    </div>
                  </div>
                )}

                {/* Approval Date */}
                {projectRequest.approvalDate && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Approved</h4>
                    <div className="flex items-center text-sm text-gray-900">
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {formatDate(projectRequest.approvalDate)}
                    </div>
                  </div>
                )}

                {/* Review Notes */}
                {projectRequest.reviewNotes && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Review Notes</h4>
                    <p className="text-sm text-gray-900">{projectRequest.reviewNotes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            {permissions.canChangeStatus && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">
                    {currentUser?.role === 'admin' ? 'Admin Actions' : 'Status Management'}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {currentUser?.role === 'admin' 
                      ? 'Change status at any time (including approved projects)'
                      : 'Change status for non-approved projects'}
                  </p>
              </div>
              <div className="px-6 py-4 space-y-3">
                  {/* Approve Button - Only show if user can change status and not already approved */}
                {projectRequest.status !== 'approved' && (
                  <button 
                    onClick={handleApproveRequest}
                    className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center justify-center space-x-2"
                  >
                    <CheckCircleIcon className="w-5 h-5" />
                    <span>Approve Request</span>
                  </button>
                )}
                
                  {/* Reject Button - Only show if user can change status and not already rejected */}
                {projectRequest.status !== 'rejected' && (
                  <button 
                    onClick={handleRejectRequest}
                    className="w-full bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 flex items-center justify-center space-x-2"
                  >
                    <XCircleIcon className="w-5 h-5" />
                    <span>Reject Request</span>
                  </button>
                )}
                
                  {/* Under Review Button - Only show if user can change status and not already under_review */}
                {projectRequest.status !== 'under_review' && (
                  <button 
                    onClick={() => handleUpdateStatus('under_review')}
                    className="w-full bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 flex items-center justify-center space-x-2"
                  >
                    <ExclamationTriangleIcon className="w-5 h-5" />
                    <span>Put Under Review</span>
                  </button>
                )}
                
                  {/* On Hold Button - Only show if user can change status and not already on_hold */}
                {projectRequest.status !== 'on_hold' && (
                  <button 
                    onClick={() => handleUpdateStatus('on_hold')}
                    className="w-full bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 flex items-center justify-center space-x-2"
                  >
                    <ClockIcon className="w-5 h-5" />
                    <span>Put On Hold</span>
                  </button>
                )}
                
                  {/* Back to Pending Button - Only show if user can change status and not already pending */}
                {projectRequest.status !== 'pending' && (
                  <button 
                    onClick={() => handleUpdateStatus('pending')}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center justify-center space-x-2"
                  >
                    <ClockIcon className="w-5 h-5" />
                    <span>Reset to Pending</span>
                  </button>
                )}
                  
                  {/* Admin: Allow changing status on approved projects */}
                  {currentUser?.role === 'admin' && projectRequest.status === 'approved' && (
                    <div className="mt-4 p-3 bg-indigo-50 rounded-md border border-indigo-200">
                      <p className="text-sm font-medium text-indigo-800 mb-2">Admin Status Change</p>
                      <select
                        onChange={(e) => {
                          if (e.target.value && e.target.value !== 'approved') {
                            handleUpdateStatus(e.target.value);
                            e.target.value = 'approved'; // Reset to current status
                          }
                        }}
                        className="w-full border border-indigo-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        defaultValue="approved"
                      >
                        <option value="approved">Approved (Current)</option>
                        <option value="pending">Pending</option>
                        <option value="under_review">Under Review</option>
                        <option value="rejected">Rejected</option>
                        <option value="on_hold">On Hold</option>
                      </select>
                    </div>
                  )}
                
                {/* Current Status Indicator */}
                <div className="mt-4 p-3 bg-gray-50 rounded-md">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Current Status:</span> 
                    <span className={`ml-2 px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(projectRequest.status)}`}>
                      {projectRequest.status ? projectRequest.status.replace('_', ' ').toUpperCase() : 'UNKNOWN'}
                    </span>
                  </p>
                </div>
              </div>
            </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}






