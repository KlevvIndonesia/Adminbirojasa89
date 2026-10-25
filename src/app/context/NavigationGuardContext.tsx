import React, { createContext, useContext } from "react";

export interface CustomHeaderConfig {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  showBackButton?: boolean;
  onBack?: () => void;
  hideBreadcrumbs?: boolean;
}

export interface NavigationGuardConfig {
  isDirty: boolean;
  onDiscard?: () => void;
}

export interface NavigationGuardContextType {
  customHeader: CustomHeaderConfig | null;
  setCustomHeader: React.Dispatch<React.SetStateAction<CustomHeaderConfig | null>>;
  navigationGuard: NavigationGuardConfig | null;
  setNavigationGuard: React.Dispatch<React.SetStateAction<NavigationGuardConfig | null>>;
}

export const NavigationGuardContext = createContext<NavigationGuardContextType | null>(null);

export function useNavigationGuard(): NavigationGuardContextType {
  const context = useContext(NavigationGuardContext);
  if (!context) {
    // Return dummy fallbacks if used outside provider so component never crashes
    return {
      customHeader: null,
      setCustomHeader: () => {},
      navigationGuard: null,
      setNavigationGuard: () => {},
    };
  }
  return context;
}
