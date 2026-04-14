"use client";
import Image from "next/image";
import React, { useRef, useEffect, useState } from "react";
import AnimatedText from "../../custom/AnimatedText";
import AnimatedSection from "@/components/custom/AnimatedSection";

const VIDEO_PATH =
  "https://res.cloudinary.com/dy4opvh1v/video/upload/v1761572351/uri_ifs___V_Tv-oqSq8BDfblNGdhzoGOmsDns3006hrFayXpKHweGk_txsrja.mp4";
const PHONE_FRAME_PATH = "/assets/images/mobile1.png";

const list = [
  {
    description: "50% of Every Sale Goes to You",
  },
  {
    description: "No Upfront Costs or Minimum Orders",
  },
  {
    description: "Sample Box Provided for Free",
  },
  {
    description: "Premium Sweets in popular flavor",
  },
];

const WhyChose = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const [isMuted, setIsMuted] = useState(true);

  // Toggle mute/unmute
  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.muted) {
      // Unmute
      video.muted = false;
      setIsMuted(false);
      video.play().catch((error) => {
        console.error("Could not play video with audio:", error);
        // Fallback to muted if unmuted play fails
        video.muted = true;
        setIsMuted(true);
        video.play().catch(() => {});
      });
    } else {
      // Mute
      video.muted = true;
      setIsMuted(true);
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    const section = sectionRef.current;

    if (!video || !section) return;

    // Ensure video plays when visible
    const ensureVideoPlaying = () => {
      if (video.paused) {
        video.muted = true; // Keep muted for autoplay
        video.play().catch(() => {});
      }
    };

    // Intersection observer to play when section is visible
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            ensureVideoPlaying();
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: "100px",
      }
    );

    observer.observe(section);

    // Check if section is visible on mount
    const checkVisibility = () => {
      const rect = section.getBoundingClientRect();
      const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
      if (isVisible) {
        ensureVideoPlaying();
      }
    };

    // Try to play immediately
    video.load();
    checkVisibility();
    setTimeout(checkVisibility, 300);

    // Handle video loaded
    const handleCanPlay = () => {
      ensureVideoPlaying();
    };

    video.addEventListener("canplay", handleCanPlay);

    // Cleanup
    return () => {
      observer.disconnect();
      video.removeEventListener("canplay", handleCanPlay);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="h-fit w-full bg-[url('/assets/images/3bg.png')] bg-cover bg-no-repeat bg-center bg-fixed flex items-center justify-center px-4 md:px-8 py-10 md:py-20"
    >
      <AnimatedSection
        animationType="slideUp"
        duration={0.5}
        delay={0.2}
        className="w-full flex flex-col lg:flex-row items-center justify-between gap-8 md:gap-12 lg:gap-16 max-w-7xl mx-auto"
      >
        {/* Image Section */}
        <div className="w-full lg:w-1/2 flex items-center justify-center mb-8 lg:mb-0">
          <div className="relative w-full max-w-xs md:max-w-md lg:max-w-lg aspect-[9/16]">
            {/* Phone Frame Image */}
            <Image
              src={PHONE_FRAME_PATH}
              alt="phone frame"
              fill={true}
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="z-10 object-contain absolute"
            />
            <video
              ref={videoRef}
              key={VIDEO_PATH}
              autoPlay
              loop
              muted={isMuted}
              playsInline
              preload="auto"
              className="relative"
              style={{
                top: "3.5%",
                left: "4.5%",
                width: "90.5%",
                height: "92%",
                borderRadius: "30px",
                objectFit: "cover",
              }}
            >
              <source src={VIDEO_PATH} type="video/mp4" />
              Your browser does not support the video tag.
            </video>

            {/* Mute/Unmute Icon Button - Bottom Right Corner */}
            <button
              onClick={toggleMute}
              className="absolute z-20 w-16 h-16 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 shadow-lg border border-white/20"
              aria-label={isMuted ? "Unmute video" : "Mute video"}
              style={{
                bottom: "calc(4.5% + 16px)",
                right: "calc(5% + 16px)",
              }}
            >
              {isMuted ? (
                // Muted Icon (speaker with slash)
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="2.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M1.5 1.5l22 22"
                  />
                </svg>
              ) : (
                // Unmuted Icon (speaker with waves)
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="2.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Content Section */}
        <div className="w-full lg:w-1/2 flex flex-col items-start justify-start gap-6">
          <AnimatedText
            text="Why Choose Us for Your Next Fundraiser?"
            className="text-3xl md:text-5xl lg:text-6xl font-inter font-bold max-w-full md:max-w-2xl relative z-10 text-white"
            splitBy="word"
            duration={0.3}
            stagger={0.1}
          />
          <ul className="flex flex-col items-start justify-start gap-3 md:gap-4 w-full list-disc list-inside">
            {list.map((item, index) => (
              <li
                key={index}
                className="text-white text-base md:text-lg font-medium leading-relaxed"
              >
                {item.description}
              </li>
            ))}
          </ul>
          {/* Stats Section */}
          {/* <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-8 py-10">
                        <div className="flex flex-col items-center sm:items-start justify-start gap-2 w-full sm:w-1/2">
                            <h1 className="text-white text-4xl md:text-5xl lg:text-6xl font-inter font-bold">
                                120K
                            </h1>
                            <h6 className="text-white text-base md:text-lg font-medium leading-relaxed">
                                Organizations
                            </h6>
                        </div>
                        <div className="flex flex-col items-center sm:items-start justify-start gap-2 w-full sm:w-1/2">
                            <h1 className="text-white text-4xl md:text-5xl lg:text-6xl font-inter font-bold">
                                8.990
                            </h1>
                            <h6 className="text-white text-base md:text-lg font-medium leading-relaxed">
                                Project Done
                            </h6>
                        </div>
                    </div> */}
        </div>
      </AnimatedSection>
    </section>
  );
};

export default WhyChose;
