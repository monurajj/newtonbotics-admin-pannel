import { 
  NotificationApiResponse, 
  NotificationApiParams, 
  NotificationSettings,
  NotificationApiError 
} from '../types/notifications';

export class NotificationService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = '/api/admin/dashboard';
  }

  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const token = localStorage.getItem('accessToken');
    
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      let errorData: NotificationApiError | { success: boolean; error?: { message: string; details?: Record<string, unknown> }; message?: string; timestamp?: string; path?: string; method?: string };
      try {
        errorData = await response.json();
      } catch {
        errorData = {
          success: false,
          error: {
            message: `HTTP error! status: ${response.status}`,
            details: { statusCode: response.status, isOperational: true }
          },
          timestamp: new Date().toISOString(),
          path: endpoint,
          method: options.method || 'GET'
        };
      }
      
      // Safely extract error message with fallbacks
      const topLevelMessage =
        typeof errorData === 'object' &&
        errorData !== null &&
        'message' in errorData &&
        typeof (errorData as { message?: unknown }).message === 'string'
          ? (errorData as { message: string }).message
          : undefined;

      const errorMessage = errorData?.error?.message 
        || topLevelMessage
        || `HTTP error! status: ${response.status}`;
      
      // Create error with status code information for better handling
      const error = new Error(errorMessage);
      (error as any).statusCode = response.status;
      (error as any).status = response.status;
      throw error;
    }

    return response.json();
  }

  /**
   * Get notifications with filtering and pagination
   */
  async getNotifications(params: NotificationApiParams = {}): Promise<NotificationApiResponse> {
    const queryParams = new URLSearchParams();
    
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.skip) queryParams.append('skip', params.skip.toString());
    if (params.type) queryParams.append('type', params.type);
    if (params.priority) queryParams.append('priority', params.priority);
    if (params.read !== undefined) queryParams.append('read', params.read.toString());

    const queryString = queryParams.toString();
    const endpoint = `/notifications${queryString ? `?${queryString}` : ''}`;
    
    return this.makeRequest<NotificationApiResponse>(endpoint);
  }

  /**
   * Mark a specific notification as read
   */
  async markAsRead(notificationId: string): Promise<{ success: boolean; message: string; data: Record<string, unknown> }> {
    return this.makeRequest(`/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<{ success: boolean; message: string; data: Record<string, unknown> }> {
    return this.makeRequest('/notifications/read-all', {
      method: 'PUT',
    });
  }

  /**
   * Get notification settings
   */
  async getSettings(): Promise<{ success: boolean; data: { settings: NotificationSettings } }> {
    return this.makeRequest('/settings');
  }

  /**
   * Update notification settings
   */
  async updateSettings(settings: Partial<NotificationSettings>): Promise<{ success: boolean; message: string; data: { settings: NotificationSettings } }> {
    return this.makeRequest('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
