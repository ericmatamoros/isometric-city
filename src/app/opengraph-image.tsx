import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'ISOCITY — Metropolis Builder';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0f1219 0%, #1a1f2e 50%, #0f1219 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {/* Background grid pattern */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(74, 124, 63, 0.15) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(37, 99, 235, 0.15) 0%, transparent 50%)',
            display: 'flex',
          }}
        />

        {/* Isometric buildings representation using simple shapes */}
        <div
          style={{
            position: 'absolute',
            bottom: 80,
            display: 'flex',
            alignItems: 'flex-end',
            gap: 12,
          }}
        >
          {/* Building 1 - Short residential */}
          <div
            style={{
              width: 60,
              height: 80,
              background: 'linear-gradient(135deg, #FFE082 0%, #FFD54F 50%, #FFA726 100%)',
              borderRadius: 4,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingBottom: 8,
              boxShadow: '4px 4px 0 rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ display: 'flex', gap: 4 }}>
              <div style={{ width: 12, height: 16, background: '#FFF59D', display: 'flex' }} />
              <div style={{ width: 12, height: 16, background: '#FFF59D', display: 'flex' }} />
            </div>
          </div>

          {/* Building 2 - Tall commercial */}
          <div
            style={{
              width: 70,
              height: 160,
              background: 'linear-gradient(135deg, #4DD0E1 0%, #00ACC1 50%, #00838F 100%)',
              borderRadius: 4,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-around',
              padding: 8,
              boxShadow: '4px 4px 0 rgba(0,0,0,0.3)',
            }}
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} style={{ display: 'flex', gap: 4 }}>
                <div style={{ width: 10, height: 14, background: '#E0F7FA', display: 'flex' }} />
                <div style={{ width: 10, height: 14, background: '#E0F7FA', display: 'flex' }} />
                <div style={{ width: 10, height: 14, background: '#E0F7FA', display: 'flex' }} />
              </div>
            ))}
          </div>

          {/* Building 3 - Medium office */}
          <div
            style={{
              width: 80,
              height: 120,
              background: 'linear-gradient(135deg, #E0E0E0 0%, #BDBDBD 50%, #757575 100%)',
              borderRadius: 4,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-around',
              padding: 8,
              boxShadow: '4px 4px 0 rgba(0,0,0,0.3)',
            }}
          >
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ display: 'flex', gap: 6 }}>
                <div style={{ width: 14, height: 16, background: '#29B6F6', display: 'flex' }} />
                <div style={{ width: 14, height: 16, background: '#29B6F6', display: 'flex' }} />
                <div style={{ width: 14, height: 16, background: '#29B6F6', display: 'flex' }} />
              </div>
            ))}
          </div>

          {/* Building 4 - Tallest skyscraper */}
          <div
            style={{
              width: 65,
              height: 200,
              background: 'linear-gradient(135deg, #90CAF9 0%, #1976D2 50%, #0D47A1 100%)',
              borderRadius: 4,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-around',
              padding: 8,
              boxShadow: '4px 4px 0 rgba(0,0,0,0.3)',
            }}
          >
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} style={{ display: 'flex', gap: 4 }}>
                <div style={{ width: 10, height: 12, background: '#FFF59D', display: 'flex' }} />
                <div style={{ width: 10, height: 12, background: '#FFF59D', display: 'flex' }} />
              </div>
            ))}
          </div>

          {/* Building 5 - Medium residential */}
          <div
            style={{
              width: 55,
              height: 100,
              background: 'linear-gradient(135deg, #C5CAE9 0%, #7986CB 50%, #3F51B5 100%)',
              borderRadius: 4,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-around',
              padding: 8,
              boxShadow: '4px 4px 0 rgba(0,0,0,0.3)',
            }}
          >
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ display: 'flex', gap: 4 }}>
                <div style={{ width: 10, height: 14, background: '#FFF59D', display: 'flex' }} />
                <div style={{ width: 10, height: 14, background: '#FFF59D', display: 'flex' }} />
              </div>
            ))}
          </div>

          {/* Building 6 - Fire station (red) */}
          <div
            style={{
              width: 60,
              height: 70,
              background: 'linear-gradient(135deg, #EF5350 0%, #D32F2F 50%, #B71C1C 100%)',
              borderRadius: 4,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingBottom: 8,
              boxShadow: '4px 4px 0 rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ width: 30, height: 24, background: '#263238', borderRadius: 2, display: 'flex' }} />
          </div>

          {/* Tree */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: 40,
                height: 50,
                background: 'radial-gradient(circle at 50% 60%, #4CAF50 0%, #2E7D32 100%)',
                borderRadius: '50%',
                display: 'flex',
              }}
            />
            <div style={{ width: 8, height: 20, background: '#5D4037', display: 'flex' }} />
          </div>
        </div>

        {/* Ground / Road */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            left: 0,
            right: 0,
            height: 40,
            background: 'linear-gradient(180deg, #3d5a35 0%, #2d4a26 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: '80%',
              height: 16,
              background: '#4a4a4a',
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ width: '90%', height: 2, background: '#FFF59D', display: 'flex' }} />
          </div>
        </div>

        {/* Title */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'absolute',
            top: 80,
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              letterSpacing: '0.15em',
              background: 'linear-gradient(180deg, #D4AF37 0%, #F5E6A3 50%, #D4AF37 100%)',
              backgroundClip: 'text',
              color: 'transparent',
              display: 'flex',
            }}
          >
            ISOCITY
          </div>
          <div
            style={{
              fontSize: 24,
              color: '#9CA3AF',
              letterSpacing: '0.3em',
              marginTop: 8,
              display: 'flex',
            }}
          >
            METROPOLIS BUILDER
          </div>
        </div>

        {/* Bottom tagline */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 40,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 24,
          }}
        >
          <div
            style={{
              fontSize: 16,
              color: '#9CA3AF',
              display: 'flex',
            }}
          >
            Build your gleaming metropolis
          </div>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              background: '#D4AF37',
              display: 'flex',
            }}
          />
          <div
            style={{
              fontSize: 16,
              color: '#9CA3AF',
              display: 'flex',
            }}
          >
            Zone districts
          </div>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              background: '#D4AF37',
              display: 'flex',
            }}
          />
          <div
            style={{
              fontSize: 16,
              color: '#9CA3AF',
              display: 'flex',
            }}
          >
            Manage resources
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
