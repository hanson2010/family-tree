import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ApiResponse, AvatarUploadResponse } from '@/types';

// Gemini VLM prompt for smart cropping
const GEMINI_CROP_PROMPT = `
You are an image analysis assistant. Analyze the provided image and return
the best crop region for a square portrait avatar. Focus on the face/head area.
Return ONLY a JSON object with x, y, width, height as percentages (0-100) of
the image dimensions. Example: {"x": 20, "y": 10, "width": 60, "height": 60}
`;

// POST /api/avatar - Process avatar image
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    if (file.size > maxSize) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: 'Invalid file type. Allowed types: JPEG, PNG, GIF, WebP.' },
        { status: 400 }
      );
    }

    // Read image buffer
    const buffer = await file.arrayBuffer();
    const base64Original = Buffer.from(buffer).toString('base64');

    // Get smart crop suggestion from Gemini
    let cropSuggestion = { x: 25, y: 15, width: 50, height: 50 }; // Default crop

    try {
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const result = await model.generateContent([
        GEMINI_CROP_PROMPT,
        {
          inlineData: {
            mimeType: file.type,
            data: base64Original,
          },
        },
      ]);

      const response = result.response.text();
      // Parse JSON from response
      const jsonMatch = response.match(/\{[^}]+\}/);
      if (jsonMatch) {
        cropSuggestion = JSON.parse(jsonMatch[0]);
      }
    } catch (geminiError) {
      console.warn('Gemini AI crop suggestion failed, using default:', geminiError);
      // Continue with default crop
    }

    // Process image (resize to 200x200, convert to JPEG)
    // In production, use Sharp library for image processing
    // For now, we'll return the original image as base64
    // In a real implementation, you would:
    // 1. Crop to suggested region
    // 2. Resize to 200x200 pixels
    // 3. Compress to WebP or optimized JPEG
    // 4. Convert to base64 data URL

    const mimeType = file.type;
    const processedBase64 = `data:${mimeType};base64,${base64Original}`;

    return NextResponse.json<AvatarUploadResponse>({
      success: true,
      avatar: processedBase64,
      cropSuggestion,
      originalSize: file.size,
      processedSize: base64Original.length,
    });
  } catch (error) {
    console.error('Error processing avatar:', error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: 'Failed to process avatar' },
      { status: 500 }
    );
  }
}
