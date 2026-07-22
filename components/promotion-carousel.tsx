"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface PromotionImage {
  id: string
  image: string
  title: string
  order: number
}

export default function PromotionCarousel() {
  const [promotions, setPromotions] = useState<PromotionImage[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const loadPromotions = () => {
      const saved = localStorage.getItem("promotions")
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          console.log("[v0] PromotionCarousel loaded promotions:", parsed.length, "items")
          setPromotions(parsed)
        } catch (error) {
          console.log("[v0] Error parsing promotions:", error)
          setPromotions([])
        }
      }
    }

    loadPromotions()
    setMounted(true)

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "promotions") {
        console.log("[v0] Storage changed: promotions updated from another tab")
        loadPromotions()
      }
    }

    window.addEventListener("storage", handleStorageChange)
    return () => window.removeEventListener("storage", handleStorageChange)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const interval = setInterval(() => {
      const saved = localStorage.getItem("promotions")
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (parsed.length !== promotions.length) {
            console.log("[v0] PromotionCarousel detected change: updating from", promotions.length, "to", parsed.length)
            setPromotions(parsed)
            setCurrentIndex(0)
          }
        } catch {
          // silent
        }
      }
    }, 500)

    return () => clearInterval(interval)
  }, [mounted, promotions.length])

  useEffect(() => {
    if (promotions.length === 0) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % promotions.length)
    }, 3000)

    return () => clearInterval(interval)
  }, [promotions.length])

  if (!mounted || promotions.length === 0) return null

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + promotions.length) % promotions.length)
  }

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % promotions.length)
  }

  return (
    <div className="relative w-full bg-black rounded-lg overflow-hidden group">
      {/* 이미지 표시 */}
      <div className="relative w-full aspect-video bg-black">
        {promotions.map((promo, index) => (
          <div
            key={promo.id}
            className={`absolute inset-0 transition-opacity duration-500 ${
              index === currentIndex ? "opacity-100" : "opacity-0"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={promo.image || "/placeholder.svg"}
              alt={promo.title || "프로모션"}
              className="w-full h-full object-contain bg-black"
            />
            {/* 어두운 오버레이 */}
            <div className="absolute inset-0 bg-black/20" />
            {/* 제목 표시 */}
            {promo.title && (
              <div className="absolute inset-0 flex items-center justify-center">
                <h3 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white text-center drop-shadow-lg px-4">
                  {promo.title}
                </h3>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 네비게이션 버튼 */}
      {promotions.length > 1 && (
        <>
          <button
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
            aria-label="이전"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
            aria-label="다음"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* 인디케이터 */}
      {promotions.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {promotions.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex ? "bg-white w-6" : "bg-white/50 hover:bg-white/70"
              }`}
              aria-label={`이미지 ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
