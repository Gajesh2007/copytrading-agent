import Image from "next/image";

export interface ModelLogo {
  src: string;
  alt: string;
  bgColor: string;
  textColor: string;
}

export const MODEL_LOGOS: Record<string, ModelLogo> = {
  "deepseek-chat-v3.1": {
    src: "/deepseek_logo.png",
    alt: "DeepSeek V3.1",
    bgColor: "#357EDD",
    textColor: "#FFFFFF"
  },
  "qwen3-max": {
    src: "/qwen_logo.png", 
    alt: "Qwen3 Max",
    bgColor: "#8A5CFF",
    textColor: "#FFFFFF"
  },
  "grok-4": {
    src: "/Grok_logo.webp",
    alt: "Grok 4", 
    bgColor: "#111111",
    textColor: "#FFFFFF"
  },
  "gpt-5": {
    src: "/GPT_logo.png",
    alt: "Inverse GPT-5",
    bgColor: "#2BA176",
    textColor: "#FFFFFF"
  },
  "inverse-gemini": {
    src: "/Gemini_logo.webp", 
    alt: "Inverse Gemini 2.5 Pro",
    bgColor: "#397DFF", 
    textColor: "#FFFFFF"
  }
};

interface ModelLogoProps {
  modelId: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ModelLogo({ modelId, size = "md", className = "" }: ModelLogoProps) {
  const logo = MODEL_LOGOS[modelId];
  
  if (!logo) {
    return null;
  }

  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6", 
    lg: "w-8 h-8"
  };

  return (
    <div 
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center ${className}`}
      style={{ backgroundColor: logo.bgColor }}
    >
      <Image
        src={logo.src}
        alt={logo.alt}
        width={size === "sm" ? 16 : size === "md" ? 24 : 32}
        height={size === "sm" ? 16 : size === "md" ? 24 : 32}
        className="w-full h-full object-contain p-1"
      />
    </div>
  );
}
