import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, Globe, Megaphone, Store, Sparkles, LucideIcon } from 'lucide-react';

interface OnboardingCarouselProps {
  onComplete: () => void;
}

interface Slide {
  headline: string;
  subtext: string;
  icon: LucideIcon;
}

const slides: Slide[] = [
  {
    headline: 'Welcome to Winger',
    subtext: "Africa's first homegrown affiliate marketplace.",
    icon: Globe,
  },
  {
    headline: 'Sell without chasing customers',
    subtext: 'List your products once. Affiliates promote them everywhere.',
    icon: Store,
  },
  {
    headline: 'Promote. Share. Earn.',
    subtext: 'Earn commissions by sharing products you believe in.',
    icon: Megaphone,
  },
  {
    headline: 'No barriers. Just opportunity.',
    subtext: "Browse products. See earnings. Join when you're ready.",
    icon: Sparkles,
  },
];

export const OnboardingCarousel = ({ onComplete }: OnboardingCarouselProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const totalSlides = slides.length;

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;
    const index = Math.round(container.scrollLeft / container.clientWidth);
    setActiveIndex(index);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onScroll = () => handleScroll();
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  const goToSlide = (index: number) => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollTo({
      left: container.clientWidth * index,
      behavior: 'smooth',
    });
  };

  const handleSkip = () => {
    goToSlide(totalSlides - 1);
    setTimeout(onComplete, 300);
  };

  const dots = useMemo(
    () =>
      Array.from({ length: totalSlides }, (_, index) => (
        <button
          key={index}
          type="button"
          aria-label={`Go to slide ${index + 1}`}
          onClick={() => goToSlide(index)}
          className={`h-2.5 w-2.5 rounded-full transition-all ${
            activeIndex === index ? 'bg-foreground w-6' : 'bg-muted-foreground/30'
          }`}
        />
      )),
    [activeIndex, totalSlides],
  );

  return (
    <div className="min-h-screen bg-gradient-hero text-foreground flex flex-col">
      <div className="flex items-center justify-between px-5 pt-6">
        <div className="text-sm font-semibold tracking-wide text-foreground/60">Winger</div>
        <Button variant="ghost" size="sm" onClick={handleSkip} className="text-foreground/80">
          Skip
        </Button>
      </div>

      <div
        ref={containerRef}
        className="flex-1 flex overflow-x-auto snap-x snap-mandatory scroll-smooth"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {slides.map((slide, index) => {
          const Icon = slide.icon;
          return (
            <div
              key={slide.headline}
              className="min-w-full snap-center flex items-center justify-center px-6 py-10"
            >
              <div className="max-w-xl text-center space-y-4 animate-in fade-in slide-in-from-bottom-6 duration-700">
                <div className="flex justify-center mb-2">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Icon className="w-7 h-7 text-primary" />
                  </div>
                </div>
                <h1 className="text-2xl sm:text-4xl font-bold">{slide.headline}</h1>
                <p className="text-sm sm:text-lg text-foreground/70">{slide.subtext}</p>
                {index === totalSlides - 1 && (
                  <Button
                    onClick={onComplete}
                    size="lg"
                    className="mt-6 w-full sm:w-auto px-8 py-6 text-base sm:text-lg rounded-xl shadow-glow"
                  >
                    Get Started
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-2 pb-8">{dots}</div>
    </div>
  );
};
