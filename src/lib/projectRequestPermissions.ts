/**
 * Project Request Access Control Permissions
 * 
 * This utility provides functions to check permissions for project requests
 * based on user role and project request status.
 */

export interface ProjectRequest {
  _id?: string;
  id?: string;
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'on_hold';
  submittedBy?: string | { _id?: string; id?: string };
  submittedById?: string;
  document?: {
    originalName?: string;
    documentName?: string;
    url?: string;
    publicId?: string;
    size?: number;
    bytes?: number;
  };
}

export interface CurrentUser {
  id?: string;
  _id?: string;
  role?: string;
}

/**
 * Get project request permissions for a user
 */
export function getProjectRequestPermissions(
  projectRequest: ProjectRequest | null | undefined,
  currentUser: CurrentUser | null | undefined
) {
  if (!projectRequest || !currentUser) {
    return {
      canEdit: false,
      canChangeStatus: false,
      canViewDocument: false,
      canDelete: false,
      canApprove: false,
      canReject: false,
      isReadOnly: true,
      showAdminBadge: false,
    };
  }

  const userId = currentUser.id || currentUser._id || '';
  const submittedById = 
    typeof projectRequest.submittedBy === 'string'
      ? projectRequest.submittedBy
      : projectRequest.submittedBy?._id || projectRequest.submittedBy?.id || projectRequest.submittedById || '';
  
  const isOwner = userId && submittedById && userId.toString() === submittedById.toString();
  const isAdmin = currentUser.role === 'admin';
  const isMentorOrHigher = ['mentor', 'researcher', 'admin'].includes(currentUser.role || '');
  const isApproved = projectRequest.status === 'approved';

  return {
    // Can edit project request (update fields)
    canEdit:
      isAdmin || 
      (isOwner && !isApproved && projectRequest.status !== 'rejected') ||
      (isMentorOrHigher && !isApproved),

    // Can change status
    canChangeStatus: isAdmin || (isMentorOrHigher && !isApproved),

    // Can view document (admin always, owner always, mentors+ always)
    canViewDocument: isAdmin || isOwner || isMentorOrHigher,

    // Can delete project request
    canDelete:
      isAdmin ||
      (isOwner && projectRequest.status !== 'approved' && projectRequest.status !== 'under_review'),

    // Can approve project
    canApprove: isMentorOrHigher && !isApproved,

    // Can reject project
    canReject: isMentorOrHigher && !isApproved,

    // Is read-only (for display purposes)
    isReadOnly: isApproved && !isAdmin,

    // Show admin badge (admin viewing approved project)
    showAdminBadge: isApproved && isAdmin,
  };
}

/**
 * Check if user can edit a project request
 */
export function canEdit(projectRequest: ProjectRequest | null | undefined, currentUser: CurrentUser | null | undefined): boolean {
  const permissions = getProjectRequestPermissions(projectRequest, currentUser);
  return permissions.canEdit;
}

/**
 * Check if user can change status of a project request
 */
export function canChangeStatus(
  projectRequest: ProjectRequest | null | undefined,
  currentUser: CurrentUser | null | undefined
): boolean {
  const permissions = getProjectRequestPermissions(projectRequest, currentUser);
  return permissions.canChangeStatus;
}

/**
 * Check if user can view document
 */
export function canViewDocument(
  projectRequest: ProjectRequest | null | undefined,
  currentUser: CurrentUser | null | undefined
): boolean {
  const permissions = getProjectRequestPermissions(projectRequest, currentUser);
  return permissions.canViewDocument;
}

/**
 * Get status badge information
 */
export function getStatusBadge(status: string | undefined, canEdit: boolean) {
  if (!status) {
    return { color: 'bg-gray-100 text-gray-800', text: 'Unknown', icon: 'clock' };
  }

  const badges: Record<string, { color: string; text: string; icon: string; badge?: string }> = {
    pending: {
      color: 'bg-yellow-100 text-yellow-800',
      text: 'Pending',
      icon: 'clock',
    },
    under_review: {
      color: 'bg-blue-100 text-blue-800',
      text: 'Under Review',
      icon: 'eye',
    },
    approved: {
      color: 'bg-green-100 text-green-800',
      text: 'Approved',
      icon: 'check-circle',
      badge: canEdit ? 'Admin-Only Editing' : 'Read-Only',
    },
    rejected: {
      color: 'bg-red-100 text-red-800',
      text: 'Rejected',
      icon: 'times-circle',
    },
    on_hold: {
      color: 'bg-gray-100 text-gray-800',
      text: 'On Hold',
      icon: 'pause',
    },
  };

  return badges[status] || badges.pending;
}
