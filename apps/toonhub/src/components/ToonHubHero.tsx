import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

const IMAGES = [
  { src: '/cards/1-angel.jpg', alt: 'Winged figure covered in glowing eyes', bg: '#1F130B', glow: '#FF8A2A' },
  { src: '/cards/2-angel-wing.jpg', alt: 'Burning wing with glowing embers', bg: '#14191C', glow: '#FFB25C' },
  { src: '/cards/3-dragon.jpg', alt: 'Dragon warrior wreathed in lightning', bg: '#17122A', glow: '#A88BFF' },
  { src: '/cards/4-dragon-head.jpg', alt: 'Roaring storm dragon', bg: '#0F1424', glow: '#7FA7FF' },
];

const DURATION = 650;
const EASING = 'cubic-bezier(0.4,0,0.2,1)';

const GRAIN_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(#n)' opacity='0.08'/></svg>`,
  );

type Role = 'center' | 'left' | 'right' | 'back';
type Direction = 'next' | 'prev';

function getRoleStyle(role: Role, isMobile: boolean): CSSProperties {
  switch (role) {
    case 'center':
      return {
        filter: 'blur(0px)',
        opacity: 1,
        zIndex: 20,
        left: '50%',
        height: isMobile ? '52%' : '70%',
        bottom: isMobile ? '26%' : '12%',
      };
    case 'left':
      return {
        filter: 'blur(2px)',
        opacity: 0.7,
        zIndex: 10,
        left: isMobile ? '14%' : '27%',
        height: isMobile ? '26%' : '42%',
        bottom: isMobile ? '34%' : '30%',
      };
    case 'right':
      return {
        filter: 'blur(2px)',
        opacity: 0.7,
        zIndex: 10,
        left: isMobile ? '86%' : '73%',
        height: isMobile ? '26%' : '42%',
        bottom: isMobile ? '34%' : '30%',
      };
    case 'back':
      return {
        filter: 'blur(4px)',
        opacity: 0.45,
        zIndex: 5,
        left: '50%',
        height: isMobile ? '20%' : '32%',
        bottom: isMobile ? '40%' : '38%',
      };
  }
}

const NavButton = ({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
}) => {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="flex items-center justify-center rounded-full w-12 h-12 sm:w-16 sm:h-16 text-white"
      style={{
        border: '2px solid #fff',
        backgroundColor: hover ? 'rgba(255,255,255,0.12)' : 'transparent',
        transform: hover ? 'scale(1.08)' : 'scale(1)',
        transition: 'transform 150ms, background-color 150ms',
      }}
    >
      {children}
    </button>
  );
};

