import { useState, useRef, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SwipeableCardProps {
  children: ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
  className?: string;
  threshold?: number;
}

export const SwipeableCard = ({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftAction,
  rightAction,
  className,
  threshold = 80
}: SwipeableCardProps) => {
  const [offset, setOffset] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const isHorizontal = useRef<boolean | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isHorizontal.current = null;
    setSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swiping) return;
    
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - startX.current;
    const diffY = currentY - startY.current;

    // Determine swipe direction on first significant move
    if (isHorizontal.current === null) {
      if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
        isHorizontal.current = Math.abs(diffX) > Math.abs(diffY);
      }
      return;
    }

    // Only handle horizontal swipes
    if (!isHorizontal.current) return;

    // Limit swipe range
    const maxOffset = 120;
    const resistance = 0.6;
    let newOffset = diffX * resistance;

    // Only allow directions with handlers
    if (newOffset > 0 && !onSwipeRight) newOffset = 0;
    if (newOffset < 0 && !onSwipeLeft) newOffset = 0;

    newOffset = Math.max(-maxOffset, Math.min(maxOffset, newOffset));
    setOffset(newOffset);
  };

  const handleTouchEnd = () => {
    setSwiping(false);

    if (Math.abs(offset) >= threshold) {
      if (offset > 0 && onSwipeRight) {
        onSwipeRight();
      } else if (offset < 0 && onSwipeLeft) {
        onSwipeLeft();
      }
    }

    setOffset(0);
    isHorizontal.current = null;
  };

  const showLeft = offset > 20 && rightAction;
  const showRight = offset < -20 && leftAction;

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* Background actions */}
      {rightAction && (
        <div 
          className={cn(
            "absolute inset-y-0 left-0 flex items-center justify-start px-4 transition-opacity",
            showLeft ? "opacity-100" : "opacity-0"
          )}
          style={{ width: Math.abs(offset) }}
        >
          {rightAction}
        </div>
      )}
      {leftAction && (
        <div 
          className={cn(
            "absolute inset-y-0 right-0 flex items-center justify-end px-4 transition-opacity",
            showRight ? "opacity-100" : "opacity-0"
          )}
          style={{ width: Math.abs(offset) }}
        >
          {leftAction}
        </div>
      )}

      {/* Main content */}
      <div
        className="relative bg-card touch-pan-y"
        style={{
          transform: `translateX(${offset}px)`,
          transition: swiping ? 'none' : 'transform 0.2s ease-out'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
};
