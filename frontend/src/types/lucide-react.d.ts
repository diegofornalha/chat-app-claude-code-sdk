declare module 'lucide-react' {
  import { ComponentType, SVGProps } from 'react';
  
  export interface IconProps extends SVGProps<SVGSVGElement> {
    size?: number | string;
    absoluteStrokeWidth?: boolean;
  }
  
  export const ChevronDown: ComponentType<IconProps>;
  export const Bot: ComponentType<IconProps>;
  export const Users: ComponentType<IconProps>;
  export const Brain: ComponentType<IconProps>;
  export const Check: ComponentType<IconProps>;
  export const AlertCircle: ComponentType<IconProps>;
  export const Database: ComponentType<IconProps>;
  export const Link: ComponentType<IconProps>;
  export const Sparkles: ComponentType<IconProps>;
}
