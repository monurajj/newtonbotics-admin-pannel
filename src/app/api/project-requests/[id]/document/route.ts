import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/config/backend';

const backendUrl = getBackendUrl();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization');
    if (!token) {
      return NextResponse.json({ success: false, message: 'No authorization token provided' }, { status: 401 });
    }

    const { id } = await params;
    const url = `${backendUrl}/api/project-requests/${id}/document`;

    console.log('Fetching project request document from:', url);

    const response = await fetch(url, {
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      },
      redirect: 'follow'
    });

    // If response is a redirect to Cloudinary or similar CDN, pass it through
    const finalUrl = response.url || url;
    if (finalUrl.includes('cloudinary.com') || finalUrl.includes('res.cloudinary.com') || response.status === 302 || response.status === 301) {
      const location = response.headers.get('location') || finalUrl;
      if (location) {
        return NextResponse.redirect(location);
      }
    }

    // Handle file download
    if (response.ok) {
      const blob = await response.blob();
      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      const contentDisposition = response.headers.get('content-disposition') || `attachment; filename="document.pdf"`;
      
      return new NextResponse(blob, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': contentDisposition,
        },
      });
    } else {
      const data = await response.json().catch(() => ({}));
      return NextResponse.json(
        { success: false, message: data.message || 'Failed to fetch document' },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('Error fetching project request document:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
