import { Helmet, HelmetProvider } from "react-helmet-async";

import { TooltipProvider } from "@/components/ui/tooltip";

const PageMeta = ({ title, description }) => (
  <Helmet>
    <title>{title}</title>
    <meta name="description" content={description} />
  </Helmet>
);

export const AppWrapper = ({ children }) => (
  <HelmetProvider>
    <TooltipProvider>{children}</TooltipProvider>
  </HelmetProvider>
);

export default PageMeta;
