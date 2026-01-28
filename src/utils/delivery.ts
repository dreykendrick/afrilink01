export type DeliveryTier = 'local' | 'intercity' | 'unsupported';

interface DeliveryInput {
  vendorCity?: string | null;
  vendorCountry?: string | null;
  buyerCity: string;
  buyerCountry?: string;
  freeDelivery?: boolean;
}

interface DeliveryResult {
  tier: DeliveryTier;
  fee: number;
  label: string;
  estimate: string;
  isSupported: boolean;
}

const normalize = (value?: string | null) => value?.trim().toLowerCase() || '';

export const calculateDelivery = ({
  vendorCity,
  vendorCountry,
  buyerCity,
  buyerCountry,
  freeDelivery,
}: DeliveryInput): DeliveryResult => {
  if (freeDelivery) {
    return {
      tier: 'local',
      fee: 0,
      label: 'Free delivery (vendor sponsored)',
      estimate: 'Same-day or next-day delivery',
      isSupported: true,
    };
  }

  const normalizedVendorCountry = normalize(vendorCountry);
  const normalizedBuyerCountry = normalize(buyerCountry);

  if (normalizedVendorCountry && normalizedBuyerCountry && normalizedVendorCountry !== normalizedBuyerCountry) {
    return {
      tier: 'unsupported',
      fee: 0,
      label: 'International delivery not supported',
      estimate: 'Unavailable',
      isSupported: false,
    };
  }

  const normalizedVendorCity = normalize(vendorCity);
  const normalizedBuyerCity = normalize(buyerCity);

  if (normalizedVendorCity && normalizedVendorCity === normalizedBuyerCity) {
    return {
      tier: 'local',
      fee: 1500,
      label: 'Local delivery (distance-based)',
      estimate: 'Same-day or next-day delivery',
      isSupported: true,
    };
  }

  return {
    tier: 'intercity',
    fee: 5000,
    label: 'Intercity delivery (distance-based)',
    estimate: '2–5 business days',
    isSupported: true,
  };
};
