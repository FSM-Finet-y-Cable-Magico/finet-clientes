"use client";

import { useState, type CSSProperties } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

const SLIDES = [
  {
    id: 1,
    title: "Internet de Alta Velocidad",
    subtitle:
      "Planes de Fibra Optica desde 200 Mbps hasta 900 Mbps simetricos.",
    image: "/hero/slide-1.webp",
    overlayClass: "bg-[var(--color-hero-slide-1)]/25",
  },
  {
    id: 2,
    title: "Television Digital HD",
    subtitle: "Agrega entretenimiento a tu hogar con nuestros planes Duo.",
    image: "/hero/slide-2.webp",
    overlayClass: "bg-[var(--color-hero-slide-2)]/20",
  },
];

export const Hero = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev === 0 ? SLIDES.length - 1 : prev - 1));
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev === SLIDES.length - 1 ? 0 : prev + 1));
  };

  const isReduced =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  return (
    <section
      aria-roledescription="carrusel"
      aria-label="Planes destacados"
      className="relative w-full h-[60vh] md:h-[70vh] overflow-hidden bg-surface"
    >
      <div
        className="flex h-full w-full"
        style={
          {
            transform: `translateX(-${currentIndex * 100}%)`,
            transition: isReduced ? "none" : "transform 400ms ease-in-out",
          } satisfies CSSProperties
        }
      >
        {SLIDES.map((slide, index) => {
          const isActive = index === currentIndex;
          return (
            <div
              key={slide.id}
              role="group"
              aria-roledescription="diapositiva"
              aria-label={`Diapositiva ${index + 1} de ${SLIDES.length}`}
              aria-hidden={!isActive}
              className={`relative shrink-0 w-full h-full flex items-center justify-center`}
            >
              {slide.image && (
                <>
                  <Image
                    src={slide.image}
                    // Decorativa: el titulo y subtitulo ya dicen todo lo que
                    // la foto aporta.
                    alt=""
                    fill
                    priority={isActive}
                    sizes="100vw"
                    className="object-cover"
                  />
                  {/* Tinte de marca (mismo tono que el fondo solido de este
                      slide) + un blur leve, para que el texto blanco resalte
                      sobre la foto y las fotos queden consistentes entre si. */}
                  <div
                    className={`absolute inset-0 backdrop-blur-sm ${slide.overlayClass}`}
                    aria-hidden
                  />
                </>
              )}
              <div className="relative z-10 text-center px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
                <h2 className="text-3xl md:text-5xl lg:text-6xl font-extrabold text-white tracking-tight mb-4 drop-shadow-md">
                  {slide.title}
                </h2>
                <p className="text-lg md:text-xl text-white/80 mb-8 max-w-2xl mx-auto drop-shadow-sm">
                  {slide.subtitle}
                </p>

                <a
                  href="/planes"
                  tabIndex={isActive ? 0 : -1}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-8 py-3 text-base font-bold text-background hover:bg-primary-bright transition-colors shadow-lg shadow-primary/25"
                >
                  Ver Planes
                </a>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={prevSlide}
        className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white backdrop-blur-sm transition-all focus:outline-none focus:ring-2 focus:ring-white"
        aria-label="Diapositiva anterior"
      >
        <ChevronLeft size={32} aria-hidden />
      </button>
      <button
        onClick={nextSlide}
        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white backdrop-blur-sm transition-all focus:outline-none focus:ring-2 focus:ring-white"
        aria-label="Diapositiva siguiente"
      >
        <ChevronRight size={32} aria-hidden />
      </button>

      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 flex space-x-3 z-20"
        role="tablist"
        aria-label="Navegacion del carrusel"
      >
        {SLIDES.map((_, index) => (
          <button
            key={index}
            role="tab"
            aria-selected={currentIndex === index}
            onClick={() => setCurrentIndex(index)}
            className={`w-3 h-3 rounded-full transition-all duration-300 ${
              currentIndex === index
                ? "bg-white scale-125"
                : "bg-white/50 hover:bg-white/80"
            }`}
            aria-label={`Ir a la diapositiva ${index + 1}`}
          />
        ))}
      </div>
    </section>
  );
};
