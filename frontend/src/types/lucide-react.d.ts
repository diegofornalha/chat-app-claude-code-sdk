declare module 'lucide-react' {
  import { ComponentType, SVGProps } from 'react';
  
  export interface IconProps extends SVGProps<SVGSVGElement> {
    size?: number | string;
    absoluteStrokeWidth?: boolean;
  }
  
  // Todos os ícones que usamos no projeto
  export const Copy: ComponentType<IconProps>;
  export const RefreshCw: ComponentType<IconProps>;
  export const ThumbsUp: ComponentType<IconProps>;
  export const ThumbsDown: ComponentType<IconProps>;
  export const Share2: ComponentType<IconProps>;
  export const Bookmark: ComponentType<IconProps>;
  export const Edit: ComponentType<IconProps>;
  export const Trash2: ComponentType<IconProps>;
  export const GitBranch: ComponentType<IconProps>;
  export const ChevronLeft: ComponentType<IconProps>;
  export const ChevronRight: ComponentType<IconProps>;
  export const ChevronDown: ComponentType<IconProps>;
  export const ChevronUp: ComponentType<IconProps>;
  export const Check: ComponentType<IconProps>;
  export const Terminal: ComponentType<IconProps>;
  export const Code2: ComponentType<IconProps>;
  export const Expand: ComponentType<IconProps>;
  export const Minimize2: ComponentType<IconProps>;
  export const Brain: ComponentType<IconProps>;
  export const Activity: ComponentType<IconProps>;
  export const BookOpen: ComponentType<IconProps>;
  export const ExternalLink: ComponentType<IconProps>;
  export const Database: ComponentType<IconProps>;
  export const FileText: ComponentType<IconProps>;
  export const Lightbulb: ComponentType<IconProps>;
  export const Sparkles: ComponentType<IconProps>;
  export const ArrowRight: ComponentType<IconProps>;
  export const Users2: ComponentType<IconProps>;
  export const User: ComponentType<IconProps>;
  export const Users: ComponentType<IconProps>;
  export const Bot: ComponentType<IconProps>;
  export const Send: ComponentType<IconProps>;
  export const Paperclip: ComponentType<IconProps>;
  export const Mic: ComponentType<IconProps>;
  export const StopCircle: ComponentType<IconProps>;
  export const CheckCircle2: ComponentType<IconProps>;
  export const Circle: ComponentType<IconProps>;
  export const Clock: ComponentType<IconProps>;
  export const AlertCircle: ComponentType<IconProps>;
  export const XCircle: ComponentType<IconProps>;
  export const Zap: ComponentType<IconProps>;
  export const CheckCircle: ComponentType<IconProps>;
  export const Settings: ComponentType<IconProps>;
  export const History: ComponentType<IconProps>;
  export const Link: ComponentType<IconProps>;
}