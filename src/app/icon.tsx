import { ImageResponse } from 'next/og';

export const size = 32;
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1e293b',
          borderRadius: '6px',
        }}
      >
        <span
          style={{
            fontSize: 20,
            color: '#f8fafc',
          }}
        >
          族
        </span>
      </div>
    ),
    { width: 32, height: 32 }
  );
}
