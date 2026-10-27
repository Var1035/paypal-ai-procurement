import React from "react";

interface MaterialIconProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string;
  size?: number | string;
  className?: string;
  filled?: boolean;
}

/**
 * MaterialIcon Component
 * Renders crisp Google Material Symbols icons without emoji dependencies.
 */
export const MaterialIcon: React.FC<MaterialIconProps> = ({
  name,
  size = 18,
  className = "",
  filled = false,
  style,
  ...props
}) => {
  return (
    <span
      className={`material-symbols-outlined select-none inline-flex items-center justify-center align-middle ${className}`}
      style={{
        fontSize: typeof size === "number" ? `${size}px` : size,
        width: typeof size === "number" ? `${size}px` : size,
        height: typeof size === "number" ? `${size}px` : size,
        fontVariationSettings: filled ? "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24" : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
        lineHeight: 1,
        ...style,
      }}
      aria-hidden="true"
      {...props}
    >
      {name}
    </span>
  );
};

export default MaterialIcon;
