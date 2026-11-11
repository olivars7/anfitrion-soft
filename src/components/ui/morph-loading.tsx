"use client"

interface UniqueLoadingProps {
  variant?: "morph"
  size?: "sm" | "md" | "lg"
  className?: string
}

export default function UniqueLoading({
  variant = "morph",
  size = "md",
  className = "",
}: UniqueLoadingProps) {
  const containerSizes = {
    sm: "w-16 h-16",
    md: "w-20 h-20",
    lg: "w-24 h-24",
  }

  if (variant === "morph") {
    return (
      <div className={`relative ${containerSizes[size]} ${className}`}>
        <div className="absolute inset-0 flex items-center justify-center">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="absolute w-3 h-3 bg-white"
              style={{
                animation: `morph-${i} 2s infinite ease-in-out`,
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>
    )
  }

  return null
}
