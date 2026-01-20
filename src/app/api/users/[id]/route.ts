import { NextRequest, NextResponse } from 'next/server';

const backendUrl = process.env.BACKEND_URL || 'https://newton-botics-servers-chi.vercel.app';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = request.headers.get('authorization');
    
    if (!token) {
      return NextResponse.json({ success: false, message: 'No authorization token provided' }, { status: 401 });
    }

    console.log('Fetching user:', `${backendUrl}/api/users/${id}`);

    const response = await fetch(`${backendUrl}/api/users/${id}`, {
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      }
    });

    let data;
    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    
    try {
      const text = await response.text();
      
      if (!text || text.trim().length === 0) {
        data = {};
      } else if (isJson) {
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          console.error('Failed to parse JSON response:', parseError);
          data = {
            message: `Backend returned invalid JSON (${response.status})`,
            error: 'Invalid JSON response from backend'
          };
        }
      } else {
        console.warn('Backend returned non-JSON response for GET:', contentType);
        data = {
          message: response.status === 404 
            ? `User with ID "${id}" not found` 
            : `Backend returned ${response.status} error`,
          error: 'Non-JSON response from backend'
        };
      }
    } catch (e) {
      console.error('Failed to read backend response:', e);
      data = {
        message: `Failed to read backend response (${response.status})`
      };
    }

    if (response.ok) {
      return NextResponse.json(data);
    } else {
      return NextResponse.json(
        { success: false, message: data.message || data.error?.message || `Failed to fetch user (${response.status})` },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = request.headers.get('authorization');
    
    if (!token) {
      return NextResponse.json({ success: false, message: 'No authorization token provided' }, { status: 401 });
    }

    // Validate user ID format (MongoDB ObjectId is 24 hex characters)
    if (!id || id.trim().length === 0) {
      return NextResponse.json(
        { success: false, message: 'Invalid user ID provided' },
        { status: 400 }
      );
    }

    const body = await request.json();
    console.log('Updating user:', `${backendUrl}/api/users/${id}`);
    console.log('Backend URL (from env):', process.env.BACKEND_URL || 'not set (using fallback)');
    console.log('Backend URL (resolved):', backendUrl);
    console.log('User ID:', id);
    console.log('Request body:', JSON.stringify(body, null, 2));
    console.log('Authorization token:', token ? 'Token provided' : 'No token');

    const response = await fetch(`${backendUrl}/api/users/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    let data;
    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    
    try {
      const text = await response.text();
      
      if (!text || text.trim().length === 0) {
        // Empty response
        data = {};
      } else if (isJson) {
        // Try to parse as JSON
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          console.error('Failed to parse JSON response:', parseError);
          console.error('Response text (first 500 chars):', text.substring(0, 500));
          data = {
            message: response.status === 404 
              ? `User with ID "${id}" not found` 
              : `Backend returned invalid JSON (${response.status})`,
            error: 'Invalid JSON response from backend'
          };
        }
      } else {
        // Backend returned non-JSON (likely HTML error page from Vercel)
        console.warn('Backend returned non-JSON response (content-type:', contentType, ')');
        console.warn('Response preview (first 300 chars):', text.substring(0, 300));
        
        // Check if it's a Vercel deployment error
        const isVercelDeploymentError = text.includes('DEPLOYMENT_NOT_FOUND') || 
                                        text.toLowerCase().includes('the deployment could not be found') ||
                                        text.toLowerCase().includes('deployment_not_found');
        
        // Check if it's an HTML error page
        const isHtmlError = text.includes('<html') || text.includes('<!DOCTYPE') || text.toLowerCase().includes('the deploy');
        
        if (isVercelDeploymentError) {
          data = {
            message: `Backend deployment not found. The backend URL "${backendUrl}" does not exist on Vercel. Please check your BACKEND_URL environment variable.`,
            error: 'Vercel deployment not found',
            backendUrl: backendUrl,
            suggestion: 'Please verify your BACKEND_URL environment variable is set to the correct backend deployment URL.'
          };
        } else {
          data = {
            message: response.status === 404 
              ? `User with ID "${id}" not found. The backend endpoint may not exist or the user was deleted.`
              : `Backend returned ${response.status} error${isHtmlError ? ' (HTML error page)' : ''}`,
            error: isHtmlError ? 'Backend returned HTML error page instead of JSON' : `Non-JSON response: ${contentType}`,
            responsePreview: text.substring(0, 200) // Include first 200 chars for debugging
          };
        }
      }
    } catch (e) {
      console.error('Failed to read backend response:', e);
      data = {
        message: response.status === 404 
          ? `User with ID "${id}" not found` 
          : `Failed to read backend response (${response.status})`
      };
    }
    
    console.log('Backend response status:', response.status);
    console.log('Backend response content-type:', contentType);
    console.log('Backend response data:', JSON.stringify(data, null, 2));

    if (response.ok) {
      return NextResponse.json(data);
    } else {
      console.error('Backend error:', data);
      
      // Provide more specific error messages based on status code
      let errorMessage = data.message || data.error?.message;
      
      if (response.status === 404) {
        // Check if it's a deployment error vs actual user not found
        if (data.error === 'Vercel deployment not found') {
          errorMessage = data.message || `Backend deployment not found at ${backendUrl}. Please check your BACKEND_URL environment variable.`;
        } else {
          errorMessage = errorMessage || `User with ID "${id}" not found. The user may have been deleted or the ID is incorrect.`;
        }
      } else if (response.status === 401) {
        errorMessage = errorMessage || 'Unauthorized. Please check your authentication token.';
      } else if (response.status === 403) {
        errorMessage = errorMessage || 'Forbidden. You do not have permission to update this user.';
      } else if (!errorMessage) {
        errorMessage = `Failed to update user (${response.status})`;
      }
      
      return NextResponse.json(
        { success: false, message: errorMessage, details: data, userId: id },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = request.headers.get('authorization');
    
    if (!token) {
      return NextResponse.json({ success: false, message: 'No authorization token provided' }, { status: 401 });
    }

    console.log('Deactivating user:', `${backendUrl}/api/users/${id}`);

    const response = await fetch(`${backendUrl}/api/users/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      }
    });

    let data;
    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    
    try {
      const text = await response.text();
      
      if (!text || text.trim().length === 0) {
        data = {};
      } else if (isJson) {
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          console.error('Failed to parse JSON response:', parseError);
          data = {
            message: `Backend returned invalid JSON (${response.status})`,
            error: 'Invalid JSON response from backend'
          };
        }
      } else {
        console.warn('Backend returned non-JSON response for DELETE:', contentType);
        data = {
          message: response.status === 404 
            ? `User with ID "${id}" not found` 
            : `Backend returned ${response.status} error`,
          error: 'Non-JSON response from backend'
        };
      }
    } catch (e) {
      console.error('Failed to read backend response:', e);
      data = {
        message: `Failed to read backend response (${response.status})`
      };
    }

    if (response.ok) {
      return NextResponse.json(data);
    } else {
      return NextResponse.json(
        { success: false, message: data.message || data.error?.message || `Failed to deactivate user (${response.status})` },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('Error deactivating user:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