export default function ToonHubHero() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 640 : false,
  );
  const [linkHover, setLinkHover] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    IMAGES.forEach(({ src }) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    },
    [],
  );

  const navigate = useCallback(
    (direction: Direction) => {
      if (isAnimating) return;
      setIsAnimating(true);
      setActiveIndex((prev) => (direction === 'next' ? (prev + 1) % 4 : (prev + 3) % 4));
      timeoutRef.current = window.setTimeout(() => setIsAnimating(false), DURATION);
    },
    [isAnimating],
  );

  const roles: Record<number, Role> = {
    [activeIndex]: 'center',
    [(activeIndex + 3) % 4]: 'left',
    [(activeIndex + 1) % 4]: 'right',
    [(activeIndex + 2) % 4]: 'back',
  };

  const itemTransition = [
    `transform ${DURATION}ms ${EASING}`,
    `filter ${DURATION}ms ${EASING}`,
    `opacity ${DURATION}ms ${EASING}`,
    `left ${DURATION}ms ${EASING}`,
    `height ${DURATION}ms ${EASING}`,
    `bottom ${DURATION}ms ${EASING}`,
  ].join(', ');

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        backgroundColor: IMAGES[activeIndex].bg,
        transition: `background-color ${DURATION}ms ${EASING}`,
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <div className="relative w-full" style={{ height: '100vh', overflow: 'hidden' }}>
        {/* Grain overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            zIndex: 50,
            opacity: 0.4,
            backgroundImage: `url("${GRAIN_SVG}")`,
            backgroundSize: '200px 200px',
            backgroundRepeat: 'repeat',
          }}
        />

        {/* Giant ghost text */}
        <div
          className="absolute inset-x-0 flex items-center justify-center pointer-events-none select-none"
          style={{ zIndex: 2, top: '18%' }}
        >
          <span
            style={{
              fontFamily: "'Anton', sans-serif",
              fontSize: 'clamp(110px, 40vw, 600px)',
              fontWeight: 900,
              color: '#fff',
              opacity: 0.12,
              lineHeight: 1,
              textTransform: 'uppercase',
              letterSpacing: '-0.02em',
              whiteSpace: 'nowrap',
            }}
          >
            STORM
          </span>
        </div>

        {/* Brand label */}
        <div
          className="absolute top-6 left-4 sm:left-8 text-xs font-semibold uppercase text-white"
          style={{ zIndex: 60, opacity: 0.9, letterSpacing: '0.18em' }}
        >
          STORM
        </div>

        {/* Carousel */}
        <div className="absolute inset-0" style={{ zIndex: 3 }}>
          {IMAGES.map((image, i) => {
            const isCenter = roles[i] === 'center';
            return (
              <div
                key={image.src}
                style={{
                  position: 'absolute',
                  aspectRatio: '0.6 / 1',
                  transform: 'translateX(-50%)',
                  borderRadius: isMobile ? 16 : 22,
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.14)',
                  boxShadow: isCenter
                    ? `0 30px 80px rgba(0,0,0,0.6), 0 0 90px ${image.glow}55`
                    : '0 20px 50px rgba(0,0,0,0.5)',
                  transition: `${itemTransition}, box-shadow ${DURATION}ms ${EASING}`,
                  willChange: 'transform, filter, opacity',
                  ...getRoleStyle(roles[i], isMobile),
                }}
              >
                <img
                  src={image.src}
                  alt={image.alt}
                  draggable={false}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'center',
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Bottom-left text + nav */}
        <div
          className="absolute bottom-6 left-4 sm:bottom-20 sm:left-24"
          style={{ zIndex: 60, maxWidth: 320 }}
        >
          <p
            className="font-bold uppercase tracking-widest mb-2 sm:mb-3 text-base sm:text-[22px] text-white"
            style={{ opacity: 0.95, letterSpacing: '0.02em' }}
          >
            STORM
          </p>
          <p
            className="hidden sm:block text-xs sm:text-sm text-white mb-4 sm:mb-5"
            style={{ opacity: 0.85, lineHeight: 1.6 }}
          >
            The artwork is stunning, shipped fully prepared. The finish is a vision, the 3D craft is
            flawless. Many thanks! Wishing you the win. Order now.
          </p>
          <div className="flex items-center gap-3">
            <NavButton label="Previous" onClick={() => navigate('prev')}>
              <ArrowLeft size={26} strokeWidth={2.25} />
            </NavButton>
            <NavButton label="Next" onClick={() => navigate('next')}>
              <ArrowRight size={26} strokeWidth={2.25} />
            </NavButton>
          </div>
        </div>

        {/* Bottom-right link */}
        <div
          className="absolute bottom-6 right-4 sm:bottom-20 sm:right-10"
          style={{ zIndex: 60 }}
        >
          <a
            href="#"
            className="flex items-center gap-2 text-white"
            onMouseEnter={() => setLinkHover(true)}
            onMouseLeave={() => setLinkHover(false)}
            style={{
              fontFamily: "'Anton', sans-serif",
              fontSize: 'clamp(20px, 4vw, 56px)',
              fontWeight: 400,
              opacity: linkHover ? 1 : 0.95,
              transition: 'opacity 200ms',
              letterSpacing: '-0.02em',
              lineHeight: 1,
              textTransform: 'uppercase',
              textDecoration: 'none',
            }}
          >
            DISCOVER IT
            <ArrowRight className="w-5 h-5 sm:w-8 sm:h-8" strokeWidth={2.25} />
          </a>
        </div>
      </div>
    </div>
  );
}
