export type CommercialProposalContactLine = {
  label: string;
  value: string;
  href?: string;
};

export type CommercialProposalMetaItem = {
  label: string;
  value: string;
};

export type CommercialProposalIncludeItem = {
  id: string;
  title: string;
  description?: string;
};

export type CommercialProposalPaymentCard = {
  id: string;
  title: string;
  amount: string;
  subtitle?: string;
  note?: string;
};

export type CommercialProposalModel = {
  currency: string;
  accentColor: string;
  business: {
    logoUrl: string | null;
    displayName: string;
    responsibleName: string | null;
    contactLines: CommercialProposalContactLine[];
  };
  documentTitle: string;
  meta: CommercialProposalMetaItem[];
  introMessage: string;
  includesTitle: string;
  includes: CommercialProposalIncludeItem[];
  investmentLabel: string;
  investmentAmount: string;
  paymentCards: CommercialProposalPaymentCard[];
  conditionsTitle: string;
  conditionsText: string;
  closingMessage: string;
  signatureName: string;
  signatureContact: string | null;
};
